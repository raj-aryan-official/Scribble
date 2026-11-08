const logger = require('./logger');
const { toPublicRoom, toPublicPlayer, clearRoomTimers } = require('./RoomManager');
const {
    getMemberRoom,
    isDrawer,
    isHost,
    sanitizeNickname,
    rejectWithError
} = require('./handlers/utils');
const {
    getTimeLeft,
    makeSnapshot,
    cleanEndGame
} = require('./game/loop');
const { registerRoomHandlers } = require('./handlers/room');
const { registerGameHandlers } = require('./handlers/game');
const { registerDrawingHandlers } = require('./handlers/drawing');
const { registerChatHandlers } = require('./handlers/chat');
const { registerVoiceHandlers } = require('./handlers/voice');

/**
 * Register all Socket.IO event handlers on a newly connected socket.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerHandlers(io, socket) {
    const safeOn = (eventName, handler) => {
        socket.on(eventName, (payload) => {
            try {
                handler(payload);
            } catch (err) {
                logger.error(`Error in event handler ${eventName}:`, err);
                rejectWithError(socket, 'Internal server error');
            }
        });
    };

    registerRoomHandlers(io, socket, safeOn);
    registerGameHandlers(io, socket, safeOn);
    registerDrawingHandlers(io, socket, safeOn);
    registerChatHandlers(io, socket, safeOn);
    registerVoiceHandlers(io, socket, safeOn);
}

// Preserve helper references for testing and backward compatibility
registerHandlers.getMemberRoom = getMemberRoom;
registerHandlers.isDrawer = isDrawer;
registerHandlers.isHost = isHost;
registerHandlers.cleanEndGame = cleanEndGame;
registerHandlers.sanitizeNickname = sanitizeNickname;
registerHandlers.rejectWithError = rejectWithError;
registerHandlers.toPublicRoom = toPublicRoom;
registerHandlers.toPublicPlayer = toPublicPlayer;
registerHandlers.clearRoomTimers = clearRoomTimers;
registerHandlers.getTimeLeft = getTimeLeft;
registerHandlers.makeSnapshot = makeSnapshot;
registerHandlers.registerHandlers = registerHandlers;

module.exports = registerHandlers;
