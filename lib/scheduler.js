const fs = require("fs-extra");
const logger = require('./logger.js');
const schedule = require('node-schedule');
const { processFiles } = require("../services/processFile");
const { zipAndMoveDirectory } = require("../services/zipAndMoveDirectory");
const { emptyTheDirectory } = require("../services/emptyTheDirectory");

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
 * Sets up a scheduled task to zip a specified directory and then move the resulting zip file
 * to a designated destination path. The task is conditioned to only execute if the directory is not empty.
 * The scheduling of the task can be configured in several ways:
 * - `dailyAt`: Schedules the task to run at a specific time each day, specified in "HH:MM" format.
 * - `everyXHours`: Schedules the task to run at fixed intervals every X hours.
 * - `everyXMinutes`: Schedules the task to run at fixed intervals every X minutes.
 * The function uses the highest precedence scheduling option available in the configuration.
 * It listens for SIGINT (Ctrl-C) to shut down gracefully and logs the task's progress and errors.
 *
 * @param {Object} config - Configuration object containing scheduling parameters and paths.
 * @throws {Error} If the scheduling configuration is invalid, it throws an error.
 */
function scheduler(config) {
  const {
    sourceZipDirectory,
    destinationZipDirectory,
    runProcessFiles,
    runZipAndMove,
    runEmptyTheDirectory,
  } = config;

  // Validate scheduling configuration first
  try {
    validateSchedulingConfig(config);
  } catch (error) {
    logger.error('Scheduling configuration validation failed:', error.message);
    throw new Error(
      'Scheduling setup aborted due to configuration validation failure.'
    );
  }

  const handleTaskExecution = async () => {
    try {
      const directoryNotEmpty = await isDirectoryNotEmpty(sourceZipDirectory);

      if (directoryNotEmpty) {
        logger.info('===========================');
        logger.info('Scheduled cycle started...');
        if (runProcessFiles) {
          await processFiles(config);
        }

        if (runZipAndMove) {
          logger.info('Starting to zip and move the folder...');
          await zipAndMoveDirectory(
            sourceZipDirectory,
            destinationZipDirectory
          );
        }

        if (runEmptyTheDirectory) {
          logger.info('Starting to delete folder/directory...');
          await emptyTheDirectory(sourceZipDirectory);
        }

        logger.info('Scheduled cycle completed successfully.');
      } else {
        logger.info(
          `Scheduled cycle skipped. Directory ${sourceZipDirectory} is empty.`
        );
      }
    } catch (error) {
      logger.error('Error during scheduled task execution:', error);
      // Send Email
      await schedule.gracefulShutdown();
      process.exit(1); // Exit the process after cleanup
    }
  };

  if (config.dailyAt) {
    const [hour, minute] = config.dailyAt
      .split(':')
      .map((num) => parseInt(num, 10));
    schedule.scheduleJob({ hour, minute }, handleTaskExecution);
    logger.info(`Scheduled to run daily at ${config.dailyAt}`);
  } else if (config.everyXHours != null) {
    const rule = new schedule.RecurrenceRule();
    rule.hour = new schedule.Range(0, 23, config.everyXHours);
    schedule.scheduleJob(rule, handleTaskExecution);
    logger.info(`Scheduled to run every ${config.everyXHours} hours`);
  } else if (config.everyXMinutes != null) {
    const rule = new schedule.RecurrenceRule();
    rule.minute = new schedule.Range(0, 59, config.everyXMinutes);
    schedule.scheduleJob(rule, handleTaskExecution);
    logger.info(`Scheduled to run every ${config.everyXMinutes} minutes`);
  }

  // Listen for SIGINT signal e.g., Ctrl-C in terminal
  process.on('SIGINT', () => {
    schedule
      .gracefulShutdown()
      .then(() => {
        logger.warn('Scheduler shutdown gracefully.');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Failed to shutdown scheduler gracefully:', error);
        process.exit(1);
      });
  });
}

module.exports = {
  scheduler,
};
