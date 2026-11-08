export const EVENTS = {
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
    START_VOTE_KICK: 'startVoteKick',
    CAST_VOTE: 'castVote',
    CANCEL_VOTE_KICK: 'cancelVoteKick',
    REACT: 'react',
    LIKE_DRAWING: 'likeDrawing',
    EDIT_PROFILE: 'editProfile',
    END_GAME: 'endGame',
    END_GAME_EARLY: 'endGameEarly',
    PLAY_AGAIN: 'playAgain',
    UPDATE_SETTINGS: 'updateSettings',
    ASSIGN_TEAM: 'assignTeam',
    RANDOMIZE_TEAMS: 'randomizeTeams',
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
    VOTE_STATE: 'voteState',
    KICKED: 'kicked',
    REACTION_BATCH: 'reactionBatch',
    LIKE_UPDATE: 'likeUpdate',
    ERROR: 'error'
};

export const GAME_STATES = {
    LOBBY: 'LOBBY',
    TURN_INTRO: 'TURN_INTRO',
    WORD_SELECTION: 'WORD_SELECTION',
    DRAWING: 'DRAWING',
    TURN_WAIT: 'TURN_WAIT',
    PAUSED: 'PAUSED',
    ROUND_END: 'ROUND_END',
    GAME_END: 'GAME_END'
};

export const TWIST_FREQUENCIES = {
    OFF: 'off',
    SOMETIMES: 'sometimes',
    EVERY: 'every'
};

export const TWIST_IDS = [
    'one-colour',
    'limited-ink',
    'no-undo-eraser',
    'thin-line',
    'mirror',
    'upside-down',
    'blindfold',
    'speed',
    'wobbly-pen',
    'first-guesser-bonus'
];

export const TWIST_DEFINITIONS = {
    'one-colour': {
        id: 'one-colour',
        name: 'One colour',
        rule: 'The colour is locked to a single shade this turn.',
        badge: 'One colour',
        icon: 'palette'
    },
    'limited-ink': {
        id: 'limited-ink',
        name: 'Limited ink',
        rule: 'Ink drains as you draw. Undo refunds ink; eraser is free.',
        badge: 'Limited ink',
        icon: 'droplet'
    },
    'no-undo-eraser': {
        id: 'no-undo-eraser',
        name: 'No undo or eraser',
        rule: 'Eraser and undo are disabled this turn. Every mark is final.',
        badge: 'No undo/eraser',
        icon: 'ban'
    },
    'thin-line': {
        id: 'thin-line',
        name: 'Thin line only',
        rule: 'Brush size is locked at 2. Precision sketching only!',
        badge: 'Thin line',
        icon: 'minus'
    },
    'mirror': {
        id: 'mirror',
        name: 'Mirror',
        rule: 'Every stroke is mirrored across the vertical centre line.',
        badge: 'Mirror',
        icon: 'flip-horizontal'
    },
    'upside-down': {
        id: 'upside-down',
        name: 'Upside-down paper',
        rule: 'The drawer’s paper is turned upside-down!',
        badge: 'Upside-down',
        icon: 'rotate-cw'
    },
    'blindfold': {
        id: 'blindfold',
        name: 'Blindfold',
        rule: 'After 3 seconds, the drawer’s paper goes dark!',
        badge: 'Blindfold',
        icon: 'eye-off'
    },
    'speed': {
        id: 'speed',
        name: 'Speed',
        rule: 'Half the draw time, double points for everyone!',
        badge: 'Speed 2x',
        icon: 'zap'
    },
    'wobbly-pen': {
        id: 'wobbly-pen',
        name: 'Wobbly pen',
        rule: 'The pen is shivering! Jitter added to each stroke.',
        badge: 'Wobbly pen',
        icon: 'activity'
    },
    'first-guesser-bonus': {
        id: 'first-guesser-bonus',
        name: 'First guesser bonus',
        rule: 'The first player to guess correctly scores double points!',
        badge: 'First guess 2x',
        icon: 'award'
    }
};

export const GAME_MODES = {
    CLASSIC: 'classic',
    SPEED: 'speed',
    TEAM: 'team',
    RELAY: 'relay',
    HARD: 'hard',
    CUSTOM: 'custom'
};

export const ALLOWED_MODES = [
    'classic',
    'speed',
    'team',
    'relay',
    'hard',
    'custom'
];

export const MODE_DEFINITIONS = {
    'classic': {
        id: 'classic',
        name: 'Classic',
        description: 'Standard Scribble. Take turns drawing secret words while others race to guess.',
        icon: 'pencil'
    },
    'speed': {
        id: 'speed',
        name: 'Speed',
        description: '30 s turns, 8 short rounds, and a smaller word pool of easy words.',
        icon: 'zap'
    },
    'team': {
        id: 'team',
        name: 'Team',
        description: '2 to 4 teams. Teams draw in turns; only teammates guess for their team. Shared team scores on the leaderboard.',
        icon: 'users'
    },
    'relay': {
        id: 'relay',
        name: 'Relay',
        description: 'One secret word, N players each draw for 10 s in turn on the same paper. Guessers guess at the end, and the score is split.',
        icon: 'git-merge'
    },
    'hard': {
        id: 'hard',
        name: 'Hard',
        description: 'Only one hint is ever revealed, and points are 1.5x.',
        icon: 'flame'
    },
    'custom': {
        id: 'custom',
        name: 'Custom',
        description: 'Host sets time, hint count, rounds, and a score multiplier.',
        icon: 'sliders'
    }
};

export const WORD_LANGUAGES = {
    ENGLISH: 'english',
    HINDI: 'hindi',
    HINGLISH: 'hinglish'
};

export const ALLOWED_WORD_LANGUAGES = [
    'english',
    'hindi',
    'hinglish'
];

export const REGIONAL_PACKS = [
    'objects',
    'food',
    'festivals',
    'cricket',
    'subjects',
    'places',
    'animals',
    'cinema'
];

export const REGIONAL_PACK_DEFINITIONS = {
    'objects': { id: 'objects', label: 'Everyday Objects' },
    'food': { id: 'food', label: 'Desi Food' },
    'festivals': { id: 'festivals', label: 'Festivals' },
    'cricket': { id: 'cricket', label: 'Cricket' },
    'subjects': { id: 'subjects', label: 'School & Subjects' },
    'places': { id: 'places', label: 'Cities & Monuments' },
    'animals': { id: 'animals', label: 'Animals' },
    'cinema': { id: 'cinema', label: 'Cinema & Bollywood' }
};
