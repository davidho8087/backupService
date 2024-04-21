const logger = require('../lib/logger.js');

exports.handleError = (error, source) => {
  logger.error(`Error Message in ${source}:`, error.message);
  logger.error(`Full-Error in ${source}:`, error);
};
