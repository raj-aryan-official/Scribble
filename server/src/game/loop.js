const roomManager = require('../RoomManager');
const { toPublicRoom, clearRoomTimers } = require('../RoomManager');
const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { getWordChoices } = require('../wordBank');
const logger = require('../logger');
const {
    transition
} = require('./machine');
const {
    createTurnId,
    initGameTurns,
    handlePlayerLeft,
    getNextDrawerCandidate,
    advanceRound,
    recordTurnDraw,
    recordTurnMiss,
    snapshotEligibleGuessers,
    buildTurnInfo
} = require('./turns');

const getTimeLeft = (room) => {
    if (!room || room.gameState !== GAME_STATES.DRAWING || !room.roundEndsAt) {
        return 0;
    }
    return Math.max(0, Math.ceil((room.roundEndsAt - Date.now()) / 1000));
};

const makeSnapshot = (room, playerSocketId, playerRecord = null, lastSeq = undefined) => {
    let record = playerRecord;
    if (!record && room.records) {
        for (const r of room.records.values()) {
            if (r.socketId === playerSocketId || r.playerId === playerSocketId) {
                record = r;
                break;
            }
        }
    }

    const isDrawerPlayer = Boolean(
        room.drawerId && (room.drawerId === playerSocketId || (record && room.drawerId === record.playerId))
    );
    const hasGuessed = Boolean(
        record?.guessedThisTurn ||
        (room.guessedPlayers && (room.guessedPlayers.has(playerSocketId) || (record && room.guessedPlayers.has(record.playerId))))
    );

    let rank = 1;
    if (room.records && room.records.size > 0) {
        const sorted = Array.from(room.records.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
        const idx = sorted.findIndex(r => r.playerId === record?.playerId);
        if (idx !== -1) rank = idx + 1;
    }

    const ownRecord = record ? {
        playerId: record.playerId,
        username: record.username,
        avatar: record.avatar,
        score: record.score || 0,
        rank,
        guessedThisTurn: Boolean(record.guessedThisTurn),
        correctGuesses: record.correctGuesses || 0,
        drawsDone: record.drawsDone || [],
        missedDraws: record.missedDraws || [],
        joinedAt: record.joinedAt,
        leftAt: record.leftAt,
        status: record.status || 'connected'
    } : null;

    const drawerRecord = room.records ? room.records.get(room.drawerId) : null;
    const drawerPlayer = (room.players || []).find(p => p.id === room.drawerId || p.playerId === room.drawerId);

    const baseTurnInfo = buildTurnInfo(room) || {};
    const turnInfo = {
        ...baseTurnInfo,
        round: room.round || room.currentRound || 1,
        totalRounds: room.settings?.rounds || 3,
        drawerId: room.drawerId,
        drawerName: drawerRecord?.username || drawerPlayer?.username || 'Maya',
        drawerAvatar: drawerRecord?.avatar || drawerPlayer?.avatar || 'avatar-1'
    };

    let strokes = room.strokes || [];
    if (typeof lastSeq === 'number' && Number.isFinite(lastSeq)) {
        strokes = strokes.filter(s => (s.seq || 0) > lastSeq);
    }

    return {
        publicRoom: toPublicRoom(room),
        room: toPublicRoom(room),
        ownRecord,
        record: ownRecord,
        turnInfo,
        TURN_INFO: turnInfo,
        turnId: room.currentTurnId || null,
        gameState: room.gameState,
        drawerId: room.drawerId,
        hint: room.hint || '',
        timeLeft: getTimeLeft(room),
        word: (isDrawerPlayer || hasGuessed) ? room.wordToGuess : null,
        wordChoices: (isDrawerPlayer && room.gameState === GAME_STATES.WORD_SELECTION) ? (room.wordChoices || []) : null,
        strokes,
        chatHistory: (room.chatMessages || []).slice(-50),
        recentChat: (room.chatMessages || []).slice(-50),
        startsAt: room.startsAt || null,
        selectionEndsAt: room.selectionEndsAt || null,
        roundEndsAt: room.roundEndsAt || null,
        pausedAt: room.pausedAt || null,
        remainingDrawTime: room.remainingDrawTime || null,
        scores: room.scores || {},
        awards: room.awards || null,
        stats: room.awards || null,
        waitingFor: (room.gameState === GAME_STATES.TURN_WAIT && room.records?.get(room.waitingForDrawerId)?.username) || null,
        waitingForDrawerId: room.waitingForDrawerId || null,
        turnWaitEndsAt: room.turnWaitEndsAt || null
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

const calculateAwards = (room) => {
    let bestArtist = null;
    let fastestGuesser = null;

    if (room.drawerFirstGuessTimes) {
        let lowestDrawerAvg = Infinity;
        let bestDrawerId = null;

        for (const [drawerId, times] of Object.entries(room.drawerFirstGuessTimes)) {
            if (Array.isArray(times) && times.length > 0) {
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                if (avg < lowestDrawerAvg) {
                    lowestDrawerAvg = avg;
                    bestDrawerId = drawerId;
                }
            }
        }

        if (bestDrawerId) {
            const drawerPlayer = (room.players || []).find(p => p.id === bestDrawerId);
            if (drawerPlayer) {
                bestArtist = {
                    id: drawerPlayer.id,
                    username: drawerPlayer.username,
                    avatar: drawerPlayer.avatar,
                    avgTime: Math.round(lowestDrawerAvg * 10) / 10
                };
            }
        }
    }

    if (room.playerGuessTimes) {
        let lowestGuesserAvg = Infinity;
        let bestGuesserId = null;

        for (const [guesserId, times] of Object.entries(room.playerGuessTimes)) {
            if (Array.isArray(times) && times.length > 0) {
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                if (avg < lowestGuesserAvg) {
                    lowestGuesserAvg = avg;
                    bestGuesserId = guesserId;
                }
            }
        }

        if (bestGuesserId) {
            const guesserPlayer = (room.players || []).find(p => p.id === bestGuesserId);
            if (guesserPlayer) {
                fastestGuesser = {
                    id: guesserPlayer.id,
                    username: guesserPlayer.username,
                    avatar: guesserPlayer.avatar,
                    avgTime: Math.round(lowestGuesserAvg * 10) / 10
                };
            }
        }
    }

    return { bestArtist, fastestGuesser };
};

const cleanEndGame = (io, room, reason = null) => {
    if (!room) return;
    clearRoomTimers(room);
    transition(room, 'END_GAME');
    room.waitingForDrawerId = null;
    room.turnWaitEndsAt = null;
    room.roundEndsAt = null;
    room.startsAt = null;
    room.selectionEndsAt = null;
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

    const awards = calculateAwards(room);
    room.awards = awards;

    io.to(room.code).emit(EVENTS.GAME_ENDED, {
        scores: room.scores || {},
        matchDrawings: room.matchDrawings || [],
        awards,
        stats: awards,
        reason: reason || room.endReason || null
    });
};

const startGameLoop = (io, roomCode) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    initGameTurns(room);
    transition(room, 'START_GAME');
    room.currentDrawerIndex = 0;
    room.scores = room.players.reduce((acc, player) => ({ ...acc, [player.id]: 0 }), {});
    room.matchDrawings = [];
    room.drawerFirstGuessTimes = {};
    room.playerGuessTimes = {};
    room.awards = null;

    const now = Date.now();
    room.startsAt = now + 3000;

    startTurn(io, room, true);
};

const startTurn = (io, room, isGameStart = false) => {
    const connectedCount = room?.records
        ? Array.from(room.records.values()).filter(r => r.status === 'connected').length
        : (room?.players || []).filter(p => !p.isDisconnected).length;

    if (!room || !room.players || room.players.length < 2 || connectedCount < 2) {
        cleanEndGame(io, room, 'not-enough-players');
        return;
    }

    if (isGameStart || !room.turnQueue) {
        if (room.currentRound === undefined) room.currentRound = 1;
        if (room.round === undefined) room.round = room.currentRound;
        initGameTurns(room);
    }

    const candidate = getNextDrawerCandidate(room);
    if (candidate.isRoundOver) {
        const advanced = advanceRound(room);
        if (!advanced) {
            cleanEndGame(io, room);
            return;
        }
        startTurn(io, room, false);
        return;
    }

    const candidateId = candidate.candidateId;
    const candidateRecord = room.records?.get(candidateId);
    const candidatePlayer = room.players?.find(p => p.playerId === candidateId || p.id === candidateId);

    // E14: If drawer was marked AFK-skipped (>=3 auto-picks), skip their turns until they draw
    if (candidateRecord?.isAfkSkipped) {
        recordTurnMiss(room, candidateId);
        startTurn(io, room, false);
        return;
    }

    const isConnected = candidateRecord
        ? (candidateRecord.status === 'connected' && Boolean(candidateRecord.socketId))
        : Boolean(candidatePlayer && !candidatePlayer.isDisconnected);

    if (!isConnected) {
        // Player is away: enter TURN_WAIT phase for up to 8 s
        clearRoomTimers(room);
        transition(room, 'DRAWER_AWAY');
        room.waitingForDrawerId = candidateId;
        room.turnWaitEndsAt = Date.now() + 8000;
        room.startsAt = null;
        room.selectionEndsAt = null;
        room.roundEndsAt = null;
        room.hint = null;
        room.wordChoices = null;

        const waitingUsername = candidateRecord?.username || candidatePlayer?.username || 'Player';

        io.to(room.code).emit(EVENTS.GAME_STARTED, {
            gameState: GAME_STATES.TURN_WAIT,
            currentRound: room.round || room.currentRound || 1,
            totalRounds: room.settings?.rounds || 3,
            drawerId: null,
            waitingFor: waitingUsername,
            waitingForDrawerId: candidateId,
            endsAt: room.turnWaitEndsAt,
            turnWaitEndsAt: room.turnWaitEndsAt,
            startsAt: null,
            selectionEndsAt: null,
            turnInfo: buildTurnInfo(room)
        });

        io.to(room.code).emit(EVENTS.TURN_INFO, buildTurnInfo(room));
        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));

        room.timers.turnWait = setTimeout(() => {
            try {
                const currentRoom = roomManager.getRoom(room.code);
                if (!currentRoom || currentRoom !== room) return;
                currentRoom.timers.turnWait = null;
                recordTurnMiss(currentRoom, candidateId);
                currentRoom.waitingForDrawerId = null;
                currentRoom.turnWaitEndsAt = null;
                startTurn(io, currentRoom, false);
            } catch (err) {
                logger.error('Error in turnWait timer:', err);
                cleanEndGame(io, room);
            }
        }, 8000);
        return;
    }

    if (room.timers?.turnWait) {
        clearTimeout(room.timers.turnWait);
        room.timers.turnWait = null;
    }
    room.waitingForDrawerId = null;
    room.turnWaitEndsAt = null;

    room.currentTurnId = createTurnId();
    room.turnInRound = (room.turnInRound || 0) + 1;
    transition(room, 'START_SELECTION');
    room.guessedPlayers = new Set();
    if (room.records) {
        for (const r of room.records.values()) {
            r.guessedThisTurn = false;
        }
    }
    clearRoomTimers(room);

    room.drawerId = candidatePlayer ? candidatePlayer.id : (candidateRecord?.socketId || candidateId);
    const candidateIdx = room.players.findIndex(p => p.id === room.drawerId || p.playerId === candidateId);
    if (candidateIdx !== -1) {
        room.currentDrawerIndex = candidateIdx;
    }

    room.hint = null;
    room.wordHint = null;
    room.roundEndsAt = null;

    if (!isGameStart) {
        room.startsAt = null;
    }

    const choices = getWordChoices(room, 3);
    room.wordChoices = choices;

    const countdownDelay = isGameStart && room.startsAt ? Math.max(0, room.startsAt - Date.now()) : 0;
    const selectionDuration = countdownDelay + 10000;
    room.selectionEndsAt = Date.now() + selectionDuration;

    io.to(room.code).emit(EVENTS.GAME_STARTED, {
        gameState: GAME_STATES.WORD_SELECTION,
        currentRound: room.round || room.currentRound || 1,
        totalRounds: room.settings?.rounds || 3,
        drawerId: room.drawerId,
        drawerName: candidateRecord?.username || candidatePlayer?.username || 'Maya',
        drawerAvatar: candidateRecord?.avatar || candidatePlayer?.avatar || 'avatar-1',
        startsAt: room.startsAt,
        selectionEndsAt: room.selectionEndsAt,
        turnId: room.currentTurnId,
        turnInRound: room.turnInRound,
        turnsInRound: room.turnsInRound
    });

    io.to(room.code).emit(EVENTS.TURN_INFO, buildTurnInfo(room));

    const drawerSocketId = candidateRecord?.socketId || candidatePlayer?.id || room.drawerId;
    io.to(drawerSocketId).emit(EVENTS.WORD_CHOICES, choices);

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
                startRound(io, currentRoom, randomWord, true);
            }
        } catch (err) {
            logger.error('Error in wordSelection timer:', err);
            cleanEndGame(io, room);
        }
    }, selectionDuration);
};

const startRoundInterval = (io, room, totalTime = (room.settings?.drawTime || 60)) => {
    if (!room) return;
    if (room.timers.interval) {
        clearInterval(room.timers.interval);
        room.timers.interval = null;
    }
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

const startRound = (io, room, word, autoPicked = false) => {
    clearRoomTimers(room);
    snapshotEligibleGuessers(room);
    room.wordToGuess = word;
    if (room.usedWords && typeof room.usedWords.add === 'function') {
        room.usedWords.add(word);
    }
    transition(room, 'START_ROUND');
    room.strokes = [];
    room.roundGained = {};
    room.fastestGuesserId = null;
    room.drawerBonus = 0;
    room.roundFirstGuessTime = null;
    room.roundStartTime = Date.now();
    room.revealedIndices = new Set();
    room.startsAt = null;
    room.selectionEndsAt = null;

    const initialHint = word.split('').map(char => char === ' ' ? '  ' : '_ ').join('').trim();
    room.hint = initialHint;
    room.wordHint = initialHint;

    const drawer = room.players[room.currentDrawerIndex];
    room.drawerId = drawer?.id || null;

    // AFK auto-pick handling (E14)
    const drawerRecord = room.records ? (room.records.get(drawer?.playerId || room.drawerId) || Array.from(room.records.values()).find(r => r.socketId === drawer?.id)) : null;
    if (autoPicked) {
        if (drawerRecord) {
            drawerRecord.consecutiveAutoPicks = (drawerRecord.consecutiveAutoPicks || 0) + 1;
            if (drawerRecord.consecutiveAutoPicks === 2) {
                const drawerSock = drawer?.id || drawerRecord.socketId;
                if (drawerSock) {
                    io.to(drawerSock).emit(EVENTS.AFK_NUDGE, {
                        message: 'You have had 2 auto-picked words in a row. Choose your next word to stay active!'
                    });
                }
            } else if (drawerRecord.consecutiveAutoPicks >= 3) {
                drawerRecord.isAfkSkipped = true;
            }
        }
    } else {
        if (drawerRecord) {
            drawerRecord.consecutiveAutoPicks = 0;
            drawerRecord.isAfkSkipped = false;
        }
    }

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
        drawerId: drawer?.id,
        roundEndsAt: room.roundEndsAt,
        turnId: room.currentTurnId
    });

    if (drawer) {
        io.to(drawer.id).emit(EVENTS.DRAWER_WORD, {
            word,
            autoPicked: Boolean(autoPicked),
            turnId: room.currentTurnId
        });
    }
    io.to(room.code).emit(EVENTS.CANVAS_CLEARED);
    io.to(room.code).emit(EVENTS.TURN_INFO, buildTurnInfo(room));

    startRoundInterval(io, room, totalTime);
    checkGuessersAway(io, room);
};

const endRound = (io, room) => {
    clearRoomTimers(room);
    if (room.drawerId) {
        recordTurnDraw(room, room.drawerId, room.currentTurnId);
    }
    transition(room, 'END_ROUND');
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
            round: room.round || room.currentRound,
            strokes: JSON.parse(JSON.stringify(room.strokes.slice(0, 1000)))
        });
        if (room.matchDrawings.length > 30) {
            room.matchDrawings.shift();
        }
    }

    const gains = (room.players || []).map(p => ({
        id: p.id,
        gained: room.roundGained?.[p.id] || 0,
        total: room.scores?.[p.id] || 0
    }));

    let nextDrawerId = null;
    let nextDrawerName = null;
    let nextDrawerAvatar = null;
    const nextCandidateId = (room.turnQueue && room.turnQueue.length > 0)
        ? room.turnQueue[0]
        : (room.makeUpQueue && room.makeUpQueue.length > 0 ? room.makeUpQueue[0] : null);

    if (nextCandidateId) {
        const nextRec = room.records?.get(nextCandidateId);
        const nextPlayer = room.players?.find(p => p.playerId === nextCandidateId || p.id === nextCandidateId);
        nextDrawerId = nextPlayer?.id || nextRec?.socketId || nextCandidateId;
        nextDrawerName = nextRec?.username || nextPlayer?.username || 'Maya';
        nextDrawerAvatar = nextRec?.avatar || nextPlayer?.avatar || 'avatar-1';
    } else if (Array.isArray(room.players) && room.players.length > 0) {
        const willGameEnd = ((room.round || room.currentRound || 1) >= (room.settings?.rounds || 3));
        if (!willGameEnd) {
            const nextDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;
            const nextDrawer = room.players[nextDrawerIndex];
            if (nextDrawer) {
                nextDrawerId = nextDrawer.id;
                nextDrawerName = nextDrawer.username;
                nextDrawerAvatar = nextDrawer.avatar;
            }
        }
    }

    io.to(room.code).emit(EVENTS.ROUND_ENDED, {
        word: room.wordToGuess,
        scores: room.scores || {},
        gained: room.roundGained || {},
        gains,
        fastestGuesserId: room.fastestGuesserId || null,
        drawerBonus: room.drawerBonus || 0,
        nextDrawerId,
        nextDrawerName,
        nextDrawerAvatar,
        strokes: room.strokes || []
    });

    const roundEndMsg = {
        username: 'System',
        text: `Round Over! The word was: ${room.wordToGuess}`,
        type: 'system'
    };
    recordChatMessage(room, roundEndMsg);
    io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, roundEndMsg);

    room.timers.intermission = setTimeout(() => {
        advanceIntermission(io, room);
    }, 5000);
};

const advanceIntermission = (io, room) => {
    try {
        const currentRoom = roomManager.getRoom(room.code);
        if (!currentRoom || currentRoom !== room) {
            clearRoomTimers(room);
            return;
        }
        if (currentRoom.timers?.intermission) {
            clearTimeout(currentRoom.timers.intermission);
            currentRoom.timers.intermission = null;
        }
        startTurn(io, currentRoom, false);
    } catch (err) {
        logger.error('Error in intermission timer:', err);
        cleanEndGame(io, room);
    }
};

const skipIntermission = (io, room) => {
    if (!room || room.gameState !== GAME_STATES.ROUND_END) return;
    advanceIntermission(io, room);
};

// Pause helper: drawer away during DRAWING (E1)
const pauseForDrawerAway = (io, room) => {
    if (!room || room.gameState !== GAME_STATES.DRAWING) return;
    if (room.timers?.drawerAway) return;

    if (room.timers?.interval) {
        clearInterval(room.timers.interval);
        room.timers.interval = null;
    }

    room.pausedAt = Date.now();
    room.remainingDrawTime = Math.max(0, (room.roundEndsAt || Date.now()) - room.pausedAt);
    transition(room, 'DRAWER_AWAY');

    io.to(room.code).emit(EVENTS.TIMER_UPDATE, Math.ceil(room.remainingDrawTime / 1000));
    io.to(room.code).emit(EVENTS.GAME_PAUSED, {
        reason: 'drawer-away',
        remainingSeconds: Math.ceil(room.remainingDrawTime / 1000),
        timeout: 10
    });
    io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));

    room.timers.drawerAway = setTimeout(() => {
        try {
            const cur = roomManager.getRoom(room.code);
            if (!cur || cur !== room) return;
            cur.timers.drawerAway = null;
            // E1: Not returned within 10s: end turn with no points
            cur.roundGained = {};
            endRound(io, cur);
        } catch (err) {
            logger.error('Error in drawerAway timer callback:', err);
        }
    }, 10000);
};

// Resume helper: drawer returned within 10s (E1)
const resumeFromDrawerAway = (io, room) => {
    if (!room || room.gameState !== GAME_STATES.PAUSED) return;
    if (room.timers?.drawerAway) {
        clearTimeout(room.timers.drawerAway);
        room.timers.drawerAway = null;
    }

    const remaining = room.remainingDrawTime !== undefined && room.remainingDrawTime !== null
        ? room.remainingDrawTime
        : 10000;
    room.roundEndsAt = Date.now() + remaining;
    room.pausedAt = null;
    room.remainingDrawTime = null;

    transition(room, 'DRAWER_RETURNED');

    const totalTime = room.settings?.drawTime || 60;
    startRoundInterval(io, room, totalTime);

    io.to(room.code).emit(EVENTS.GAME_RESUMED, {
        roundEndsAt: room.roundEndsAt
    });
    io.to(room.code).emit(EVENTS.TIMER_UPDATE, getTimeLeft(room));
    io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
};

// Check all guessers away for 15s during DRAWING (E3)
const checkGuessersAway = (io, room) => {
    if (!room) return;
    const connectedGuessers = (room.players || []).filter(
        p => !p.isDisconnected && p.id !== room.drawerId && p.playerId !== room.drawerId
    );
    if (connectedGuessers.length > 0) {
        if (room.timers?.allGuessersAway) {
            clearTimeout(room.timers.allGuessersAway);
            room.timers.allGuessersAway = null;
        }
        return;
    }
    if (room.gameState !== GAME_STATES.DRAWING) return;
    const totalGuessers = (room.players || []).filter(
        p => p.id !== room.drawerId && p.playerId !== room.drawerId
    );
    if (totalGuessers.length < 2) return;
    if (connectedGuessers.length === 0) {
        if (!room.timers.allGuessersAway) {
            room.timers.allGuessersAway = setTimeout(() => {
                try {
                    const cur = roomManager.getRoom(room.code);
                    if (!cur || cur !== room) return;
                    cur.timers.allGuessersAway = null;
                    endRound(io, cur);
                } catch (err) {
                    logger.error('Error in allGuessersAway timer callback:', err);
                }
            }, 15000);
        }
    } else {
        if (room.timers.allGuessersAway) {
            clearTimeout(room.timers.allGuessersAway);
            room.timers.allGuessersAway = null;
        }
    }
};

// Check fewer than 2 connected players pauses up to 60s (E4)
const checkConnectedPlayerCount = (io, room) => {
    if (!room) return;
    const isMidGame = (room.gameState !== GAME_STATES.LOBBY && room.gameState !== GAME_STATES.GAME_END);
    if (!isMidGame) return;

    const connectedCount = room.records
        ? Array.from(room.records.values()).filter(r => r.status === 'connected').length
        : (room.players || []).filter(p => !p.isDisconnected).length;

    if (connectedCount < 2) {
        if (room.gameState !== GAME_STATES.PAUSED) {
            room.pausedAt = Date.now();
            if (room.roundEndsAt) {
                room.remainingDrawTime = Math.max(0, room.roundEndsAt - room.pausedAt);
            }
            if (room.selectionEndsAt) {
                room.remainingSelectionTime = Math.max(0, room.selectionEndsAt - room.pausedAt);
            }
            if (room.timers?.interval) {
                clearInterval(room.timers.interval);
                room.timers.interval = null;
            }
            if (room.timers?.wordSelection) {
                clearTimeout(room.timers.wordSelection);
                room.timers.wordSelection = null;
            }
            transition(room, 'PAUSE');
            io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
            io.to(room.code).emit(EVENTS.GAME_PAUSED, {
                reason: 'not-enough-players',
                timeout: 60
            });
        }
        if (!room.timers.pausedGrace) {
            room.timers.pausedGrace = setTimeout(() => {
                try {
                    const cur = roomManager.getRoom(room.code);
                    if (!cur || cur !== room) return;
                    cur.timers.pausedGrace = null;
                    cleanEndGame(io, cur, 'not-enough-players');
                } catch (err) {
                    logger.error('Error in pausedGrace timer callback:', err);
                }
            }, 60000);
        }
    } else if (connectedCount >= 2 && room.gameState === GAME_STATES.PAUSED && room.timers?.pausedGrace) {
        clearTimeout(room.timers.pausedGrace);
        room.timers.pausedGrace = null;

        if (room.remainingDrawTime !== undefined && room.remainingDrawTime !== null) {
            room.roundEndsAt = Date.now() + room.remainingDrawTime;
        }
        if (room.remainingSelectionTime !== undefined && room.remainingSelectionTime !== null) {
            room.selectionEndsAt = Date.now() + room.remainingSelectionTime;
        }
        room.pausedAt = null;

        transition(room, 'RESUME');

        if (room.gameState === GAME_STATES.DRAWING) {
            startRoundInterval(io, room, room.settings?.drawTime || 60);
        }

        io.to(room.code).emit(EVENTS.GAME_RESUMED, {
            roundEndsAt: room.roundEndsAt,
            selectionEndsAt: room.selectionEndsAt
        });
        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
    }
};

const handlePlayerLeave = (io, room, leavingPlayerId, _reason = null) => {
    if (!room) return;

    const leavingIndex = room.players.findIndex(p => p.id === leavingPlayerId || p.playerId === leavingPlayerId);
    if (leavingIndex === -1) return;

    const leavingPlayer = room.players[leavingIndex];
    const departingDrawerName = leavingPlayer?.username || 'Maya';
    const wasDrawer = (leavingIndex === room.currentDrawerIndex || room.drawerId === leavingPlayerId || room.drawerId === leavingPlayer?.playerId);
    const wasInTurn = (room.gameState === GAME_STATES.WORD_SELECTION || room.gameState === GAME_STATES.DRAWING);

    handlePlayerLeft(room, leavingPlayer.playerId || leavingPlayerId);

    const updatedRoom = roomManager.removePlayer(room.code, leavingPlayerId);
    if (!updatedRoom) {
        return;
    }

    io.to(updatedRoom.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(updatedRoom));

    // Mid-game check: If fewer than 2 connected players remain mid-game, pause up to 60s (E4)
    checkConnectedPlayerCount(io, updatedRoom);

    // If waiting for this drawer in TURN_WAIT, advance immediately
    if (updatedRoom.waitingForDrawerId === leavingPlayerId || updatedRoom.waitingForDrawerId === leavingPlayer?.playerId) {
        if (updatedRoom.timers?.turnWait) {
            clearTimeout(updatedRoom.timers.turnWait);
            updatedRoom.timers.turnWait = null;
        }
        updatedRoom.waitingForDrawerId = null;
        updatedRoom.turnWaitEndsAt = null;
        startTurn(io, updatedRoom, false);
        return;
    }

    // Drawer leaving check:
    // If in DRAWING, pause up to 10s (E1)
    if (wasInTurn && wasDrawer) {
        if (updatedRoom.gameState === GAME_STATES.DRAWING) {
            pauseForDrawerAway(io, updatedRoom);
            return;
        }

        clearRoomTimers(updatedRoom);
        transition(updatedRoom, 'ROUND_END');
        updatedRoom.roundEndsAt = null;
        updatedRoom.hint = null;

        const gains = (updatedRoom.players || []).map(p => ({
            id: p.id,
            gained: updatedRoom.roundGained?.[p.id] || 0,
            total: updatedRoom.scores?.[p.id] || 0
        }));

        io.to(updatedRoom.code).emit(EVENTS.ROUND_ENDED, {
            word: updatedRoom.wordToGuess,
            scores: updatedRoom.scores || {},
            gained: updatedRoom.roundGained || {},
            gains,
            fastestGuesserId: updatedRoom.fastestGuesserId || null,
            drawerBonus: updatedRoom.drawerBonus || 0,
            nextDrawerId: null,
            reason: 'drawer-left',
            drawerName: departingDrawerName,
            strokes: updatedRoom.strokes || []
        });

        const msg = {
            username: 'System',
            text: `${departingDrawerName} left. Skipping to the next drawer.`,
            type: 'system'
        };
        recordChatMessage(updatedRoom, msg);
        io.to(updatedRoom.code).emit(EVENTS.MESSAGE_RECEIVED, msg);

        startTurn(io, updatedRoom, false);
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
    startRoundInterval,
    endRound,
    advanceIntermission,
    skipIntermission,
    handlePlayerLeave,
    pauseForDrawerAway,
    resumeFromDrawerAway,
    checkGuessersAway,
    checkConnectedPlayerCount
};
