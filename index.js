const dotenv = require("dotenv");
dotenv.config();

const app = require("./server.js");
const { loadYAMLConfig } = require("./config.loader.js");
const logger = require("./lib/logger.js");
const { scheduler } = require("./lib/scheduler.js");
const {
  prepareDirectory,
  testPrismaConnection,
} = require("./utils/preparatory");
const { startGrpcServer } = require("./grpcServer.js");

// Load YAML config
const config = loadYAMLConfig();

if (config) logger.info("YAML config loaded successfully:", config);

const port = config.PORT || 5003;
const environment = config.NODE_ENV;
const host = config.HOST || "localhost";

const isEnabled = config.PATH_CONFIG.isEnabled;
const configPath = config.PATH_CONFIG;
const runProcessFiles = config.PATH_CONFIG.runProcessFiles;

(async function () {
  try {
    if (isEnabled) {
      if (runProcessFiles) {
        logger.info("Process files is enabled");
      }
      // await testPrismaConnection();
      await prepareDirectory(configPath);
      scheduler(configPath);
    } else {
      logger.info("Scheduled task is disabled");
    }

    app.listen(port, function () {
      logger.info(`Server is running on port ${port}`);
      logger.info(`Server is running in ${environment} mode`);
      logger.info(`http://${host}:${port}`);
    });

    // Start the gRPC server
    startGrpcServer();
  } catch (error) {
    logger.error(`Critical error during server startup: ${error.message}`, {
      error,
    });
    process.exit(1);
  }
})();
