import winston from 'winston';
import env from '../config/env.js';

const consoleFormat = winston.format.printf(
  ({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaString}`;
  }
);

const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    consoleFormat
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
