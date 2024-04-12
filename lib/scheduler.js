import schedule from 'node-schedule';
import archiver from 'archiver';
import fs from 'fs-extra';
import logger from "./logger.js";
import {format} from "date-fns";
import {ensureDirectoryExists, moveZipFile} from "../utils.js";
import path from "path";


/**
 * Zips the specified folder and returns the path of the created zip file.
 *
 * @param {string} folderToZip Path of the folder to zip.
 * @returns {Promise<string>} The path of the created zip file.
 */
export async function zipFolder(folderToZip) {
    const timestamp = format(new Date(), 'dd-MM-yyyy-HH-mm-ss');
    const zipFilename = `backup-${timestamp}.zip`;
    const zipPath = path.join(folderToZip, '..', zipFilename);

    return new Promise((resolve, reject) => {
        // Create a file to write the archive to, using fsExtra instead of fs
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(zipPath));
        archive.on('error', (err) => reject(err));
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                logger.warn(err);
            } else {
                reject(err);
            }
        })

        archive.pipe(output);
        archive.glob('**', { cwd: folderToZip });
        archive.finalize();
    });
}

/**
 * Schedules a task to zip a folder and move the zip to a specified path.
 * @param {string} folderToZip Path of the folder to zip.
 * @param {string} destinationPath Where to move the zip file.
 * @param {string} scheduleTime The time to run the task each day, in HH:MM format.
 */
export function scheduleFolderZipAndMove(folderToZip, destinationPath, scheduleTime) {
    logger.info(`This scheduled task will be executed at ${scheduleTime}`);
    const [hourString, minuteString] = scheduleTime.split(':');
    const hour = parseInt(hourString, 10);
    const minute = parseInt(minuteString, 10);

    // Schedule the task
    schedule.scheduleJob({hour, minute}, async function () {

        try {

            // Ensure the destination directory exists
            await ensureDirectoryExists(destinationPath);
            logger.info(`Verify directory exists: ${destinationPath}`);
            logger.info('CHECKED')

            const zipPath = await zipFolder(folderToZip);
            const now = new Date();
            const formattedDate = format(now, "PPpp");
            logger.info(`Folder zipped successfully: ${zipPath} at ${formattedDate}`)

            // Construct the full destination filepath including the filename
            const destinationFilePath = path.join(destinationPath, path.basename(zipPath));


            // Move the zip file to the constructed destination filepath
            await moveZipFile(zipPath, destinationFilePath);
            console.log(`Zip file moved to: ${destinationPath}`);
        } catch (error) {
            console.error('Failed to zip folder or move zip file:', error);
        }
    });
}
