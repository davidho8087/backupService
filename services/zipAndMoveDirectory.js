const fs = require("fs-extra");
const logger = require("../lib/logger");
const { format } = require("date-fns");
const path = require("path");
const archiver = require("archiver");
const { ensureDirectoryExists } = require("../utils/preparatory");

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

module.exports = {
	zipAndMoveDirectory
};