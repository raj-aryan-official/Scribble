const roomManager = require('../RoomManager');
const { toPublicRoom, toPublicPlayer, clearRoomTimers } = require('../RoomManager');
const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { sanitizeNickname, rejectWithError, getMemberRoom, isHost } = require('./utils');
const { makeSnapshot, recordChatMessage, handlePlayerLeave, cleanEndGame } = require('../game/loop');
const logger = require('../logger');

const ALLOWED_AVATARS = new Set(Array.from({ length: 12 }, (_, i) => `avatar-${i + 1}`));

function validateAvatar(avatar) {
    if (typeof avatar === 'string' && ALLOWED_AVATARS.has(avatar)) {
        return avatar;
    }
    return 'avatar-1';
}

function registerRoomHandlers(io, socket, safeOn) {
    safeOn(EVENTS.CREATE_ROOM, (payload) => {
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
        const room = roomManager.createRoom(player, settings);

        socket.join(room.code);
        socket.emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
    });

    safeOn(EVENTS.JOIN_ROOM, (payload) => {
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
            return rejectWithError(socket, 'Room not found');
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
        socket.emit(EVENTS.ROOM_JOINED, toPublicRoom(result.room));
        io.to(roomCode).emit(EVENTS.PLAYER_JOINED, toPublicPlayer(player));

        const joinMsg = {
            username: 'System',
            text: `${cleanUsername} joined!`,
            type: 'system'
        };
        recordChatMessage(result.room, joinMsg);
        io.to(roomCode).emit(EVENTS.MESSAGE_RECEIVED, joinMsg);

        // A late JOIN_ROOM during a game gets the same STATE_SNAPSHOT
        if (result.room.gameState !== GAME_STATES.LOBBY) {
            const snapshot = makeSnapshot(result.room, socket.id);
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
        const sessionId = payload.sessionId;
        if (typeof roomCode !== 'string' || typeof sessionId !== 'string' || !roomCode || !sessionId) {
            return rejectWithError(socket, 'Invalid rejoin parameters', 'SESSION_EXPIRED');
        }

        const room = roomManager.getRoom(roomCode);
        if (!room) {
            return rejectWithError(socket, 'Room not found', 'SESSION_EXPIRED');
        }

        if (room.kickedSessionIds && room.kickedSessionIds.has(sessionId)) {
            return rejectWithError(socket, 'You have been kicked from this room', 'SESSION_EXPIRED');
        }

        const existingPlayer = room.players.find(p => p.sessionId === sessionId);
        if (!existingPlayer) {
            return rejectWithError(socket, 'Session not found in room', 'SESSION_EXPIRED');
        }

        // New tab wins check: close old socket's seat claim if still connected
        if (existingPlayer.id && existingPlayer.id !== socket.id) {
            const oldSocket = io.sockets?.sockets?.get
                ? io.sockets.sockets.get(existingPlayer.id)
                : (io.sockets?.[existingPlayer.id] || null);
            if (oldSocket) {
                oldSocket.leave(room.code);
                oldSocket.leave(`${room.code}_voice`);
                oldSocket.emit(EVENTS.ERROR, {
                    message: 'Session opened in another window/tab',
                    code: 'SESSION_REPLACED'
                });
            }
        }

        const result = roomManager.reconnectPlayer(roomCode, sessionId, socket.id);
        if (result.error) {
            return rejectWithError(socket, result.error, 'SESSION_EXPIRED');
        }

        socket.join(roomCode);
        if (room.gameState === GAME_STATES.DRAWING && (room.drawerId === socket.id || (room.guessedPlayers && room.guessedPlayers.has(socket.id)))) {
            socket.join(`${room.code}:guessed`);
        }

        // Notify room that player is back online
        io.to(roomCode).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));

        // Emit ONE STATE_SNAPSHOT to that socket only
        const snapshot = makeSnapshot(room, socket.id);
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

    safeOn(EVENTS.KICK_PLAYER, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isHost(room, socket)) {
            return rejectWithError(socket, 'Only the host can kick players');
        }
        const targetId = payload.playerId || payload.targetId || payload.target;
        if (typeof targetId !== 'string' || !targetId) {
            return rejectWithError(socket, 'Invalid target player');
        }
        if (targetId === socket.id) {
            return rejectWithError(socket, 'Cannot kick yourself');
        }
        const targetPlayer = room.players.find(p => p.id === targetId);
        if (!targetPlayer) {
            return rejectWithError(socket, 'Player not found in room');
        }

        // Record sessionId to prevent rejoining
        if (targetPlayer.sessionId) {
            if (!room.kickedSessionIds) room.kickedSessionIds = new Set();
            room.kickedSessionIds.add(targetPlayer.sessionId);
        }

        io.to(targetId).emit(EVENTS.KICKED, { message: 'You have been kicked from the room' });
        if (EVENTS.KICKED !== 'KICKED') {
            io.to(targetId).emit('KICKED', { message: 'You have been kicked from the room' });
        }

        const targetSocket = io.sockets?.sockets?.get
            ? io.sockets.sockets.get(targetId)
            : (io.sockets?.[targetId] || null);
        if (targetSocket && typeof targetSocket.leave === 'function') {
            targetSocket.leave(room.code);
            targetSocket.leave(`${room.code}_voice`);
        }

        handlePlayerLeave(io, room, targetId, 'kicked');
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

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Do not remove player immediately. Mark disconnected with timestamp
        player.isDisconnected = true;
        player.disconnectedAt = Date.now();

        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));

        const sessionId = player.sessionId;
        if (!sessionId) {
            handlePlayerLeave(io, room, socket.id, 'disconnect');
            return;
        }

        if (!room.timers.grace) room.timers.grace = {};
        if (room.timers.grace[sessionId]) {
            clearTimeout(room.timers.grace[sessionId]);
        }

        // Start 60s grace timer stored on room.timers.grace[sessionId]
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
    });
}

module.exports = { registerRoomHandlers };
