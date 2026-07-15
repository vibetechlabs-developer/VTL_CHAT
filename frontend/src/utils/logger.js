/**
 * Development-only logger
 * Logs are only output in development mode (import.meta.env.DEV)
 * In production, all calls are no-ops to avoid console output and reduce bundle size
 */

const isDev = import.meta.env.DEV;

const logger = {
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    if (isDev) {
      console.error(...args);
    }
  },
  info: (...args) => {
    if (isDev) {
      console.info(...args);
    }
  },
  debug: (...args) => {
    if (isDev) {
      console.debug(...args);
    }
  },
};

export default logger;
