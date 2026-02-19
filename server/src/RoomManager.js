const { v4: uuidv4 } = require('uuid');
const { GAME_STATES } = require('../../shared/types');

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(hostPlayer, settings = {}) {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomId = uuidv4();

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
            // Assign next player as host
            const newHost = room.players[0];
            room.hostId = newHost.id;
            newHost.isHost = true; // Update the player object
        }

        return room;
    }
}

module.exports = new RoomManager();
