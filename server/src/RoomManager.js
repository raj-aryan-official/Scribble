const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { GAME_STATES, TWIST_IDS } = require('../../shared/types.cjs');
const blocklist = require('./blocklist');
const { sanitiseText } = require('./sanitise');
const {
    createRoomStore,
    scheduleRoomSave
} = require('./RoomStore');
const {
    canJoinRoom,
    handleLateJoin,
    handlePlayerLeft
} = require('./game/turns');
const { clearRoomQueue } = require('./handlers/actionQueue');

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALLOWED_ROUNDS = [1, 2, 3, 5, 7, 10, 12];
const ALLOWED_DRAW_TIMES = [60, 80, 100, 120];
const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const ALLOWED_PACKS = ['animals', 'food', 'places', 'objects', 'actions'];
const ALLOWED_WORD_CHOICES = ['pick', 'random'];
const ALLOWED_TWISTS = ['off', 'sometimes', 'every'];
const MAX_ROOMS = 500;

function deduplicateNickname(room, desired) {
    if (!room || !room.records || typeof desired !== 'string') return desired;
    const existing = new Set(
        Array.from(room.records.values()).map(r => (r.username || '').toLowerCase())
    );
    if (!existing.has(desired.toLowerCase())) {
        return desired;
    }
    let counter = 2;
    while (existing.has(`${desired} (${counter})`.toLowerCase())) {
        counter++;
    }
    return `${desired} (${counter})`;
}

function generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        const randomIndex = crypto.randomInt(0, ROOM_CODE_ALPHABET.length);
        code += ROOM_CODE_ALPHABET[randomIndex];
    }
    return code;
}

function generateRejoinToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    if (typeof token !== 'string') return '';
    return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyToken(token, storedHash) {
    if (typeof token !== 'string' || typeof storedHash !== 'string' || !token || !storedHash) {
        return false;
    }
    try {
        const tokenBuf = crypto.createHash('sha256').update(token).digest();
        const storedBuf = Buffer.from(storedHash, 'hex');
        if (tokenBuf.length !== storedBuf.length) {
            return false;
        }
        return crypto.timingSafeEqual(tokenBuf, storedBuf);
    } catch {
        return false;
    }
}

// Soft block: 10-minute temporary ban by rejoinToken and nickname
function isPlayerBlocked(room, player) {
    if (!room || !player) return false;
    const now = Date.now();
    if (!room.kickedBlocks) room.kickedBlocks = new Map();

    const checkKey = (key) => {
        if (!key) return false;
        if (room.kickedBlocks.has(key)) {
            const exp = room.kickedBlocks.get(key);
            if (now < exp) {
                return true;
            }
            room.kickedBlocks.delete(key);
        }
        return false;
    };

    if (player.sessionId && checkKey(`sid:${player.sessionId}`)) return true;
    if (player.playerId && checkKey(`pid:${player.playerId}`)) return true;
    if (player.rejoinToken && checkKey(`token:${hashToken(player.rejoinToken)}`)) return true;
    if (player.tokenHash && checkKey(`token:${player.tokenHash}`)) return true;
    if (player.username && checkKey(`nick:${player.username.trim().toLowerCase()}`)) return true;

    return false;
}

// Soft block: 10-minute temporary ban by rejoinToken and nickname
function blockKickedPlayer(room, record, durationMs = 10 * 60 * 1000) {
    if (!room) return;
    if (!room.kickedBlocks) room.kickedBlocks = new Map();
    const expiresAt = Date.now() + durationMs;

    if (record?.sessionId) room.kickedBlocks.set(`sid:${record.sessionId}`, expiresAt);
    if (record?.playerId) room.kickedBlocks.set(`pid:${record.playerId}`, expiresAt);
    if (record?.tokenHash) room.kickedBlocks.set(`token:${record.tokenHash}`, expiresAt);
    if (record?.rejoinToken) room.kickedBlocks.set(`token:${hashToken(record.rejoinToken)}`, expiresAt);
    if (record?.username) room.kickedBlocks.set(`nick:${record.username.trim().toLowerCase()}`, expiresAt);
}

function sanitizeSettings(rawSettings = {}) {
    const rounds = ALLOWED_ROUNDS.includes(rawSettings?.rounds) ? rawSettings.rounds : 3;
    const drawTime = ALLOWED_DRAW_TIMES.includes(rawSettings?.drawTime) ? rawSettings.drawTime : 60;
    const difficulty = ALLOWED_DIFFICULTIES.includes(rawSettings?.difficulty) ? rawSettings.difficulty : 'Medium';
    const wordChoice = ALLOWED_WORD_CHOICES.includes(rawSettings?.wordChoice) ? rawSettings.wordChoice : 'pick';
    let maxPlayers = 12;
    if (
        typeof rawSettings?.maxPlayers === 'number' &&
        Number.isInteger(rawSettings.maxPlayers) &&
        rawSettings.maxPlayers >= 2 &&
        rawSettings.maxPlayers <= 12
    ) {
        maxPlayers = rawSettings.maxPlayers;
    }

    let packs = [];
    if (Array.isArray(rawSettings?.packs)) {
        const seenPacks = new Set();
        for (const p of rawSettings.packs) {
            if (typeof p === 'string') {
                const normP = p.trim().toLowerCase();
                if (ALLOWED_PACKS.includes(normP) && !seenPacks.has(normP)) {
                    seenPacks.add(normP);
                    packs.push(normP);
                }
            }
        }
    }

    let customWordsRaw = [];
    if (typeof rawSettings?.customWords === 'string') {
        customWordsRaw = rawSettings.customWords.split(',');
    } else if (Array.isArray(rawSettings?.customWords)) {
        customWordsRaw = rawSettings.customWords;
    }

    const customWords = [];
    const seenWords = new Set();
    for (const w of customWordsRaw) {
        if (typeof w !== 'string') continue;
        const cleanWord = sanitiseText(w).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim();
        if (cleanWord.length >= 3 && cleanWord.length <= 20 && !blocklist.includes(cleanWord)) {
            if (!seenWords.has(cleanWord)) {
                seenWords.add(cleanWord);
                customWords.push(cleanWord);
                if (customWords.length >= 50) break;
            }
        }
    }

    const twists = ALLOWED_TWISTS.includes(rawSettings?.twists) ? rawSettings.twists : 'off';
    let enabledTwists = [...TWIST_IDS];
    if (Array.isArray(rawSettings?.enabledTwists)) {
        const valid = rawSettings.enabledTwists.filter(id => TWIST_IDS.includes(id));
        if (valid.length > 0) {
            enabledTwists = valid;
        }
    }

    return {
        rounds,
        drawTime,
        difficulty,
        maxPlayers,
        packs,
        customWords,
        wordChoice,
        twists,
        enabledTwists
    };
}

function clearRoomTimers(room) {
    if (!room || !room.timers) return;
    if (room.timers.interval) {
        clearInterval(room.timers.interval);
        room.timers.interval = null;
    }
    if (room.timers.wordSelection) {
        clearTimeout(room.timers.wordSelection);
        room.timers.wordSelection = null;
    }
    if (room.timers.intermission) {
        clearTimeout(room.timers.intermission);
        room.timers.intermission = null;
    }
    if (room.timers.turnWait) {
        clearTimeout(room.timers.turnWait);
        room.timers.turnWait = null;
    }
    if (room.timers.hostGrace) {
        clearTimeout(room.timers.hostGrace);
        room.timers.hostGrace = null;
    }
    if (room.timers.drawerAway) {
        clearTimeout(room.timers.drawerAway);
        room.timers.drawerAway = null;
    }
    if (room.timers.allGuessersAway) {
        clearTimeout(room.timers.allGuessersAway);
        room.timers.allGuessersAway = null;
    }
    if (room.timers.pausedGrace) {
        clearTimeout(room.timers.pausedGrace);
        room.timers.pausedGrace = null;
    }
    if (room.timers.emptyCleanup) {
        clearTimeout(room.timers.emptyCleanup);
        room.timers.emptyCleanup = null;
    }
    if (room.timers.grace) {
        for (const sessionId of Object.keys(room.timers.grace)) {
            if (room.timers.grace[sessionId]) {
                clearTimeout(room.timers.grace[sessionId]);
            }
        }
        room.timers.grace = {};
    }
    if (room.timers.away) {
        for (const playerId of Object.keys(room.timers.away)) {
            if (room.timers.away[playerId]) {
                clearTimeout(room.timers.away[playerId]);
            }
        }
        room.timers.away = {};
    }
    if (room.pendingClaims) {
        for (const [, claim] of room.pendingClaims.entries()) {
            if (claim.timer) clearTimeout(claim.timer);
        }
        room.pendingClaims.clear();
    }
    if (room.saveDebounceTimer) {
        clearTimeout(room.saveDebounceTimer);
        room.saveDebounceTimer = null;
    }
    if (room.activeVote?.timer) {
        clearTimeout(room.activeVote.timer);
        room.activeVote.timer = null;
    }
    if (room.reactionBatchTimer) {
        clearTimeout(room.reactionBatchTimer);
        room.reactionBatchTimer = null;
    }
}

const toPublicPlayer = (player, room = null) => {
    if (!player || typeof player !== 'object') return null;
    const isAway = player.status === 'away' || player.status === 'left' || Boolean(player.isDisconnected);
    const isHost = Boolean(player.isHost || (room && (player.id === room.hostId || room.records?.get(player.playerId)?.isHost)));
    const rec = room?.records?.get(player.playerId);
    const result = {
        id: player.id,
        username: player.username,
        avatar: player.avatar,
        isHost,
        isDisconnected: isAway
    };
    if (player.playerId || rec?.playerId) {
        result.playerId = player.playerId || rec?.playerId;
    }
    if (player.status || rec?.status) {
        result.status = player.status || rec?.status || (isAway ? 'away' : 'connected');
    }
    if (rec?.missedDraws || player.missedDraws) {
        result.missedDraws = rec?.missedDraws || player.missedDraws;
    }
    if (rec?.joinedMidRound !== undefined || player.joinedMidRound !== undefined) {
        result.joinedMidRound = Boolean(rec?.joinedMidRound || player.joinedMidRound);
    }
    return result;
};

const toPublicRoom = (room) => {
    if (!room || typeof room !== 'object') return null;
    if (room.players === undefined && (room.username !== undefined || room.sessionId !== undefined)) {
        return toPublicPlayer(room);
    }

    const scores = {};
    if (Array.isArray(room.players)) {
        for (const p of room.players) {
            const rec = room.records?.get(p.playerId);
            scores[p.id] = rec?.score ?? room.scores?.[p.id] ?? 0;
        }
    }

    const actingRecord = room.actingHostId ? room.records?.get(room.actingHostId) : null;
    const actingPlayer = room.actingHostId ? (Array.isArray(room.players) ? room.players.find(p => p.playerId === room.actingHostId || p.id === room.actingHostId) : null) : null;
    const actingHostName = actingRecord?.username || actingPlayer?.username || null;

    const originalRecord = room.originalHostId ? room.records?.get(room.originalHostId) : null;
    const originalPlayer = room.originalHostId ? (Array.isArray(room.players) ? room.players.find(p => p.playerId === room.originalHostId || p.id === room.originalHostId) : null) : null;
    const originalHostName = originalRecord?.username || originalPlayer?.username || null;

    return {
        code: room.code,
        hostId: room.hostId,
        settings: room.settings,
        gameState: room.gameState,
        currentRound: room.currentRound,
        scores,
        players: Array.isArray(room.players) ? room.players.map(p => toPublicPlayer(p, room)) : [],
        actingHostId: room.actingHostId || null,
        actingHostName: actingHostName || null,
        originalHostId: room.originalHostId || null,
        originalHostName: originalHostName || null
    };
};

class RoomManager {
    constructor(roomStore = createRoomStore()) {
        this.rooms = new Map();
        this.roomStore = roomStore;
    }

    async init() {
        await this.restoreFromStore();
    }

    async restoreFromStore() {
        if (!this.roomStore) return;
        try {
            const saved = await this.roomStore.loadAll();
            for (const { code, data } of saved) {
                if (!this.rooms.has(code)) {
                    const room = this._inflateRoom(data);
                    this.rooms.set(code, room);
                }
            }
        } catch (err) {
            console.error('Failed to restore rooms from store:', err);
        }
    }

    _inflateRoom(data) {
        const recordsMap = new Map();
        const players = [];
        const scores = {};

        if (Array.isArray(data.records)) {
            for (const r of data.records) {
                const rec = {
                    playerId: r.playerId,
                    socketId: null,
                    username: r.username,
                    avatar: r.avatar,
                    score: r.score || 0,
                    guessedThisTurn: Boolean(r.guessedThisTurn),
                    guessMs: r.guessMs || [],
                    correctGuesses: r.correctGuesses || 0,
                    drawsDone: r.drawsDone || [],
                    missedDraws: r.missedDraws || [],
                    joinedAt: r.joinedAt || Date.now(),
                    leftAt: r.leftAt || Date.now(),
                    status: 'away', // Restore on boot marks every player 'away'
                    tokenHash: r.tokenHash,
                    isHost: Boolean(r.isHost)
                };
                recordsMap.set(r.playerId, rec);
                scores[r.playerId] = rec.score;

                players.push({
                    id: r.playerId,
                    playerId: r.playerId,
                    socketId: null,
                    username: r.username,
                    avatar: r.avatar,
                    score: rec.score,
                    isHost: rec.isHost,
                    status: 'away',
                    isDisconnected: true,
                    disconnectedAt: rec.leftAt
                });
            }
        }

        const room = {
            id: data.id || uuidv4(),
            code: data.code,
            hostId: data.hostId,
            players,
            records: recordsMap,
            gameState: data.gameState || GAME_STATES.LOBBY,
            settings: sanitizeSettings(data.settings),
            currentRound: data.currentRound || 0,
            currentDrawerIndex: data.currentDrawerIndex || 0,
            drawerId: data.drawerId || null,
            turnQueue: Array.isArray(data.turnQueue) ? data.turnQueue : Array.from(recordsMap.keys()),
            strokes: data.strokes || [],
            chatMessages: data.chatMessages || [],
            wordToGuess: data.wordToGuess || null,
            wordChoices: data.wordChoices || null,
            defaultChoice: typeof data.defaultChoice === 'number' ? data.defaultChoice : null,
            usedWords: new Set(data.usedWords || []),
            hint: data.hint || null,
            wordHint: data.wordHint || null,
            roundEndsAt: data.roundEndsAt || null,
            timer: data.timer || 0,
            scores,
            revealedIndices: new Set(data.revealedIndices || []),
            guessedPlayers: new Set(data.guessedPlayers || []),
            matchDrawings: data.matchDrawings || [],
            currentTwist: data.currentTwist || null,
            turnInkRemaining: typeof data.turnInkRemaining === 'number' ? data.turnInkRemaining : null,
            timers: {
                interval: null,
                wordSelection: null,
                intermission: null,
                away: {},
                grace: {}
            },
            pendingClaims: new Map(),
            kickedSessionIds: new Set(data.kickedSessionIds || []),
            kickedTokenHashes: new Set(data.kickedTokenHashes || [])
        };

        return room;
    }

    createRoom(hostPlayer, rawSettings = {}) {
        if (this.rooms.size >= MAX_ROOMS) {
            const err = new Error('Maximum room limit reached');
            err.code = 'MAX_ROOMS_REACHED';
            throw err;
        }

        let roomCode;
        do {
            roomCode = generateRoomCode();
        } while (this.rooms.has(roomCode));

        const roomId = uuidv4();
        const settings = sanitizeSettings(rawSettings);

        // Generate public playerId and secret rejoinToken
        const playerId = hostPlayer.playerId || `p_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        const rejoinToken = generateRejoinToken();
        const tokenHash = hashToken(rejoinToken);

        const record = {
            playerId,
            socketId: hostPlayer.id,
            username: hostPlayer.username,
            avatar: hostPlayer.avatar,
            score: 0,
            guessedThisTurn: false,
            guessMs: [],
            correctGuesses: 0,
            drawsDone: [],
            missedDraws: [],
            consecutiveAutoPicks: 0,
            isAfkSkipped: false,
            joinedAt: Date.now(),
            leftAt: null,
            status: 'connected',
            tokenHash,
            isHost: true,
            sessionId: hostPlayer.sessionId || null
        };

        const records = new Map();
        records.set(playerId, record);

        // Mutate hostPlayer with credentials and status
        hostPlayer.id = hostPlayer.id || playerId;
        hostPlayer.playerId = playerId;
        hostPlayer.socketId = hostPlayer.id;
        hostPlayer.rejoinToken = rejoinToken;
        hostPlayer.score = 0;
        hostPlayer.status = 'connected';
        hostPlayer.isDisconnected = false;
        hostPlayer.isHost = true;

        const room = {
            id: roomId,
            code: roomCode,
            hostId: hostPlayer.id,
            originalHostId: playerId,
            actingHostId: null,
            players: [hostPlayer],
            records,
            gameState: GAME_STATES.LOBBY,
            settings,
            currentRound: 0,
            currentDrawerIndex: 0,
            drawerId: null,
            turnQueue: [playerId],
            strokes: [],
            strokeSeq: 0,
            chatMessages: [],
            wordToGuess: null,
            wordChoices: null,
            defaultChoice: null,
            usedWords: new Set(),
            hint: null,
            wordHint: null,
            roundEndsAt: null,
            timer: 0,
            scores: { [hostPlayer.id]: 0, [playerId]: 0 },
            guessedPlayers: new Set(),
            currentTwist: null,
            turnInkRemaining: null,
            timers: {
                interval: null,
                wordSelection: null,
                intermission: null,
                turnWait: null,
                hostGrace: null,
                drawerAway: null,
                allGuessersAway: null,
                pausedGrace: null,
                emptyCleanup: null,
                away: {},
                grace: {}
            },
            pendingClaims: new Map(),
            kickedSessionIds: new Set(),
            kickedTokenHashes: new Set()
        };

        this.rooms.set(roomCode, room);
        scheduleRoomSave(this.roomStore, room);
        return room;
    }

    joinRoom(roomCode, player) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };

        if (
            isPlayerBlocked(room, player) ||
            (room.kickedSessionIds && player.sessionId && room.kickedSessionIds.has(player.sessionId)) ||
            (player.rejoinToken && room.kickedTokenHashes && room.kickedTokenHashes.has(hashToken(player.rejoinToken)))
        ) {
            return { error: 'You have been kicked from this room' };
        }

        if (!canJoinRoom(room)) {
            return { error: 'Room is full' };
        }

        if (room.timers?.emptyCleanup) {
            clearTimeout(room.timers.emptyCleanup);
            room.timers.emptyCleanup = null;
        }
        if (room.timers?.allGuessersAway) {
            clearTimeout(room.timers.allGuessersAway);
            room.timers.allGuessersAway = null;
        }

        player.username = deduplicateNickname(room, player.username);

        const playerId = player.playerId || `p_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        const rejoinToken = generateRejoinToken();
        const tokenHash = hashToken(rejoinToken);

        const record = {
            playerId,
            socketId: player.id,
            username: player.username,
            avatar: player.avatar,
            score: 0,
            guessedThisTurn: false,
            guessMs: [],
            correctGuesses: 0,
            drawsDone: [],
            missedDraws: [],
            consecutiveAutoPicks: 0,
            isAfkSkipped: false,
            joinedAt: Date.now(),
            leftAt: null,
            status: 'connected',
            tokenHash,
            isHost: false,
            sessionId: player.sessionId || null
        };

        room.records.set(playerId, record);

        // Mutate player object
        player.playerId = playerId;
        player.socketId = player.id;
        player.rejoinToken = rejoinToken;
        player.score = 0;
        player.status = 'connected';
        player.isDisconnected = false;

        room.players.push(player);
        if (room.gameState === GAME_STATES.LOBBY) {
            if (!room.turnQueue) room.turnQueue = [];
            if (!room.turnQueue.includes(playerId)) {
                room.turnQueue.push(playerId);
            }
        } else {
            handleLateJoin(room, playerId);
        }

        if (!room.scores) room.scores = {};
        room.scores[playerId] = 0;
        room.scores[player.id] = 0;

        scheduleRoomSave(this.roomStore, room);
        return { room, player, rejoinToken, playerId };
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    removePlayer(roomCode, playerId) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        const leavingIndex = room.players.findIndex(p => p.id === playerId || p.playerId === playerId);
        if (leavingIndex === -1) return room;

        const leavingPlayer = room.players[leavingIndex];
        const record = room.records.get(leavingPlayer.playerId || playerId);
        const wasHost = (room.hostId === leavingPlayer.id || room.hostId === leavingPlayer.playerId);

        // Cancel grace timer if any
        if (leavingPlayer.sessionId && room.timers?.grace?.[leavingPlayer.sessionId]) {
            clearTimeout(room.timers.grace[leavingPlayer.sessionId]);
            delete room.timers.grace[leavingPlayer.sessionId];
        }
        if (record && room.timers?.away?.[record.playerId]) {
            clearTimeout(room.timers.away[record.playerId]);
            delete room.timers.away[record.playerId];
        }

        if (record) {
            record.status = 'left';
            record.leftAt = Date.now();
        }

        handlePlayerLeft(room, leavingPlayer.playerId || playerId);

        room.players.splice(leavingIndex, 1);
        if (room.turnQueue) {
            room.turnQueue = room.turnQueue.filter(id => id !== playerId && id !== leavingPlayer.playerId);
        }

        // If no players remain in records or players, clear timers and delete room
        const activeOrAwayCount = Array.from(room.records.values()).filter(
            r => r.status === 'connected' || r.status === 'away'
        ).length;

        if (room.players.length === 0 && activeOrAwayCount === 0) {
            clearRoomTimers(room);
            this.rooms.delete(roomCode);
            this.roomStore?.delete(roomCode);
            return null;
        }

        // Pass host to longest-present connected player
        if (wasHost && room.players.length > 0) {
            const newHost = room.players[0];
            room.hostId = newHost.id;
            for (const p of room.players) {
                p.isHost = (p.id === room.hostId || p.playerId === room.hostId);
            }
            if (room.records) {
                for (const rec of room.records.values()) {
                    rec.isHost = (rec.playerId === newHost.playerId || rec.socketId === newHost.id);
                }
            }
        }

        // Keep currentDrawerIndex pointing at the same player when someone earlier leaves
        if (leavingIndex < room.currentDrawerIndex) {
            room.currentDrawerIndex--;
        } else if (leavingIndex === room.currentDrawerIndex) {
            if (room.currentDrawerIndex >= room.players.length) {
                room.currentDrawerIndex = 0;
            }
        }

        scheduleRoomSave(this.roomStore, room);
        return room;
    }

    reconnectRecord(room, record, newSocketId) {
        if (!room || !record) return { error: 'Invalid room or record' };

        if (isPlayerBlocked(room, record)) {
            return { error: 'You have been kicked from this room' };
        }

        if (room.kickedPlayerIds && room.kickedPlayerIds.has(record.playerId)) {
            return { error: 'You have been kicked from this room' };
        }
        if (room.kickedTokenHashes && room.kickedTokenHashes.has(record.tokenHash)) {
            return { error: 'You have been kicked from this room' };
        }
        if (record.sessionId && room.kickedSessionIds && room.kickedSessionIds.has(record.sessionId)) {
            return { error: 'You have been kicked from this room' };
        }

        // Cancel away / grace timers
        if (room.timers?.away?.[record.playerId]) {
            clearTimeout(room.timers.away[record.playerId]);
            delete room.timers.away[record.playerId];
        }
        if (record.sessionId && room.timers?.grace?.[record.sessionId]) {
            clearTimeout(room.timers.grace[record.sessionId]);
            delete room.timers.grace[record.sessionId];
        }
        if (room.timers?.emptyCleanup) {
            clearTimeout(room.timers.emptyCleanup);
            room.timers.emptyCleanup = null;
        }
        if (room.timers?.allGuessersAway) {
            clearTimeout(room.timers.allGuessersAway);
            room.timers.allGuessersAway = null;
        }

        const oldSocketId = record.socketId;

        // Restore status to connected
        record.socketId = newSocketId;
        record.status = 'connected';
        record.leftAt = null;

        // Restore in room.players
        let player = room.players.find(p => p.playerId === record.playerId || p.id === oldSocketId || (record.sessionId && p.sessionId === record.sessionId));
        const prevSocketId = player?.id || oldSocketId;
        if (!player) {
            player = {
                id: newSocketId,
                playerId: record.playerId,
                socketId: newSocketId,
                username: record.username,
                avatar: record.avatar,
                score: record.score,
                isHost: record.isHost,
                status: 'connected',
                isDisconnected: false,
                sessionId: record.sessionId
            };
            room.players.push(player);
        } else {
            player.id = newSocketId;
            player.socketId = newSocketId;
            player.status = 'connected';
            player.isDisconnected = false;
            delete player.disconnectedAt;
            player.score = record.score;
        }

        // Re-add to turn queue if not already in it
        if (!room.turnQueue) room.turnQueue = [];
        if (!room.turnQueue.includes(record.playerId)) {
            room.turnQueue.push(record.playerId);
        }

        // Ensure scores map has both playerId and socketId pointing to record score
        if (!room.scores) room.scores = {};
        room.scores[record.playerId] = record.score;
        room.scores[newSocketId] = record.score;
        if (oldSocketId && oldSocketId !== newSocketId && oldSocketId !== record.playerId) {
            delete room.scores[oldSocketId];
        }

        // Migrate guessed status if needed
        if (room.guessedPlayers && (room.guessedPlayers.has(oldSocketId) || record.guessedThisTurn)) {
            record.guessedThisTurn = true;
            room.guessedPlayers.delete(oldSocketId);
            room.guessedPlayers.add(record.playerId);
            room.guessedPlayers.add(newSocketId);
        }

        // If returning record is original host, restore their host privileges within 90s
        if (room.originalHostId && room.originalHostId === record.playerId) {
            if (room.timers?.hostGrace) {
                clearTimeout(room.timers.hostGrace);
                room.timers.hostGrace = null;
            }
            if (room.actingHostId && room.actingHostId !== record.playerId) {
                const actingRec = room.records.get(room.actingHostId);
                if (actingRec) actingRec.isHost = false;
                const actingP = room.players.find(p => p.playerId === room.actingHostId || p.id === actingRec?.socketId);
                if (actingP) actingP.isHost = false;
                room.actingHostId = null;
            }
            record.isHost = true;
            if (player) player.isHost = true;
        }

        // Migrate host if this record is host
        if (record.isHost) {
            room.hostId = newSocketId;
            for (const p of room.players) {
                p.isHost = (p.playerId === record.playerId || p.id === newSocketId);
            }
        }

        // Migrate drawer if this record is drawer
        if (room.drawerId === oldSocketId || room.drawerId === record.playerId || room.drawerId === prevSocketId) {
            room.drawerId = newSocketId;
        }

        scheduleRoomSave(this.roomStore, room);
        return { room, record, player, oldSocketId };
    }

    reconnectWithToken(roomCode, rejoinToken, newSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };

        let record = null;
        for (const r of room.records.values()) {
            if (verifyToken(rejoinToken, r.tokenHash)) {
                record = r;
                break;
            }
        }

        if (!record) {
            return { error: 'Session not found in room' };
        }

        return this.reconnectRecord(room, record, newSocketId);
    }

    reconnectPlayer(roomCode, sessionId, newSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };

        if (room.kickedSessionIds && sessionId && room.kickedSessionIds.has(sessionId)) {
            return { error: 'You have been kicked from this room' };
        }

        // Try looking up record first
        let record = null;
        for (const r of room.records.values()) {
            if (r.sessionId === sessionId) {
                record = r;
                break;
            }
        }

        const player = room.players.find(p => p.sessionId === sessionId || (record && p.playerId === record.playerId));
        if (!player && !record) return { error: 'Session not found in room' };

        // Cancel grace timer
        if (room.timers?.grace?.[sessionId]) {
            clearTimeout(room.timers.grace[sessionId]);
            delete room.timers.grace[sessionId];
        }
        if (record && room.timers?.away?.[record.playerId]) {
            clearTimeout(room.timers.away[record.playerId]);
            delete room.timers.away[record.playerId];
        }

        const oldSocketId = player ? player.id : (record ? record.socketId : null);

        if (record) {
            record.socketId = newSocketId;
            record.status = 'connected';
            record.leftAt = null;
        }

        if (player) {
            player.id = newSocketId;
            player.socketId = newSocketId;
            player.status = 'connected';
            player.isDisconnected = false;
            delete player.disconnectedAt;
            if (record) player.score = record.score;
        }

        // Migrate Scores
        if (!room.scores) room.scores = {};
        const scoreVal = record ? record.score : (room.scores[oldSocketId] || 0);
        room.scores[newSocketId] = scoreVal;
        if (record) room.scores[record.playerId] = scoreVal;
        if (oldSocketId && oldSocketId !== newSocketId) {
            delete room.scores[oldSocketId];
        }

        // Migrate Guessed Status
        if (room.guessedPlayers && (room.guessedPlayers.has(oldSocketId) || record?.guessedThisTurn)) {
            room.guessedPlayers.delete(oldSocketId);
            room.guessedPlayers.add(newSocketId);
            if (record) room.guessedPlayers.add(record.playerId);
        }

        // Migrate Host
        if (room.hostId === oldSocketId || (record && record.isHost)) {
            room.hostId = newSocketId;
        }
        for (const p of room.players) {
            p.isHost = (p.id === room.hostId || (record && p.playerId === record.playerId && record.isHost));
        }

        // Migrate Drawer ID
        if (room.drawerId === oldSocketId || (record && room.drawerId === record.playerId)) {
            room.drawerId = newSocketId;
        }

        scheduleRoomSave(this.roomStore, room);
        return { room, player: player || record, oldSocketId, record };
    }

    getRoomByPlayerId(id) {
        for (const [, room] of this.rooms) {
            if (Array.isArray(room.players) && room.players.some(p => p.id === id || p.playerId === id || p.socketId === id)) {
                return room;
            }
            if (room.records) {
                for (const rec of room.records.values()) {
                    if (rec.socketId === id || rec.playerId === id) {
                        return room;
                    }
                }
            }
        }
        return null;
    }

    deleteRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (room) {
            clearRoomTimers(room);
            this.rooms.delete(roomCode);
            this.roomStore?.delete(roomCode);
            clearRoomQueue(roomCode);
        }
    }
}

const roomManager = new RoomManager();
roomManager.toPublicRoom = toPublicRoom;
roomManager.toPublicPlayer = toPublicPlayer;
roomManager.clearRoomTimers = clearRoomTimers;
roomManager.sanitizeSettings = sanitizeSettings;
roomManager.generateRoomCode = generateRoomCode;
roomManager.generateRejoinToken = generateRejoinToken;
roomManager.hashToken = hashToken;
roomManager.verifyToken = verifyToken;
roomManager.ROOM_CODE_ALPHABET = ROOM_CODE_ALPHABET;
roomManager.ALLOWED_ROUNDS = ALLOWED_ROUNDS;
roomManager.ALLOWED_DRAW_TIMES = ALLOWED_DRAW_TIMES;
roomManager.ALLOWED_DIFFICULTIES = ALLOWED_DIFFICULTIES;
roomManager.ALLOWED_PACKS = ALLOWED_PACKS;
roomManager.ALLOWED_TWISTS = ALLOWED_TWISTS;
roomManager.TWIST_IDS = TWIST_IDS;
roomManager.MAX_ROOMS = MAX_ROOMS;
roomManager.deduplicateNickname = deduplicateNickname;
roomManager.RoomManager = RoomManager;

module.exports = roomManager;
module.exports.toPublicRoom = toPublicRoom;
module.exports.toPublicPlayer = toPublicPlayer;
module.exports.clearRoomTimers = clearRoomTimers;
module.exports.sanitizeSettings = sanitizeSettings;
module.exports.generateRoomCode = generateRoomCode;
module.exports.generateRejoinToken = generateRejoinToken;
module.exports.hashToken = hashToken;
module.exports.verifyToken = verifyToken;
module.exports.ROOM_CODE_ALPHABET = ROOM_CODE_ALPHABET;
module.exports.ALLOWED_ROUNDS = ALLOWED_ROUNDS;
module.exports.ALLOWED_DRAW_TIMES = ALLOWED_DRAW_TIMES;
module.exports.ALLOWED_DIFFICULTIES = ALLOWED_DIFFICULTIES;
module.exports.ALLOWED_PACKS = ALLOWED_PACKS;
module.exports.ALLOWED_TWISTS = ALLOWED_TWISTS;
module.exports.TWIST_IDS = TWIST_IDS;
module.exports.MAX_ROOMS = MAX_ROOMS;
module.exports.deduplicateNickname = deduplicateNickname;
module.exports.blockKickedPlayer = blockKickedPlayer;
module.exports.isPlayerBlocked = isPlayerBlocked;
module.exports.RoomManager = RoomManager;
