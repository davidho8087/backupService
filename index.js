const dotenv = require('dotenv');
dotenv.config();

const app = require('./server.js');
const { loadYAMLConfig } = require('./config.loader.js');
const logger = require('./lib/logger.js');
const { scheduler } = require('./lib/scheduler.js');
const { testPrismaConnection, prepareDirectory } = require("./utils/preparatory");


// Load YAML config
const config = loadYAMLConfig();

if (config) logger.info('YAML config loaded successfully:', config);

const port = config.PORT;
const environment = config.NODE_ENV;
const host = config.HOST;

const isEnabled = config.PATH_CONFIG.isEnabled;
const configPath = config.PATH_CONFIG;

(async function () {
  try {
    if (isEnabled) {
      await testPrismaConnection();
      await prepareDirectory(configPath);
      scheduler(configPath);
    } else {
      logger.info('Scheduled task is disabled');
    }

    app.listen(5003, function () {
      logger.info(`Server is running on port ${port}`);
      logger.info(`Server is running in ${environment} mode`);
      logger.info(`http://${host}:${port}`);
    });
  } catch (error) {
    logger.error(`Critical error during server startup: ${error.message}`, {
      error,
    });
    process.exit(1);
  }
})();
