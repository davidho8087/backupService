import fs from 'fs-extra';
import {parse} from 'csv-parse';
import logger from "./lib/logger.js";
import prisma from "./lib/prismaClient.js";
import path from "path";
import async from 'async';
import {parseISO} from "date-fns";

/**
 * Ensures that the specified directory exists. If the directory does not exist,
 * it will be created.
 *
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
 * Add a file move operation to the queue.
 */
function queueErrorFile(errorQueue, filePath, folderPath) {
    const fileName = path.basename(filePath);
    const targetPath = path.join(folderPath, fileName);
    errorQueue.push({sourcePath: filePath, targetPath});
}

function constructDataObject(fields, contentColumn) {
    let dataObject = {};
    fields.forEach(field => {
        if (field in contentColumn) {
            // You can include additional logic to handle different data types or default values here
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

function validateData(dataObject, requiredFields) {
    const errors = [];
    requiredFields.forEach(field => {
        if (!(field in dataObject)) {
            errors.push(`Missing required field: ${field}`);
        }
    });
    return errors.length > 0 ? errors : null;
}

export async function processFiles(config) {
    try {
        logger.info('Processing files...');
        const {BATCH_SIZE, errorFolderPath, dbInsertionErrorFolderPath, folderToZipPath} = config;

        // Configuration for error handling
        const errorQueue = async.queue(async (task, callback) => {
            try {
                logger.info(`Moving file ${task.sourcePath} to ${task.targetPath}`);
                await fs.move(task.sourcePath, task.targetPath);
                logger.info(`Moved erroneous file to: ${task.targetPath}`);
            } catch (error) {
                logger.error(`Failed to move erroneous file: ${task.sourcePath} to error directory: ${error.message}`);
            } finally {
                callback();
            }
        }, BATCH_SIZE); // Limited concurrency for error processing



        const files = await fs.promises.readdir(folderToZipPath);

        if (!files.length) {
            logger.info('No files to process.');
            return;  // Exit early if no files to process
        }


        const tasks = files.map(file => {
            return async () => { // Make sure to return a function for async.parallelLimit
                const filePath = path.join(folderToZipPath, file);


                const matchedMappedFields = determineFieldMapping(file, config);
                if (!matchedMappedFields) {
                    logger.error(`No field configuration found for file: ${file}`);
                    return; // Skip processing this file
                }

                const parser = fs.createReadStream(filePath)
                    .pipe(parse({
                        columns: matchedMappedFields,
                        trim: true,
                        skip_empty_lines: false
                    }));

                parser.on('error', error => {
                    logger.error(`Error parsing file ${file}: ${error.message}`);
                    queueErrorFile(errorQueue, filePath, errorFolderPath);
                    logger.info(`Destroying parser for file: ${file}`);
                    parser.destroy();
                });

                try {

                    for await (const contentColumn of parser) {
                        logger.info(`Processing data for file ${file}:`, contentColumn);

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
                            logger.error(`Validation errors for file ${file}: ${errors.join(', ')}`);
                            queueErrorFile(errorQueue, filePath, errorFolderPath);
                            continue; // Skip this record and continue with the next one
                        }

                        // Attempt to insert the validated data into the database
                        try {
                            await prisma.detection.create({data: dataObject});
                            logger.info(`Data for file ${file} inserted successfully.`);
                        } catch (error) {
                            // Handle database insertion errors, log them, and queue the file for error handling
                            logger.error(`Error during insert into db with file ${file}: ${error.message}`);
                            queueErrorFile(errorQueue, filePath, dbInsertionErrorFolderPath);
                        }
                    }
                    logger.info(`Completed processing the file: ${file}`);
                } catch (error) {
                    logger.error(`Error processing the file ${file}: ${error.message}`);
                }
            };
        });
        // Execute all tasks with controlled concurrency
        await async.parallelLimit(tasks, BATCH_SIZE);
        logger.info(`Queue Length: ${errorQueue.length()}, Running: ${errorQueue.running()}`);
        // Check if there are remaining or currently processed tasks
        if (errorQueue.length() + errorQueue.running() > 0) {
            await new Promise(resolve => errorQueue.drain(resolve));
            logger.info('Error queue has been completely drained.');
        } else {
            logger.info('No errors encountered during file process, skipping error queue draining.');
        }


    } catch (error) {
        logger.error(`Error on processing files: ${error.message}`);
        throw error;
    }
}
