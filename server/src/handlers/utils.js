const roomManager = require('../RoomManager');
const { EVENTS } = require('../../../shared/types.cjs');

const sanitizeNickname = (raw) => {
    if (typeof raw !== 'string') return '';
    return raw.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
};

const rejectWithError = (socket, message, code = undefined) => {
    socket.emit(EVENTS.ERROR, { message, ...(code ? { code } : {}) });
};

const getMemberRoom = (socket, roomCode) => {
    if (!socket || !roomCode || typeof roomCode !== 'string') return null;
    const room = roomManager.getRoom(roomCode);
    if (!room || !Array.isArray(room.players)) return null;
    const isMember = room.players.some(p => p.id === socket.id);
    return isMember ? room : null;
};

const isDrawer = (room, socket) => {
    if (!room || !socket || !Array.isArray(room.players)) return false;
    const drawer = room.players[room.currentDrawerIndex];
    return Boolean(drawer && drawer.id === socket.id);
};

const isHost = (room, socket) => {
    if (!room || !socket) return false;
    return Boolean(room.hostId === socket.id);
};

module.exports = {
    sanitizeNickname,
    rejectWithError,
    getMemberRoom,
    isDrawer,
    isHost
};
