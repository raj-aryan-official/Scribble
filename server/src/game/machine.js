const { GAME_STATES } = require('../../../shared/types.cjs');
const logger = require('../logger');

const TRANSITIONS = {
    [GAME_STATES.LOBBY]: {
        START_GAME: GAME_STATES.WORD_SELECTION,
        TURN_INTRO: GAME_STATES.TURN_INTRO,
        START_SELECTION: GAME_STATES.WORD_SELECTION,
        START_TURN: GAME_STATES.WORD_SELECTION,
        WORD_SELECTION: GAME_STATES.WORD_SELECTION,
        TURN_WAIT: GAME_STATES.TURN_WAIT,
        DRAWER_AWAY: GAME_STATES.TURN_WAIT,
        END_GAME: GAME_STATES.GAME_END
    },
    [GAME_STATES.TURN_INTRO]: {
        START_SELECTION: GAME_STATES.WORD_SELECTION,
        START_TURN: GAME_STATES.WORD_SELECTION,
        WORD_SELECTION: GAME_STATES.WORD_SELECTION,
        DRAWER_AWAY: GAME_STATES.TURN_WAIT,
        TURN_WAIT: GAME_STATES.TURN_WAIT,
        PAUSE: GAME_STATES.PAUSED,
        END_GAME: GAME_STATES.GAME_END
    },
    [GAME_STATES.WORD_SELECTION]: {
        WORD_CHOSEN: GAME_STATES.DRAWING,
        START_ROUND: GAME_STATES.DRAWING,
        START_SELECTION: GAME_STATES.WORD_SELECTION,
        START_TURN: GAME_STATES.WORD_SELECTION,
        WORD_SELECTION: GAME_STATES.WORD_SELECTION,
        DRAWER_AWAY: GAME_STATES.TURN_WAIT,
        TURN_WAIT: GAME_STATES.TURN_WAIT,
        ROUND_END: GAME_STATES.ROUND_END,
        END_ROUND: GAME_STATES.ROUND_END,
        PAUSE: GAME_STATES.PAUSED,
        END_GAME: GAME_STATES.GAME_END
    },
    [GAME_STATES.DRAWING]: {
        ROUND_END: GAME_STATES.ROUND_END,
        END_ROUND: GAME_STATES.ROUND_END,
        DRAWER_AWAY: GAME_STATES.PAUSED,
        PAUSE: GAME_STATES.PAUSED,
        END_GAME: GAME_STATES.GAME_END
    },
    [GAME_STATES.PAUSED]: {
        RESUME: (room) => room.previousState || GAME_STATES.DRAWING,
        DRAWER_RETURNED: (room) => room.previousState || GAME_STATES.DRAWING,
        ROUND_END: GAME_STATES.ROUND_END,
        END_ROUND: GAME_STATES.ROUND_END,
        END_GAME: GAME_STATES.GAME_END
    },
    [GAME_STATES.TURN_WAIT]: {
        START_SELECTION: GAME_STATES.WORD_SELECTION,
        START_TURN: GAME_STATES.WORD_SELECTION,
        WORD_SELECTION: GAME_STATES.WORD_SELECTION,
        DRAWER_RETURNED: GAME_STATES.WORD_SELECTION,
        TURN_WAIT: GAME_STATES.TURN_WAIT,
        ROUND_END: GAME_STATES.ROUND_END,
        END_ROUND: GAME_STATES.ROUND_END,
        PAUSE: GAME_STATES.PAUSED,
        END_GAME: GAME_STATES.GAME_END
    },
    [GAME_STATES.ROUND_END]: {
        START_TURN: GAME_STATES.WORD_SELECTION,
        START_SELECTION: GAME_STATES.WORD_SELECTION,
        WORD_SELECTION: GAME_STATES.WORD_SELECTION,
        TURN_INTRO: GAME_STATES.TURN_INTRO,
        TURN_WAIT: GAME_STATES.TURN_WAIT,
        DRAWER_AWAY: GAME_STATES.TURN_WAIT,
        END_GAME: GAME_STATES.GAME_END,
        GAME_END: GAME_STATES.GAME_END
    },
    [GAME_STATES.GAME_END]: {
        PLAY_AGAIN: GAME_STATES.LOBBY,
        START_GAME: GAME_STATES.WORD_SELECTION,
        START_TURN: GAME_STATES.WORD_SELECTION,
        START_SELECTION: GAME_STATES.WORD_SELECTION,
        END_GAME: GAME_STATES.GAME_END // Idempotent
    }
};

/**
 * Executes a state transition for the given room.
 * If the transition is not allowed from the current state, it is ignored and logged.
 *
 * @param {Object} room
 * @param {string} event
 * @param {Object} [payload]
 * @returns {{ success: boolean, from?: string, to?: string, reason?: string }}
 */
function transition(room, event, payload = {}) {
    if (!room || typeof room !== 'object') {
        return { success: false, reason: 'INVALID_ROOM' };
    }
    const currentState = room.gameState || GAME_STATES.LOBBY;
    const allowed = TRANSITIONS[currentState];

    if (!allowed || !(event in allowed)) {
        logger.warn(`[STATE_MACHINE] Illegal transition ignored: Room ${room.code || 'unknown'} in state ${currentState} cannot handle event '${event}'`);
        return { success: false, from: currentState, event, reason: 'ILLEGAL_TRANSITION' };
    }

    let nextState = allowed[event];
    if (typeof nextState === 'function') {
        nextState = nextState(room, payload);
    }

    if (!nextState || !GAME_STATES[nextState]) {
        logger.warn(`[STATE_MACHINE] Transition yielded invalid target state '${nextState}' for room ${room.code || 'unknown'}`);
        return { success: false, from: currentState, event, reason: 'INVALID_TARGET_STATE' };
    }

    if (nextState === GAME_STATES.PAUSED && currentState !== GAME_STATES.PAUSED) {
        room.previousState = currentState;
    }

    const fromState = currentState;
    room.gameState = nextState;
    logger.info(`[STATE_MACHINE] Room ${room.code || 'unknown'} transition: ${fromState} -> ${nextState} (event: ${event})`);

    return { success: true, from: fromState, to: nextState };
}

function canTransition(room, event) {
    if (!room || !room.gameState) return false;
    const allowed = TRANSITIONS[room.gameState];
    return Boolean(allowed && event in allowed);
}

function canDraw(room) {
    return Boolean(room && room.gameState === GAME_STATES.DRAWING);
}

function canGuess(room) {
    return Boolean(room && room.gameState === GAME_STATES.DRAWING);
}

function canChooseWord(room) {
    return Boolean(room && room.gameState === GAME_STATES.WORD_SELECTION);
}

function canStartGame(room) {
    return Boolean(room && (room.gameState === GAME_STATES.LOBBY || room.gameState === GAME_STATES.GAME_END));
}

module.exports = {
    GAME_STATES,
    TRANSITIONS,
    transition,
    canTransition,
    canDraw,
    canGuess,
    canChooseWord,
    canStartGame
};
