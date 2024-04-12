import fs from 'fs-extra';
import logger from "./lib/logger.js";

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
 * Moves a file from one location to another.
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
 * Ensures that the specified directory exists. If the directory does not exist,
 * it will be created.
 */
export async function prepareEnvironment(destinationPath, folderToZipPath) {
	try {
		logger.info('Verify folder existence');
		await ensureDirectoryExists(folderToZipPath);
		await ensureDirectoryExists(destinationPath);
	} catch (error) {
		logger.error('Error preparing the environment:', error);
		throw error;
	}
}

/**
 * Validates the scheduling configuration to ensure exactly one scheduling option is set.
 * Throws an error if zero or more than one scheduling option is set.
 *
 * @param {Object} config - The scheduling configuration object.
 * @throws {Error} If zero or more than one scheduling option is set.
 */
export function validateSchedulingConfig(config) {
	const { dailyAt, everyXHours, everyXMinutes } = config;

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
 * @param {string} directoryPath - The path to the directory to empty.
 */
export async function emptyDirectory(directoryPath) {
	try {
		await fs.emptyDir(directoryPath);
		logger.info(`All files in ${directoryPath} have been successfully deleted.`);
	} catch (error) {
		logger.error(`Error emptying directory ${directoryPath}:`, error);
		throw error;
	}
}


/**
 * Checks if the specified directory contains any files or subdirectories by attempting to read the first entry only.
 *
 * @param {string} dirPath Path of the directory to check.
 * @returns {Promise<boolean>} Returns true if the directory is not empty.
 */
export async function isDirectoryNotEmpty(dirPath) {
	try {
		const dir = await fs.opendir(dirPath);
		for await (const dirent of dir) {
			await dir.close(); // It's important to close the directory handle when done.
			return true; // Directory is not empty
		}
		return false; // Directory is empty if no entries are found
	} catch (error) {
		logger.error(`Error accessing directory ${dirPath}:`, error);
		return false; // Treat errors as 'empty' for safety
	}
}
