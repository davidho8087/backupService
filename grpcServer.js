const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const logger = require("./lib/logger");

// Load the proto file
const PROTO_PATH = path.join(__dirname, "logic.proto");
logger.debug(`Loading proto file from path: ${PROTO_PATH}`);
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
logger.debug("Proto file loaded successfully");
const proto = grpc.loadPackageDefinition(packageDefinition).LogicService;

// Implement the TriggerAndAcknowledge RPC method
const triggerAndAcknowledge = (call, callback) => {
  logger.debug(`Received TriggerRequest with message: ${call.request.message}`);

  // Simulate logic execution
  setTimeout(() => {
    try {
      logger.debug("Logic execution complete");
      callback(null, { message: "Logic execution complete" });
    } catch (error) {
      logger.error(`Error during logic execution: ${error.message}`);
      callback({
        code: grpc.status.INTERNAL,
        message: `Internal server error: ${error.message}`,
      });
    }
  }, 2000);
};

// Create and start the gRPC server
const startGrpcServer = () => {
  const server = new grpc.Server();
  server.addService(proto.service, {
    TriggerAndAcknowledge: triggerAndAcknowledge,
  });

  server.bindAsync(
    "0.0.0.0:50051",
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        logger.error(`Failed to bind gRPC server: ${err.message}`);
      } else {
        logger.info(`gRPC server running on port ${port}`);
      }
    }
  );
};

module.exports = {
  startGrpcServer,
  triggerAndAcknowledge,
};
