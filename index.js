// index.js

import * as dotenv from 'dotenv'

dotenv.config()

import app from './server.js'
import logger from './lib/logger.js'
import {scheduleFolderZipAndMove} from './lib/scheduler.js';
import {loadYAMLConfig} from './config.loader.js'
import {prepareEnvironment} from "./utils.js";

// Load YAML config
const config = loadYAMLConfig();

if (config) logger.info('YAML config loaded successfully:', config);

const port = config.PORT;
const environment = config.NODE_ENV;
const host = config.HOST;

// Configure the scheduled task parameters
const folderToZip = config.PATH_CONFIG.folderToZip;
const destinationPath = config.PATH_CONFIG.destinationPath;
const scheduleTime = config.PATH_CONFIG.scheduledTime;
const isEnabled = config.PATH_CONFIG.isEnabled;

try {

    if (isEnabled) {
        await prepareEnvironment(destinationPath, folderToZip);
        scheduleFolderZipAndMove(folderToZip, destinationPath, scheduleTime);
    } else {
        logger.info('Scheduled task is disabled');
    }

    app.listen(5003, () => {
        logger.info(`Server is running on port ${port}`);
        logger.info(`Server is running in ${environment} mode`);
        logger.info(`http://${host}:${port}`);
    });

} catch (error) {
    logger.error(`Error starting server: ${error.message}`);
    process.exit(1);
}