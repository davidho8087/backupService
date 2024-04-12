// index.js

import * as dotenv from 'dotenv'

dotenv.config()

import app from './server.js'
import logger from './lib/logger.js'
import { setupScheduler } from './lib/scheduler.js';
import {loadYAMLConfig} from './config.loader.js'
import {prepareEnvironment} from "./utils.js";

// Load YAML config
const config = loadYAMLConfig();

if (config) logger.info('YAML config loaded successfully:', config);

const port = config.PORT;
const environment = config.NODE_ENV;
const host = config.HOST;

// Configure the scheduled task parameters
const folderToZipPath = config.PATH_CONFIG.folderToZipPath;
const destinationPath = config.PATH_CONFIG.destinationPath;
const isEnabled = config.PATH_CONFIG.isEnabled;
const configPath = config.PATH_CONFIG;

try {
    if (isEnabled) {
        await prepareEnvironment(destinationPath, folderToZipPath);
        setupScheduler(configPath, folderToZipPath, destinationPath);
    } else {
        logger.info('Scheduled task is disabled');
    }

    app.listen(5003, () => {
        logger.info(`Server is running on port ${port}`);
        logger.info(`Server is running in ${environment} mode`);
        logger.info(`http://${host}:${port}`);
    });

} catch (error) {
    logger.error(`Critical error during server startup: ${error.message}`, { error });
    process.exit(1);
}