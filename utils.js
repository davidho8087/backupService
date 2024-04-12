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
        logger.info(`Moved file from ${sourcePath} to ${destinationPath}`);
    } catch (error) {
        logger.error('Error moving zip file:', error);
        throw error;
    }
}

/**
 * Ensures that the specified directory exists. If the directory does not exist,
 * it will be created.
 */
export async function prepareEnvironment(destinationPath, folderToZip){
    try {
        logger.info('Verify folder existence');
        await ensureDirectoryExists(folderToZip);
        await ensureDirectoryExists(destinationPath);
    } catch (error) {
        logger.error('Error preparing the environment:', error);
        throw error;
    }
}

