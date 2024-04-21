const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const { format } = require('date-fns');
const config = require('../config.loader.js').loadYAMLConfig();
const util = require('util');
const randomString = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

const logPath= path.resolve(config.PATH_CONFIG.winstonLogDirectory)

const transformForFile = () => {
  return {
    transform: (info) => {
      const args = info[Symbol.for('splat')];
      if (args) {
        info.message = util.format(info.message);
        if (args.length >= 1 && typeof args[0] === 'object') {
          Object.assign(info, args[0]);
        }
      }
      return info;
    },
  };
};
const fileFormat = winston.format.combine(
  winston.format.splat(),
  winston.format.uncolorize({ level: true }),
  transformForFile()
);

const configTransportCombined = new winston.transports.DailyRotateFile({
  filename: '%DATE%.log',
  dirname: path.join(logPath, 'combined'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '200m',
  maxFiles: '7d',
  level: 'debug',
  format: fileFormat,
});

const configTransportHttp = new winston.transports.DailyRotateFile({
  filename: '%DATE%.log',
  dirname: path.join(logPath, 'http'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '200m',
  maxFiles: '7d',
  level: 'http',
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.uncolorize({ level: true })
  ),
});

const configTransportError = new winston.transports.DailyRotateFile({
  filename: '%DATE%.log',
  dirname: path.join(logPath, 'error'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '200m',
  maxFiles: '7d',
  level: 'error',
  format: fileFormat,
});

const configTransportInfo = new winston.transports.DailyRotateFile({
  filename: '%DATE%.log',
  dirname: path.join(logPath, 'info'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '200m',
  maxFiles: '7d',
  level: 'info',
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.uncolorize({ level: true }),
    transformForFile()
  ),
});

const configTransportWarn = new winston.transports.DailyRotateFile({
  filename: '%DATE%.log',
  dirname: path.join(logPath, 'warn'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '200m',
  maxFiles: '7d',
  level: 'warn',
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.uncolorize({ level: true })
  ),
});

const transports = [];

transports.push(configTransportCombined);
transports.push(configTransportHttp);
transports.push(configTransportError);
transports.push(configTransportInfo);
transports.push(configTransportWarn);

const transformForConsoleTerminal = () => {
  return {
    transform: (info) => {
      //combine message and args if any
      const args = info[Symbol.for('splat')];
      if (args) {
        info.message = util.format(info.message, ...args);
      }
      return info;
    },
  };
};

const winstonFormat = () => {
  return winston.format.combine(
    winston.format.timestamp({
      format: () => format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
    }), // Dynamic timestamp
    transformForConsoleTerminal(),
    winston.format.colorize({ level: true }),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  );
};

transports.push(
  new winston.transports.Console({
    level: 'debug',
    format: winstonFormat(),
  })
);

// Create the Winston logger
const logger = winston.createLogger({
  defaultMeta: {
    requestId: randomString(),
  },
  transports: transports, // Assuming 'transports' is defined somewhere in your code
});

logger.info('Winston-logPath', logPath);

module.exports = logger;
