import schedule from 'node-schedule';
import archiver from 'archiver';
import fs from 'fs-extra';
import logger from "./logger.js";
import {format } from "date-fns";
import {
    emptyDirectory,
    ensureDirectoryExists, isDirectoryNotEmpty,
    moveZipFile, processFiles,
    validateSchedulingConfig
} from "../utils.js";
import path from "path";


/**
 * Zips the specified folder and returns the path of the created zip file.
 * Only includes files that are present at the time of zipping.
 * Logs the successful creation of the zip file.
 *
 * @param {string} folderToZip Path of the folder to zip.
 * @returns {Promise<string>} The path of the created zip file.
 */
export async function zipFolder(folderToZip) {

     // Refresh the list of files right before zipping
    const refreshedFiles = await fs.promises.readdir(folderToZip);
    if (refreshedFiles.length === 0) {
        logger.info('No files left to zip after moving erroneous files.');
        return null;
    }

    const timestamp = format(new Date(), 'dd-MM-yyyy-HH-mm-ss');
    const zipFilename = `backup-${timestamp}.zip`;
    const zipPath = path.join(folderToZip, '..', zipFilename);

    return new Promise((resolve, reject) => {
        // Create a file to write the archive
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {zlib: {level: 9}});

        archive.on('entry', data => {
            fs.access(path.join(folderToZip, data.name), fs.constants.F_OK, (err) => {
                if (err) {
                    logger.warn(`File scheduled for archiving was not found: ${data.name}`);
                    // Optionally handle the missing file situation, e.g., by removing it from the archive.
                }
            });
        });

        output.on('close', () => {
            const now = new Date();
            const formattedDate = format(now, "PPpp");
            logger.info(`Folder zipped successfully: ${zipPath} at ${formattedDate}`);
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
        archive.glob('**', {cwd: folderToZip});
        archive.finalize();
    });
}

/**
 * Schedules a task to zip a folder and move the zip to a specified path.
 * @param {string} folderToZipPath Path of the folder to zip.
 * @param {string} destinationPath Where to move the zip file.
 */
export async function zipMoveDeleteFolder(folderToZipPath, destinationPath) {
    try {
        await ensureDirectoryExists(destinationPath);
        const zipPath = await zipFolder(folderToZipPath);
        if (!zipPath) {
            logger.info("Not require to create a zip file as the folder is empty.");
            return;
        }
        const destinationFilePath = path.join(destinationPath, path.basename(zipPath));
        await moveZipFile(zipPath, destinationFilePath);
        await emptyDirectory(folderToZipPath)
        logger.info('Folder zipping and moving completed.');
    } catch (error) {
        logger.error('Failed to zip folder or move zip file:', error);
    }
}

/**
 * Sets up a scheduled task to zip a specified folder and then move the resulting zip file
 * to a designated destination path. The task is conditioned to only execute if the directory is not empty.
 * The scheduling of the task can be configured in several ways:
 * - `dailyAt`: Schedules the task to run at a specific time each day, specified in "HH:MM" format.
 * - `everyXHours`: Schedules the task to run at fixed intervals every X hours.
 * - `everyXMinutes`: Schedules the task to run at fixed intervals every X minutes.
 * The function uses the highest precedence scheduling option available in the configuration.
 * It listens for SIGINT (Ctrl-C) to shut down gracefully and logs the task's progress and errors.
 *
 * @param {Object} config - Configuration object containing scheduling parameters and paths.
 * @param {string|null} config.dailyAt - Time of day ("HH:MM") when the task should run daily.
 * @param {number|null} config.everyXHours - Interval in hours for the task to run repeatedly.
 * @param {number|null} config.everyXMinutes - Interval in minutes for more frequent tasks.
 * @param {string} config.folderToZipPath - Path of the folder to be zipped.
 * @param {string} config.destinationPath - Destination path for the moved zip file.
 * @param {string} config.errorFolderPath - Path for storing error logs or files.
 * @param {number} config.BATCH_SIZE - Number of files processed in a batch.
 * @throws {Error} If the scheduling configuration is invalid, it throws an error.
 */
export function setupScheduler(config) {
    const {folderToZipPath, destinationPath, errorFolderPath} = config;

    // Validate scheduling configuration first
    try {
        validateSchedulingConfig(config);
    } catch (error) {
        logger.error("Scheduling configuration validation failed:", error.message);
        throw new Error("Scheduling setup aborted due to configuration validation failure.");
    }

    const handleTaskExecution = async () => {
        try {

            const directoryNotEmpty = await isDirectoryNotEmpty(folderToZipPath);

            if (directoryNotEmpty) {

                // Proceed with further processing...
                logger.info('Scheduled TASK Cycle Started.');
                await processFiles(config)
                logger.info('Finished processing files, starting to zip and move the folder...');
                await zipMoveDeleteFolder(folderToZipPath, destinationPath);

                logger.info('Scheduled TASK completed successfully.');
            } else {
                logger.info(`Scheduled TASK skipped. Directory ${folderToZipPath} is empty.`);
            }
        } catch (error) {
            logger.error('Error during scheduled task execution:', error);
            // Send Email
            await schedule.gracefulShutdown();
            process.exit(1);  // Exit the process after cleanup
        }
    };

    if (config.dailyAt) {
        const [hour, minute] = config.dailyAt.split(':').map(num => parseInt(num, 10));
        schedule.scheduleJob({hour, minute}, handleTaskExecution);
        logger.info(`Task scheduled to run daily at ${config.dailyAt}`);
    } else if (config.everyXHours != null) {
        const rule = new schedule.RecurrenceRule();
        rule.hour = new schedule.Range(0, 23, config.everyXHours);
        schedule.scheduleJob(rule, handleTaskExecution);
        logger.info(`Task scheduled to run every ${config.everyXHours} hours`);
    } else if (config.everyXMinutes != null) {
        const rule = new schedule.RecurrenceRule();
        rule.minute = new schedule.Range(0, 59, config.everyXMinutes);
        schedule.scheduleJob(rule, handleTaskExecution);
        logger.info(`Task scheduled to run every ${config.everyXMinutes} minutes`);
    }

    // Listen for SIGINT signal e.g., Ctrl-C in terminal
    process.on('SIGINT', () => {
        schedule.gracefulShutdown()
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
