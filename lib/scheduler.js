import schedule from 'node-schedule';
import archiver from 'archiver';
import fs from 'fs-extra';
import logger from "./logger.js";
import { format } from "date-fns";
import {
	emptyDirectory,
	ensureDirectoryExists, isDirectoryNotEmpty,
	moveZipFile,
	validateSchedulingConfig
} from "../utils.js";
import path from "path";


/**
 * Zips the specified folder and returns the path of the created zip file.
 * Logs the successful creation of the zip file.
 *
 * @param {string} folderToZip Path of the folder to zip.
 * @returns {Promise<string>} The path of the created zip file.
 */
export async function zipFolder(folderToZip) {
	const timestamp = format(new Date(), 'dd-MM-yyyy-HH-mm-ss');
	const zipFilename = `backup-${timestamp}.zip`;
	const zipPath = path.join(folderToZip, '..', zipFilename);

	return new Promise((resolve, reject) => {
		// Create a file to write the archive
		const output = fs.createWriteStream(zipPath);
		const archive = archiver('zip', { zlib: { level: 9 } });

		output.on('close', () => {
			const now = new Date();
			const formattedDate = format(now, "PPpp");
			logger.info(`Folder zipped successfully: ${zipPath} at ${formattedDate}`);
			resolve(zipPath);
		});
		archive.on('error', (err) => reject(err));
		archive.on('warning', (err) => {
			if (err.code === 'ENOENT') {
				logger.warn(err);
			} else {
				reject(err);
			}
		});

		archive.pipe(output);
		archive.glob('**', { cwd: folderToZip });
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
		const destinationFilePath = path.join(destinationPath, path.basename(zipPath));
		await moveZipFile(zipPath, destinationFilePath);
		await emptyDirectory(folderToZipPath)

	} catch (error) {
		logger.error('Failed to zip folder or move zip file:', error);
	}
}

/**
 * Sets up a scheduled task to zip a specified folder and then move the resulting zip file
 * to a designated destination path. The task is only executed if the directory is not empty,
 * and can be configured to run based on several scheduling options:
 * - At a specific time each day (`dailyAt`), which specifies the exact time to run the task.
 * - At fixed intervals every X hours (`everyXHours`), which schedules the task to run repeatedly throughout the day.
 * - At fixed intervals every X minutes (`everyXMinutes`), for more frequent tasks within an hour.
 * Only one of these options should be set at a time. If multiple are provided, `dailyAt` takes precedence over `everyXHours`,
 * which in turn takes precedence over `everyXMinutes`. The scheduler also listens for a SIGINT signal to shut down gracefully.
 *
 * @param {Object} config - The configuration object containing scheduling parameters.
 * @param {string | null} config.dailyAt - The daily time at which the task should run, specified in "HH:MM" format.
 * @param {number|null} config.everyXHours - The interval, in hours, at which the task should run, if not using `dailyAt`.
 * @param {number|null} config.everyXMinutes - The interval, in minutes, at which the task should run, used only if `dailyAt` and `everyXHours` are not set.
 * @param {string} folderToZipPath - The file path of the folder to be zipped. The task is executed only if this directory is not empty.
 * @param {string} destinationPath - The destination path where the zip file should be moved to.
 * @throws {Error} If the scheduling configuration validation fails, it throws an error and aborts the setup.
 */

export function setupScheduler(config, folderToZipPath, destinationPath) {
	// Validate scheduling configuration first
	try {
		validateSchedulingConfig(config);
	} catch (error) {
		logger.error("Scheduling configuration validation failed:", error.message);
		throw new Error("Scheduling setup aborted due to configuration validation failure.");
	}

	const handleTaskExecution = async () => {
		try {
			if (await isDirectoryNotEmpty(folderToZipPath)) {
				logger.info('Scheduled TASK started. Directory is not empty.');
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
		schedule.scheduleJob({ hour, minute }, handleTaskExecution);
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
				logger.info('Scheduler shutdown gracefully.');
				process.exit(0);
			})
			.catch((error) => {
				logger.error('Failed to shutdown scheduler gracefully:', error);
				process.exit(1);
			});
	});
}
