import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { format } from 'date-fns'
import { fileURLToPath } from 'url'
import util from 'util'
const randomString = () => {
    return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    )
}

// Determine the directory of the current module file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logPath = path.join(__dirname, '..', '..','..', 'logs', 'chart-service-logs')

const transformForFile = () => {
    return {
        transform: (info) => {
            const args = info[Symbol.for('splat')]
            if (args) {
                // Only keep the first argument as part of the main message
                info.message = util.format(info.message)

                // Merge additional arguments (objects) directly into the info object
                if (args.length >= 1 && typeof args[0] === 'object') {
                    Object.assign(info, args[0])
                }
            }
            return info
        },
    }
}

const fileFormat = winston.format.combine(
    winston.format.splat(),
    winston.format.uncolorize({ level: true }),
    transformForFile(),
)

const configTransportCombined = new DailyRotateFile({
    filename: '%DATE%.log',
    dirname: path.join(logPath, 'combined'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '200m',
    maxFiles: '7d',
    level: 'debug',
    format: fileFormat,
})

const configTransportHttp = new DailyRotateFile({
    filename: '%DATE%.log',
    dirname: path.join(logPath, 'http'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '200m',
    maxFiles: '7d',
    level: 'http',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.uncolorize({ level: true }),
    ),
})

const configTransportError = new DailyRotateFile({
    filename: '%DATE%.log',
    dirname: path.join(logPath, 'error'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '200m',
    maxFiles: '7d',
    level: 'error',
    format: fileFormat,
})

const configTransportInfo = new DailyRotateFile({
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
        transformForFile(),
    ),
})

const configTransportWarn = new DailyRotateFile({
    filename: '%DATE%.log',
    dirname: path.join(logPath, 'warn'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '200m',
    maxFiles: '7d',
    level: 'warn',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.uncolorize({ level: true }),
    ),
})

const transports = []

transports.push(configTransportCombined)
transports.push(configTransportHttp)
transports.push(configTransportError)
transports.push(configTransportInfo)
transports.push(configTransportWarn)

const transformForConsoleTerminal = () => {
    return {
        transform: (info) => {
            //combine message and args if any
            const args = info[Symbol.for('splat')]
            if (args) {
                info.message = util.format(info.message, ...args)
            }
            return info
        },
    }
}

const winstonFormat = () => {
    return winston.format.combine(
        winston.format.timestamp({
            format: () => format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
        }), // Dynamic timestamp
        transformForConsoleTerminal(),
        winston.format.colorize({ level: true }),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} [${level}]: ${message}`
        })
    )
}

transports.push(
    new winston.transports.Console({
        level: 'debug',
        format: winstonFormat(),
    })
)

// Create the Winston logger
const logger = winston.createLogger({
    defaultMeta: {
        requestId: randomString(),
    },
    transports: transports,
})

export default logger
