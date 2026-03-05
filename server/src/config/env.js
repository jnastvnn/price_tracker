import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 3001),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: requireEnv('DATABASE_URL'),
  logLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  db: {
    poolMax: toNumber(process.env.DB_POOL_MAX, 10),
    idleTimeoutMs: toNumber(process.env.DB_IDLE_TIMEOUT, 30000),
    connectionTimeoutMs: toNumber(process.env.DB_CONN_TIMEOUT, 2000),
    ssl:
      process.env.DB_SSL === 'true' ||
      (process.env.DB_SSL !== 'false' &&
        process.env.NODE_ENV === 'production'),
  },
};

export default env;
