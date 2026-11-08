/**
 * In-memory Token Bucket Rate Limiter
 * Tracks token buckets per IP and per socket.
 */

class TokenBucket {
    constructor(capacity = 10, refillRatePerSec = 1) {
        this.capacity = capacity;
        this.refillRate = refillRatePerSec / 1000; // tokens per ms
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    consume(cost = 1) {
        const now = Date.now();
        const elapsed = Math.max(0, now - this.lastRefill);
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;

        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }
        return false;
    }
}

const socketBuckets = new Map();
const ipBuckets = new Map();

function getBucket(store, key, capacity, refillRatePerSec) {
    if (!store.has(key)) {
        store.set(key, new TokenBucket(capacity, refillRatePerSec));
    }
    return store.get(key);
}

/**
 * Checks and consumes tokens for a given socket and/or IP.
 * Returns true if allowed, false if limit exceeded.
 *
 * @param {string} [socketId]
 * @param {string} [ip]
 * @param {string} [action]
 * @param {number} [cost]
 * @param {number} [capacity]
 * @param {number} [refillRatePerSec]
 * @returns {boolean}
 */
function checkLimit({ socketId, ip, action = 'default', cost = 1, capacity = 10, refillRatePerSec = 1 }) {
    if (socketId) {
        const key = `${action}:socket:${socketId}`;
        const bucket = getBucket(socketBuckets, key, capacity, refillRatePerSec);
        if (!bucket.consume(cost)) {
            return false;
        }
    }

    if (ip) {
        const key = `${action}:ip:${ip}`;
        const bucket = getBucket(ipBuckets, key, capacity, refillRatePerSec);
        if (!bucket.consume(cost)) {
            return false;
        }
    }

    return true;
}

function checkCreateRoomLimit(socket) {
    const ip = socket?.handshake?.address || socket?.conn?.remoteAddress;
    return checkLimit({
        socketId: socket?.id,
        ip,
        action: 'createRoom',
        cost: 1,
        capacity: 10,
        refillRatePerSec: 1
    });
}

function checkJoinRoomLimit(socket) {
    const ip = socket?.handshake?.address || socket?.conn?.remoteAddress;
    return checkLimit({
        socketId: socket?.id,
        ip,
        action: 'joinRoom',
        cost: 1,
        capacity: 10,
        refillRatePerSec: 1
    });
}

function recordWrongRoomCode(socket) {
    const ip = socket?.handshake?.address || socket?.conn?.remoteAddress;
    // Consumes 3 tokens on wrong room codes to quickly throttle brute force
    return checkLimit({
        socketId: socket?.id,
        ip,
        action: 'wrongRoom',
        cost: 3,
        capacity: 10,
        refillRatePerSec: 1
    });
}

function resetRateLimits() {
    socketBuckets.clear();
    ipBuckets.clear();
}

module.exports = {
    TokenBucket,
    checkLimit,
    checkCreateRoomLimit,
    checkJoinRoomLimit,
    recordWrongRoomCode,
    resetRateLimits
};

