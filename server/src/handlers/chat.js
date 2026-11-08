const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { normalize, isCorrect, isClose } = require('../guess');
const blocklist = require('../blocklist');
const { rejectWithError, getMemberRoom } = require('./utils');
const { calculateGuessScore, calculateDrawerBonus } = require('../game/scoring');
const { getTimeLeft, recordChatMessage, endRound } = require('../game/loop');

// Per-socket message rate-limiting store (socketId -> Array<timestamp>)
const socketMessageTimestamps = new Map();

const filterProfanity = (text, secretWord) => {
    if (!text) return '';
    let result = text;
    const normSecret = secretWord ? normalize(secretWord) : '';

    for (const badWord of blocklist) {
        if (normSecret && normalize(badWord) === normSecret) {
            continue;
        }
        const regex = new RegExp(`\\b${badWord}\\b`, 'gi');
        result = result.replace(regex, (match) => '*'.repeat(match.length));
    }
    return result;
};

const maskWord = (text, secretWord) => {
    if (!text || !secretWord) return text;
    const normWord = secretWord.trim();
    if (!normWord) return text;
    const escaped = normWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    return text.replace(regex, (match) => '*'.repeat(match.length));
};

function registerChatHandlers(io, socket, safeOn) {
    safeOn(EVENTS.SEND_MESSAGE, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }

        // Rate-limit: 5 messages per 3 seconds per socket
        const now = Date.now();
        const timestamps = socketMessageTimestamps.get(socket.id) || [];
        const recentTimestamps = timestamps.filter(t => now - t < 3000);
        if (recentTimestamps.length >= 5) {
            return rejectWithError(socket, 'Slow down');
        }
        recentTimestamps.push(now);
        socketMessageTimestamps.set(socket.id, recentTimestamps);

        // Trim, reject empty, cap at 100 characters, strip control characters
        const rawText = typeof payload.text === 'string' ? payload.text : '';
        const stripped = rawText.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        const trimmed = stripped.trim();
        if (!trimmed) {
            return;
        }
        const text = trimmed.slice(0, 100);

        const player = room.players.find(p => p.id === socket.id);
        const drawer = room.players[room.currentDrawerIndex];
        const isCurrentDrawer = drawer && drawer.id === socket.id;
        const hasAlreadyGuessed = Boolean(room.guessedPlayers && room.guessedPlayers.has(socket.id));

        // CHANNELS:
        // The drawer and players who already guessed this round chat in a 'guessed' channel that only they receive
        if (room.gameState === GAME_STATES.DRAWING && (isCurrentDrawer || hasAlreadyGuessed)) {
            let filtered = filterProfanity(text, room.wordToGuess);
            filtered = maskWord(filtered, room.wordToGuess);

            const chatMsg = {
                username: player?.username || 'Unknown',
                text: filtered,
                type: 'guessed',
                senderId: socket.id
            };
            recordChatMessage(room, chatMsg);
            io.to(`${room.code}:guessed`).emit(EVENTS.MESSAGE_RECEIVED, chatMsg);
            return;
        }

        // Active game during DRAWING phase: message from player who hasn't guessed yet
        if (room.gameState === GAME_STATES.DRAWING && room.wordToGuess) {
            if (isCorrect(text, room.wordToGuess)) {
                if (!room.guessedPlayers) room.guessedPlayers = new Set();
                room.guessedPlayers.add(socket.id);
                socket.join(`${room.code}:guessed`);

                if (!room.scores) room.scores = {};
                if (!room.scores[socket.id]) room.scores[socket.id] = 0;
                const drawerId = room.drawerId || drawer?.id;
                if (drawerId && !room.scores[drawerId]) room.scores[drawerId] = 0;

                const totalTime = room.settings?.drawTime || 60;
                const timeLeft = getTimeLeft(room);
                const isFirstGuesser = room.guessedPlayers.size === 1;
                const gained = calculateGuessScore(timeLeft, totalTime, isFirstGuesser);

                room.scores[socket.id] += gained;
                const total = room.scores[socket.id];

                if (!room.roundGained) room.roundGained = {};
                room.roundGained[socket.id] = (room.roundGained[socket.id] || 0) + gained;

                // Drawer bonus at 10% of each guess
                if (drawerId) {
                    const drawerBonus = calculateDrawerBonus(gained);
                    room.scores[drawerId] += drawerBonus;
                    room.roundGained[drawerId] = (room.roundGained[drawerId] || 0) + drawerBonus;
                }

                // Send the word ONLY to the player who guessed it
                socket.emit(EVENTS.CORRECT_GUESS, {
                    playerId: socket.id,
                    gained,
                    total,
                    points: total,
                    word: room.wordToGuess
                });

                // Broadcast to others WITHOUT the word
                socket.to(room.code).emit(EVENTS.CORRECT_GUESS, {
                    playerId: socket.id,
                    gained,
                    total,
                    points: total
                });

                const correctMsg = {
                    username: player?.username || 'Unknown',
                    text: `Guessed the word! (+${gained})`,
                    type: 'correct',
                    gained,
                    playerId: socket.id
                };
                recordChatMessage(room, correctMsg);
                io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, correctMsg);

                const activeGuessers = room.players.filter(p => !p.isDisconnected && p.id !== drawerId).length;
                if (room.guessedPlayers.size >= activeGuessers && activeGuessers > 0) {
                    endRound(io, room);
                }
                return;
            }

            // A near miss emits CLOSE_GUESS only to that sender. Do not broadcast it.
            if (isClose(text, room.wordToGuess)) {
                socket.emit(EVENTS.CLOSE_GUESS, { message: 'Close!' });
            }
        }

        // Standard chat message: filter profanity and mask secret word
        let filtered = filterProfanity(text, room.wordToGuess);
        filtered = maskWord(filtered, room.wordToGuess);

        const chatMsg = {
            username: player?.username || 'Unknown',
            text: filtered,
            type: 'chat',
            senderId: socket.id
        };
        recordChatMessage(room, chatMsg);
        io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, chatMsg);
    });
}

module.exports = {
    registerChatHandlers,
    filterProfanity,
    maskWord,
    socketMessageTimestamps
};
