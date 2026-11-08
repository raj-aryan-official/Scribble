const { v4: uuidv4 } = require('uuid');
const roomManager = require('../RoomManager');
const { toPublicRoom, clearRoomTimers, blockKickedPlayer } = require('../RoomManager');
const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { getMemberRoom, isHost, rejectWithError } = require('./utils');
const { transition } = require('../game/machine');
const { handlePlayerLeft, buildTurnInfo } = require('../game/turns');
const { startTurn } = require('../game/loop');
const logger = require('../logger');

// Per-socket moderation event timestamps for rate limiting (5 per 3s like chat)
const socketModerationTimestamps = new Map();

function resetModerationRateLimits() {
    socketModerationTimestamps.clear();
}

function checkModerationRateLimit(socket) {
    const now = Date.now();
    const timestamps = socketModerationTimestamps.get(socket.id) || [];
    const recent = timestamps.filter(t => now - t < 3000);
    if (recent.length >= 5) {
        return false;
    }
    recent.push(now);
    socketModerationTimestamps.set(socket.id, recent);
    return true;
}

function getConnectedPlayers(room) {
    if (!room) return [];
    if (room.records) {
        return Array.from(room.records.values()).filter(
            r => r.status === 'connected' && Boolean(r.socketId)
        );
    }
    return (room.players || []).filter(p => !p.isDisconnected && p.status !== 'away' && p.status !== 'left');
}

function broadcastVoteState(io, room) {
    if (!room || !room.activeVote) {
        if (room?.code) {
            io.to(room.code).emit(EVENTS.VOTE_STATE, null);
        }
        return;
    }

    let yes = 0;
    let _no = 0;
    for (const val of room.activeVote.votes.values()) {
        if (val) yes++;
        else _no++;
    }

    const payload = {
        voteId: room.activeVote.voteId,
        targetId: room.activeVote.targetId,
        targetName: room.activeVote.targetName,
        targetAvatar: room.activeVote.targetAvatar,
        reason: room.activeVote.reason,
        yes,
        no: _no,
        total: room.activeVote.total,
        threshold: room.activeVote.threshold,
        endsAt: room.activeVote.endsAt
    };

    io.to(room.code).emit(EVENTS.VOTE_STATE, payload);
}

function resolveVote(io, room, forceResult = null) {
    if (!room || !room.activeVote) return;

    if (room.activeVote.timer) {
        clearTimeout(room.activeVote.timer);
        room.activeVote.timer = null;
    }

    let yes = 0;
    let _no = 0;
    for (const val of room.activeVote.votes.values()) {
        if (val) yes++;
        else _no++;
    }

    const vote = room.activeVote;
    const passed = forceResult !== null ? forceResult : (yes >= vote.threshold);

    if (passed) {
        const msg = {
            username: 'System',
            text: `Vote passed (${yes}/${vote.threshold}). ${vote.targetName} was removed from the room.`,
            type: 'system'
        };
        io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, msg);

        executeKick(io, room, vote.targetId, 'vote', vote.reason);
    } else {
        const msg = {
            username: 'System',
            text: `Vote to remove ${vote.targetName} failed (${yes}/${vote.threshold} votes).`,
            type: 'system'
        };
        io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, msg);

        // Target immunity for 10 minutes
        const now = Date.now();
        const targetRec = room.records?.get(vote.targetId);
        if (targetRec) targetRec.voteImmunityUntil = now + 10 * 60 * 1000;
        if (!room.targetImmunities) room.targetImmunities = new Map();
        room.targetImmunities.set(vote.targetId, now + 10 * 60 * 1000);

        // Increment initiator failed vote count
        const initRec = room.records?.get(vote.initiatorId);
        if (initRec) initRec.failedVoteCount = (initRec.failedVoteCount || 0) + 1;
        if (!room.initiatorFailedVotes) room.initiatorFailedVotes = new Map();
        const prevFail = room.initiatorFailedVotes.get(vote.initiatorId) || 0;
        room.initiatorFailedVotes.set(vote.initiatorId, prevFail + 1);

        room.activeVote = null;
        io.to(room.code).emit(EVENTS.VOTE_STATE, null);
    }
}

function checkEarlyResolution(io, room) {
    if (!room || !room.activeVote) return;

    let yes = 0;
    let _no = 0;
    for (const val of room.activeVote.votes.values()) {
        if (val) yes++;
        else _no++;
    }

    const remaining = room.activeVote.total - (yes + _no);

    // Condition 1: Yes votes reached threshold -> Early PASS
    if (yes >= room.activeVote.threshold) {
        resolveVote(io, room, true);
        return;
    }

    // Condition 2: Impossible to reach threshold even if all remaining vote yes -> Early FAIL
    if (yes + remaining < room.activeVote.threshold) {
        resolveVote(io, room, false);
    }
}

/**
 * Executes player kick, applying the 10-minute soft block, setting status to 'kicked',
 * and handling mid-turn drawer rules (GF3).
 */
function executeKick(io, room, targetId, kickedBy = 'vote', reason = 'moderation') {
    if (!room || !targetId) return;

    const targetPlayer = room.players?.find(p => p.id === targetId || p.playerId === targetId);
    const targetRecord = room.records
        ? (room.records.get(targetId) || Array.from(room.records.values()).find(r => r.socketId === targetId || r.playerId === targetId))
        : null;

    const effectivePlayerId = targetRecord?.playerId || targetPlayer?.playerId || targetId;
    const targetSocketId = targetRecord?.socketId || targetPlayer?.id;
    const departingName = targetRecord?.username || targetPlayer?.username || 'Player';

    // Soft block: 10-minute temporary ban by rejoinToken and nickname
    blockKickedPlayer(room, targetRecord || targetPlayer, 10 * 60 * 1000);

    // Keep record but mark status 'kicked'
    if (targetRecord) targetRecord.status = 'kicked';
    if (targetPlayer) targetPlayer.status = 'kicked';

    // Notify kicked target
    if (targetSocketId) {
        io.to(targetSocketId).emit(EVENTS.KICKED, {
            by: kickedBy,
            reason,
            message: kickedBy === 'vote' ? 'You have been kicked by vote.' : 'The host removed you from the room.'
        });

        const targetSocket = io.sockets?.sockets?.get
            ? io.sockets.sockets.get(targetSocketId)
            : (io.sockets?.[targetSocketId] || null);
        if (targetSocket && typeof targetSocket.leave === 'function') {
            targetSocket.leave(room.code);
            targetSocket.leave(`${room.code}_voice`);
        }
    }

    // Clear any active vote if it targeted this player
    if (room.activeVote && (room.activeVote.targetId === effectivePlayerId || room.activeVote.targetId === targetId)) {
        if (room.activeVote.timer) clearTimeout(room.activeVote.timer);
        room.activeVote = null;
        io.to(room.code).emit(EVENTS.VOTE_STATE, null);
    }

    // Drawer kicked mid-turn check (GF3):
    // If target was drawer and turn is active (WORD_SELECTION or DRAWING), end turn with no points
    const leavingIndex = room.players?.findIndex(p => p.id === targetSocketId || p.playerId === effectivePlayerId);
    const wasDrawer = (leavingIndex === room.currentDrawerIndex || room.drawerId === targetSocketId || room.drawerId === effectivePlayerId);
    const wasInTurn = (room.gameState === GAME_STATES.WORD_SELECTION || room.gameState === GAME_STATES.DRAWING);

    if (wasInTurn && wasDrawer) {
        clearRoomTimers(room);
        transition(room, 'ROUND_END');
        room.roundEndsAt = null;
        room.hint = null;
        room.roundGained = {}; // No points

        const gains = (room.players || []).map(p => ({
            id: p.id,
            gained: 0,
            total: room.scores?.[p.id] || 0
        }));

        io.to(room.code).emit(EVENTS.ROUND_ENDED, {
            word: room.wordToGuess,
            scores: room.scores || {},
            gained: {},
            gains,
            fastestGuesserId: null,
            drawerBonus: 0,
            nextDrawerId: null,
            reason: 'drawer-kicked',
            drawerName: departingName,
            strokes: room.strokes || []
        });

        const msg = {
            username: 'System',
            text: `${departingName} was removed. Skipping to the next drawer.`,
            type: 'system'
        };
        io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, msg);

        handlePlayerLeft(room, effectivePlayerId);
        roomManager.removePlayer(room.code, targetSocketId || effectivePlayerId);
        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));

        startTurn(io, room, false);
    } else {
        handlePlayerLeft(room, effectivePlayerId);
        roomManager.removePlayer(room.code, targetSocketId || effectivePlayerId);
        io.to(room.code).emit(EVENTS.ROOM_JOINED, toPublicRoom(room));
        io.to(room.code).emit(EVENTS.TURN_INFO, buildTurnInfo(room));
    }
}

function registerModerationHandlers(io, socket, safeOn) {
    socket.on('disconnect', () => {
        socketModerationTimestamps.delete(socket.id);
    });

    safeOn(EVENTS.START_VOTE_KICK, (payload) => {
        if (!checkModerationRateLimit(socket)) {
            return rejectWithError(socket, 'Slow down');
        }

        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }

        const room = (payload.roomCode ? getMemberRoom(socket, payload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }

        const connectedPlayers = getConnectedPlayers(room);
        if (connectedPlayers.length < 4) {
            return rejectWithError(socket, 'At least 4 connected players are required to start a vote to kick');
        }

        const initiatorPlayer = room.players?.find(p => p.id === socket.id);
        const initiatorRecord = room.records
            ? (room.records.get(initiatorPlayer?.playerId) || Array.from(room.records.values()).find(r => r.socketId === socket.id))
            : null;

        const initiatorId = initiatorRecord?.playerId || initiatorPlayer?.playerId || socket.id;

        const targetPlayer = room.players?.find(p => p.id === payload.targetId || p.playerId === payload.targetId);
        const targetRecord = room.records
            ? (room.records.get(payload.targetId) || Array.from(room.records.values()).find(r => r.socketId === payload.targetId || r.playerId === payload.targetId))
            : null;

        if (!targetPlayer && !targetRecord) {
            return rejectWithError(socket, 'Target player not found in room');
        }

        const targetId = targetRecord?.playerId || targetPlayer?.playerId || targetPlayer?.id;

        // Cannot target yourself
        if (targetId === initiatorId || targetPlayer?.id === socket.id) {
            return rejectWithError(socket, 'You cannot target yourself');
        }

        // Cannot target the host
        const isTargetHost = Boolean(targetPlayer?.isHost || targetId === room.hostId || targetRecord?.isHost || targetPlayer?.id === room.hostId);
        if (isTargetHost) {
            return rejectWithError(socket, 'You cannot vote to kick the host');
        }

        const now = Date.now();

        // Target must have been in room for at least 60 s
        const targetJoinedAt = targetRecord?.joinedAt || targetPlayer?.joinedAt || now;
        if (now - targetJoinedAt < 60000) {
            return rejectWithError(socket, 'Target has been in the room for less than 60 seconds');
        }

        // Only one vote at a time
        if (room.activeVote) {
            return rejectWithError(socket, 'A vote is already in progress');
        }

        // Initiator 2-minute cooldown
        const lastVote = initiatorRecord?.lastVoteStartedAt || room.voteCooldowns?.get(initiatorId) || 0;
        if (now - lastVote < 120000) {
            return rejectWithError(socket, 'You must wait 2 minutes before starting another vote');
        }

        // Target 10-minute immunity
        const immunityUntil = targetRecord?.voteImmunityUntil || room.targetImmunities?.get(targetId) || 0;
        if (now < immunityUntil) {
            return rejectWithError(socket, 'Target recently survived a vote and cannot be targeted for 10 minutes');
        }

        // Player whose votes failed 3 times cannot start votes
        const failedCount = initiatorRecord?.failedVoteCount || room.initiatorFailedVotes?.get(initiatorId) || 0;
        if (failedCount >= 3) {
            return rejectWithError(socket, 'You cannot start any more votes for the rest of the game');
        }

        const VALID_REASONS = ['afk', 'spam', 'abuse', 'other'];
        const reason = VALID_REASONS.includes(payload.reason) ? payload.reason : 'other';

        // Record initiator vote start timestamp
        if (initiatorRecord) initiatorRecord.lastVoteStartedAt = now;
        if (!room.voteCooldowns) room.voteCooldowns = new Map();
        room.voteCooldowns.set(initiatorId, now);

        // Eligible voters: all connected players EXCEPT the target
        const eligibleVoterIds = connectedPlayers
            .filter(p => {
                const pid = p.playerId || p.id;
                return pid !== targetId && p.id !== (targetPlayer?.id || targetRecord?.socketId);
            })
            .map(p => p.playerId || p.id);

        const total = eligibleVoterIds.length;
        const threshold = Math.ceil(0.6 * total);

        const voteId = uuidv4();
        const votes = new Map();
        // Initiator automatically casts yes
        votes.set(initiatorId, true);

        const endsAt = now + 20000;
        room.activeVote = {
            voteId,
            targetId,
            targetName: targetRecord?.username || targetPlayer?.username || 'Player',
            targetAvatar: targetRecord?.avatar || targetPlayer?.avatar || 'avatar-1',
            targetSocketId: targetRecord?.socketId || targetPlayer?.id,
            reason,
            initiatorId,
            eligibleVoterIds: new Set(eligibleVoterIds),
            votes,
            threshold,
            total,
            endsAt,
            timer: null
        };

        broadcastVoteState(io, room);

        room.activeVote.timer = setTimeout(() => {
            try {
                resolveVote(io, room);
            } catch (err) {
                logger.error('Error in vote timeout:', err);
            }
        }, 20000);

        checkEarlyResolution(io, room);
    });

    safeOn(EVENTS.CAST_VOTE, (payload) => {
        if (!checkModerationRateLimit(socket)) {
            return rejectWithError(socket, 'Slow down');
        }

        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }

        const room = (payload.roomCode ? getMemberRoom(socket, payload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }

        if (!room.activeVote || room.activeVote.voteId !== payload.voteId) {
            return rejectWithError(socket, 'No active vote matching this ID');
        }

        const voterPlayer = room.players?.find(p => p.id === socket.id);
        const voterRecord = room.records
            ? (room.records.get(voterPlayer?.playerId) || Array.from(room.records.values()).find(r => r.socketId === socket.id))
            : null;

        const voterId = voterRecord?.playerId || voterPlayer?.playerId || socket.id;

        if (voterId === room.activeVote.targetId) {
            return rejectWithError(socket, 'Target cannot vote');
        }

        if (!room.activeVote.eligibleVoterIds.has(voterId)) {
            return rejectWithError(socket, 'Not an eligible voter');
        }

        if (room.activeVote.votes.has(voterId)) {
            return rejectWithError(socket, 'You have already voted');
        }

        room.activeVote.votes.set(voterId, Boolean(payload.yes));

        broadcastVoteState(io, room);
        checkEarlyResolution(io, room);
    });

    safeOn(EVENTS.CANCEL_VOTE_KICK, (payload = {}) => {
        if (!checkModerationRateLimit(socket)) {
            return rejectWithError(socket, 'Slow down');
        }

        const safePayload = payload && typeof payload === 'object' ? payload : {};
        const room = (safePayload.roomCode ? getMemberRoom(socket, safePayload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }

        if (!isHost(room, socket)) {
            return rejectWithError(socket, 'Only the host can cancel a vote');
        }

        if (room.activeVote) {
            if (room.activeVote.timer) {
                clearTimeout(room.activeVote.timer);
                room.activeVote.timer = null;
            }
            const targetName = room.activeVote.targetName;
            room.activeVote = null;

            const msg = {
                username: 'System',
                text: `The host cancelled the vote to kick ${targetName}.`,
                type: 'system'
            };
            io.to(room.code).emit(EVENTS.MESSAGE_RECEIVED, msg);
            io.to(room.code).emit(EVENTS.VOTE_STATE, null);
        }
    });

    // Host direct kick with soft block and GF3 drawer rules
    safeOn(EVENTS.KICK_PLAYER, (payload) => {
        if (!checkModerationRateLimit(socket)) {
            return rejectWithError(socket, 'Slow down');
        }

        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }

        const room = (payload.roomCode ? getMemberRoom(socket, payload.roomCode) : null) || roomManager.getRoomByPlayerId(socket.id);
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

        executeKick(io, room, targetId, 'host', 'Host kick');
    });
}

module.exports = {
    registerModerationHandlers,
    resolveVote,
    executeKick,
    checkEarlyResolution,
    broadcastVoteState,
    resetModerationRateLimits
};
