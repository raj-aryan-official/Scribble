const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { rejectWithError, getMemberRoom, isDrawer, isHost } = require('./utils');
const { startGameLoop, startRound, cleanEndGame, skipIntermission } = require('../game/loop');

function registerGameHandlers(io, socket, safeOn) {
    safeOn(EVENTS.START_GAME, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isHost(room, socket)) {
            return rejectWithError(socket, 'Only the host can start the game');
        }
        if (room.gameState !== GAME_STATES.LOBBY && room.gameState !== GAME_STATES.GAME_END) {
            return rejectWithError(socket, 'Game can only be started from LOBBY or GAME_END');
        }
        if (!Array.isArray(room.players) || room.players.length < 2) {
            return rejectWithError(socket, 'At least 2 players are required to start the game');
        }
        startGameLoop(io, room.code);
    });

    safeOn(EVENTS.CHOOSE_WORD, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isDrawer(room, socket)) {
            return rejectWithError(socket, 'Only the drawer can choose the word');
        }
        if (room.gameState !== GAME_STATES.WORD_SELECTION) {
            return rejectWithError(socket, 'Word selection is not active');
        }
        const rawWord = payload.word;
        const chosenWord = typeof rawWord === 'string' ? rawWord : rawWord?.word;
        if (!chosenWord || !Array.isArray(room.wordChoices)) {
            return rejectWithError(socket, 'Word was not among the offered choices');
        }
        const match = room.wordChoices.find(c => (typeof c === 'string' ? c : c.word) === chosenWord);
        if (!match) {
            return rejectWithError(socket, 'Word was not among the offered choices');
        }
        if (room.timers?.wordSelection) {
            clearTimeout(room.timers.wordSelection);
            room.timers.wordSelection = null;
        }
        room.wordChoices = null;
        startRound(io, room, chosenWord);
    });

    safeOn(EVENTS.END_GAME_EARLY, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isHost(room, socket)) {
            return rejectWithError(socket, 'Only the host can end the game');
        }
        cleanEndGame(io, room);
    });

    safeOn(EVENTS.SKIP_ROUND_END, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isHost(room, socket)) {
            return rejectWithError(socket, 'Only the host can skip');
        }
        skipIntermission(io, room);
    });
}

module.exports = { registerGameHandlers };
