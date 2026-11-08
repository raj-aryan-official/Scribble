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
    END_GAME_EARLY: 'endGameEarly',
    PLAY_AGAIN: 'playAgain',
    UPDATE_SETTINGS: 'updateSettings',

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
    KICKED: 'kicked',
    ERROR: 'error'
};

const GAME_STATES = {
    LOBBY: 'LOBBY',
    WORD_SELECTION: 'WORD_SELECTION',
    DRAWING: 'DRAWING',
    ROUND_END: 'ROUND_END',
    GAME_END: 'GAME_END'
};

module.exports = { EVENTS, GAME_STATES };
