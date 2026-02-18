const fs = require('fs');
const path = require('path');
const util = require('util');

const LOGGER_STATE_KEY = '__GYM_LICENSE_SERVER_FILE_LOGGER_STATE__';

function serializeArg(arg) {
    if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack || ''}`.trim();
    }
    if (typeof arg === 'string') return arg;
    return util.inspect(arg, { depth: 6, breakLength: 120, compact: false });
}

function appendLine(filePath, line, fallback) {
    try {
        fs.appendFileSync(filePath, `${line}\n`, 'utf8');
    } catch (error) {
        fallback('[FILE_LOGGER] Failed to write log entry:', error?.message || error);
    }
}

function initFileLogger(options = {}) {
    if (global[LOGGER_STATE_KEY]) {
        return global[LOGGER_STATE_KEY];
    }

    const serviceName = options.serviceName || 'license-server';
    const logsDir = options.logsDir || path.join(process.cwd(), 'logs');
    const combinedLogPath = path.join(logsDir, `${serviceName}.log`);
    const errorLogPath = path.join(logsDir, `${serviceName}-errors.log`);

    fs.mkdirSync(logsDir, { recursive: true });
    if (!fs.existsSync(combinedLogPath)) fs.writeFileSync(combinedLogPath, '', 'utf8');
    if (!fs.existsSync(errorLogPath)) fs.writeFileSync(errorLogPath, '', 'utf8');

    const originalConsole = {
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        log: console.log.bind(console)
    };

    const writeLog = (level, args) => {
        const message = args.map(serializeArg).join(' ');
        const line = `${new Date().toISOString()} [${serviceName}] [${level}] ${message}`;
        appendLine(combinedLogPath, line, originalConsole.error);
        if (level === 'ERROR' || level === 'FATAL') {
            appendLine(errorLogPath, line, originalConsole.error);
        }
    };

    console.warn = (...args) => {
        writeLog('WARN', args);
        originalConsole.warn(...args);
    };

    console.error = (...args) => {
        writeLog('ERROR', args);
        originalConsole.error(...args);
    };

    process.on('unhandledRejection', (reason) => {
        writeLog('FATAL', ['Unhandled Promise Rejection:', reason]);
        originalConsole.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
        writeLog('FATAL', ['Uncaught Exception:', error]);
        originalConsole.error('Uncaught Exception:', error);
    });

    const loggerState = {
        serviceName,
        logsDir,
        combinedLogPath,
        errorLogPath
    };

    global[LOGGER_STATE_KEY] = loggerState;
    originalConsole.log(`[FILE_LOGGER] ${serviceName} logs: ${errorLogPath}`);
    return loggerState;
}

module.exports = {
    initFileLogger
};
