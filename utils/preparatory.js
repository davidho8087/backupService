const fs = require("fs-extra");
const prisma = require("../lib/prismaClient");
const logger = require("../lib/logger");
/**
 * Tests the connection to the Prisma database by retrieving a limited number of detection records.
 * This function fetches one detection record to ensure the Prisma client is properly configured
 * and can query the database. It logs the outcome of the operation.
 *
 * @async
 * @function testPrismaConnection
 * @returns {Promise<void>} A promise that resolves if the connection test is successful.
 * @throws {Error} Throws an error if the Prisma client cannot retrieve data from the database.
 */
async function testPrismaConnection() {
  try {
    const detections = await prisma.detection.findMany({
      take: 1, // Limits the query to 5 items for testing
    });
    logger.info(
      `Prisma connection test passed. Found ${detections.length} detections limit with 1 record.`
    );
  } catch (error) {
    logger.error("Prisma connection test failed", { error });
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
 * Prepares the directory by ensuring that the specified directories exist. If the directories
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
async function prepareDirectory(configPath) {
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
    logger.error("Error preparing the environment:", error);
    throw error;
  });
}

module.exports = {
  testPrismaConnection,
  ensureDirectoryExists,
  prepareDirectory,
};
