const logger = require('./logger');
const roomManager = require('./RoomManager');
const { toPublicRoom, toPublicPlayer, clearRoomTimers } = require('./RoomManager');
const {
    getMemberRoom,
    isDrawer,
    isHost,
    sanitizeNickname,
    sanitiseText,
    rejectWithError
} = require('./handlers/utils');
const {
    getTimeLeft,
    makeSnapshot,
    cleanEndGame
} = require('./game/loop');
const { enqueueRoomAction } = require('./handlers/actionQueue');
const { registerRoomHandlers } = require('./handlers/room');
const { registerGameHandlers } = require('./handlers/game');
const { registerDrawingHandlers } = require('./handlers/drawing');
const { registerChatHandlers } = require('./handlers/chat');
const { registerVoiceHandlers } = require('./handlers/voice');
const { registerModerationHandlers } = require('./handlers/moderation');
const { registerReactionHandlers } = require('./handlers/reactions');

/**
 * Register all Socket.IO event handlers on a newly connected socket.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerHandlers(io, socket) {
    const safeOn = (eventName, handler) => {
        socket.on(eventName, (payload) => {
            const roomCode = (payload && typeof payload === 'object' && typeof payload.roomCode === 'string')
                ? payload.roomCode
                : roomManager.getRoomByPlayerId(socket.id)?.code;

            return enqueueRoomAction(roomCode, () => {
                try {
                    return handler(payload);
                } catch (err) {
                    logger.error(`Error in event handler ${eventName}:`, err);
                    rejectWithError(socket, 'Internal server error');
                }
            });
        });
    };

    registerRoomHandlers(io, socket, safeOn);
    registerGameHandlers(io, socket, safeOn);
    registerDrawingHandlers(io, socket, safeOn);
    registerChatHandlers(io, socket, safeOn);
    registerVoiceHandlers(io, socket, safeOn);
    registerModerationHandlers(io, socket, safeOn);
    registerReactionHandlers(io, socket, safeOn);
}

// Preserve helper references for testing and backward compatibility
registerHandlers.getMemberRoom = getMemberRoom;
registerHandlers.isDrawer = isDrawer;
registerHandlers.isHost = isHost;
registerHandlers.cleanEndGame = cleanEndGame;
registerHandlers.sanitizeNickname = sanitizeNickname;
registerHandlers.sanitiseText = sanitiseText;
registerHandlers.rejectWithError = rejectWithError;
registerHandlers.toPublicRoom = toPublicRoom;
registerHandlers.toPublicPlayer = toPublicPlayer;
registerHandlers.clearRoomTimers = clearRoomTimers;
registerHandlers.getTimeLeft = getTimeLeft;
registerHandlers.makeSnapshot = makeSnapshot;
registerHandlers.registerHandlers = registerHandlers;

module.exports = registerHandlers;
