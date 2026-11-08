const roomManager = require('../RoomManager');
const { toPublicRoom, clearRoomTimers } = require('../RoomManager');
const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { getWordChoices } = require('../wordBank');
const logger = require('../logger');

const getTimeLeft = (room) => {
    if (!room || room.gameState !== GAME_STATES.DRAWING || !room.roundEndsAt) {
        return 0;
    }
    return Math.max(0, Math.ceil((room.roundEndsAt - Date.now()) / 1000));
};

const makeSnapshot = (room, playerSocketId) => {
    const isDrawerPlayer = Boolean(room.drawerId && room.drawerId === playerSocketId);
    const hasGuessed = Boolean(room.guessedPlayers && room.guessedPlayers.has(playerSocketId));

    return {
        publicRoom: toPublicRoom(room),
        room: toPublicRoom(room),
        gameState: room.gameState,
        drawerId: room.drawerId,
        hint: room.hint || '',
        timeLeft: getTimeLeft(room),
        word: (isDrawerPlayer || hasGuessed) ? room.wordToGuess : null,
        wordChoices: (isDrawerPlayer && room.gameState === GAME_STATES.WORD_SELECTION) ? (room.wordChoices || []) : null,
        strokes: room.strokes || [],
        recentChat: (room.chatMessages || []).slice(-100)
    };
};

const recordChatMessage = (room, msg) => {
    if (!room) return;
    if (!room.chatMessages) room.chatMessages = [];
    room.chatMessages.push(msg);
    if (room.chatMessages.length > 100) {
        room.chatMessages.shift();
    }
};

const cleanEndGame = (io, room) => {
    if (!room) return;
    clearRoomTimers(room);
    room.gameState = GAME_STATES.GAME_END;
    room.roundEndsAt = null;
    room.hint = null;
    room.wordChoices = null;

    const guessedRoomName = `${room.code}:guessed`;
    const existingGuessed = io.sockets?.adapter?.rooms?.get(guessedRoomName);
    if (existingGuessed) {
        for (const sid of [...existingGuessed]) {
            const s = io.sockets?.sockets?.get ? io.sockets.sockets.get(sid) : io.sockets?.[sid];
            s?.leave(guessedRoomName);
        }
    }

    io.to(room.code).emit(EVENTS.GAME_ENDED, {
        scores: room.scores || {},
        matchDrawings: room.matchDrawings || []
    });
};

const startGameLoop = (io, roomCode) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    room.currentRound = 1;
    room.gameState = GAME_STATES.WORD_SELECTION;
    room.currentDrawerIndex = 0;
    room.scores = room.players.reduce((acc, player) => ({ ...acc, [player.id]: 0 }), {});
    room.matchDrawings = [];

    startTurn(io, room);
};

const startTurn = (io, room) => {
    room.gameState = GAME_STATES.WORD_SELECTION;
    room.guessedPlayers = new Set();
    clearRoomTimers(room);

    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer) return;

    room.drawerId = drawer.id;
    room.hint = null;
    room.wordHint = null;
    room.roundEndsAt = null;

    const choices = getWordChoices(room, 3);
    room.wordChoices = choices;

    io.to(room.code).emit(EVENTS.GAME_STARTED, {
        gameState: GAME_STATES.WORD_SELECTION,
        currentRound: room.currentRound,
        drawerId: drawer.id
    });

    io.to(drawer.id).emit(EVENTS.WORD_CHOICES, choices);

    room.timers.wordSelection = setTimeout(() => {
        try {
            const currentRoom = roomManager.getRoom(room.code);
            if (!currentRoom || currentRoom !== room) {
                clearRoomTimers(room);
                return;
            }
            if (currentRoom.gameState === GAME_STATES.WORD_SELECTION && Array.isArray(currentRoom.wordChoices) && currentRoom.wordChoices.length > 0) {
                const randomChoice = currentRoom.wordChoices[Math.floor(Math.random() * currentRoom.wordChoices.length)];
                const randomWord = typeof randomChoice === 'string' ? randomChoice : randomChoice.word;
                currentRoom.wordChoices = null;
                startRound(io, currentRoom, randomWord);
            }
        } catch (err) {
            logger.error('Error in wordSelection timer:', err);
            cleanEndGame(io, room);
        }
    }, 10000);
};

const startRound = (io, room, word) => {
    clearRoomTimers(room);
    room.wordToGuess = word;
    if (room.usedWords && typeof room.usedWords.add === 'function') {
        room.usedWords.add(word);
    }
    room.gameState = GAME_STATES.DRAWING;
    room.strokes = [];
    room.roundGained = {};
    room.roundStartTime = Date.now();
    room.revealedIndices = new Set();

    const initialHint = word.split('').map(char => char === ' ' ? '  ' : '_ ').join('').trim();
    room.hint = initialHint;
    room.wordHint = initialHint;

    const drawer = room.players[room.currentDrawerIndex];
    room.drawerId = drawer?.id || null;

    // Reset and join the ':guessed' channel for the drawer
    const guessedRoomName = `${room.code}:guessed`;
    const existingGuessed = io.sockets?.adapter?.rooms?.get(guessedRoomName);
    if (existingGuessed) {
        for (const sid of [...existingGuessed]) {
            const s = io.sockets?.sockets?.get ? io.sockets.sockets.get(sid) : io.sockets?.[sid];
            s?.leave(guessedRoomName);
        }
    }
    if (drawer?.id) {
        const drawerSocket = io.sockets?.sockets?.get ? io.sockets.sockets.get(drawer.id) : io.sockets?.[drawer.id];
        drawerSocket?.join(guessedRoomName);
    }

    const totalTime = room.settings?.drawTime || 60;
    room.roundEndsAt = Date.now() + totalTime * 1000;

    io.to(room.code).emit(EVENTS.WORD_CHOSEN, {
        hint: initialHint,
        length: word.length,
        drawerId: drawer?.id
    });

    if (drawer) {
        io.to(drawer.id).emit(EVENTS.DRAWER_WORD, { word });
    }
    io.to(room.code).emit(EVENTS.CANVAS_CLEARED);

    room.timers.interval = setInterval(() => {
        try {
            const currentRoom = roomManager.getRoom(room.code);
            if (!currentRoom || currentRoom !== room) {
                clearRoomTimers(room);
                return;
            }

            const timeLeft = getTimeLeft(currentRoom);
            io.to(currentRoom.code).emit(EVENTS.TIMER_UPDATE, timeLeft);

            const revealTimes = [Math.floor(totalTime * 0.5), Math.floor(totalTime * 0.25)];

            if (revealTimes.includes(timeLeft)) {
                const currentWord = currentRoom.wordToGuess;
                if (currentWord) {
                    const unrevealedIndices = [];
                    for (let i = 0; i < currentWord.length; i++) {
                        if (currentWord[i] !== ' ' && !currentRoom.revealedIndices.has(i)) {
                            unrevealedIndices.push(i);
                        }
                    }

                    if (unrevealedIndices.length > 0) {
                        const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
                        currentRoom.revealedIndices.add(randomIndex);

                        let newHint = '';
                        for (let i = 0; i < currentWord.length; i++) {
                            if (currentWord[i] === ' ') {
                                newHint += '  ';
                            } else if (currentRoom.revealedIndices.has(i)) {
                                newHint += currentWord[i] + ' ';
                            } else {
                                newHint += '_ ';
                            }
                        }
                        currentRoom.hint = newHint.trim();
                        currentRoom.wordHint = currentRoom.hint;
                        io.to(currentRoom.code).emit(EVENTS.HINT_UPDATE, { hint: newHint.trim() });
                    }
                }
            }

            if (timeLeft <= 0) {
                endRound(io, currentRoom);
            }
        } catch (err) {
            logger.error('Error in round interval timer:', err);
            cleanEndGame(io, room);
        }
    }, 1000);
};

const endRound = (io, room) => {
    clearRoomTimers(room);
    room.gameState = GAME_STATES.ROUND_END;
    room.roundEndsAt = null;
    room.hint = null;

    // Leave ':guessed' room at round end
    const guessedRoomName = `${room.code}:guessed`;
    const existingGuessed = io.sockets?.adapter?.rooms?.get(guessedRoomName);
    if (existingGuessed) {
        for (const sid of [...existingGuessed]) {
            const s = io.sockets?.sockets?.get ? io.sockets.sockets.get(sid) : io.sockets?.[sid];
            s?.leave(guessedRoomName);
        }
    }

    // Save round drawing for match showcase (capped at 30 rounds)
    if (!room.matchDrawings) room.matchDrawings = [];
    if (room.strokes && room.strokes.length > 0 && room.wordToGuess) {
        const drawer = room.players.find(p => p.id === room.drawerId);
        room.matchDrawings.push({
            word: room.wordToGuess,
            drawerName: drawer ? drawer.username : 'Unknown',
            drawerAvatar: drawer ? drawer.avatar : 'avatar-1',
            round: room.currentRound,
            strokes: JSON.parse(JSON.stringify(room.strokes.slice(0, 1000)))
        });
        if (room.matchDrawings.length > 30) {
            room.matchDrawings.shift();
        }
    }

    io.to(room.code).emit(EVENTS.ROUND_ENDED, {
        word: room.wordToGuess,
        scores: room.scores,
        gained: room.roundGained || {}
    });

    const roundEndMsg = {
        username: 'System',
        text: `Round Over! The word was: ${room.wordToGuess}`,
        type: 'system'
    };
    recordChatMessage(room, roundEndMsg);
    io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, roundEndMsg);

    room.timers.intermission = setTimeout(() => {
        try {
            const currentRoom = roomManager.getRoom(room.code);
            if (!currentRoom || currentRoom !== room) {
                clearRoomTimers(room);
                return;
            }
            currentRoom.currentDrawerIndex++;
            if (currentRoom.currentDrawerIndex >= currentRoom.players.length) {
                currentRoom.currentDrawerIndex = 0;
                currentRoom.currentRound++;

                if (currentRoom.currentRound > (currentRoom.settings?.rounds || 3)) {
                    cleanEndGame(io, currentRoom);
                } else {
                    startTurn(io, currentRoom);
                }
            } else {
                startTurn(io, currentRoom);
            }
        } catch (err) {
            logger.error('Error in intermission timer:', err);
            cleanEndGame(io, room);
        }
    }, 5000);
};

const handlePlayerLeave = (io, room, leavingPlayerId, _reason = null) => {
    if (!room) return;

    const leavingIndex = room.players.findIndex(p => p.id === leavingPlayerId);
    if (leavingIndex === -1) return;

    const wasDrawer = (leavingIndex === room.currentDrawerIndex);
    const wasMidGame = (room.gameState !== GAME_STATES.LOBBY && room.gameState !== GAME_STATES.GAME_END);
    const wasInTurn = (room.gameState === GAME_STATES.WORD_SELECTION || room.gameState === GAME_STATES.DRAWING);

    const updatedRoom = roomManager.removePlayer(room.code, leavingPlayerId);
    if (!updatedRoom) {
        // Room deleted (all players left)
        return;
    }

    io.to(updatedRoom.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(updatedRoom));

    // Mid-game check: If fewer than 2 players remain mid-game, end the game and send GAME_ENDED
    if (wasMidGame && updatedRoom.players.length < 2) {
        cleanEndGame(io, updatedRoom);
        const msg = {
            username: 'System',
            text: 'Game ended: not enough players to continue.',
            type: 'system'
        };
        recordChatMessage(updatedRoom, msg);
        io.to(updatedRoom.code).emit(EVENTS.MESSAGE_RECEIVED, msg);
        return;
    }

    // Drawer leaving check
    if (wasInTurn && wasDrawer) {
        clearRoomTimers(updatedRoom);
        updatedRoom.gameState = GAME_STATES.ROUND_END;
        updatedRoom.roundEndsAt = null;
        updatedRoom.hint = null;

        io.to(updatedRoom.code).emit(EVENTS.ROUND_ENDED, {
            word: updatedRoom.wordToGuess,
            scores: updatedRoom.scores,
            reason: 'drawer-left'
        });

        const msg = {
            username: 'System',
            text: 'Drawer left the game! Advancing to the next turn...',
            type: 'system'
        };
        recordChatMessage(updatedRoom, msg);
        io.to(updatedRoom.code).emit(EVENTS.MESSAGE_RECEIVED, msg);

        if (updatedRoom.currentDrawerIndex >= updatedRoom.players.length) {
            updatedRoom.currentDrawerIndex = 0;
            updatedRoom.currentRound++;
        }

        if (updatedRoom.currentRound > (updatedRoom.settings?.rounds || 3)) {
            cleanEndGame(io, updatedRoom);
        } else {
            startTurn(io, updatedRoom);
        }
    }
};

module.exports = {
    getTimeLeft,
    makeSnapshot,
    recordChatMessage,
    cleanEndGame,
    startGameLoop,
    startTurn,
    startRound,
    endRound,
    handlePlayerLeave
};
