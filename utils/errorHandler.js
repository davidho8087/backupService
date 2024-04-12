import logger from '../lib/logger.js'

export const handleError = (error, source) => {
    logger.error(`Error Message in ${source}:`, error.message);
    logger.error(`Full-Error in ${source}:`, error);
}

