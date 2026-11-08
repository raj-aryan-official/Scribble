const logger = require('../logger');

const roomChains = new Map();

/**
 * Enqueues an action on a per-room promise chain to guarantee
 * strict sequential processing of events for each room.
 *
 * If the room's queue is currently idle, actionFn is executed immediately
 * so synchronous operations remain immediate. If an action is already in flight,
 * subsequent actions are chained sequentially.
 *
 * @param {string} roomCode
 * @param {Function} actionFn
 * @returns {any} Result of actionFn or a Promise chaining to it
 */
function enqueueRoomAction(roomCode, actionFn) {
    if (!roomCode || typeof roomCode !== 'string') {
        return actionFn();
    }

    const currentPromise = roomChains.get(roomCode);
    if (!currentPromise) {
        let result;
        try {
            result = actionFn();
        } catch (err) {
            logger.error(`Error executing action for room ${roomCode}:`, err);
            return Promise.reject(err);
        }
        if (result && typeof result.then === 'function') {
            roomChains.set(roomCode, result);
            result.finally(() => {
                if (roomChains.get(roomCode) === result) {
                    roomChains.delete(roomCode);
                }
            });
        }
        return result;
    }

    const nextPromise = currentPromise
        .then(() => actionFn())
        .catch((err) => {
            logger.error(`Error executing action for room ${roomCode}:`, err);
        });

    roomChains.set(roomCode, nextPromise);

    nextPromise.finally(() => {
        if (roomChains.get(roomCode) === nextPromise) {
            roomChains.delete(roomCode);
        }
    });

    return nextPromise;
}

function clearRoomQueue(roomCode) {
    roomChains.delete(roomCode);
}

module.exports = {
    enqueueRoomAction,
    clearRoomQueue
};
