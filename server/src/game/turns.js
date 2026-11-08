const { v4: uuidv4 } = require('uuid');
const { GAME_STATES } = require('../../../shared/types.cjs');

/**
 * Creates a unique identifier for a turn.
 */
function createTurnId() {
    return `turn_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
}

/**
 * Builds the initial turn queue from room.records for all players who are
 * connected or away, ordered strictly by join time (joinedAt).
 *
 * @param {Object} room
 * @returns {string[]} Array of unique playerIds
 */
function buildInitialQueue(room) {
    if (!room || !room.records) return [];
    const eligible = Array.from(room.records.values())
        .filter((r) => r.status === 'connected' || r.status === 'away')
        .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    const seen = new Set();
    const queue = [];
    for (const p of eligible) {
        if (!seen.has(p.playerId)) {
            seen.add(p.playerId);
            queue.push(p.playerId);
        }
    }
    return queue;
}

/**
 * Initializes the turn system for a new game.
 *
 * @param {Object} room
 */
function initGameTurns(room) {
    room.round = 1;
    room.currentRound = 1;
    room.makeUpQueue = [];
    room.nextRoundQueue = [];
    room.waitingForDrawerId = null;
    room.currentTurnId = null;
    room.eligibleGuessers = new Set();

    if (room.timers?.turnWait) {
        clearTimeout(room.timers.turnWait);
        room.timers.turnWait = null;
    }

    room.turnQueue = buildInitialQueue(room);
    room.turnsInRound = room.turnQueue.length;
    room.turnInRound = 0;
}

/**
 * Handles a late joiner during an active game:
 * - Becomes a guesser at once, starts on 0 points.
 * - Appended to the end of this round's queue if at least one turn is still ahead.
 * - If they join during the last turn of a round, they go into the next round's queue.
 *
 * @param {Object} room
 * @param {string} playerId
 */
function handleLateJoin(room, playerId) {
    if (!room || !room.records || !room.records.has(playerId)) return;
    const record = room.records.get(playerId);
    if (!record || record.status === 'left') return;
    if (room.gameState === GAME_STATES.LOBBY || room.gameState === GAME_STATES.GAME_END) return;

    if (!Array.isArray(room.turnQueue)) room.turnQueue = [];
    if (!Array.isArray(room.nextRoundQueue)) room.nextRoundQueue = [];
    if (!Array.isArray(room.makeUpQueue)) room.makeUpQueue = [];

    // Deduplication check: do not add if already in any queue or currently drawing
    if (
        room.turnQueue.includes(playerId) ||
        room.nextRoundQueue.includes(playerId) ||
        room.makeUpQueue.includes(playerId) ||
        room.drawerId === playerId
    ) {
        return;
    }

    // Is there at least one turn still ahead in this round?
    // If turnQueue has at least one player remaining, append to current round's queue
    if (room.turnQueue.length > 0) {
        room.turnQueue.push(playerId);
        room.turnsInRound = (room.turnsInRound || 0) + 1;
    } else {
        // Last turn of the round is currently in progress (turnQueue is empty) -> next round's queue
        room.nextRoundQueue.push(playerId);
    }
}

/**
 * A player who leaves ('left') is removed from all queues.
 *
 * @param {Object} room
 * @param {string} playerId
 */
function handlePlayerLeft(room, playerId) {
    if (!room) return;
    if (Array.isArray(room.turnQueue)) {
        room.turnQueue = room.turnQueue.filter((id) => id !== playerId);
    }
    if (Array.isArray(room.makeUpQueue)) {
        room.makeUpQueue = room.makeUpQueue.filter((id) => id !== playerId);
    }
    if (Array.isArray(room.nextRoundQueue)) {
        room.nextRoundQueue = room.nextRoundQueue.filter((id) => id !== playerId);
    }
    if (room.waitingForDrawerId === playerId) {
        if (room.timers?.turnWait) {
            clearTimeout(room.timers.turnWait);
            room.timers.turnWait = null;
        }
        room.waitingForDrawerId = null;
    }
}

/**
 * Returning player:
 * - If their turn is still ahead, they keep their place in turnQueue.
 * - If their turn passed while they were away (recorded in missedDraws),
 *   they get one make-up turn at the end of that round if they are connected by then;
 *   otherwise it is skipped with no penalty.
 *
 * @param {Object} room
 * @param {string} playerId
 */
function handlePlayerReturn(room, playerId) {
    if (!room || !room.records) return;
    let record = room.records.get(playerId);
    if (!record) {
        for (const r of room.records.values()) {
            if (r.socketId === playerId) {
                record = r;
                break;
            }
        }
    }
    if (!record) return;
    const effectivePlayerId = record.playerId;

    if (!Array.isArray(room.turnQueue)) room.turnQueue = [];
    if (!Array.isArray(room.makeUpQueue)) room.makeUpQueue = [];
    if (!Array.isArray(room.nextRoundQueue)) room.nextRoundQueue = [];

    // If turn is still ahead or currently drawing, keep their place!
    if (
        room.turnQueue.includes(effectivePlayerId) ||
        room.turnQueue.includes(playerId) ||
        room.drawerId === effectivePlayerId ||
        room.drawerId === playerId
    ) {
        return;
    }

    // If already scheduled for make-up, do not duplicate
    if (room.makeUpQueue.includes(effectivePlayerId) || room.makeUpQueue.includes(playerId)) {
        return;
    }

    // Check if they missed their turn in the current round
    const currentRound = room.round || 1;
    const drawsThisRound = (record.drawsDone || []).filter((d) => d.round === currentRound).length;
    const missedThisRound = (record.missedDraws || []).filter((m) => m.round === currentRound).length;

    if (drawsThisRound === 0 && missedThisRound > 0) {
        // Owed one make-up turn at the end of that round
        room.makeUpQueue.push(effectivePlayerId);
    }
}

/**
 * Selects the next drawer candidate from the queue or make-up turns.
 *
 * @param {Object} room
 * @returns {{ candidateId: string | null, isMakeUp: boolean, isRoundOver: boolean }}
 */
function getNextDrawerCandidate(room) {
    if (!room) return { candidateId: null, isMakeUp: false, isRoundOver: true };
    if (!Array.isArray(room.turnQueue)) room.turnQueue = [];
    if (!Array.isArray(room.makeUpQueue)) room.makeUpQueue = [];

    // 1. Regular turn queue
    while (room.turnQueue.length > 0) {
        const candidateId = room.turnQueue.shift();
        const record = room.records?.get(candidateId);
        // Skip permanently left players
        if (!record || record.status === 'left') {
            continue;
        }
        return { candidateId, isMakeUp: false, isRoundOver: false };
    }

    // 2. Make-up turns
    while (room.makeUpQueue.length > 0) {
        const candidateId = room.makeUpQueue.shift();
        const record = room.records?.get(candidateId);
        if (!record || record.status === 'left') {
            continue;
        }
        // "They get one make-up turn at the end of that round if they are connected by then; otherwise it is skipped with no penalty."
        if (record.status === 'connected') {
            return { candidateId, isMakeUp: true, isRoundOver: false };
        }
        // If away/disconnected at make-up turn, skip with no penalty
    }

    return { candidateId: null, isMakeUp: false, isRoundOver: true };
}

/**
 * Advances to the next round when current round turns and make-up turns are done.
 * Rebuilds queue from all connected or away players in join order,
 * plus any late joiners from nextRoundQueue.
 *
 * @param {Object} room
 * @returns {boolean} true if new round started, false if game is over
 */
function advanceRound(room) {
    const totalRounds = room.settings?.rounds || 3;
    const currentRound = room.round || 1;

    if (currentRound >= totalRounds) {
        return false; // Game over
    }

    room.round = currentRound + 1;
    room.currentRound = room.round;
    room.makeUpQueue = [];

    // Rebuild queue from all connected or away players in join order
    const nextQueue = buildInitialQueue(room);

    // Merge in any players from nextRoundQueue who are not already in nextQueue
    if (Array.isArray(room.nextRoundQueue)) {
        for (const pid of room.nextRoundQueue) {
            const rec = room.records?.get(pid);
            if (rec && rec.status !== 'left' && !nextQueue.includes(pid)) {
                nextQueue.push(pid);
            }
        }
    }
    room.nextRoundQueue = [];
    room.turnQueue = nextQueue;
    room.turnsInRound = nextQueue.length;
    room.turnInRound = 0;
    return true;
}

/**
 * Records a completed drawing turn for a player.
 *
 * @param {Object} room
 * @param {string} playerId
 * @param {string} turnId
 */
function recordTurnDraw(room, playerId, turnId) {
    if (!room || !room.records) return;
    let record = room.records.get(playerId);
    if (!record) {
        for (const r of room.records.values()) {
            if (r.socketId === playerId) {
                record = r;
                break;
            }
        }
    }
    if (!record) return;
    if (!Array.isArray(record.drawsDone)) record.drawsDone = [];
    record.drawsDone.push({
        turnId: turnId || room.currentTurnId,
        round: room.round || 1,
        timestamp: Date.now()
    });
}

/**
 * Records a missed drawing turn for a player.
 *
 * @param {Object} room
 * @param {string} playerId
 * @param {string} turnId
 */
function recordTurnMiss(room, playerId, turnId) {
    if (!room || !room.records) return;
    let record = room.records.get(playerId);
    if (!record) {
        for (const r of room.records.values()) {
            if (r.socketId === playerId) {
                record = r;
                break;
            }
        }
    }
    if (!record) return;
    if (!Array.isArray(record.missedDraws)) record.missedDraws = [];
    record.missedDraws.push({
        turnId: turnId || room.currentTurnId || createTurnId(),
        round: room.round || 1,
        timestamp: Date.now()
    });
}

/**
 * Snapshots eligible guessers present at word selection.
 * The drawer's bonus counts only guessers who were present when the word was chosen.
 *
 * @param {Object} room
 */
function snapshotEligibleGuessers(room) {
    if (!room || !room.records) return;
    const drawerId = room.drawerId;
    const eligible = new Set();
    for (const [playerId, rec] of room.records.entries()) {
        if (rec.status === 'connected' && playerId !== drawerId && rec.socketId !== drawerId) {
            eligible.add(playerId);
            if (rec.socketId) eligible.add(rec.socketId);
        }
    }
    room.eligibleGuessers = eligible;
}

/**
 * Checks whether a guesser is eligible to grant the drawer a bonus.
 *
 * @param {Object} room
 * @param {string} guesserIdentifier playerId or socketId
 * @returns {boolean}
 */
function isGuesserEligibleForBonus(room, guesserIdentifier) {
    if (!room.eligibleGuessers || room.eligibleGuessers.size === 0) return true;
    return room.eligibleGuessers.has(guesserIdentifier);
}

/**
 * Checks if a new player can join the room.
 * Away players keep their seat, so a new joiner gets 'Room full'
 * only when connected plus away is at least maxPlayers.
 *
 * @param {Object} room
 * @returns {boolean}
 */
function canJoinRoom(room) {
    if (!room) return false;
    const max = room.settings?.maxPlayers || 12;
    if (!room.records) return true;
    const activeSeats = Array.from(room.records.values()).filter(
        (r) => r.status === 'connected' || r.status === 'away'
    ).length;
    return activeSeats < max;
}

/**
 * Constructs the standard TURN_INFO broadcast payload.
 *
 * @param {Object} room
 * @returns {Object}
 */
function buildTurnInfo(room) {
    if (!room) return null;
    const totalRounds = room.settings?.rounds || 3;
    const nextDrawerId = (room.turnQueue && room.turnQueue.length > 0)
        ? room.turnQueue[0]
        : (room.makeUpQueue && room.makeUpQueue.length > 0 ? room.makeUpQueue[0] : null);

    return {
        turnId: room.currentTurnId || null,
        round: room.round || 1,
        totalRounds,
        turnInRound: room.turnInRound || 1,
        turnsInRound: room.turnsInRound || (room.turnQueue ? room.turnQueue.length : 1),
        drawerId: room.drawerId || null,
        nextDrawerId,
        queue: Array.isArray(room.turnQueue) ? [...room.turnQueue] : []
    };
}

module.exports = {
    createTurnId,
    initGameTurns,
    buildInitialQueue,
    handleLateJoin,
    handlePlayerLeft,
    handlePlayerReturn,
    getNextDrawerCandidate,
    advanceRound,
    recordTurnDraw,
    recordTurnMiss,
    snapshotEligibleGuessers,
    isGuesserEligibleForBonus,
    canJoinRoom,
    buildTurnInfo
};
