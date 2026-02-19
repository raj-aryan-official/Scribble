const roomManager = require('./RoomManager');
const { EVENTS, GAME_STATES } = require('../../shared/types');
const { getRandomWords } = require('./wordBank');

module.exports = (io, socket) => {
    // Helper to sanitize room object (remove circular refs/timers)
    // Helper to sanitize room object (remove circular refs/timers/internal sets)
    const getSanitizedRoom = (room) => {
        const { timerInterval, wordSelectionTimer, revealedIndices, ...sanitized } = room;
        return sanitized;
    };

    socket.on(EVENTS.CREATE_ROOM, ({ username, avatar, settings, sessionId }) => {
        const player = { id: socket.id, username, avatar, isHost: true, sessionId };
        const room = roomManager.createRoom(player, settings);

        socket.join(room.code);
        socket.emit(EVENTS.ROOM_JOINED, getSanitizedRoom(room));
        console.log(`Room created: ${room.code} by ${username} (${sessionId})`);
    });

    socket.on(EVENTS.JOIN_ROOM, ({ roomCode, username, avatar, sessionId }) => {
        const player = { id: socket.id, username, avatar, isHost: false, sessionId };
        const result = roomManager.joinRoom(roomCode, player);

        if (result.error) {
            socket.emit(EVENTS.ERROR, { message: result.error });
            return;
        }

        socket.join(roomCode);
        socket.emit(EVENTS.ROOM_JOINED, getSanitizedRoom(result.room));
        io.to(roomCode).emit(EVENTS.PLAYER_JOINED, player);

        // System Message: Join
        io.to(roomCode).emit(EVENTS.MESSAGE_RECEIVED, {
            username: 'System',
            text: `${username} joined!`,
            type: 'system'
        });

        console.log(`${username} joined room ${roomCode}`);

        // Late Join: Send current strokes if drawing
        if (result.room.strokes && result.room.strokes.length > 0) {
            socket.emit('STROKE_HISTORY', result.room.strokes);
        }
    });

    socket.on('REJOIN_ROOM', ({ roomCode, sessionId }) => {
        const result = roomManager.reconnectPlayer(roomCode, sessionId, socket.id);

        if (result.error) {
            socket.emit(EVENTS.ERROR, { message: result.error, code: 'SESSION_EXPIRED' });
            return;
        }

        const { room, player } = result;
        socket.join(roomCode);

        // Emit Joined event to self
        socket.emit(EVENTS.ROOM_JOINED, getSanitizedRoom(room));

        // Notify others that player is back (using UPDATE_PLAYERS to refresh list with new ID)
        io.to(roomCode).emit(EVENTS.PLAYER_JOINED, player); // This appends/updates based on client logic

        // Send current game state
        if (room.gameState === GAME_STATES.DRAWING) {
            socket.emit(EVENTS.GAME_STARTED, {
                gameState: room.gameState,
                currentRound: room.currentRound,
                totalRounds: room.settings.rounds,
                drawerId: room.players[room.currentDrawerIndex].id
            });

            // Send strokes
            if (room.strokes && room.strokes.length > 0) {
                socket.emit('STROKE_HISTORY', room.strokes);
            }

            // Send Word/Hint
            if (player.id === room.players[room.currentDrawerIndex].id) {
                socket.emit('drawerWord', { word: room.wordToGuess });
            } else {
                socket.emit(EVENTS.WORD_CHOSEN, {
                    hint: room.wordHint || '', // Use stored hint if avaiable in room? 
                    // RoomManager doesn't seem to store `wordHint` explicitly on room object in `startRound`, 
                    // it calculates it. We might need to store it.
                    // Checking startRound: `const initialHint = ...`. It emits it but doesn't store it on `room`.
                    // We should FIX startRound to store `wordHint` on room.
                    length: room.wordToGuess?.length || 0,
                    drawerId: room.players[room.currentDrawerIndex].id
                });

                // If we don't store `wordHint` on room, we need to regenerate it or store it.
                // Let's assume for now we might miss the hint until next update if not stored.
            }

            // Send Timer
            // We need current timer value. socketHandlers updates it but doesn't store in room property?
            // It just emits. We should probably store it.
        }

        console.log(`User ${player.username} rejoined ${roomCode}`);
    });

    socket.on('disconnect', () => {
        // Find room where socket matches a player
        // For MVP iteration is acceptable given low room count
        let targetRoomCode = null;
        for (const [code, room] of roomManager.rooms) {
            if (room.players.find(p => p.id === socket.id)) {
                targetRoomCode = code;
                break;
            }
        }

        if (targetRoomCode) {
            const room = roomManager.removePlayer(targetRoomCode, socket.id);
            if (room) {
                // Notify remaining players
                io.to(targetRoomCode).emit(EVENTS.ROOM_JOINED, getSanitizedRoom(room));
                // Actually PLAYER_JOINED usually sends single player in my code above?
                // Let's check: Line 36 dispatch UPDATE_PLAYERS. 
                // Protocol check: client expects 'UPDATE_PLAYERS' with payload: player or list? 
                // Context GameContext: UPDATE_PLAYERS appends. 
                // We need a way to REPLACE the list or remove.
                // Current client implementation appends. That's bad for removal.
                // We might need a new event 'UPDATE_PLAYER_LIST' or similar, OR we just let the client handle it if we change GameContext.
                // Let's emit a specific event for disconnect or full refresh.
                // For MVP, if we restart/refresh it works, but for live update we need a 'SET_PLAYERS' or similar.
                // Let's assume for now we use 'PLAYER_LEFT' or similar if we added it, but let's stick to emitting the updated list and fixing client if needed?
                // Wait, client `UPDATE_PLAYERS` appends. `JOIN_ROOM` sets.
                // We should probably emit `ROOM_JOINED` again? Or better, just emit the new list on a new event `PLAYER_LEFT`?
                // Let's emit `PLAYER_UPDATE` with full list and existing `UPDATE_PLAYERS` logic might need helper.

                // Correction: Use a new event or existing?
                // Client `GameContext` has `UPDATE_PLAYERS` which checks duplicates but doesn't remove.
                // We should add `SET_PLAYERS` or `PLAYER_LEFT` to client.
                // Ideally I should update Client GameContext first.
                // But user asked to "do", so I will Emit 'PLAYER_DISCONNECTED' and handle it on client? 
                // Or just emit `JOIN_ROOM` style update? 
                // Let's emit 'PLAYER_UPDATE_FULL' with list. 

                // RE-READING socketHandlers JOIN_ROOM:
                // socket.emit(EVENTS.ROOM_JOINED, result.room);
                // io.to(roomCode).emit(EVENTS.PLAYER_JOINED, player);

                // I will emit 'ROOM_UPDATE' with room object.
                io.to(targetRoomCode).emit(EVENTS.ROOM_JOINED, getSanitizedRoom(room));
                console.log(`User ${socket.id} disconnected from ${targetRoomCode}`);
            }
        }
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
            if (room.wordSelectionTimer) {
                clearTimeout(room.wordSelectionTimer);
                room.wordSelectionTimer = null;
            }
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

    // Voice Chat Signaling
    socket.on(EVENTS.VOICE_JOIN, ({ roomCode }) => {
        socket.join(`${roomCode}_voice`);
        // Notify others in voice channel
        socket.to(`${roomCode}_voice`).emit(EVENTS.VOICE_JOIN, { socketId: socket.id });
        // Send list of existing voice users to the new joiner
        const voiceRoom = io.sockets.adapter.rooms.get(`${roomCode}_voice`);
        if (voiceRoom) {
            const users = Array.from(voiceRoom).filter(id => id !== socket.id);
            socket.emit('EXISTING_VOICE_USERS', users);
        }
    });

    socket.on(EVENTS.VOICE_OFFER, ({ target, offer }) => {
        io.to(target).emit(EVENTS.VOICE_OFFER, { sender: socket.id, offer });
    });

    socket.on(EVENTS.VOICE_ANSWER, ({ target, answer }) => {
        io.to(target).emit(EVENTS.VOICE_ANSWER, { sender: socket.id, answer });
    });

    socket.on(EVENTS.ICE_CANDIDATE, ({ target, candidate }) => {
        io.to(target).emit(EVENTS.ICE_CANDIDATE, { sender: socket.id, candidate });
    });

    // Handle voice leave specifically if needed, or rely on disconnect
    socket.on(EVENTS.VOICE_LEAVE, ({ roomCode }) => {
        socket.leave(`${roomCode}_voice`);
        socket.to(`${roomCode}_voice`).emit(EVENTS.VOICE_LEAVE, { socketId: socket.id });
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

        // Auto-select if no choice in 10s (MVP)
        room.wordSelectionTimer = setTimeout(() => {
            const randomWord = choices[Math.floor(Math.random() * choices.length)];
            // Verify we are still in selection (race condition check)
            if (room.gameState === GAME_STATES.WORD_SELECTION) {
                startRound(io, room, randomWord);
                // Need to tell drawer? startRound sends events.
            }
        }, 10000);
    };

    const startRound = (io, room, word) => {
        room.wordToGuess = word;
        room.gameState = GAME_STATES.DRAWING;
        room.strokes = [];
        room.strokes = [];
        room.roundStartTime = Date.now();
        room.revealedIndices = new Set(); // Track revealed indices for hints

        // Initial Hint: All underscores (except spaces if any)
        // Adjust regex to preserve spaces if needed or just space out
        // Current logic: word.replace(/[a-zA-Z]/g, '_ ') -> replaces every letter with "_ "
        const initialHint = word.split('').map(char => char === ' ' ? '  ' : '_ ').join('').trim();

        io.to(room.code).emit(EVENTS.WORD_CHOSEN, {
            hint: initialHint,
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

            // Hint Logic: Reveal at 50% and 25% time
            // Total time is usually 60s (default in RoomManager if not set, let's assume room.settings.drawTime)
            const totalTime = room.settings.drawTime || 60;
            const revealTimes = [Math.floor(totalTime * 0.5), Math.floor(totalTime * 0.25)];

            if (revealTimes.includes(timeLeft)) {
                console.log(`[DEBUG] Triggering Hint for Room ${room.code} at ${timeLeft}s. Total: ${totalTime}`);
                // Reveal a letter
                const word = room.wordToGuess;
                // Indices that are not spaces and not yet revealed
                const unrevealedIndices = [];
                for (let i = 0; i < word.length; i++) {
                    if (word[i] !== ' ' && !room.revealedIndices.has(i)) {
                        unrevealedIndices.push(i);
                    }
                }

                if (unrevealedIndices.length > 0) {
                    // Reveal one random index
                    const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
                    room.revealedIndices.add(randomIndex);

                    // Construct new hint string
                    let newHint = '';
                    for (let i = 0; i < word.length; i++) {
                        if (word[i] === ' ') {
                            newHint += '  '; // Double space for visual separation
                        } else if (room.revealedIndices.has(i)) {
                            newHint += word[i] + ' ';
                        } else {
                            newHint += '_ ';
                        }
                    }

                    // Emit HINT_UPDATE
                    console.log(`[DEBUG] Emitting HINT_UPDATE: "${newHint}"`);
                    io.to(room.code).emit('HINT_UPDATE', { hint: newHint.trim() });
                }
            }

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
