const roomManager = require('../RoomManager');
const { EVENTS } = require('../../../shared/types.cjs');
const { sanitiseText, sanitizeNickname } = require('../sanitise');

const rejectWithError = (socket, message, code = undefined) => {
    socket.emit(EVENTS.ERROR, { message, ...(code ? { code } : {}) });
};

const getMemberRoom = (socket, roomCode) => {
    if (!socket || !roomCode || typeof roomCode !== 'string') return null;
    const room = roomManager.getRoom(roomCode);
    if (!room || !Array.isArray(room.players)) return null;
    const isMember = room.players.some(p => p.id === socket.id || p.socketId === socket.id);
    if (isMember) return room;
    if (room.records) {
        for (const rec of room.records.values()) {
            if (rec.socketId === socket.id || rec.playerId === socket.id) {
                return room;
            }
        }
    }
    return null;
};

const isDrawer = (room, socket) => {
    if (!room || !socket) return false;
    if (room.drawerId) {
        if (room.drawerId === socket.id) return true;
        const rec = room.records?.get(room.drawerId);
        if (rec && rec.socketId === socket.id) return true;
        for (const r of (room.records?.values() || [])) {
            if (r.socketId === socket.id && r.playerId === room.drawerId) return true;
        }
    }
    if (Array.isArray(room.players) && room.currentDrawerIndex !== undefined) {
        const drawer = room.players[room.currentDrawerIndex];
        return Boolean(drawer && (drawer.id === socket.id || drawer.socketId === socket.id));
    }
    return false;
};

const isHost = (room, socket) => {
    if (!room || !socket) return false;
    if (room.hostId === socket.id) return true;
    if (room.records) {
        const rec = room.records.get(room.hostId);
        if (rec && rec.socketId === socket.id) return true;
        for (const r of room.records.values()) {
            if (r.socketId === socket.id && (r.isHost || r.playerId === room.hostId)) return true;
        }
    }
    return false;
};

module.exports = {
    sanitiseText,
    sanitizeNickname,
    rejectWithError,
    getMemberRoom,
    isDrawer,
    isHost
};
