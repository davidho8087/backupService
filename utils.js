const fs = require('fs-extra');
const parse = require('csv-parse').parse;
const logger = require('./lib/logger.js');
const prisma = require('./lib/prismaClient.js');
const path = require('path');
const async = require('async');


async function testPrismaConnection() {
  try {
    const detections = await prisma.detection.findMany({
      take: 1 // Limits the query to 5 items for testing
    });
    logger.info(`Prisma connection test passed. Found ${detections.length} detections limit with 1 record.`);
  } catch (error) {
    logger.error('Prisma connection test failed', { error });
    throw error; // Rethrow to handle the error outside
  }
}

/**
 * Ensures that the specified directory exists. If the directory does not exist,
 * it will be created.
 *
 * @async
 * @param {string} directoryPath - The path to the directory to check or create.
 * @throws {Error} Will throw an error if there is an issue ensuring directory existence.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
async function ensureDirectoryExists(directoryPath) {
  return fs
    .pathExists(directoryPath)
    .then((exists) => {
      if (!exists) {
        return fs
          .ensureDir(directoryPath)
          .then(() => logger.info(`Directory created: ${directoryPath}`));
      } else {
        logger.info(`Verify Directory: ${directoryPath}, CHECKED!`);
      }
    })
    .catch((error) => {
      logger.error(`Error ensuring directory exists: ${directoryPath}`, error);
      throw error;
    });
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
async function moveZipFile(sourcePath, destinationPath) {
  return fs
    .move(sourcePath, destinationPath)
    .then(() => logger.info(`Zip file moved to: ${destinationPath}`))
    .catch((error) => {
      logger.error('Error moving zip file:', error);
      throw error;
    });
}

/**
 * Prepares the environment by ensuring that the specified directories exist. If the directories
 * do not exist, they are created. This function is critical for setting up the necessary file
 * system structure before processing begins, including locations for successful operations and error handling.
 *
 * @async
 * @param {Object} configPath - An object containing paths that need to be verified and potentially created.
 * @param {string} configPath.sourceZipDirectory - The path to the directory where files will be zipped.
 * @param {string} configPath.destinationZipDirectory - The path to the directory where zipped files will be moved.
 * @param {string} configPath.miscErrorDirectory - The path to the directory where miscellaneous errors or logs will be stored.
 * @param {string} configPath.dbInsertionErrorDirectory - The path to the directory where database insertion errors or logs will be stored.
 * @param {string} configPath.fieldConfigErrorDirectory - The path to the directory where field configuration errors or logs will be stored.
 * @throws {Error} - Throws an error if there is an issue creating the directories.
 */
async function prepareEnvironment(configPath) {
  const {
    sourceZipDirectory,
    destinationZipDirectory,
    miscErrorDirectory,
    dbInsertionErrorDirectory,
    fieldConfigErrorDirectory,
  } = configPath;
  return Promise.all([
    ensureDirectoryExists(sourceZipDirectory),
    ensureDirectoryExists(destinationZipDirectory),
    ensureDirectoryExists(miscErrorDirectory),
    ensureDirectoryExists(dbInsertionErrorDirectory),
    ensureDirectoryExists(fieldConfigErrorDirectory),
  ]).catch((error) => {
    logger.error('Error preparing the environment:', error);
    throw error;
  });
}
/**
 * Validates the scheduling configuration to ensure exactly one scheduling option is set.
 * Throws an error if zero or more than one scheduling option is set.
 *
 * @param {Object} config - The scheduling configuration object.
 * @throws {Error} If zero or more than one scheduling option is set.
 */
function validateSchedulingConfig(config) {
  const { dailyAt, everyXHours, everyXMinutes } = config;
  const optionsSet = [dailyAt, everyXHours, everyXMinutes].filter(
    (item) => item != null
  ).length;
  if (optionsSet !== 1) {
    throw new Error(
      "Invalid scheduling configuration: exactly one of 'dailyAt', 'everyXHours', or 'everyXMinutes' must be set."
    );
  }
  logger.info('Scheduling configuration is valid.');
}

/**
 * Empties the contents of a given directory but leaves the directory intact.
 * If the directory does not exist, it will be created.
 *
 * @async
 * @param {string} directoryPath - The path to the directory to empty.
 * @throws {Error} - Throws an error if there is an issue emptying the directory.
 */
async function emptyTheDirectory(directoryPath) {
  return fs
    .emptyDir(directoryPath)
    .then(() =>
      logger.info(
        `All files in ${directoryPath} have been successfully deleted.`
      )
    )
    .catch((error) => {
      logger.error(
        `Error deleting files in directory ${directoryPath}:`,
        error
      );
      throw error;
    });
}

/**
 * Checks asynchronously if a directory is not empty.
 *
 * This function reads the contents of a specified directory and returns a promise that resolves
 * to `true` if the directory contains one or more files or directory, or `false` if it is empty.
 * If an error occurs during reading the directory (e.g., the directory does not exist), the promise
 * rejects with an error.
 *
 * @async
 * @param {string} directoryPath - The path to the directory to check.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the directory is not empty,
 *                             otherwise `false`.
 */
function isDirectoryNotEmpty(directoryPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) reject(err);
      else resolve(files.length > 0);
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
  fields.forEach((field) => {
    if (field in contentColumn) {
      let value = contentColumn[field];
      if (field === 'duration' || field === 'count') {
        // Convert duration to float and count to int with fallbacks
        value =
          field === 'duration' ? parseFloat(value) || 0 : parseInt(value) || 0;
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
  requiredFields.forEach((field) => {
    if (!(field in dataObject)) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  return errors.length > 0 ? errors : null;
}

/**
 * Adds an error file's paths to a queue for processing.
 *
 * This function extracts the filename from the provided file path, combines it with the directory path to
 * form a new target path, and adds both the original file path and the new target path to the error queue.
 *
 * @param {Array} errorQueue - The queue where error file paths are stored for processing.
 * @param {string} filePath - The full path of the file that encountered an error.
 * @param {string} directoryPath - The target directory path where the error file should be relocated.
 */
function queueErrorFile(errorQueue, filePath, directoryPath) {
  const fileName = path.basename(filePath);
  const targetPath = path.join(directoryPath, fileName);
  errorQueue.push({ sourcePath: filePath, targetPath });
}

/**
 * Processes files within a specified directory according to configuration settings.
 *
 * This function reads files from a specified directory (`sourceZipDirectory` from the config),
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

async function processFiles(config) {
  try {
    const {
      BATCH_SIZE,
      miscErrorDirectory,
      dbInsertionErrorDirectory,
      sourceZipDirectory,
      fieldConfigErrorDirectory,
    } = config;

    // Configuration for error handling
    const errorQueue = async.queue(async (task, callback) => {
      try {
        await fs.move(task.sourcePath, task.targetPath);
        logger.info(`Successfully moved erroneous file to: ${task.targetPath}`);
      } catch (error) {
        logger.error(
          `Failed to move erroneous file: ${task.sourcePath} to ${task.targetPath}. Error: ${error.message}`
        );
      } finally {
        callback();
      }
    }, BATCH_SIZE); // Limited concurrency for error processing

    const files = await fs.promises.readdir(sourceZipDirectory);

    if (!files.length) {
      logger.info('No files found to process. Exiting.');
      return; // Exit early if no files to process
    }

    const tasks = files.map((file) => {
      return async () => {
        // Make sure to return a function for async.parallelLimit
        const filePath = path.join(sourceZipDirectory, file);
        const matchedMappedFields = determineFieldMapping(file, config);

        if (!matchedMappedFields) {
          logger.warn(
            `No field configuration found for file: ${file}. Skipping file.`
          );
          queueErrorFile(errorQueue, filePath, fieldConfigErrorDirectory);
          return; // Skip processing this file
        }

        const parser = fs.createReadStream(filePath).pipe(
          parse({
            columns: matchedMappedFields,
            trim: true,
            skip_empty_lines: false,
          })
        );

        parser.on('error', (error) => {
          logger.error(
            `Parsing error in file ${file}: ${error.message}. Terminating parser.`
          );
          queueErrorFile(errorQueue, filePath, miscErrorDirectory);
          parser.destroy();
        });

        try {
          for await (const contentColumn of parser) {
            logger.debug(
              `Processing row in file ${file}: ${JSON.stringify(contentColumn)}`
            );
            let dataObject;
            try {
              // Attempt to dynamically construct a data object from the content column
              dataObject = constructDataObject(
                matchedMappedFields,
                contentColumn
              );

              // Extracts the filename from the filePath
              dataObject['file_name'] = path.basename(filePath);

            } catch (error) {
              // Log the error if constructing the data object fails
              logger.error(
                `Error constructing data object for file ${file}: ${error.message}`
              );
              queueErrorFile(errorQueue, filePath, miscErrorDirectory);
              continue; // Skip this record and continue with the next one
            }

            // Validate the constructed data object
            const errors = validateData(dataObject, matchedMappedFields);
            if (errors) {
              // Log validation errors and queue the file for error processing
              logger.warn(
                `Validation errors in file ${file}: ${errors.join(
                  ', '
                )}. Skipping row.`
              );
              queueErrorFile(errorQueue, filePath, miscErrorDirectory);
              continue; // Skip this record and continue with the next one
            }

            // Attempt to insert the validated data into the database
            try {
              await prisma.detection.create({ data: dataObject });
              logger.info(`Successfully inserted data for file ${file}.`);
            } catch (error) {
              logger.error(
                `Database insertion error for file ${file}: ${
                  error.message
                }. Data: ${JSON.stringify(dataObject)}`
              );
              queueErrorFile(errorQueue, filePath, dbInsertionErrorDirectory);
            }
          }
          logger.info(`Completed processing the file: ${file}`);
        } catch (error) {
          logger.error(
            `Unhandled error during the processing of file ${file}: ${error.message}`
          );
        }
      };
    });
    // Execute all tasks with controlled concurrency
    await async.parallelLimit(tasks, BATCH_SIZE);
    logger.info(
      `Initial processing complete. Queue Length: ${errorQueue.length()}, Running Tasks: ${errorQueue.running()}`
    );
    // Check if there are remaining or currently processed tasks
    if (errorQueue.length() + errorQueue.running() > 0) {
      await new Promise((resolve) => errorQueue.drain(resolve));
      logger.info('All error handling tasks completed. Error queue drained.');
    } else {
      logger.info(
        'No errors encountered during file process, skipping error queue draining.'
      );
    }
  } catch (error) {
    logger.error(`Critical error in processFiles: ${error.message}`);
  }
}

module.exports = {
  ensureDirectoryExists,
  moveZipFile,
  prepareEnvironment,
  validateSchedulingConfig,
  emptyTheDirectory,
  isDirectoryNotEmpty,
  processFiles,
  testPrismaConnection
};
