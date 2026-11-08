// Auto-generated from shared/types.js by npm run sync:shared. Do not edit directly.

const EVENTS = {
    // Client -> Server
    JOIN_ROOM: 'joinRoom',
    CREATE_ROOM: 'createRoom',
    REJOIN_ROOM: 'rejoinRoom',
    START_GAME: 'startGame',
    CHOOSE_WORD: 'chooseWord',
    DRAW_STROKE: 'drawStroke',
    STROKE_START: 'strokeStart',
    STROKE_POINTS: 'strokePoints',
    STROKE_END: 'strokeEnd',
    STROKE_HISTORY: 'strokeHistory',
    UNDO_STROKE: 'undoStroke',
    CLEAR_CANVAS: 'clearCanvas',
    SEND_MESSAGE: 'sendMessage',
    KICK_PLAYER: 'kickPlayer',
    EDIT_PROFILE: 'editProfile',
    END_GAME: 'endGame',
    END_GAME_EARLY: 'endGameEarly',
    PLAY_AGAIN: 'playAgain',
    UPDATE_SETTINGS: 'updateSettings',
    SKIP_ROUND_END: 'skipRoundEnd',
    CLAIM_SEAT: 'claimSeat',
    RESOLVE_SEAT_CLAIM: 'resolveSeatClaim',
    TAKE_OVER: 'takeOver',
    CLOCK_SYNC: 'clockSync',
    SYNC_REQUEST: 'syncRequest',

    // Voice Chat
    VOICE_JOIN: 'voiceJoin',
    VOICE_LEAVE: 'voiceLeave',
    VOICE_OFFER: 'voiceOffer',
    VOICE_ANSWER: 'voiceAnswer',
    ICE_CANDIDATE: 'iceCandidate',
    EXISTING_VOICE_USERS: 'existingVoiceUsers',

    // Server -> Client
    ROOM_JOINED: 'roomJoined',
    PLAYER_JOINED: 'playerJoined',
    GAME_STARTED: 'gameStarted',
    WORD_CHOICES: 'wordChoices',
    WORD_CHOSEN: 'wordChosen',
    DRAWER_WORD: 'drawerWord',
    STROKE_RECEIVED: 'strokeReceived',
    STROKE_UNDONE: 'strokeUndone',
    CANVAS_CLEARED: 'canvasCleared',
    MESSAGE_RECEIVED: 'messageReceived',
    CORRECT_GUESS: 'correctGuess',
    CLOSE_GUESS: 'closeGuess',
    HINT_UPDATE: 'hintUpdate',
    TIMER_UPDATE: 'timerUpdate',
    ROUND_ENDED: 'roundEnded',
    GAME_ENDED: 'gameEnded',
    STATE_SNAPSHOT: 'stateSnapshot',
    SUPERSEDED: 'superseded',
    PLAYER_STATUS: 'playerStatus',
    SEAT_CLAIM_AVAILABLE: 'seatClaimAvailable',
    SEAT_CLAIM_REQUEST: 'seatClaimRequest',
    SEAT_CLAIM_DECLINED: 'seatClaimDeclined',
    SEAT_CLAIM_ACCEPTED: 'seatClaimAccepted',
    TURN_INFO: 'turnInfo',
    AFK_NUDGE: 'afkNudge',
    GAME_PAUSED: 'gamePaused',
    GAME_RESUMED: 'gameResumed',
    KICKED: 'kicked',
    ERROR: 'error'
};

const GAME_STATES = {
    LOBBY: 'LOBBY',
    TURN_INTRO: 'TURN_INTRO',
    WORD_SELECTION: 'WORD_SELECTION',
    DRAWING: 'DRAWING',
    TURN_WAIT: 'TURN_WAIT',
    PAUSED: 'PAUSED',
    ROUND_END: 'ROUND_END',
    GAME_END: 'GAME_END'
};

module.exports = { EVENTS, GAME_STATES };
