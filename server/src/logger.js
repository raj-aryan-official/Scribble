const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info');

function scrub(arg) {
    if (arg instanceof Error) {
        return arg.stack || arg.message;
    }
    if (typeof arg === 'string') {
        return arg.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[SESSION]');
    }
    if (arg && typeof arg === 'object') {
        const copy = Array.isArray(arg) ? [...arg] : { ...arg };
        if (copy.sessionId) copy.sessionId = '[SCRUBBED]';
        if (copy.wordToGuess) copy.wordToGuess = '[SCRUBBED]';
        return copy;
    }
    return arg;
}

function log(level, message, ...args) {
    if (LOG_LEVELS[level] < LOG_LEVELS[CURRENT_LEVEL]) return;
    const timestamp = new Date().toISOString();
    const cleanArgs = args.map(scrub);
    const fn = console[level] || console.log;
    fn(`[${timestamp}] [${level.toUpperCase()}]`, scrub(message), ...cleanArgs);
}

module.exports = {
    debug: (msg, ...args) => log('debug', msg, ...args),
    info: (msg, ...args) => log('info', msg, ...args),
    warn: (msg, ...args) => log('warn', msg, ...args),
    error: (msg, ...args) => log('error', msg, ...args)
};

