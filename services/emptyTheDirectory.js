const fs = require("fs-extra");
const logger = require("../lib/logger");

/**
 * Empties the contents of a given directory but leaves the directory intact.
 * If the directory does not exist, it will be created.
 *
 * @async
 * @param {string} directoryPath - The path to the directory to empty.
 * @throws {Error} - Throws an error if there is an issue emptying the directory.
 */
async function emptyTheDirectory(directoryPath) {
	return fs
		.emptyDir(directoryPath)
		.then(() =>
			logger.info(
				`All files in ${directoryPath} have been successfully deleted.`
			)
		)
		.catch((error) => {
			logger.error(
				`Error deleting files in directory ${directoryPath}:`,
				error
			);
			throw error;
		});
}

module.exports = {
	emptyTheDirectory,
};
