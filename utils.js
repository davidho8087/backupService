import fs from 'fs-extra';
import {parse} from 'csv-parse';
import logger from "./lib/logger.js";
import prisma from "./lib/prismaClient.js";
import path from "path";
import async from 'async';

/**
 * Ensures that the specified directory exists. If the directory does not exist,
 * it will be created.
 *
 * @async
 * @param {string} path The path to the directory to check or create.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function ensureDirectoryExists(path) {
    try {
        // Check if the directory exists
        const exists = await fs.pathExists(path);

        if (!exists) {
            // Create the directory if it does not exist
            await fs.ensureDir(path);
            logger.info(`Directory created: ${path}`);
        } else {
            logger.info(`Verify Directory: ${path}, CHECKED!`);
        }
    } catch (error) {
        logger.error(`Error ensuring directory exists: ${path}`, error);
        throw error;
    }
}

/**
 * Asynchronously moves a zip file from one location to another.
 *
 * @async
 * @param {string} sourcePath - The path of the zip file to be moved.
 * @param {string} destinationPath - The path of the destination where the zip file should be moved.
 * @throws Will throw an error if the file cannot be moved.
 * @returns {Promise<void>} A Promise that resolves when the zip file has been moved.
 */
export async function moveZipFile(sourcePath, destinationPath) {
    try {
        await fs.move(sourcePath, destinationPath);
        logger.info(`Zip file moved to: ${destinationPath}`);
    } catch (error) {
        logger.error('Error moving zip file:', error);
        throw error;
    }
}

/**
 * Prepares the environment by ensuring that the specified directories exist. If the directories
 * do not exist, they are created. This function is critical for setting up the necessary file
 * system structure before processing begins, including locations for successful operations and error handling.
 *
 * @async
 * @param {Object} configPath - An object containing paths that need to be verified and potentially created.
 * @param {string} configPath.folderToZipPath - The path to the directory where files will be zipped.
 * @param {string} configPath.destinationPath - The path to the directory where zipped files will be moved.
 * @param {string} configPath.errorFolderPath - The path to the directory where erroneous files or logs will be stored.
 * @throws {Error} - Throws an error if there is an issue creating the directories.
 */
export async function prepareEnvironment(configPath) {
    const {folderToZipPath, destinationPath, errorFolderPath, dbInsertionErrorFolderPath} = configPath;
    try {
        logger.info('Verify folder existence');
        await ensureDirectoryExists(folderToZipPath);
        await ensureDirectoryExists(destinationPath);
        await ensureDirectoryExists(errorFolderPath);
        await ensureDirectoryExists(dbInsertionErrorFolderPath);
    } catch (error) {
        logger.error('Error preparing the environment:', error);
        throw error;
    }
}

/**
 * Validates the scheduling configuration to ensure exactly one scheduling option is set.
 * Throws an error if zero or more than one scheduling option is set.
 *
 * @async
 * @param {Object} config - The scheduling configuration object.
 * @throws {Error} If zero or more than one scheduling option is set.
 */
export function validateSchedulingConfig(config) {
    const {dailyAt, everyXHours, everyXMinutes} = config;

    // Count how many scheduling options are set
    const optionsSet = [dailyAt, everyXHours, everyXMinutes].filter(item => item != null).length;

    // Check if exactly one scheduling option is set
    if (optionsSet !== 1) {
        throw new Error("Invalid scheduling configuration: exactly one of 'dailyAt', 'everyXHours', or 'everyXMinutes' shall be set.");
    }

    logger.info("Scheduling configuration is valid.");
}

/**
 * Empties the contents of a given directory but leaves the directory intact.
 * If the directory does not exist, it will be created.
 *
 * @async
 * @param {string} directoryPath - The path to the directory to empty.
 */
export async function emptyDirectory(directoryPath) {
    try {
        await fs.emptyDir(directoryPath);
        logger.info(`All files in ${directoryPath} have been successfully deleted.`);
    } catch (error) {
        logger.error(`Error deleting files in directory ${directoryPath}:`, error);
        throw error;
    }
}


/**
 * Checks asynchronously if a directory is not empty.
 *
 * This function reads the contents of a specified directory and returns a promise that resolves
 * to `true` if the directory contains one or more files or folders, or `false` if it is empty.
 * If an error occurs during reading the directory (e.g., the directory does not exist), the promise
 * rejects with an error.
 *
 * @async
 * @param {string} dirPath - The path to the directory to check.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the directory is not empty,
 *                             otherwise `false`.
 */
export async function isDirectoryNotEmpty(dirPath) {
    return new Promise((resolve, reject) => {
        fs.readdir(dirPath, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files.length > 0);
            }
        });
    });
}


/**
 * Determines the field mapping for a file based on its filename and a configuration object.
 *
 * This function analyzes a filename by splitting it into parts using an underscore as the delimiter.
 * It then iterates through a mapping object provided in the configuration, checking if a part of the filename
 * at a specific index (defined by the configuration) matches a key in the mapping. If a match is found,
 * it returns the corresponding fields from the configuration. If no match is found after evaluating all entries,
 * it returns null.
 *
 * @param {string} filename - The filename to analyze for field mapping.
 * @param {Object} config - A configuration object containing the mapping of file parts to fields.
 * @returns {Object|null} The field mapping if a match is found; otherwise, null.
 */
function determineFieldMapping(filename, config) {
    const parts = filename.split('_');
    for (const [key, value] of Object.entries(config.FILE_FIELD_MAP)) {
        if (parts[value.spacing] === key) {
            return value.fields;
        }
    }
    return null; // No matching configuration found
}


/**
 * Adds an error file's paths to a queue for processing.
 *
 * This function extracts the filename from the provided file path, combines it with the folder path to
 * form a new target path, and adds both the original file path and the new target path to the error queue.
 *
 * @param {Array} errorQueue - The queue where error file paths are stored for processing.
 * @param {string} filePath - The full path of the file that encountered an error.
 * @param {string} folderPath - The target folder path where the error file should be relocated.
 */
function queueErrorFile(errorQueue, filePath, folderPath) {
    const fileName = path.basename(filePath);
    const targetPath = path.join(folderPath, fileName);
    errorQueue.push({sourcePath: filePath, targetPath});
}


/**
 * Constructs a data object from specified fields and a content column.
 *
 * This function iterates over a list of fields and checks if each field exists in the content column.
 * If a field exists, it is added to the data object. Specific fields like "duration" and "count"
 * are converted to float and integer respectively, with a fallback value of 0 if conversion fails.
 *
 * @param {string[]} fields - Array of field names to include in the data object.
 * @param {Object} contentColumn - Object containing the data values for fields.
 * @returns {Object} The constructed data object populated with values from contentColumn.
 */
function constructDataObject(fields, contentColumn) {
    let dataObject = {};
    fields.forEach(field => {
        if (field in contentColumn) {
            let value = contentColumn[field];
            if (field === "duration" || field === "count") {
                // Convert duration to float and count to int with fallbacks
                value = field === "duration" ? parseFloat(value) || 0 : parseInt(value) || 0;
            }
            dataObject[field] = value;
        }
    });
    return dataObject;
}

/**
 * Validates if the specified fields exist in the data object.
 *
 * This function checks each field listed in `requiredFields` to determine
 * if they exist in `dataObject`. If any required field is missing,
 * an error message is added to an array. The function returns null
 * if no errors are found, otherwise it returns an array of error messages.
 *
 * @param {Object} dataObject - The data object to validate.
 * @param {string[]} requiredFields - An array of strings representing the names of required fields.
 * @returns {null | string[]} Returns null if all required fields are present, otherwise returns an array of error messages.
 */
function validateData(dataObject, requiredFields) {
    const errors = [];
    requiredFields.forEach(field => {
        if (!(field in dataObject)) {
            errors.push(`Missing required field: ${field}`);
        }
    });
    return errors.length > 0 ? errors : null;
}


/**
 * Processes files within a specified folder according to configuration settings.
 *
 * This function reads files from a specified directory (`folderToZipPath` from the config),
 * and processes each file according to field mappings defined in the config. It validates,
 * parses, and inserts each file's data into a database. Files with errors in parsing, validation,
 * or database insertion are moved to specific error directories. The function manages file
 * processing with controlled concurrency based on the `BATCH_SIZE` setting.
 *
 * If a file does not match the expected field configuration or other errors occur during its processing,
 * it is queued for error handling. This function uses async queues for error processing and handles
 * these with concurrency limits. After processing, it checks and waits for all error handling tasks
 * to complete.
 *
 * @param {Object} config - Configuration object containing settings like `BATCH_SIZE`, directories for error handling,
 *                          database settings, and field mappings for parsing files.
 * @returns {Promise<void>} A promise that resolves when all files are processed and all error tasks are handled.
 *                          Logs various statuses and errors throughout the process.
 */

export async function processFiles(config) {
    try {
        const {BATCH_SIZE, errorFolderPath, dbInsertionErrorFolderPath, folderToZipPath} = config;

        // Configuration for error handling
        const errorQueue = async.queue(async (task, callback) => {
            try {
                await fs.move(task.sourcePath, task.targetPath);
                logger.info(`Successfully moved erroneous file to: ${task.targetPath}`);
            } catch (error) {
                logger.error(`Failed to move erroneous file: ${task.sourcePath} to ${task.targetPath}. Error: ${error.message}`);            } finally {
                callback();
            }
        }, BATCH_SIZE); // Limited concurrency for error processing



        const files = await fs.promises.readdir(folderToZipPath);

        if (!files.length) {
            logger.info('No files found to process. Exiting.');
            return;  // Exit early if no files to process
        }


        const tasks = files.map(file => {
            return async () => { // Make sure to return a function for async.parallelLimit
                const filePath = path.join(folderToZipPath, file);
                const matchedMappedFields = determineFieldMapping(file, config);

                if (!matchedMappedFields) {
                    logger.warn(`No field configuration found for file: ${file}. Skipping file.`);
                    return; // Skip processing this file
                }

                const parser = fs.createReadStream(filePath)
                    .pipe(parse({
                        columns: matchedMappedFields,
                        trim: true,
                        skip_empty_lines: false
                    }));

                parser.on('error', error => {
                    logger.error(`Parsing error in file ${file}: ${error.message}. Terminating parser.`);
                    queueErrorFile(errorQueue, filePath, errorFolderPath);
                    parser.destroy();
                });

                try {
                    for await (const contentColumn of parser) {
                        logger.debug(`Processing row in file ${file}: ${JSON.stringify(contentColumn)}`);
                        let dataObject;
                        try {
                            // Attempt to dynamically construct a data object from the content column
                            dataObject = constructDataObject(matchedMappedFields, contentColumn);
                        } catch (error) {
                            // Log the error if constructing the data object fails
                            logger.error(`Error constructing data object for file ${file}: ${error.message}`);
                            queueErrorFile(errorQueue, filePath, errorFolderPath);
                            continue; // Skip this record and continue with the next one
                        }

                        // Validate the constructed data object
                        const errors = validateData(dataObject, matchedMappedFields);
                        if (errors) {
                            // Log validation errors and queue the file for error processing
                            logger.warn(`Validation errors in file ${file}: ${errors.join(', ')}. Skipping row.`);
                            queueErrorFile(errorQueue, filePath, errorFolderPath);
                            continue; // Skip this record and continue with the next one
                        }

                        // Attempt to insert the validated data into the database
                        try {
                            await prisma.detection.create({data: dataObject});
                            logger.info(`Successfully inserted data for file ${file}.`);
                        } catch (error) {
                            logger.error(`Database insertion error for file ${file}: ${error.message}. Data: ${JSON.stringify(dataObject)}`);
                            queueErrorFile(errorQueue, filePath, dbInsertionErrorFolderPath);
                        }
                    }
                    logger.info(`Completed processing the file: ${file}`);
                } catch (error) {
                    logger.error(`Unhandled error during the processing of file ${file}: ${error.message}`);
                }
            };
        });
        // Execute all tasks with controlled concurrency
        await async.parallelLimit(tasks, BATCH_SIZE);
        logger.info(`Initial processing complete. Queue Length: ${errorQueue.length()}, Running Tasks: ${errorQueue.running()}`);
        // Check if there are remaining or currently processed tasks
        if (errorQueue.length() + errorQueue.running() > 0) {
            await new Promise(resolve => errorQueue.drain(resolve));
            logger.info('All error handling tasks completed. Error queue drained.');
        } else {
            logger.info('No errors encountered during file process, skipping error queue draining.');
        }


    } catch (error) {
        logger.error(`Critical error in processFiles: ${error.message}`);
    }
}
