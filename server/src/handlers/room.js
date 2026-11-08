const { v4: uuidv4 } = require('uuid');
const roomManager = require('../RoomManager');
const { toPublicRoom, toPublicPlayer, clearRoomTimers } = require('../RoomManager');
const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { transition } = require('../game/machine');
const { sanitizeNickname, rejectWithError, getMemberRoom, isHost } = require('./utils');
const {
    makeSnapshot,
    recordChatMessage,
    handlePlayerLeave,
    cleanEndGame,
    startTurn,
    pauseForDrawerAway,
    resumeFromDrawerAway,
    checkGuessersAway,
    checkConnectedPlayerCount
} = require('../game/loop');
const { handlePlayerReturn, handlePlayerLeft, buildTurnInfo } = require('../game/turns');
const {
    checkCreateRoomLimit,
    checkJoinRoomLimit,
    recordWrongRoomCode
} = require('./rateLimiter');
const logger = require('../logger');

const isFastTimers = process.env.FAST_TIMERS === 'true' || process.env.TEST_TIMERS === 'true';
const HOST_GRACE_MS = isFastTimers ? 4000 : 90000;
const SEAT_CLAIM_TIMEOUT_MS = isFastTimers ? 4000 : 20000;

const ALLOWED_AVATARS = new Set(Array.from({ length: 12 }, (_, i) => `avatar-${i + 1}`));

function validateAvatar(avatar) {
    if (typeof avatar === 'string' && ALLOWED_AVATARS.has(avatar)) {
        return avatar;
    }
    return 'avatar-1';
}

function registerRoomHandlers(io, socket, safeOn) {
    safeOn(EVENTS.CREATE_ROOM, (payload) => {
        // E22: Token bucket rate limiting for CREATE_ROOM
        if (!checkCreateRoomLimit(socket)) {
            return rejectWithError(socket, 'Too many tries. Wait a moment.', 'RATE_LIMITED');
        }

        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const cleanUsername = sanitizeNickname(payload.username);
        if (cleanUsername.length < 1 || cleanUsername.length > 16) {
            return rejectWithError(socket, 'Username must be between 1 and 16 characters');
        }
        const avatar = validateAvatar(payload.avatar);
        const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
        const settings = payload.settings && typeof payload.settings === 'object' ? payload.settings : {};

        const player = { id: socket.id, username: cleanUsername, avatar, isHost: true, sessionId };

        let room;
        try {
            room = roomManager.createRoom(player, settings);
        } catch (err) {
            // E21: Refuse new rooms beyond MAX_ROOMS (500)
            if (err.code === 'MAX_ROOMS_REACHED') {
                return rejectWithError(socket, 'The server is busy. Try again in a minute.', 'MAX_ROOMS_REACHED');
            }
            throw err;
        }

        socket.join(room.code);
        // rejoinToken is a secret created on join and sent ONLY to that socket in the JOINED reply
        socket.emit(EVENTS.ROOM_JOINED, {
            ...toPublicRoom(room),
            playerId: player.playerId,
            rejoinToken: player.rejoinToken
        });
    });

    safeOn(EVENTS.JOIN_ROOM, (payload) => {
        // E22: Token bucket rate limiting for JOIN_ROOM
        if (!checkJoinRoomLimit(socket)) {
            return rejectWithError(socket, 'Too many tries. Wait a moment.', 'RATE_LIMITED');
        }

        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const roomCode = payload.roomCode;
        if (typeof roomCode !== 'string' || !roomCode.trim() || roomCode.length > 32) {
            return rejectWithError(socket, 'Invalid room code');
        }
        const cleanUsername = sanitizeNickname(payload.username);
        if (cleanUsername.length < 1 || cleanUsername.length > 16) {
            return rejectWithError(socket, 'Username must be between 1 and 16 characters');
        }
        const avatar = validateAvatar(payload.avatar);
        const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;

        // Check if player is already in another room
        const currentRoom = roomManager.getRoomByPlayerId(socket.id);
        if (currentRoom && currentRoom.code !== roomCode) {
            socket.leave(currentRoom.code);
            socket.leave(`${currentRoom.code}_voice`);
            handlePlayerLeave(io, currentRoom, socket.id, 'switched');
        }

        // Check if room exists
        const targetRoom = roomManager.getRoom(roomCode);
        if (!targetRoom) {
            // E22: Record wrong room code attempt against rate limiter
            recordWrongRoomCode(socket);
            return rejectWithError(socket, 'Room not found');
        }

        // 6. Seat claim without a token: if the room has 'away' players and a joiner uses the same nickname,
        // reply SEAT_CLAIM_AVAILABLE { playerId, username }
        if (!payload.rejoinToken && !payload.bypassSeatClaim && targetRoom.records) {
            const awayRecord = Array.from(targetRoom.records.values()).find(
                r => r.status === 'away' && r.username.toLowerCase() === cleanUsername.toLowerCase()
            );
            if (awayRecord) {
                socket.emit(EVENTS.SEAT_CLAIM_AVAILABLE, {
                    playerId: awayRecord.playerId,
                    username: awayRecord.username
                });
                return;
            }
        }

        // New tab wins check for existing session in this room
        if (sessionId) {
            const existingPlayer = targetRoom.players.find(p => p.sessionId === sessionId);
            if (existingPlayer && existingPlayer.id !== socket.id) {
                const oldSocket = io.sockets?.sockets?.get
                    ? io.sockets.sockets.get(existingPlayer.id)
                    : (io.sockets?.[existingPlayer.id] || null);
                if (oldSocket) {
                    oldSocket.leave(targetRoom.code);
                    oldSocket.leave(`${targetRoom.code}_voice`);
                    oldSocket.emit(EVENTS.ERROR, {
                        message: 'Session opened in another window/tab',
                        code: 'SESSION_REPLACED'
                    });
                }
            }
        }

        const player = { id: socket.id, username: cleanUsername, avatar, isHost: false, sessionId };
        const result = roomManager.joinRoom(roomCode, player);

        if (result.error) {
            return rejectWithError(socket, result.error);
        }

        socket.join(roomCode);
        // Secret rejoinToken sent ONLY to this socket
        socket.emit(EVENTS.ROOM_JOINED, {
            ...toPublicRoom(result.room),
            playerId: result.playerId,
            rejoinToken: result.rejoinToken
        });
        io.to(roomCode).emit(EVENTS.PLAYER_JOINED, toPublicPlayer(result.player));
        io.to(roomCode).emit(EVENTS.PLAYER_STATUS, {
            playerId: result.playerId,
            status: 'connected'
        });

        const joinMsg = {
            id: uuidv4(),
            ts: Date.now(),
            username: 'System',
            text: `${result.player.username} joined!`,
            type: 'system'
        };
        recordChatMessage(result.room, joinMsg);
        io.to(roomCode).emit(EVENTS.MESSAGE_RECEIVED, joinMsg);

        // Resume <2 players pause if game was paused
        checkConnectedPlayerCount(io, result.room);
        checkGuessersAway(io, result.room);

        // A late JOIN_ROOM during a game gets the same STATE_SNAPSHOT
        if (result.room.gameState !== GAME_STATES.LOBBY) {
            io.to(roomCode).emit(EVENTS.TURN_INFO, buildTurnInfo(result.room));
            const snapshot = makeSnapshot(result.room, socket.id, result.player);
            socket.emit(EVENTS.STATE_SNAPSHOT, snapshot);
            if (EVENTS.STATE_SNAPSHOT !== 'STATE_SNAPSHOT') {
                socket.emit('STATE_SNAPSHOT', snapshot);
            }
        } else if (result.room.strokes && result.room.strokes.length > 0) {
            socket.emit(EVENTS.STROKE_HISTORY, result.room.strokes);
        }
    });

    const handleRejoin = (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const roomCode = payload.roomCode;
        const rejoinToken = payload.rejoinToken;
        const sessionId = payload.sessionId;
        const lastSeq = payload.lastSeq;

        if (typeof roomCode !== 'string' || !roomCode) {
            return rejectWithError(socket, 'Invalid room code', 'SESSION_EXPIRED');
        }

        const room = roomManager.getRoom(roomCode);
        if (!room) {
            return rejectWithError(socket, 'Room not found', 'SESSION_EXPIRED');
        }

        let record = null;
        if (rejoinToken && typeof rejoinToken === 'string') {
            for (const r of room.records.values()) {
                if (roomManager.verifyToken(rejoinToken, r.tokenHash)) {
                    record = r;
                    break;
                }
            }
        }

        // Backward compatibility fallback for legacy tests passing sessionId
        if (!record && sessionId && typeof sessionId === 'string') {
            for (const r of room.records.values()) {
                if (r.sessionId === sessionId) {
                    record = r;
                    break;
                }
            }
            if (!record) {
                const existing = room.players.find(p => p.sessionId === sessionId);
                if (existing) {
                    const result = roomManager.reconnectPlayer(roomCode, sessionId, socket.id);
                    if (result.error) {
                        return rejectWithError(socket, result.error, 'SESSION_EXPIRED');
                    }
                    socket.join(roomCode);
                    if (room.gameState === GAME_STATES.DRAWING && (room.drawerId === socket.id || (room.guessedPlayers && room.guessedPlayers.has(socket.id)))) {
                        socket.join(`${room.code}:guessed`);
                    }
                    io.to(roomCode).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
                    const snapshot = makeSnapshot(room, socket.id, existing, lastSeq);
                    socket.emit(EVENTS.STATE_SNAPSHOT, snapshot);
                    return;
                }
            }
        }

        if (!record) {
            return rejectWithError(socket, 'Session not found in room', 'SESSION_EXPIRED');
        }

        if (
            (room.kickedPlayerIds && room.kickedPlayerIds.has(record.playerId)) ||
            (room.kickedTokenHashes && room.kickedTokenHashes.has(record.tokenHash)) ||
            (record.sessionId && room.kickedSessionIds && room.kickedSessionIds.has(record.sessionId))
        ) {
            return rejectWithError(socket, 'You have been kicked from this room', 'SESSION_EXPIRED');
        }

        // E6: Same token on second socket: newest connection wins.
        // Send SUPERSEDED to old socket, save supersededSocketId so TAKE_OVER can win it back!
        if (record.socketId && record.socketId !== socket.id) {
            const oldSocket = io.sockets?.sockets?.get
                ? io.sockets.sockets.get(record.socketId)
                : (io.sockets?.[record.socketId] || null);
            if (oldSocket) {
                oldSocket.leave(room.code);
                oldSocket.leave(`${room.code}:guessed`);
                oldSocket.leave(`${room.code}_voice`);
                oldSocket.emit(EVENTS.SUPERSEDED, {
                    message: 'Connected from another window or device',
                    code: 'SUPERSEDED'
                });
                oldSocket.emit(EVENTS.ERROR, {
                    message: 'Session opened in another window/tab',
                    code: 'SESSION_REPLACED'
                });
                if (typeof oldSocket.disconnect === 'function') {
                    oldSocket.disconnect(true);
                }
            }
            record.supersededSocketId = record.socketId;
        }

        const res = roomManager.reconnectRecord(room, record, socket.id);
        if (res.error) {
            return rejectWithError(socket, res.error, 'SESSION_EXPIRED');
        }

        socket.join(roomCode);
        if (room.gameState === GAME_STATES.DRAWING && (record.guessedThisTurn || room.drawerId === socket.id || room.drawerId === record.playerId)) {
            socket.join(`${room.code}:guessed`);
        }

        handlePlayerReturn(room, record.playerId);

        // E1: If drawer returned while paused for drawer away, resume turn clock!
        if (room.gameState === GAME_STATES.PAUSED && room.timers?.drawerAway && (room.drawerId === socket.id || room.drawerId === record.playerId)) {
            resumeFromDrawerAway(io, room);
        }

        // E4: If game was paused for <2 players, check if we can resume!
        checkConnectedPlayerCount(io, room);
        checkGuessersAway(io, room);

        if (room.gameState === GAME_STATES.TURN_WAIT && room.waitingForDrawerId === record.playerId) {
            if (room.timers?.turnWait) {
                clearTimeout(room.timers.turnWait);
                room.timers.turnWait = null;
            }
            room.turnQueue.unshift(record.playerId);
            room.waitingForDrawerId = null;
            room.turnWaitEndsAt = null;
            startTurn(io, room, false);
        }

        // Broadcast PLAYER_STATUS {playerId, status: 'connected'} to everyone else
        socket.to(roomCode).emit(EVENTS.PLAYER_STATUS, {
            playerId: record.playerId,
            status: 'connected'
        });
        io.to(roomCode).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
        io.to(roomCode).emit(EVENTS.TURN_INFO, buildTurnInfo(room));

        // Send STATE_SNAPSHOT to that socket only (with filtered strokes if lastSeq provided - E12)
        const snapshot = makeSnapshot(room, socket.id, record, lastSeq);
        socket.emit(EVENTS.STATE_SNAPSHOT, snapshot);
        if (EVENTS.STATE_SNAPSHOT !== 'STATE_SNAPSHOT') {
            socket.emit('STATE_SNAPSHOT', snapshot);
        }
    };

    safeOn(EVENTS.REJOIN_ROOM, handleRejoin);
    if (EVENTS.REJOIN_ROOM !== 'rejoinRoom') {
        safeOn('rejoinRoom', handleRejoin);
    }
    if (EVENTS.REJOIN_ROOM !== 'REJOIN_ROOM') {
        safeOn('REJOIN_ROOM', handleRejoin);
    }

    // E6: TAKE_OVER event to win back session from superseded tab
    safeOn(EVENTS.TAKE_OVER, (payload) => {
        const roomCode = (payload && typeof payload === 'object' && payload.roomCode)
            ? payload.roomCode
            : roomManager.getRoomByPlayerId(socket.id)?.code;

        const room = roomManager.getRoom(roomCode);
        if (!room) {
            return rejectWithError(socket, 'Room not found');
        }

        let record = null;
        if (payload?.rejoinToken) {
            for (const r of room.records.values()) {
                if (roomManager.verifyToken(payload.rejoinToken, r.tokenHash)) {
                    record = r;
                    break;
                }
            }
        }
        if (!record) {
            for (const r of room.records.values()) {
                if (r.supersededSocketId === socket.id || r.socketId === socket.id) {
                    record = r;
                    break;
                }
            }
        }

        if (!record) {
            return rejectWithError(socket, 'Session not found to take over');
        }

        const currentSocketId = record.socketId;
        if (currentSocketId && currentSocketId !== socket.id) {
            const currentSocket = io.sockets?.sockets?.get
                ? io.sockets.sockets.get(currentSocketId)
                : io.sockets?.[currentSocketId];
            if (currentSocket) {
                currentSocket.leave(room.code);
                currentSocket.leave(`${room.code}:guessed`);
                currentSocket.leave(`${room.code}_voice`);
                currentSocket.emit(EVENTS.SUPERSEDED, {
                    message: 'Connected from another window or device',
                    code: 'SUPERSEDED'
                });
            }
            record.supersededSocketId = currentSocketId;
        }

        roomManager.reconnectRecord(room, record, socket.id);
        socket.join(room.code);
        if (room.gameState === GAME_STATES.DRAWING && (record.guessedThisTurn || room.drawerId === socket.id || room.drawerId === record.playerId)) {
            socket.join(`${room.code}:guessed`);
        }

        const snapshot = makeSnapshot(room, socket.id, record);
        socket.emit(EVENTS.STATE_SNAPSHOT, snapshot);
        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
        io.to(room.code).emit(EVENTS.PLAYER_STATUS, { playerId: record.playerId, status: 'connected' });
    });

    // E11: CLOCK_SYNC ping/pong handshake
    const handleClockSync = (payload) => {
        const roomCode = (payload && typeof payload === 'object' && payload.roomCode)
            ? payload.roomCode
            : roomManager.getRoomByPlayerId(socket.id)?.code;
        const room = roomManager.getRoom(roomCode);

        socket.emit(EVENTS.CLOCK_SYNC, {
            clientTime: payload?.clientTime,
            serverTime: Date.now(),
            roundEndsAt: room?.roundEndsAt || null
        });
    };
    safeOn(EVENTS.CLOCK_SYNC, handleClockSync);
    if (EVENTS.CLOCK_SYNC !== 'clockSync') {
        safeOn('clockSync', handleClockSync);
    }

    // E13: SYNC_REQUEST returning fresh STATE_SNAPSHOT
    const handleSyncRequest = (payload) => {
        const roomCode = (payload && typeof payload === 'object' && payload.roomCode)
            ? payload.roomCode
            : roomManager.getRoomByPlayerId(socket.id)?.code;

        const room = roomManager.getRoom(roomCode);
        if (!room) {
            return rejectWithError(socket, 'Room not found');
        }
        const snapshot = makeSnapshot(room, socket.id);
        socket.emit(EVENTS.STATE_SNAPSHOT, snapshot);
    };
    safeOn(EVENTS.SYNC_REQUEST, handleSyncRequest);
    if (EVENTS.SYNC_REQUEST !== 'syncRequest') {
        safeOn('syncRequest', handleSyncRequest);
    }

    // 6. Seat claim without a token
    safeOn(EVENTS.CLAIM_SEAT, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const roomCode = payload.roomCode;
        const playerId = payload.playerId;

        const room = roomManager.getRoom(roomCode);
        if (!room) {
            return rejectWithError(socket, 'Room not found');
        }

        const awayRecord = room.records.get(playerId);
        if (!awayRecord || awayRecord.status !== 'away') {
            return rejectWithError(socket, 'Seat is not available for claiming');
        }

        // Find connected host
        const hostRecord = room.records.get(room.hostId) || Array.from(room.records.values()).find(r => r.isHost && r.status === 'connected');
        const hostSocket = hostRecord?.socketId
            ? (io.sockets?.sockets?.get ? io.sockets.sockets.get(hostRecord.socketId) : io.sockets?.[hostRecord.socketId])
            : null;

        // If host is away or does not answer within 20 s, decline
        if (!hostSocket || hostRecord?.status !== 'connected') {
            socket.emit(EVENTS.SEAT_CLAIM_DECLINED, { reason: 'Host is away' });
            return;
        }

        const claimId = uuidv4();
        const claim = {
            claimId,
            roomCode,
            playerId,
            joinerSocketId: socket.id,
            timer: setTimeout(() => {
                room.pendingClaims.delete(claimId);
                const joinerSock = io.sockets?.sockets?.get ? io.sockets.sockets.get(socket.id) : io.sockets?.[socket.id];
                if (joinerSock) {
                    joinerSock.emit(EVENTS.SEAT_CLAIM_DECLINED, { reason: 'The host said no' });
                }
            }, SEAT_CLAIM_TIMEOUT_MS)
        };

        if (!room.pendingClaims) room.pendingClaims = new Map();
        room.pendingClaims.set(claimId, claim);

        hostSocket.emit(EVENTS.SEAT_CLAIM_REQUEST, {
            claimId,
            playerId,
            username: awayRecord.username,
            timeout: Math.ceil(SEAT_CLAIM_TIMEOUT_MS / 1000)
        });
    });

    safeOn(EVENTS.RESOLVE_SEAT_CLAIM, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const { claimId, accepted } = payload;
        const room = roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not in a room');
        }

        const claim = room.pendingClaims?.get(claimId);
        if (!claim) return;

        clearTimeout(claim.timer);
        room.pendingClaims.delete(claimId);

        const joinerSocket = io.sockets?.sockets?.get
            ? io.sockets.sockets.get(claim.joinerSocketId)
            : io.sockets?.[claim.joinerSocketId];

        if (!accepted) {
            if (joinerSocket) {
                joinerSocket.emit(EVENTS.SEAT_CLAIM_DECLINED, { reason: 'The host said no' });
            }
            return;
        }

        // On accept, bind the record to the new socket with a fresh token
        const awayRecord = room.records.get(claim.playerId);
        if (!awayRecord) return;

        const freshToken = roomManager.generateRejoinToken();
        awayRecord.tokenHash = roomManager.hashToken(freshToken);

        const res = roomManager.reconnectWithToken(room.code, freshToken, claim.joinerSocketId);
        if (res.error) return;

        if (joinerSocket) {
            joinerSocket.join(room.code);
            if (room.gameState === GAME_STATES.DRAWING && (awayRecord.guessedThisTurn || room.drawerId === claim.joinerSocketId)) {
                joinerSocket.join(`${room.code}:guessed`);
            }

            joinerSocket.emit(EVENTS.SEAT_CLAIM_ACCEPTED, {
                roomCode: room.code,
                playerId: awayRecord.playerId,
                rejoinToken: freshToken
            });

            joinerSocket.emit(EVENTS.ROOM_JOINED, {
                ...toPublicRoom(room),
                playerId: awayRecord.playerId,
                rejoinToken: freshToken
            });

            const snapshot = makeSnapshot(room, claim.joinerSocketId, awayRecord);
            joinerSocket.emit(EVENTS.STATE_SNAPSHOT, snapshot);
        }

        handlePlayerReturn(room, awayRecord.playerId);

        if (room.gameState === GAME_STATES.TURN_WAIT && room.waitingForDrawerId === awayRecord.playerId) {
            if (room.timers?.turnWait) {
                clearTimeout(room.timers.turnWait);
                room.timers.turnWait = null;
            }
            room.turnQueue.unshift(awayRecord.playerId);
            room.waitingForDrawerId = null;
            room.turnWaitEndsAt = null;
            startTurn(io, room, false);
        }

        io.to(room.code).emit(EVENTS.PLAYER_STATUS, {
            playerId: awayRecord.playerId,
            status: 'connected'
        });
        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
        io.to(room.code).emit(EVENTS.TURN_INFO, buildTurnInfo(room));
    });

    safeOn(EVENTS.EDIT_PROFILE, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        const avatar = payload.avatar;
        if (typeof avatar !== 'string' || !/^avatar-(?:[1-9]|1[0-2])$/.test(avatar)) {
            return rejectWithError(socket, 'Invalid avatar ID');
        }
        const player = room.players.find(p => p.id === socket.id || p.socketId === socket.id);
        const record = room.records ? Array.from(room.records.values()).find(r => r.socketId === socket.id) : null;

        if (player) player.avatar = avatar;
        if (record) record.avatar = avatar;

        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
    });

    const handlePlayAgain = (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isHost(room, socket)) {
            return rejectWithError(socket, 'Only the host can restart the game');
        }

        clearRoomTimers(room);
        if (room.records) {
            for (const rec of room.records.values()) {
                rec.score = 0;
                rec.guessedThisTurn = false;
                rec.guessMs = [];
                rec.correctGuesses = 0;
                rec.drawsDone = [];
                rec.missedDraws = [];
            }
        }
        room.scores = room.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});

        room.strokes = [];
        room.currentRound = 0;
        room.currentDrawerIndex = 0;
        room.drawerId = null;
        room.wordToGuess = null;
        room.wordChoices = null;
        room.hint = null;
        room.wordHint = null;
        room.roundEndsAt = null;
        room.guessedPlayers = new Set();
        room.usedWords = new Set();
        room.matchDrawings = [];
        room.roundGained = {};
        room.drawerFirstGuessTimes = {};
        room.playerGuessTimes = {};
        room.awards = null;
        room.gameState = GAME_STATES.LOBBY;

        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
    };

    safeOn(EVENTS.PLAY_AGAIN, handlePlayAgain);
    if (EVENTS.PLAY_AGAIN !== 'playAgain') {
        safeOn('playAgain', handlePlayAgain);
    }
    if (EVENTS.PLAY_AGAIN !== 'PLAY_AGAIN') {
        safeOn('PLAY_AGAIN', handlePlayAgain);
    }

    const handleUpdateSettings = (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isHost(room, socket)) {
            return rejectWithError(socket, 'Only the host can update room settings');
        }
        if (room.gameState !== GAME_STATES.LOBBY) {
            return rejectWithError(socket, 'Settings can only be updated in the lobby');
        }

        const rawSettings = payload.settings || payload;
        const sanitized = roomManager.sanitizeSettings(rawSettings);
        room.settings = sanitized;

        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
    };

    safeOn(EVENTS.UPDATE_SETTINGS, handleUpdateSettings);
    if (EVENTS.UPDATE_SETTINGS !== 'updateSettings') {
        safeOn('updateSettings', handleUpdateSettings);
    }

    safeOn('disconnect', () => {
        const room = roomManager.getRoomByPlayerId(socket.id);
        if (!room) return;
        socket.leave(`${room.code}:guessed`);

        let record = null;
        if (room.records) {
            for (const r of room.records.values()) {
                if (r.socketId === socket.id) {
                    record = r;
                    break;
                }
            }
        }
        const player = room.players.find(p => p.id === socket.id || (record && p.playerId === record.playerId));
        if (!record && !player) return;

        const sessionId = player?.sessionId || record?.sessionId;
        const isPersistent = Boolean(sessionId || player?.persistOnDisconnect || record?.persistOnDisconnect || socket.persistOnDisconnect);
        if (!isPersistent) {
            handlePlayerLeave(io, room, socket.id, 'disconnect');
            return;
        }

        const playerId = record ? record.playerId : player.id;
        const wasHost = Boolean(record?.isHost || room.hostId === socket.id || player?.isHost);

        // Set status 'away' on disconnect (seat stays reserved and counts toward maxPlayers - E7)
        if (record) {
            record.status = 'away';
            record.leftAt = Date.now();
            record.socketId = null;
        }

        if (player) {
            player.isDisconnected = true;
            player.status = 'away';
            player.disconnectedAt = Date.now();
        }

        // E2: Host handover to longest-present player with 90s grace timer
        if (wasHost) {
            room.originalHostId = room.originalHostId || playerId;
            const candidate = Array.from(room.records.values())
                .filter(r => r.status === 'connected' && r.playerId !== playerId)
                .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];

            if (candidate) {
                room.actingHostId = candidate.playerId;
                candidate.isHost = true;
                room.hostId = candidate.socketId;
                const p = room.players.find(x => x.playerId === candidate.playerId);
                if (p) p.isHost = true;
                if (record) record.isHost = false;
            }

            if (room.timers.hostGrace) {
                clearTimeout(room.timers.hostGrace);
            }
            room.timers.hostGrace = setTimeout(() => {
                const currentRoom = roomManager.getRoom(room.code);
                if (!currentRoom) return;
                currentRoom.timers.hostGrace = null;
                if (currentRoom.actingHostId) {
                    currentRoom.originalHostId = currentRoom.actingHostId;
                    currentRoom.actingHostId = null;
                }
            }, HOST_GRACE_MS);
        }

        // E1: Drawer disconnect pauses turn clock for up to 10s
        const wasDrawer = (room.drawerId === socket.id || room.drawerId === playerId);
        if (wasDrawer && room.gameState === GAME_STATES.DRAWING) {
            pauseForDrawerAway(io, room);
        } else if (wasDrawer && room.gameState === GAME_STATES.WORD_SELECTION) {
            clearRoomTimers(room);
            transition(room, 'ROUND_END');
            room.roundEndsAt = null;
            room.hint = null;

            const gains = (room.players || []).map(p => ({
                id: p.id,
                gained: room.roundGained?.[p.id] || 0,
                total: room.scores?.[p.id] || 0
            }));

            io.to(room.code).emit(EVENTS.ROUND_ENDED, {
                word: room.wordToGuess,
                scores: room.scores || {},
                gained: room.roundGained || {},
                gains,
                fastestGuesserId: room.fastestGuesserId || null,
                drawerBonus: room.drawerBonus || 0,
                nextDrawerId: null,
                reason: 'drawer-left',
                drawerName: player?.username || record?.username || 'Drawer',
                strokes: room.strokes || []
            });

            startTurn(io, room, false);
        } else if (!wasDrawer && room.gameState === GAME_STATES.DRAWING) {
            // E3: All guessers away check
            checkGuessersAway(io, room);
        }

        // E4: Fewer than 2 connected players pauses game up to 60s
        checkConnectedPlayerCount(io, room);

        // E21: If all connected players left, start 10 min cleanup timer
        const connectedCount = Array.from(room.records.values()).filter(r => r.status === 'connected').length;
        if (connectedCount === 0) {
            if (room.gameState === GAME_STATES.LOBBY && (room.timers?.wordSelection || room.timers?.interval)) {
                clearRoomTimers(room);
                roomManager.rooms.delete(room.code);
                roomManager.roomStore?.delete(room.code);
                return;
            }
            if (!room.timers.emptyCleanup) {
                room.timers.emptyCleanup = setTimeout(() => {
                    roomManager.deleteRoom(room.code);
                }, 10 * 60 * 1000);
            }
        }

        io.to(room.code).emit(EVENTS.PLAYER_STATUS, { playerId, status: 'away' });
        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));

        // Start 90s away timer: after 90s away, set 'left' and remove from turn order, but keep record
        if (!room.timers.away) room.timers.away = {};
        if (room.timers.away[playerId]) {
            clearTimeout(room.timers.away[playerId]);
        }

        room.timers.away[playerId] = setTimeout(() => {
            try {
                const currentRoom = roomManager.getRoom(room.code);
                if (!currentRoom || currentRoom !== room) return;

                const rec = currentRoom.records?.get(playerId);
                if (!rec || rec.status !== 'away') {
                    delete currentRoom.timers?.away?.[playerId];
                    return;
                }

                delete currentRoom.timers?.away?.[playerId];
                rec.status = 'left';

                handlePlayerLeft(currentRoom, playerId);

                if (currentRoom.gameState === GAME_STATES.TURN_WAIT && currentRoom.waitingForDrawerId === playerId) {
                    if (currentRoom.timers?.turnWait) {
                        clearTimeout(currentRoom.timers.turnWait);
                        currentRoom.timers.turnWait = null;
                    }
                    currentRoom.waitingForDrawerId = null;
                    currentRoom.turnWaitEndsAt = null;
                    startTurn(io, currentRoom, false);
                }

                const p = currentRoom.players.find(x => x.playerId === playerId || x.id === playerId);
                if (p) {
                    p.status = 'left';
                }

                io.to(currentRoom.code).emit(EVENTS.PLAYER_STATUS, { playerId, status: 'left' });
                io.to(currentRoom.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(currentRoom));
                io.to(currentRoom.code).emit(EVENTS.TURN_INFO, buildTurnInfo(currentRoom));
            } catch (err) {
                logger.error('Error in away timer callback:', err);
            }
        }, 90000);

        // Keep 60s grace timer if sessionId exists for backward compatibility
        if (sessionId) {
            if (!room.timers.grace) room.timers.grace = {};
            if (room.timers.grace[sessionId]) {
                clearTimeout(room.timers.grace[sessionId]);
            }
            room.timers.grace[sessionId] = setTimeout(() => {
                try {
                    const currentRoom = roomManager.getRoom(room.code);
                    if (!currentRoom || currentRoom !== room) return;

                    const p = currentRoom.players.find(x => x.sessionId === sessionId);
                    if (!p || !p.isDisconnected) {
                        delete currentRoom.timers?.grace?.[sessionId];
                        return;
                    }

                    delete currentRoom.timers?.grace?.[sessionId];
                    handlePlayerLeave(io, currentRoom, p.id, 'grace_timeout');
                } catch (err) {
                    logger.error('Error in grace timer callback:', err);
                    cleanEndGame(io, room);
                }
            }, 60000);
        }
    });
}

module.exports = { registerRoomHandlers };
