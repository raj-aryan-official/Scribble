const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { rejectWithError, getMemberRoom, isDrawer, isHost } = require('./utils');
const { startGameLoop, startRound, cleanEndGame, skipIntermission } = require('../game/loop');
const { canChooseWord, canStartGame } = require('../game/machine');

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
        if (!canStartGame(room)) {
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
        if (!canChooseWord(room)) {
            return rejectWithError(socket, 'Word selection is not active');
        }

        // E20: Verify turnId if provided; drop stale turnId
        if (payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId) {
            return rejectWithError(socket, 'Stale turn ID', 'STALE_TURN');
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

        // E14: Active word choice resets consecutive auto-picks
        const drawerRec = room.records ? (room.records.get(room.drawerId) || Array.from(room.records.values()).find(r => r.socketId === socket.id)) : null;
        if (drawerRec) {
            drawerRec.consecutiveAutoPicks = 0;
            drawerRec.isAfkSkipped = false;
        }

        if (room.timers?.wordSelection) {
            clearTimeout(room.timers.wordSelection);
            room.timers.wordSelection = null;
        }
        room.wordChoices = null;
        startRound(io, room, chosenWord);
    });

    const handleEndGame = (payload) => {
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
        // E16: END_GAME is host-only and idempotent
        if (room.gameState === GAME_STATES.GAME_END) {
            return;
        }
        cleanEndGame(io, room, 'host-ended');
    };

    safeOn(EVENTS.END_GAME_EARLY, handleEndGame);
    safeOn(EVENTS.END_GAME, handleEndGame);
    if (EVENTS.END_GAME !== 'endGame') {
        safeOn('endGame', handleEndGame);
    }

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
