const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { GAME_STATES } = require('../../shared/types.cjs');
const blocklist = require('./blocklist');

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALLOWED_ROUNDS = [2, 3, 5, 7, 10, 12];
const ALLOWED_DRAW_TIMES = [60, 80, 100, 120];
const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const ALLOWED_PACKS = ['animals', 'food', 'places', 'objects', 'actions'];

function generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        const randomIndex = crypto.randomInt(0, ROOM_CODE_ALPHABET.length);
        code += ROOM_CODE_ALPHABET[randomIndex];
    }
    return code;
}

function sanitizeSettings(rawSettings = {}) {
    const rounds = ALLOWED_ROUNDS.includes(rawSettings?.rounds) ? rawSettings.rounds : 3;
    const drawTime = ALLOWED_DRAW_TIMES.includes(rawSettings?.drawTime) ? rawSettings.drawTime : 60;
    const difficulty = ALLOWED_DIFFICULTIES.includes(rawSettings?.difficulty) ? rawSettings.difficulty : 'Medium';
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
        const cleanWord = w.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim();
        if (cleanWord.length >= 3 && cleanWord.length <= 20 && !blocklist.includes(cleanWord)) {
            if (!seenWords.has(cleanWord)) {
                seenWords.add(cleanWord);
                customWords.push(cleanWord);
                if (customWords.length >= 50) break;
            }
        }
    }

    return {
        rounds,
        drawTime,
        difficulty,
        maxPlayers,
        packs,
        customWords
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
    if (room.timers.grace) {
        for (const sessionId of Object.keys(room.timers.grace)) {
            if (room.timers.grace[sessionId]) {
                clearTimeout(room.timers.grace[sessionId]);
            }
        }
        room.timers.grace = {};
    }
}

const toPublicPlayer = (player) => {
    if (!player || typeof player !== 'object') return null;
    return {
        id: player.id,
        username: player.username,
        avatar: player.avatar,
        isHost: Boolean(player.isHost),
        isDisconnected: Boolean(player.isDisconnected)
    };
};

const toPublicRoom = (room) => {
    if (!room || typeof room !== 'object') return null;
    if (room.players === undefined && (room.username !== undefined || room.sessionId !== undefined)) {
        return toPublicPlayer(room);
    }
    return {
        code: room.code,
        hostId: room.hostId,
        settings: room.settings,
        gameState: room.gameState,
        currentRound: room.currentRound,
        scores: room.scores || {},
        players: Array.isArray(room.players) ? room.players.map(toPublicPlayer) : []
    };
};

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(hostPlayer, rawSettings = {}) {
        let roomCode;
        do {
            roomCode = generateRoomCode();
        } while (this.rooms.has(roomCode));

        const roomId = uuidv4();
        const settings = sanitizeSettings(rawSettings);

        const room = {
            id: roomId,
            code: roomCode,
            hostId: hostPlayer.id,
            players: [hostPlayer],
            gameState: GAME_STATES.LOBBY,
            settings,
            currentRound: 0,
            currentDrawerIndex: 0,
            drawerId: null,
            strokes: [],
            chatMessages: [],
            wordToGuess: null,
            wordChoices: null,
            usedWords: new Set(),
            hint: null,
            wordHint: null,
            roundEndsAt: null,
            timer: 0,
            scores: { [hostPlayer.id]: 0 },
            timers: {
                interval: null,
                wordSelection: null,
                intermission: null,
                grace: {}
            },
            kickedSessionIds: new Set()
        };

        this.rooms.set(roomCode, room);
        return room;
    }

    joinRoom(roomCode, player) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };

        if (room.kickedSessionIds && player.sessionId && room.kickedSessionIds.has(player.sessionId)) {
            return { error: 'You have been kicked from this room' };
        }

        const maxPlayers = room.settings?.maxPlayers || 12;
        if (room.players.length >= maxPlayers) return { error: 'Room is full' };

        room.players.push(player);
        if (!room.scores) room.scores = {};
        room.scores[player.id] = 0;

        return { room };
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    removePlayer(roomCode, playerId) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        const leavingIndex = room.players.findIndex(p => p.id === playerId);
        if (leavingIndex === -1) return room;

        const leavingPlayer = room.players[leavingIndex];
        const wasHost = (room.hostId === playerId);

        // Cancel grace timer if any
        if (leavingPlayer.sessionId && room.timers?.grace?.[leavingPlayer.sessionId]) {
            clearTimeout(room.timers.grace[leavingPlayer.sessionId]);
            delete room.timers.grace[leavingPlayer.sessionId];
        }

        room.players.splice(leavingIndex, 1);

        // If no players remain, clear timers and delete room
        if (room.players.length === 0) {
            clearRoomTimers(room);
            this.rooms.delete(roomCode);
            return null;
        }

        // Pass host to longest-present player (index 0)
        if (wasHost) {
            const newHost = room.players[0];
            room.hostId = newHost.id;
        }

        // Keep isHost flags consistent for all remaining players
        for (const p of room.players) {
            p.isHost = (p.id === room.hostId);
        }

        // Keep currentDrawerIndex pointing at the same player when someone earlier leaves
        if (leavingIndex < room.currentDrawerIndex) {
            room.currentDrawerIndex--;
        } else if (leavingIndex === room.currentDrawerIndex) {
            if (room.currentDrawerIndex >= room.players.length) {
                room.currentDrawerIndex = 0;
            }
        }

        return room;
    }

    reconnectPlayer(roomCode, sessionId, newSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };

        if (room.kickedSessionIds && sessionId && room.kickedSessionIds.has(sessionId)) {
            return { error: 'You have been kicked from this room' };
        }

        const player = room.players.find(p => p.sessionId === sessionId);
        if (!player) return { error: 'Session not found in room' };

        // Cancel grace timer
        if (room.timers?.grace?.[sessionId]) {
            clearTimeout(room.timers.grace[sessionId]);
            delete room.timers.grace[sessionId];
        }

        const oldSocketId = player.id;

        // Update Player ID and status
        player.id = newSocketId;
        player.isDisconnected = false;
        delete player.disconnectedAt;

        // Migrate Scores
        if (room.scores && room.scores[oldSocketId] !== undefined) {
            room.scores[newSocketId] = room.scores[oldSocketId];
            if (oldSocketId !== newSocketId) {
                delete room.scores[oldSocketId];
            }
        }

        // Migrate Guessed Status
        if (room.guessedPlayers && room.guessedPlayers.has(oldSocketId)) {
            room.guessedPlayers.delete(oldSocketId);
            room.guessedPlayers.add(newSocketId);
        }

        // Migrate Host
        if (room.hostId === oldSocketId) {
            room.hostId = newSocketId;
        }
        for (const p of room.players) {
            p.isHost = (p.id === room.hostId);
        }

        // Migrate Drawer ID
        if (room.drawerId === oldSocketId) {
            room.drawerId = newSocketId;
        }

        return { room, player, oldSocketId };
    }

    getRoomByPlayerId(playerId) {
        for (const [, room] of this.rooms) {
            if (room.players.find(p => p.id === playerId)) {
                return room;
            }
        }
        return null;
    }

    deleteRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (room) {
            clearRoomTimers(room);
            this.rooms.delete(roomCode);
        }
    }
}

const roomManager = new RoomManager();
roomManager.toPublicRoom = toPublicRoom;
roomManager.toPublicPlayer = toPublicPlayer;
roomManager.clearRoomTimers = clearRoomTimers;
roomManager.sanitizeSettings = sanitizeSettings;
roomManager.generateRoomCode = generateRoomCode;
roomManager.ROOM_CODE_ALPHABET = ROOM_CODE_ALPHABET;
roomManager.ALLOWED_ROUNDS = ALLOWED_ROUNDS;
roomManager.ALLOWED_DRAW_TIMES = ALLOWED_DRAW_TIMES;
roomManager.ALLOWED_DIFFICULTIES = ALLOWED_DIFFICULTIES;
roomManager.ALLOWED_PACKS = ALLOWED_PACKS;
roomManager.RoomManager = RoomManager;

module.exports = roomManager;
module.exports.toPublicRoom = toPublicRoom;
module.exports.toPublicPlayer = toPublicPlayer;
module.exports.clearRoomTimers = clearRoomTimers;
module.exports.sanitizeSettings = sanitizeSettings;
module.exports.generateRoomCode = generateRoomCode;
module.exports.ROOM_CODE_ALPHABET = ROOM_CODE_ALPHABET;
module.exports.ALLOWED_ROUNDS = ALLOWED_ROUNDS;
module.exports.ALLOWED_DRAW_TIMES = ALLOWED_DRAW_TIMES;
module.exports.ALLOWED_DIFFICULTIES = ALLOWED_DIFFICULTIES;
module.exports.ALLOWED_PACKS = ALLOWED_PACKS;
module.exports.RoomManager = RoomManager;
