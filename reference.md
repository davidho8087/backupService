```
// /**
//  * Moves a file to a designated error folder.
//  *
//  * @async
//  * @param {string} filePath - The path of the file to be moved.
//  * @param {string} errorFolderPath - The path of the error folder.
//  * @throws Will throw an error if the file cannot be moved.
//  * @returns {Promise<void>} A Promise that resolves when the file has been moved.
//  */
// async function moveToErrorFolder(filePath, errorFolderPath) {
//     const errorFilePath = path.join(errorFolderPath, path.basename(filePath));
//     try {
//         await fs.promises.rename(filePath, errorFilePath);
//         logger.info(`Moved erroneous file to: ${errorFilePath}`);
//     } catch (error) {
//         logger.error(`Failed to move file to error directory: ${error.message}`);
//     }
// }

/**
* Processes files within a specified directory, reads the data, parses it, and inserts it into a database.
* If any errors occur during the file reading or JSON parsing, the file is moved to an error folder.
* This function is designed to handle high volumes of files by limiting the concurrency of file processing.
*
* @param {Object} config Configuration object containing necessary settings.
* @param {string} config. Path of the directory containing files to process.
* @param {string} config.errorFolderPath Path to the directory where erroneous files will be moved.
* @param {number} config.BATCH_SIZE The number of files to process concurrently.
  */
  // export async function processFiles(config) {
  //
  //     const {BATCH_SIZE, errorFolderPath, folderToZipPath} = config;
  //
  //     const files = await fs.promises.readdir(folderToZipPath);
  //     const queue = async.queue(async (file, callback) => {
  //         const filePath = path.join(folderToZipPath, file);
  //         let data = '';
  //
  //         try {
  //             const readStream = fs.createReadStream(filePath, {encoding: 'utf8'});
  //             for await (const chunk of readStream) {
  //                 data += chunk;
  //             }
  //             await readStream.close(); // Ensure the stream is closed
  //         } catch (error) {
  //             logger.error(`Error reading file ${file}: ${error.message}`);
  //             await moveToErrorFolder(filePath, errorFolderPath);
  //             callback(); // Continue to the next file even if there was an error
  //             return;
  //         }
  //
  //         let jsonData;
  //         try {
  //             jsonData = JSON.parse(data);
  //         } catch (error) {
  //             logger.error(`Error parsing JSON from file ${file}: ${error.message}`);
  //             await moveToErrorFolder(filePath, errorFolderPath);
  //             callback(); // Continue to the next file even if there was an error
  //             return;
  //         }
  //
  //         try {
  //             await prisma.detection.create({
  //                 data: {
  //                     tracker_id: jsonData.trackerId,
  //                     store_code: jsonData.storeCode,
  //                     event_type: jsonData.eventType,
  //                     event_name: jsonData.eventName,
  //                     duration: parseFloat(jsonData.duration),
  //                     count: jsonData.count || 0,
  //                     class_type: jsonData.classType,
  //                     message: jsonData.message || "",
  //                     date_time: parseISO(jsonData.dateTime),
  //                     camera_name: jsonData.cameraName,
  //                     region_id: jsonData.regionId,
  //                     zone_name: jsonData.zoneName,
  //                 }
  //             });
  //             logger.info(`Data for file ${file} inserted successfully.`);
  //         } catch (error) {
  //             logger.error(`Error inserting data for file ${file}: ${error.message}`);
  //             await moveToErrorFolder(filePath, errorFolderPath);
  //         } finally {
  //             callback(); // Always proceed to the next file
  //         }
  //     }, BATCH_SIZE); // Limit concurrency by config
  //
  //     // Add files to the queue
  //     files.forEach(file => queue.push(file));
  // }
```

```
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const { getConfig, handleCriticalError } = require("./configHelper");

// Retrieve configuration based on the environment
const { dbPath } = getConfig();

let prisma;
const initializePrisma = () => {
  if (prisma) return prisma;

  try {
    prisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } },
    });
    prisma.$connect().catch(handleCriticalError);
  } catch (error) {
    handleCriticalError(error);
  }
  return prisma;
};

module.exports = initializePrisma();
```
