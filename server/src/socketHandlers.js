const roomManager = require('./RoomManager');
const { EVENTS, GAME_STATES } = require('../../shared/types');
const { getRandomWords } = require('./wordBank');

module.exports = (io, socket) => {
    socket.on(EVENTS.CREATE_ROOM, ({ username, avatar, settings }) => {
        const player = { id: socket.id, username, avatar, isHost: true };
        const room = roomManager.createRoom(player, settings);

        socket.join(room.code);
        socket.emit(EVENTS.ROOM_JOINED, room);
        console.log(`Room created: ${room.code} by ${username}`);
    });

    socket.on(EVENTS.JOIN_ROOM, ({ roomCode, username, avatar }) => {
        const player = { id: socket.id, username, avatar, isHost: false };
        const result = roomManager.joinRoom(roomCode, player);

        if (result.error) {
            socket.emit(EVENTS.ERROR, { message: result.error });
            return;
        }

        socket.join(roomCode);
        socket.emit(EVENTS.ROOM_JOINED, result.room);
        io.to(roomCode).emit(EVENTS.PLAYER_JOINED, player);
        console.log(`${username} joined room ${roomCode}`);

        // Late Join: Send current strokes if drawing
        if (result.room.strokes && result.room.strokes.length > 0) {
            socket.emit('STROKE_HISTORY', result.room.strokes);
        }
    });

    socket.on('disconnect', () => {
        // Handle disconnection logic (find room, remove player, emit update)
        // This requires tracking which room a socket is in efficiently
        // For MVP, we can iterate or store a mapping in RoomManager
    });

    // Game Flow
    socket.on(EVENTS.START_GAME, ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (room && room.players.find(p => p.id === socket.id)?.isHost) {
            startGameLoop(io, roomCode);
        }
    });

    socket.on(EVENTS.END_GAME_EARLY, ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        // Verify host
        if (room && room.players.find(p => p.id === socket.id)?.isHost) {
            if (room.timerInterval) clearInterval(room.timerInterval);
            room.gameState = GAME_STATES.GAME_END;
            io.to(roomCode).emit(EVENTS.GAME_ENDED, { scores: room.scores });
        }
    });

    socket.on(EVENTS.CHOOSE_WORD, ({ roomCode, word }) => {
        const room = roomManager.getRoom(roomCode);
        if (room && room.gameState === GAME_STATES.WORD_SELECTION) {
            startRound(io, room, word);
        }
    });

    // Helper function to start game loop (moved outside export or attached to RoomManager ideally)
    // For MVP we keep it here or import.
    // Let's assume we use a helper function defined below or imported.
    // Since we can't easily add top-level functions in replace, we'll assume we can add them at bottom or inline.
    // We will inline the logic for now or rely on roomManager updates.


    // Drawing
    socket.on(EVENTS.DRAW_STROKE, ({ roomCode, stroke }) => {
        const room = roomManager.getRoom(roomCode);
        if (room) {
            room.strokes.push(stroke);
            socket.to(roomCode).emit(EVENTS.STROKE_RECEIVED, stroke);
        }
    });

    socket.on(EVENTS.CLEAR_CANVAS, ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (room) {
            room.strokes = [];
            io.to(roomCode).emit(EVENTS.CANVAS_CLEARED);
        }
    });

    socket.on(EVENTS.UNDO_STROKE, ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (room && room.strokes.length > 0) {
            const removedStroke = room.strokes.pop();
            io.to(roomCode).emit(EVENTS.STROKE_UNDONE, { strokeId: removedStroke.id });
        }
    });

    // Chat & Guessing
    socket.on(EVENTS.SEND_MESSAGE, ({ roomCode, text }) => {
        const room = roomManager.getRoom(roomCode);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            const isDrawer = room.players[room.currentDrawerIndex]?.id === socket.id;

            if (room.gameState === GAME_STATES.DRAWING && room.wordToGuess) {
                if (isDrawer) return; // Drawer can't guess

                if (text.toLowerCase().trim() === room.wordToGuess.toLowerCase()) {
                    // Correct Guess
                    // If already guessed, ignore?
                    // For MVP assume single correct guess processing or check if player already guessed
                    // We need a list of 'guessedPlayers' in room
                    if (!room.guessedPlayers) room.guessedPlayers = new Set();

                    if (!room.guessedPlayers.has(socket.id)) {
                        room.guessedPlayers.add(socket.id);

                        // Scoring - Time Based
                        if (!room.scores) room.scores = {};
                        if (!room.scores[socket.id]) room.scores[socket.id] = 0;
                        const drawerId = room.players[room.currentDrawerIndex].id;
                        if (!room.scores[drawerId]) room.scores[drawerId] = 0;

                        const maxPoints = 500;
                        const totalTime = room.settings.drawTime || 60;
                        // Use current timeLeft from room object if we tracked it, but room.timer isn't actively updated in real-time on object properties efficiently in simplified loop
                        // But we have room.settings.drawTime. 
                        // We need to track timeLeft in RoomManager or rely on client? Server is truth. 
                        // We are updating room.timerInterval but not a room.timeLeft property? 
                        // Wait, timer update emits timeLeft. We should store it.
                        // For now let's assume we can get it or just use a timestamp diff if we stored start time.
                        // Simpler: we accept we don't have exact timeLeft in 'room' object unless we modify startRound to store startTime.

                        // Let's modify startRound to store 'roundStartTime'.
                        const timeElapsed = (Date.now() - (room.roundStartTime || Date.now())) / 1000;
                        const timeLeft = Math.max(0, totalTime - timeElapsed);
                        const ratio = timeLeft / totalTime;

                        const points = Math.floor(50 + (450 * ratio));

                        room.scores[socket.id] += points;
                        room.scores[drawerId] += Math.ceil(points / 10); // Drawer gets 10% bonus

                        io.to(roomCode).emit(EVENTS.CORRECT_GUESS, {
                            playerId: socket.id,
                            points: room.scores[socket.id],
                            word: room.wordToGuess
                        });

                        io.to(roomCode).emit(EVENTS.MESSAGE_RECEIVED, {
                            username: player.username,
                            text: 'Guessed the word!',
                            type: 'correct'
                        });

                        // Check if all guessed
                        const guessers = room.players.length - 1;
                        if (room.guessedPlayers.size >= guessers) {
                            endRound(io, room);
                        }
                        return;
                    }
                }
            }

            // If message matches word (and not already handled as correct guess above), mask it
            // This handles DRAWER revealing word or correct guessers revealing it again
            if (room.wordToGuess && text.toLowerCase().trim() === room.wordToGuess.toLowerCase()) {
                const maskedText = '*'.repeat(room.wordToGuess.length);
                const msg = {
                    username: player?.username || 'Unknown',
                    text: maskedText,
                    type: 'chat'
                };
                io.to(roomCode).emit(EVENTS.MESSAGE_RECEIVED, msg);
                return;
            }

            const msg = { username: player?.username || 'Unknown', text, type: 'chat' };
            io.to(roomCode).emit(EVENTS.MESSAGE_RECEIVED, msg);
        }
    });

    const startGameLoop = (io, roomCode) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;

        room.currentRound = 1;
        room.gameState = GAME_STATES.WORD_SELECTION;
        room.currentDrawerIndex = 0; // Reset for new game
        room.scores = room.players.reduce((acc, player) => ({ ...acc, [player.id]: 0 }), {}); // Initialize scores

        startTurn(io, room);
    };

    const startTurn = (io, room) => {
        room.gameState = GAME_STATES.WORD_SELECTION;
        room.guessedPlayers = new Set();
        if (room.timerInterval) clearInterval(room.timerInterval);

        // Simple drawer rotation
        const drawer = room.players[room.currentDrawerIndex];

        const choices = getRandomWords(3, room.settings.difficulty);

        io.to(room.code).emit(EVENTS.GAME_STARTED, {
            gameState: GAME_STATES.WORD_SELECTION,
            currentRound: room.currentRound,
            drawerId: drawer.id
        });

        io.to(drawer.id).emit(EVENTS.WORD_CHOICES, choices);

        // Auto-select if no choice in 15s (Optional MVP)
    };

    const startRound = (io, room, word) => {
        room.wordToGuess = word;
        room.gameState = GAME_STATES.DRAWING;
        room.strokes = [];
        room.roundStartTime = Date.now();

        io.to(room.code).emit(EVENTS.WORD_CHOSEN, {
            hint: word.replace(/[a-zA-Z]/g, '_ '),
            length: word.length,
            drawerId: room.players[room.currentDrawerIndex].id
        });

        io.to(room.players[room.currentDrawerIndex].id).emit('drawerWord', { word });
        io.to(room.code).emit(EVENTS.CANVAS_CLEARED);
        io.to(room.players[room.currentDrawerIndex].id).emit('drawerWord', { word });
        io.to(room.code).emit(EVENTS.CANVAS_CLEARED);
        // io.to(room.code).emit(EVENTS.GAME_STARTED, { gameState: GAME_STATES.DRAWING }); // Removed redundant/destructive emit

        let timeLeft = room.settings.drawTime;
        if (room.timerInterval) clearInterval(room.timerInterval);

        room.timerInterval = setInterval(() => {
            timeLeft--;
            io.to(room.code).emit(EVENTS.TIMER_UPDATE, timeLeft);

            if (timeLeft <= 0) {
                endRound(io, room);
            }
        }, 1000);
    };

    const endRound = (io, room) => {
        if (room.timerInterval) clearInterval(room.timerInterval);
        room.gameState = GAME_STATES.ROUND_END;

        io.to(room.code).emit(EVENTS.ROUND_ENDED, {
            word: room.wordToGuess,
            scores: room.scores
        });

        io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, {
            username: 'System',
            text: `Round Over! The word was: ${room.wordToGuess}`,
            type: 'system'
        });

        setTimeout(() => {
            // Next turn or Game End
            room.currentDrawerIndex++;
            if (room.currentDrawerIndex >= room.players.length) {
                room.currentDrawerIndex = 0;
                room.currentRound++;

                if (room.currentRound > (room.settings.rounds || 3)) {
                    io.to(room.code).emit(EVENTS.GAME_ENDED, { scores: room.scores });
                } else {
                    startTurn(io, room);
                }
            } else {
                startTurn(io, room);
            }
        }, 5000); // 5s intermission
    };
};
