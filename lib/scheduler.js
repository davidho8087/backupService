const schedule = require('node-schedule');
const archiver = require('archiver');
const fs = require('fs-extra');
const logger = require('./logger.js');
const { format } = require('date-fns');
const path = require('path');

const {
  emptyTheDirectory,
  ensureDirectoryExists,
  isDirectoryNotEmpty,
  moveZipFile,
  processFiles,
  validateSchedulingConfig,
} = require('../utils');

/**
 * Zips the specified directory and returns the path of the created zip file.
 * Only includes files that are present at the time of zipping.
 * Logs the successful creation of the zip file.
 *
 * @param {string} sourceZipDirectory Path of the directory to zip.
 * @returns {Promise<string>} The path of the created zip file.
 */
async function zipTheDirectory(sourceZipDirectory) {
  // Refresh the list of files right before zipping
  const refreshedFiles = await fs.promises.readdir(sourceZipDirectory);
  if (refreshedFiles.length === 0) {
    logger.info('No files left to zip after moving erroneous files.');
    return null;
  }

  const timestamp = format(new Date(), 'dd-MM-yyyy-HH-mm-ss');
  const zipFilename = `backup-${timestamp}.zip`;
  const zipPath = path.join(sourceZipDirectory, '..', zipFilename);

  return new Promise((resolve, reject) => {
    // Create a file to write the archive
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('entry', (data) => {
      fs.access(
        path.join(sourceZipDirectory, data.name),
        fs.constants.F_OK,
        (err) => {
          if (err) {
            logger.warn(
              `File scheduled for archiving was not found: ${data.name}`
            );
            // Optionally handle the missing file situation, e.g., by removing it from the archive.
          }
        }
      );
    });

    output.on('close', () => {
      logger.info(`Folder zipped successfully: ${zipPath} at ${timestamp}`);
      resolve(zipPath);
    });
    archive.on('error', (err) => reject(err));
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn(`Archiver warning: ${err.message}`);
      } else {
        logger.error(`Archiver error: ${err.message}`);
        reject(err);
      }
    });

    archive.pipe(output);
    archive.glob('**', { cwd: sourceZipDirectory });
    archive.finalize();
  });
}

/**
 * Schedules a task to zip a directory and move the zip to a specified path.
 * @param {string} sourceZipDirectory Path of the directory to zip.
 * @param {string} destinationZipDirectory Where to move the zip file.
 */
async function zipAndMoveDirectory(
  sourceZipDirectory,
  destinationZipDirectory
) {
  try {
    await ensureDirectoryExists(destinationZipDirectory);
    const zipPath = await zipTheDirectory(sourceZipDirectory);
    if (!zipPath) {
      logger.info('Not require to create a zip file as the folder is empty.');
      return;
    }
    const destinationFilePath = path.join(
      destinationZipDirectory,
      path.basename(zipPath)
    );
    await moveZipFile(zipPath, destinationFilePath);
    logger.info('Folder zipping and moving completed.');
  } catch (error) {
    logger.error('Failed to zip folder or move zip file:', error);
  }
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
function setupScheduler(config) {
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
  setupScheduler,
};
