const fs = require('fs');
const path = require('path');

class RoomStore {
    async save(_roomCode, _data) {
        throw new Error('Not implemented');
    }
    async load(_roomCode) {
        throw new Error('Not implemented');
    }
    async loadAll() {
        throw new Error('Not implemented');
    }
    async delete(_roomCode) {
        throw new Error('Not implemented');
    }
}

class MemoryStore extends RoomStore {
    constructor() {
        super();
        this.store = new Map();
    }

    async save(roomCode, data) {
        this.store.set(roomCode, JSON.parse(JSON.stringify(data)));
    }

    async load(roomCode) {
        const item = this.store.get(roomCode);
        return item ? JSON.parse(JSON.stringify(item)) : null;
    }

    async loadAll() {
        const result = [];
        for (const [code, data] of this.store.entries()) {
            result.push({ code, data: JSON.parse(JSON.stringify(data)) });
        }
        return result;
    }

    async delete(roomCode) {
        this.store.delete(roomCode);
    }
}

class FileStore extends RoomStore {
    constructor(dir) {
        super();
        this.dir = dir || process.env.ROOM_STORE_DIR || path.join(__dirname, '../.rooms');
        if (!fs.existsSync(this.dir)) {
            try {
                fs.mkdirSync(this.dir, { recursive: true });
            } catch {
                // Ignore if created concurrently
            }
        }
    }

    _filePath(roomCode) {
        return path.join(this.dir, `${roomCode}.json`);
    }

    async save(roomCode, data) {
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true });
        }
        const tempPath = path.join(this.dir, `${roomCode}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`);
        const targetPath = this._filePath(roomCode);
        const json = JSON.stringify(data, null, 2);
        fs.writeFileSync(tempPath, json, 'utf8');
        fs.renameSync(tempPath, targetPath);
    }

    async load(roomCode) {
        const p = this._filePath(roomCode);
        if (!fs.existsSync(p)) return null;
        try {
            const raw = fs.readFileSync(p, 'utf8');
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    async loadAll() {
        if (!fs.existsSync(this.dir)) return [];
        const files = fs.readdirSync(this.dir);
        const result = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const roomCode = path.basename(file, '.json');
                try {
                    const raw = fs.readFileSync(path.join(this.dir, file), 'utf8');
                    result.push({ code: roomCode, data: JSON.parse(raw) });
                } catch {
                    // Ignore corrupted file
                }
            }
        }
        return result;
    }

    async delete(roomCode) {
        const p = this._filePath(roomCode);
        if (fs.existsSync(p)) {
            try {
                fs.unlinkSync(p);
            } catch {
                // Ignore if already deleted
            }
        }
    }
}

function serializeRoomSnapshot(room) {
    if (!room) return null;

    const records = Array.from((room.records || new Map()).entries()).map(([pid, rec]) => ({
        playerId: pid,
        username: rec.username,
        avatar: rec.avatar,
        score: rec.score || 0,
        guessedThisTurn: Boolean(rec.guessedThisTurn),
        guessMs: rec.guessMs || [],
        correctGuesses: rec.correctGuesses || 0,
        drawsDone: rec.drawsDone || [],
        missedDraws: rec.missedDraws || [],
        joinedAt: rec.joinedAt || Date.now(),
        leftAt: rec.leftAt || null,
        status: 'away', // Restore on boot marks every player 'away'
        tokenHash: rec.tokenHash,
        isHost: Boolean(rec.isHost)
    }));

    return {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        settings: room.settings,
        gameState: room.gameState,
        currentRound: room.currentRound,
        currentDrawerIndex: room.currentDrawerIndex,
        drawerId: room.drawerId,
        turnQueue: room.turnQueue || [],
        wordToGuess: room.wordToGuess,
        wordChoices: room.wordChoices,
        hint: room.hint,
        wordHint: room.wordHint,
        roundEndsAt: room.roundEndsAt,
        timer: room.timer,
        revealedIndices: Array.from(room.revealedIndices || []),
        usedWords: Array.from(room.usedWords || []),
        matchDrawings: room.matchDrawings || [],
        strokes: room.strokes || [],
        chatMessages: room.chatMessages || [],
        records,
        kickedSessionIds: Array.from(room.kickedSessionIds || []),
        kickedTokenHashes: Array.from(room.kickedTokenHashes || [])
    };
}

function scheduleRoomSave(roomStore, room) {
    if (!roomStore || !room) return;
    if (room.saveDebounceTimer) return;

    room.saveDebounceTimer = setTimeout(async () => {
        room.saveDebounceTimer = null;
        try {
            const data = serializeRoomSnapshot(room);
            await roomStore.save(room.code, data);
        } catch (err) {
            console.error('Failed to save room snapshot:', err);
        }
    }, 1000);
}

async function saveRoomSnapshotImmediate(roomStore, room) {
    if (!roomStore || !room) return;
    if (room.saveDebounceTimer) {
        clearTimeout(room.saveDebounceTimer);
        room.saveDebounceTimer = null;
    }
    const data = serializeRoomSnapshot(room);
    await roomStore.save(room.code, data);
}

function createRoomStore(type = null, options = {}) {
    const selectedType = type || (process.env.ROOM_STORE_DIR ? 'file' : (process.env.ROOM_STORE_TYPE || 'memory'));
    if (selectedType === 'file') {
        return new FileStore(options.dir || process.env.ROOM_STORE_DIR);
    }
    return new MemoryStore();
}

module.exports = {
    RoomStore,
    MemoryStore,
    FileStore,
    createRoomStore,
    serializeRoomSnapshot,
    scheduleRoomSave,
    saveRoomSnapshotImmediate
};

