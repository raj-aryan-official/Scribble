const roomManager = require('../RoomManager');
const { EVENTS } = require('../../../shared/types.cjs');
const { rejectWithError, getMemberRoom } = require('./utils');

function registerVoiceHandlers(io, socket, safeOn) {
    safeOn(EVENTS.VOICE_JOIN, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (room.players.length > 6) {
            return rejectWithError(socket, 'Voice chat is limited to rooms of up to 6 players');
        }
        socket.join(`${room.code}_voice`);
        socket.to(`${room.code}_voice`).emit(EVENTS.VOICE_JOIN, { socketId: socket.id });
        const voiceRoom = io.sockets?.adapter?.rooms?.get(`${room.code}_voice`);
        if (voiceRoom) {
            const users = Array.from(voiceRoom).filter(id => id !== socket.id);
            socket.emit(EVENTS.EXISTING_VOICE_USERS, users);
            if (EVENTS.EXISTING_VOICE_USERS !== 'EXISTING_VOICE_USERS') {
                socket.emit('EXISTING_VOICE_USERS', users);
            }
        }
    });

    safeOn(EVENTS.VOICE_LEAVE, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        socket.leave(`${room.code}_voice`);
        socket.to(`${room.code}_voice`).emit(EVENTS.VOICE_LEAVE, { socketId: socket.id });
    });

    safeOn(EVENTS.VOICE_OFFER, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = (payload.roomCode ? getMemberRoom(socket, payload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of any room');
        }
        const target = payload.target;
        if (typeof target !== 'string' || !target) {
            return rejectWithError(socket, 'Invalid target');
        }
        const isTargetInRoom = Array.isArray(room.players) && room.players.some(p => p.id === target);
        if (!isTargetInRoom) {
            return rejectWithError(socket, 'Target is not in the same room');
        }
        if (!payload.offer || typeof payload.offer !== 'object') {
            return rejectWithError(socket, 'Invalid offer');
        }
        io.to(target).emit(EVENTS.VOICE_OFFER, { sender: socket.id, offer: payload.offer });
    });

    safeOn(EVENTS.VOICE_ANSWER, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = (payload.roomCode ? getMemberRoom(socket, payload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of any room');
        }
        const target = payload.target;
        if (typeof target !== 'string' || !target) {
            return rejectWithError(socket, 'Invalid target');
        }
        const isTargetInRoom = Array.isArray(room.players) && room.players.some(p => p.id === target);
        if (!isTargetInRoom) {
            return rejectWithError(socket, 'Target is not in the same room');
        }
        if (!payload.answer || typeof payload.answer !== 'object') {
            return rejectWithError(socket, 'Invalid answer');
        }
        io.to(target).emit(EVENTS.VOICE_ANSWER, { sender: socket.id, answer: payload.answer });
    });

    safeOn(EVENTS.ICE_CANDIDATE, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = (payload.roomCode ? getMemberRoom(socket, payload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of any room');
        }
        const target = payload.target;
        if (typeof target !== 'string' || !target) {
            return rejectWithError(socket, 'Invalid target');
        }
        const isTargetInRoom = Array.isArray(room.players) && room.players.some(p => p.id === target);
        if (!isTargetInRoom) {
            return rejectWithError(socket, 'Target is not in the same room');
        }
        if (!payload.candidate || typeof payload.candidate !== 'object') {
            return rejectWithError(socket, 'Invalid candidate');
        }
        io.to(target).emit(EVENTS.ICE_CANDIDATE, { sender: socket.id, candidate: payload.candidate });
    });
}

module.exports = { registerVoiceHandlers };
