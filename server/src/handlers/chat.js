const { v4: uuidv4 } = require('uuid');
const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { normalize, getGraphemes } = require('../guess');
const blocklist = require('../blocklist');
const { rejectWithError, getMemberRoom, sanitiseText } = require('./utils');
const { getTimeLeft, recordChatMessage, endRound } = require('../game/loop');
const { isGuesserEligibleForBonus } = require('../game/turns');
const { getMode } = require('../modes');

// Per-socket message rate-limiting store (socketId -> Array<timestamp>)
const socketMessageTimestamps = new Map();
// Per-socket clientMsgId store for deduplicating double submits (socketId -> Array<clientMsgId>)
const socketClientMsgIds = new Map();

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const filterProfanity = (text, secretWord) => {
    if (!text) return '';
    let result = text;
    const normSecret = secretWord ? normalize(secretWord) : '';

    for (const badWord of blocklist) {
        if (normSecret && normalize(badWord) === normSecret) {
            continue;
        }
        const escaped = escapeRegExp(badWord);
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        result = result.replace(regex, (match) => '*'.repeat(match.length));
    }
    return result;
};

const maskWord = (text, secretWord, aliases = []) => {
    if (!text || !secretWord) return text;
    const wordsToMask = [secretWord, ...(Array.isArray(aliases) ? aliases : [])]
        .map(w => (typeof w === 'string' ? w.trim() : ''))
        .filter(w => w.length > 0);

    if (wordsToMask.length === 0) return text;

    // Longer words first so full aliases get replaced before substrings
    wordsToMask.sort((a, b) => b.length - a.length);

    let result = text;
    for (const target of wordsToMask) {
        const escaped = escapeRegExp(target);
        const regex = new RegExp(escaped, 'gi');
        result = result.replace(regex, (match) => {
            const count = getGraphemes(match).length;
            return '*'.repeat(Math.max(1, count));
        });
    }
    return result;
};

function registerChatHandlers(io, socket, safeOn) {
    socket.on('disconnect', () => {
        socketMessageTimestamps.delete(socket.id);
        socketClientMsgIds.delete(socket.id);
    });

    safeOn(EVENTS.SEND_MESSAGE, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }

        // Double submit protection: drop if clientMsgId was seen in last 20 messages for this socket
        if (payload.clientMsgId) {
            let seenIds = socketClientMsgIds.get(socket.id);
            if (!seenIds) {
                seenIds = [];
                socketClientMsgIds.set(socket.id, seenIds);
            }
            if (seenIds.includes(payload.clientMsgId)) {
                return; // Drop repeat
            }
            seenIds.push(payload.clientMsgId);
            if (seenIds.length > 20) {
                seenIds.shift();
            }
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

        // Trim, reject empty, cap at 100 characters, sanitize via sanitiseText (E18)
        const text = sanitiseText(typeof payload.text === 'string' ? payload.text : '', 100);
        if (!text) {
            return;
        }

        // Limit emoji count per message (maximum 10 emojis to prevent spam/abuse)
        const emojiMatches = text.match(/\p{Extended_Pictographic}/ug) || [];
        if (emojiMatches.length > 10) {
            return rejectWithError(socket, 'Too many emojis in message (maximum 10)');
        }

        const player = room.players.find(p => p.id === socket.id);
        const drawer = room.players[room.currentDrawerIndex];
        const isCurrentDrawer = drawer && drawer.id === socket.id;
        const hasAlreadyGuessed = Boolean(room.guessedPlayers && room.guessedPlayers.has(socket.id));

        // CHANNELS:
        // The drawer and players who already guessed this round chat in a 'guessed' channel that only they receive
        if (room.gameState === GAME_STATES.DRAWING && (isCurrentDrawer || hasAlreadyGuessed)) {
            let filtered = filterProfanity(text, room.wordToGuess);
            filtered = maskWord(filtered, room.wordToGuess, room.wordAliases);

            const chatMsg = {
                id: uuidv4(),
                ts: Date.now(),
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
        // E20: Stale turnId messages are dropped from being counted as guesses
        const isStaleTurn = Boolean(payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId);
        const mode = getMode(room.settings?.mode);
        const guessCheck = mode.onGuess(room, socket.id, text);

        if (room.gameState === GAME_STATES.DRAWING && room.wordToGuess && !isStaleTurn && guessCheck.allowed) {
            if (guessCheck.isCorrect) {
                if (!room.guessedPlayers) room.guessedPlayers = new Set();
                room.guessedPlayers.add(socket.id);
                socket.join(`${room.code}:guessed`);

                if (!room.scores) room.scores = {};
                if (!room.scores[socket.id]) room.scores[socket.id] = 0;
                const drawerId = room.drawerId || drawer?.id;
                if (drawerId && !room.scores[drawerId]) room.scores[drawerId] = 0;

                const rawDrawTime = room.settings?.drawTime || 60;
                const totalTime = room.currentTwist?.id === 'speed' ? Math.max(15, Math.round(rawDrawTime / 2)) : rawDrawTime;
                const timeLeft = getTimeLeft(room);
                const isFirstGuesser = room.guessedPlayers.size === 1;
                if (isFirstGuesser) {
                    room.fastestGuesserId = socket.id;
                }
                const scoreResult = mode.score(room, {
                    type: 'guess',
                    guesserId: socket.id,
                    timeLeft,
                    totalTime,
                    isFirstGuesser
                });
                let gained = scoreResult.points;

                const guessDuration = Math.max(0.5, (Date.now() - (room.roundStartTime || Date.now())) / 1000);
                if (!room.playerGuessTimes) room.playerGuessTimes = {};
                if (!room.playerGuessTimes[socket.id]) room.playerGuessTimes[socket.id] = [];
                room.playerGuessTimes[socket.id].push(guessDuration);

                if (room.roundFirstGuessTime === null || room.roundFirstGuessTime === undefined) {
                    room.roundFirstGuessTime = guessDuration;
                    if (drawerId) {
                        if (!room.drawerFirstGuessTimes) room.drawerFirstGuessTimes = {};
                        if (!room.drawerFirstGuessTimes[drawerId]) room.drawerFirstGuessTimes[drawerId] = [];
                        room.drawerFirstGuessTimes[drawerId].push(guessDuration);
                    }
                }

                // Look up guesser and drawer records
                const guesserRecord = room.records
                    ? (room.records.get(player?.playerId || socket.id) || Array.from(room.records.values()).find(r => r.socketId === socket.id))
                    : null;
                const drawerRecord = room.records
                    ? (room.records.get(drawerId) || Array.from(room.records.values()).find(r => r.playerId === drawerId || r.socketId === drawerId))
                    : null;

                if (guesserRecord) {
                    guesserRecord.score = (guesserRecord.score || 0) + gained;
                    guesserRecord.guessedThisTurn = true;
                    guesserRecord.correctGuesses = (guesserRecord.correctGuesses || 0) + 1;
                    if (!guesserRecord.guessMs) guesserRecord.guessMs = [];
                    guesserRecord.guessMs.push(Math.round(guessDuration * 1000));
                }

                room.scores[socket.id] += gained;
                if (guesserRecord) {
                    room.scores[guesserRecord.playerId] = guesserRecord.score;
                }
                const total = guesserRecord ? guesserRecord.score : room.scores[socket.id];

                if (!room.roundGained) room.roundGained = {};
                room.roundGained[socket.id] = (room.roundGained[socket.id] || 0) + gained;
                if (guesserRecord) {
                    room.roundGained[guesserRecord.playerId] = (room.roundGained[guesserRecord.playerId] || 0) + gained;
                }

                // Drawer bonus at 10% of each guess - awards only if guesser was present when word was chosen
                const isEligibleForBonus = isGuesserEligibleForBonus(room, socket.id) || (guesserRecord && isGuesserEligibleForBonus(room, guesserRecord.playerId));
                if (drawerId && isEligibleForBonus) {
                    const drawerBonusResult = mode.score(room, {
                        type: 'drawerBonus',
                        drawerId,
                        guesserGained: gained
                    });
                    const drawerBonus = drawerBonusResult.points;
                    if (drawerRecord) {
                        drawerRecord.score = (drawerRecord.score || 0) + drawerBonus;
                        room.scores[drawerRecord.playerId] = drawerRecord.score;
                        if (drawerRecord.socketId) {
                            room.scores[drawerRecord.socketId] = drawerRecord.score;
                        }
                    } else {
                        room.scores[drawerId] = (room.scores[drawerId] || 0) + drawerBonus;
                    }
                    room.roundGained[drawerId] = (room.roundGained[drawerId] || 0) + drawerBonus;
                    if (drawerRecord) {
                        room.roundGained[drawerRecord.playerId] = (room.roundGained[drawerRecord.playerId] || 0) + drawerBonus;
                    }
                    room.drawerBonus = (room.drawerBonus || 0) + drawerBonus;
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
                    id: uuidv4(),
                    ts: Date.now(),
                    username: player?.username || 'Unknown',
                    text: `Guessed the word! (+${gained})`,
                    type: 'correct',
                    gained,
                    playerId: socket.id
                };
                recordChatMessage(room, correctMsg);
                io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, correctMsg);

                const activeGuessers = room.records
                    ? Array.from(room.records.values()).filter(r => r.status === 'connected' && r.playerId !== drawerId && r.socketId !== drawerId).length
                    : room.players.filter(p => !p.isDisconnected && p.id !== drawerId).length;

                if (room.guessedPlayers.size >= activeGuessers && activeGuessers > 0) {
                    endRound(io, room);
                }
                return;
            }

            // A near miss emits CLOSE_GUESS only to that sender. Do not broadcast it.
            if (guessCheck.isClose) {
                socket.emit(EVENTS.CLOSE_GUESS, { message: 'Close!' });
            }
        }

        // Standard chat message: filter profanity and mask secret word
        let filtered = filterProfanity(text, room.wordToGuess);
        filtered = maskWord(filtered, room.wordToGuess, room.wordAliases);

        const chatMsg = {
            id: uuidv4(),
            ts: Date.now(),
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
