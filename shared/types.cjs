const EVENTS = {
    JOIN_ROOM: 'joinRoom',
    CREATE_ROOM: 'createRoom',
    START_GAME: 'startGame',
    CHOOSE_WORD: 'chooseWord',
    DRAW_STROKE: 'drawStroke',
    UNDO_STROKE: 'undoStroke',
    CLEAR_CANVAS: 'clearCanvas',
    SEND_MESSAGE: 'sendMessage',
    KICK_PLAYER: 'kickPlayer',
    HEARTBEAT: 'heartbeat',
    END_GAME_EARLY: 'endGameEarly',

    // Voice Chat
    VOICE_JOIN: 'voiceJoin',
    VOICE_LEAVE: 'voiceLeave',
    VOICE_OFFER: 'voiceOffer',
    VOICE_ANSWER: 'voiceAnswer',
    ICE_CANDIDATE: 'iceCandidate',

    // Server -> Client
    ROOM_JOINED: 'roomJoined',
    PLAYER_JOINED: 'playerJoined',
    PLAYER_LEFT: 'playerLeft',
    GAME_STARTED: 'gameStarted',
    WORD_CHOICES: 'wordChoices',
    WORD_CHOSEN: 'wordChosen',
    STROKE_RECEIVED: 'strokeReceived',
    STROKE_UNDONE: 'strokeUndone',
    CANVAS_CLEARED: 'canvasCleared',
    MESSAGE_RECEIVED: 'messageReceived',
    CORRECT_GUESS: 'correctGuess',
    HINT_REVEALED: 'hintRevealed',
    TIMER_UPDATE: 'timerUpdate',
    ROUND_ENDED: 'roundEnded',
    GAME_ENDED: 'gameEnded',
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
