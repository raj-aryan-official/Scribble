const { v4: uuidv4 } = require('uuid');
const { GAME_STATES } = require('../../shared/types');

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(hostPlayer, settings = {}) {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomId = uuidv4();

        // Ensure hostPlayer has sessionId if passed
        const room = {
            id: roomId,
            code: roomCode,
            hostId: hostPlayer.id,
            players: [hostPlayer],
            gameState: GAME_STATES.LOBBY,
            settings: {
                rounds: settings.rounds || 3,
                drawTime: 60,
                difficulty: 'Medium', // Easy, Medium, Hard, Mixed
                ...settings // Merge settings (e.g., drawTime)
            },
            currentRound: 0,
            currentDrawerIndex: 0,
            strokes: [],
            chatMessages: [],
            wordToGuess: null,
            timer: 0,
            scores: { [hostPlayer.id]: 0 }
        };

        this.rooms.set(roomCode, room);
        return room;
    }

    joinRoom(roomCode, player) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };
        if (room.players.length >= 12) return { error: 'Room is full' };

        // Allow late join
        room.players.push(player);
        room.scores[player.id] = 0;

        // Late joiners might need current game state
        return { room };
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    removePlayer(roomCode, playerId) {
        const room = this.rooms.get(roomCode);
        if (!room) return;

        room.players = room.players.filter(p => p.id !== playerId);

        // If host leaves, assign new host or delete room
        if (room.players.length === 0) {
            this.rooms.delete(roomCode);
        } else if (room.hostId === playerId) {
        } else if (room.hostId === playerId) {
            // Assign random player as host
            const randomIndex = Math.floor(Math.random() * room.players.length);
            const newHost = room.players[randomIndex];
            room.hostId = newHost.id;
            newHost.isHost = true; // Update the player object
        }

        return room;
    }

    reconnectPlayer(roomCode, sessionId, newSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };

        const player = room.players.find(p => p.sessionId === sessionId);
        if (!player) return { error: 'Session not found in room' };

        const oldSocketId = player.id;

        // Update Player ID
        player.id = newSocketId;
        player.isDisconnected = false; // logic if we track disconnects

        // Migrate Scores
        if (room.scores[oldSocketId] !== undefined) {
            room.scores[newSocketId] = room.scores[oldSocketId];
            delete room.scores[oldSocketId];
        }

        // Migrate Guessed Status (if using global set in RoomManager, but it's usually per-round in socketHandlers)
        // We will handle room.guessedPlayers in socketHandlers or if it's attached to room here:
        // In socketHandlers it is: room.guessedPlayers = new Set();
        // So we need to update it here if it exists.
        if (room.guessedPlayers && room.guessedPlayers.has(oldSocketId)) {
            room.guessedPlayers.delete(oldSocketId);
            room.guessedPlayers.add(newSocketId);
        }

        // Migrate Host
        if (room.hostId === oldSocketId) {
            room.hostId = newSocketId;
        }

        return { room, player, oldSocketId };
    }
}

module.exports = new RoomManager();
