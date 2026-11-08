const roomManager = require('../RoomManager');
const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { getMemberRoom, isDrawer, rejectWithError } = require('./utils');

const ALLOWED_REACTIONS = ['heart', 'clap', 'laugh', 'wow', 'fire', 'thinking', 'sad', 'party'];

// Sliding window timestamps per socket/player for 3/s rate limit
const playerReactionTimestamps = new Map();

// Reaction counts per turn per player for 30/turn limit: Map<`${turnId}:${playerId}`, number>
const turnPlayerReactionCounts = new Map();

function resetReactionRateLimits() {
    playerReactionTimestamps.clear();
    turnPlayerReactionCounts.clear();
}

function flushReactionBatch(io, room) {
    if (!room) return;
    if (room.reactionBatchTimer) {
        clearTimeout(room.reactionBatchTimer);
        room.reactionBatchTimer = null;
    }

    if (!room.pendingReactions) return;
    const batch = { ...room.pendingReactions };
    let hasAny = false;
    for (const count of Object.values(batch)) {
        if (count > 0) hasAny = true;
    }

    // Reset pending
    room.pendingReactions = {};

    if (hasAny && room.code) {
        io.to(room.code).emit(EVENTS.REACTION_BATCH, {
            reactions: batch,
            turnId: room.currentTurnId || null
        });
    }
}

function getTopReaction(turnReactions) {
    if (!turnReactions) return null;
    let topKind = null;
    let maxCount = 0;
    for (const [kind, count] of Object.entries(turnReactions)) {
        if (count > maxCount) {
            maxCount = count;
            topKind = kind;
        }
    }
    return topKind && maxCount > 0 ? { kind: topKind, count: maxCount } : null;
}

function registerReactionHandlers(io, socket, safeOn) {
    socket.on('disconnect', () => {
        playerReactionTimestamps.delete(socket.id);
    });

    safeOn(EVENTS.REACT, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }

        const room = (payload.roomCode ? getMemberRoom(socket, payload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }

        if (room.gameState !== GAME_STATES.DRAWING) {
            return rejectWithError(socket, 'Reactions are only allowed while drawing');
        }

        // Stale turn check
        if (payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId) {
            return;
        }

        // Drawer cannot react to own drawing
        if (isDrawer(room, socket)) {
            return rejectWithError(socket, 'Drawer cannot react to own drawing');
        }

        const kind = payload.kind;
        if (!ALLOWED_REACTIONS.includes(kind)) {
            return rejectWithError(socket, 'Invalid reaction kind');
        }

        const player = (room.players || []).find(p => p.id === socket.id);
        const record = room.records
            ? (room.records.get(player?.playerId) || Array.from(room.records.values()).find(r => r.socketId === socket.id))
            : null;
        const playerId = record?.playerId || player?.playerId || socket.id;

        const now = Date.now();

        // 1. Rate limit: 3 per second per socket
        const timestamps = (playerReactionTimestamps.get(socket.id) || []).filter(t => now - t < 1000);
        if (timestamps.length >= 3) {
            return rejectWithError(socket, 'Reaction rate limit exceeded (max 3/sec)');
        }
        timestamps.push(now);
        playerReactionTimestamps.set(socket.id, timestamps);

        // 2. Limit: 30 per turn per player
        const turnKey = `${room.currentTurnId || 'turn'}:${playerId}`;
        const currentCount = turnPlayerReactionCounts.get(turnKey) || 0;
        if (currentCount >= 30) {
            return rejectWithError(socket, 'Reaction limit reached for this turn (max 30)');
        }
        turnPlayerReactionCounts.set(turnKey, currentCount + 1);

        // Aggregate into pending reactions
        if (!room.pendingReactions) room.pendingReactions = {};
        room.pendingReactions[kind] = (room.pendingReactions[kind] || 0) + 1;

        // Turn-level aggregated stats
        if (!room.turnReactions) room.turnReactions = {};
        room.turnReactions[kind] = (room.turnReactions[kind] || 0) + 1;

        // 200 ms batch aggregation broadcast
        if (!room.reactionBatchTimer) {
            room.reactionBatchTimer = setTimeout(() => {
                room.reactionBatchTimer = null;
                flushReactionBatch(io, room);
            }, 200);
        }
    });

    safeOn(EVENTS.LIKE_DRAWING, (payload) => {
        const safePayload = payload && typeof payload === 'object' ? payload : {};
        const room = (safePayload.roomCode ? getMemberRoom(socket, safePayload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }

        if (room.gameState !== GAME_STATES.DRAWING) {
            return rejectWithError(socket, 'Likes are only allowed while drawing');
        }

        // Stale turn check
        if (safePayload.turnId && room.currentTurnId && safePayload.turnId !== room.currentTurnId) {
            return;
        }

        // Drawer cannot like own drawing
        if (isDrawer(room, socket)) {
            return rejectWithError(socket, 'Drawer cannot like own drawing');
        }

        const player = (room.players || []).find(p => p.id === socket.id);
        const record = room.records
            ? (room.records.get(player?.playerId) || Array.from(room.records.values()).find(r => r.socketId === socket.id))
            : null;
        // Track by record, not by socket
        const recordId = record?.playerId || player?.playerId || socket.id;

        if (!room.turnLikes) room.turnLikes = new Set();
        if (room.turnLikes.has(recordId)) {
            return rejectWithError(socket, 'Already liked this drawing');
        }
        room.turnLikes.add(recordId);

        // Drawer earns 5 points per like, capped at 50 per turn
        room.turnLikePoints = room.turnLikePoints || 0;
        const drawer = room.players?.[room.currentDrawerIndex];
        const drawerId = room.drawerId || drawer?.id;

        if (drawerId && room.turnLikePoints < 50) {
            const pointsToAdd = Math.min(5, 50 - room.turnLikePoints);
            room.turnLikePoints += pointsToAdd;

            if (!room.scores) room.scores = {};
            room.scores[drawerId] = (room.scores[drawerId] || 0) + pointsToAdd;

            if (!room.roundGained) room.roundGained = {};
            room.roundGained[drawerId] = (room.roundGained[drawerId] || 0) + pointsToAdd;

            const drawerRecord = room.records
                ? (room.records.get(drawerId) || Array.from(room.records.values()).find(r => r.playerId === drawerId || r.socketId === drawerId))
                : null;
            if (drawerRecord) {
                drawerRecord.score = (drawerRecord.score || 0) + pointsToAdd;
            }
        }

        room.turnLikesCount = (room.turnLikesCount || 0) + 1;
        if (!room.drawerLikes) room.drawerLikes = {};
        if (drawerId) {
            room.drawerLikes[drawerId] = (room.drawerLikes[drawerId] || 0) + 1;
        }

        io.to(room.code).emit(EVENTS.LIKE_UPDATE, {
            likes: room.turnLikesCount,
            drawerId,
            turnId: room.currentTurnId || null,
            scores: room.scores || {}
        });
    });
}

module.exports = {
    ALLOWED_REACTIONS,
    registerReactionHandlers,
    flushReactionBatch,
    getTopReaction,
    resetReactionRateLimits
};

