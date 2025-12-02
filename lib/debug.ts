/**
 * Debug utility for production-safe logging
 * Only logs in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const debug = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, but sanitize in production
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, log errors but don't expose sensitive data
      const sanitized = args.map(arg => {
        if (typeof arg === 'string') {
          // Remove potential sensitive patterns
          return arg
            .replace(/api[_-]?key["\s:=]+[^\s"']+/gi, 'api[REDACTED]')
            .replace(/token["\s:=]+[^\s"']+/gi, 'token[REDACTED]')
            .replace(/password["\s:=]+[^\s"']+/gi, 'password[REDACTED]')
            .replace(/secret["\s:=]+[^\s"']+/gi, 'secret[REDACTED]');
        }
        return arg;
      });
      console.error(...sanitized);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
};

