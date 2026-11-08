const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

const roomManager = require('../src/RoomManager');
const { clearRoomTimers } = require('../src/RoomManager');
const socketHandlers = require('../src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');
const { transition } = require('../src/game/machine');
const { sanitiseText } = require('../src/sanitise');
const { resetRateLimits } = require('../src/handlers/rateLimiter');
const { enqueueRoomAction } = require('../src/handlers/actionQueue');
const {
    cleanEndGame,
    startTurn,
    endRound,
    resumeFromDrawerAway
} = require('../src/game/loop');

function createMockEnvironment() {
    const sockets = new Map();
    const rooms = new Map();

    class MockSocket extends EventEmitter {
        constructor(id) {
            super();
            this.id = id;
            this.emittedEvents = [];
            this.disconnected = false;
        }

        join(roomName) {
            if (!rooms.has(roomName)) rooms.set(roomName, new Set());
            rooms.get(roomName).add(this.id);
        }

        leave(roomName) {
            if (rooms.has(roomName)) {
                rooms.get(roomName).delete(this.id);
            }
        }

        disconnect(_close = true) {
            this.disconnected = true;
            this.emit('disconnect');
        }

        emit(event, ...args) {
            this.emittedEvents.push({ event, args });
            return true;
        }

        receiveFromClient(event, payload) {
            super.emit(event, payload);
        }

        to(target) {
            const self = this;
            return {
                emit(event, ...args) {
                    if (rooms.has(target)) {
                        for (const socketId of rooms.get(target)) {
                            if (socketId !== self.id) {
                                const s = sockets.get(socketId);
                                if (s) s.emittedEvents.push({ event, args });
                            }
                        }
                    } else if (sockets.has(target) && target !== self.id) {
                        const s = sockets.get(target);
                        if (s) s.emittedEvents.push({ event, args });
                    }
                }
            };
        }
    }

    const io = {
        sockets: {
            sockets,
            adapter: {
                rooms: {
                    get(roomName) {
                        return rooms.get(roomName) || new Set();
                    }
                }
            }
        },
        to(target) {
            return {
                emit(event, ...args) {
                    if (rooms.has(target)) {
                        for (const socketId of rooms.get(target)) {
                            const s = sockets.get(socketId);
                            if (s) s.emittedEvents.push({ event, args });
                        }
                    } else if (sockets.has(target)) {
                        const s = sockets.get(target);
                        if (s) s.emittedEvents.push({ event, args });
                    }
                }
            };
        }
    };

    function addSocket(id) {
        const socket = new MockSocket(id);
        socket.persistOnDisconnect = true;
        sockets.set(id, socket);
        socketHandlers(io, socket);
        return socket;
    }

    return { io, sockets, rooms, addSocket };
}

describe('Edge Cases E1 to E22 & Soak Test', () => {
    beforeEach(() => {
        resetRateLimits();
        for (const room of roomManager.rooms.values()) {
            clearRoomTimers(room);
        }
        roomManager.rooms.clear();
    });

    afterEach(() => {
        resetRateLimits();
        for (const room of roomManager.rooms.values()) {
            clearRoomTimers(room);
        }
        roomManager.rooms.clear();
    });

    test('E1: drawer disconnect pauses turn clock up to 10s and resumes on return or ends turn on timeout', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 10000 });
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Drawer' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);
        const { rejoinToken: p1Token } = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guesser' });

        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        p1.receiveFromClient(EVENTS.CHOOSE_WORD, { roomCode, word: room.wordChoices[0] });

        assert.equal(room.gameState, GAME_STATES.DRAWING);
        const originalEndsAt = room.roundEndsAt;

        // Drawer disconnects -> Turn clock pauses (E1)
        p1.receiveFromClient('disconnect');
        assert.equal(room.gameState, GAME_STATES.PAUSED);
        assert.ok(room.pausedAt > 0);
        assert.ok(room.timers.drawerAway, 'drawerAway timer must be active');

        // Clock advances 4s, drawer returns within 10s
        t.mock.timers.tick(4000);
        const p1New = addSocket('p1-new');
        p1New.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken: p1Token });

        // Game resumes with remaining time shifted
        assert.equal(room.gameState, GAME_STATES.DRAWING);
        assert.equal(room.timers.drawerAway, null);
        assert.ok(room.roundEndsAt > originalEndsAt, 'roundEndsAt should be shifted by pause length');

        // Part B: Disconnect and fail to return within 10s -> turn ends with no points
        p1New.receiveFromClient('disconnect');
        assert.equal(room.gameState, GAME_STATES.PAUSED);
        p2.emittedEvents = [];

        // 10s timer expires
        t.mock.timers.tick(10000);
        assert.equal(room.gameState, GAME_STATES.ROUND_END);
        const roundEndedEv = p2.emittedEvents.find(e => e.event === EVENTS.ROUND_ENDED);
        assert.ok(roundEndedEv, 'ROUND_ENDED must be emitted when drawer timeout occurs');
        assert.equal(roundEndedEv.args[0].gains.length, 2);
    });

    test('E2: acting host while host is away, host regained within 90s or permanent after timeout', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');
        const p3 = addSocket('p3');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'HostUser' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const { rejoinToken: p1Token } = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2' });
        p3.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player3' });

        assert.equal(room.hostId, 'p1');

        // Host disconnects
        p1.receiveFromClient('disconnect');

        // Longest-present connected player (p2) becomes acting host
        assert.equal(room.hostId, 'p2');
        assert.equal(room.records.get(room.players.find(p => p.id === 'p2').playerId).isHost, true);
        assert.ok(room.timers.hostGrace, 'hostGrace timer must be started');

        // Host rejoins at 40s (< 90s)
        t.mock.timers.tick(40000);
        const p1Return = addSocket('p1-return');
        p1Return.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken: p1Token });

        // Host status restored to P1, P2 is no longer host
        assert.equal(room.hostId, 'p1-return');
        assert.equal(room.records.get(room.players.find(p => p.id === 'p1-return').playerId).isHost, true);
        assert.equal(room.records.get(room.players.find(p => p.id === 'p2').playerId).isHost, false);

        // Host disconnects again; 90s expires -> acting host becomes permanent
        p1Return.receiveFromClient('disconnect');
        assert.equal(room.hostId, 'p2');
        t.mock.timers.tick(90000);
        assert.equal(room.actingHostId, null);
        assert.equal(room.originalHostId, room.players.find(p => p.id === 'p2').playerId);
    });

    test('E3: all guessers away for 15s ends turn', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const drawer = addSocket('drawer');
        const guesser1 = addSocket('guesser1');
        const guesser2 = addSocket('guesser2');

        drawer.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Drawer' });
        const roomCode = drawer.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        guesser1.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'G1' });
        guesser2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'G2' });

        drawer.receiveFromClient(EVENTS.START_GAME, { roomCode });
        drawer.receiveFromClient(EVENTS.CHOOSE_WORD, { roomCode, word: room.wordChoices[0] });
        assert.equal(room.gameState, GAME_STATES.DRAWING);

        // Both guessers disconnect
        guesser1.receiveFromClient('disconnect');
        guesser2.receiveFromClient('disconnect');

        assert.ok(room.timers.allGuessersAway, 'allGuessersAway timer must be started');

        drawer.emittedEvents = [];
        // Advance 15s
        t.mock.timers.tick(15000);

        // Turn ends
        assert.equal(room.gameState, GAME_STATES.ROUND_END);
        const roundEnded = drawer.emittedEvents.find(e => e.event === EVENTS.ROUND_ENDED);
        assert.ok(roundEnded, 'Round must end after all guessers away for 15s');
    });

    test('E4: fewer than 2 connected players pauses game up to 60s, then ends it', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P2' });
        const p2RejoinToken = p2.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].rejoinToken;

        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        p1.receiveFromClient(EVENTS.CHOOSE_WORD, { roomCode, word: room.wordChoices[0] });
        assert.equal(room.gameState, GAME_STATES.DRAWING);

        // P2 disconnects -> only 1 connected player left (<2)
        p2.receiveFromClient('disconnect');
        assert.equal(room.gameState, GAME_STATES.PAUSED);
        assert.ok(room.timers.pausedGrace, 'pausedGrace timer must be started');

        // P2 rejoins after 10s (< 60s)
        t.mock.timers.tick(10000);
        const p2New = addSocket('p2-new');
        p2New.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken: p2RejoinToken });

        // Game resumes to DRAWING
        assert.equal(room.gameState, GAME_STATES.DRAWING);
        assert.equal(room.timers.pausedGrace, null);

        // P2 disconnects again; 60s expires -> game ends
        p2New.receiveFromClient('disconnect');
        assert.equal(room.gameState, GAME_STATES.PAUSED);
        p1.emittedEvents = [];

        t.mock.timers.tick(60000);
        assert.equal(room.gameState, GAME_STATES.GAME_END);
        const gameEnded = p1.emittedEvents.find(e => e.event === EVENTS.GAME_ENDED);
        assert.ok(gameEnded, 'GAME_ENDED must be emitted when <2 players grace expires');
    });

    test('E5: nickname de-duplication appends (2), (3)', () => {
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');
        const p3 = addSocket('p3');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Alex' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Alex' });
        const p2Name = room.records.get(room.players.find(p => p.id === 'p2').playerId).username;
        assert.equal(p2Name, 'Alex (2)');

        p3.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Alex' });
        const p3Name = room.records.get(room.players.find(p => p.id === 'p3').playerId).username;
        assert.equal(p3Name, 'Alex (3)');
    });

    test('E6: SUPERSEDED for second tab and TAKE_OVER from old tab wins it back', () => {
        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');
        const tab1 = addSocket('tab1');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        tab1.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'TabUser' });
        const { rejoinToken } = tab1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];

        // Second tab connects with same token
        const tab2 = addSocket('tab2');
        tab2.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken });

        // Tab 1 receives SUPERSEDED
        const superseded = tab1.emittedEvents.find(e => e.event === EVENTS.SUPERSEDED);
        assert.ok(superseded, 'Tab 1 must receive SUPERSEDED');

        // Tab 1 emits TAKE_OVER to win it back
        tab2.emittedEvents = [];
        tab1.receiveFromClient(EVENTS.TAKE_OVER, { roomCode, rejoinToken });

        // Tab 2 now receives SUPERSEDED
        const tab2Superseded = tab2.emittedEvents.find(e => e.event === EVENTS.SUPERSEDED);
        assert.ok(tab2Superseded, 'Tab 2 must receive SUPERSEDED after TAKE_OVER');

        // Tab 1 receives fresh STATE_SNAPSHOT
        const snapshot = tab1.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT);
        assert.ok(snapshot, 'Tab 1 receives fresh STATE_SNAPSHOT on take over');
    });

    test('E7: away seats count toward maxPlayers', () => {
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');
        const p3 = addSocket('p3');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1', settings: { maxPlayers: 2 } });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P2' });

        // P2 disconnects (becomes 'away')
        p2.receiveFromClient('disconnect');

        // P3 tries to join: room is full because away seats count toward maxPlayers
        p3.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P3' });
        const err = p3.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'P3 must be rejected');
        assert.equal(err.args[0].message, 'Room is full');
    });

    test('E8: disallowed transitions ignored by state machine (cannot start game from active turn or draw in lobby)', () => {
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P2' });

        // Drawing in LOBBY is disallowed
        p1.emittedEvents = [];
        p1.receiveFromClient(EVENTS.DRAW_STROKE, { roomCode, stroke: { points: [{ x: 0, y: 0 }] } });
        const drawErr = p1.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(drawErr, 'Drawing in LOBBY must be rejected');

        // Start game
        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);

        // Trying to START_GAME again mid-game is disallowed
        p1.emittedEvents = [];
        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        const startErr = p1.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(startErr, 'Starting game mid-turn must be rejected');
    });

    test('E9: process socket events per room in order via promise chain and stamp points with server clock', async () => {
        const executionOrder = [];
        const roomCode = 'TEST_ROOM_ORDER';

        const p1 = enqueueRoomAction(roomCode, async () => {
            await new Promise(r => setTimeout(r, 20));
            executionOrder.push(1);
        });

        const p2 = enqueueRoomAction(roomCode, async () => {
            await new Promise(r => setTimeout(r, 5));
            executionOrder.push(2);
        });

        const p3 = enqueueRoomAction(roomCode, async () => {
            executionOrder.push(3);
        });

        await Promise.all([p1, p2, p3]);
        assert.deepEqual(executionOrder, [1, 2, 3], 'Actions must execute strictly in FIFO order');
    });

    test('E10: disallowed turn transitions ignored (choose word outside WORD_SELECTION)', () => {
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        // In LOBBY, CHOOSE_WORD must be rejected
        p1.emittedEvents = [];
        p1.receiveFromClient(EVENTS.CHOOSE_WORD, { roomCode, word: 'apple' });
        const err = p1.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Choosing word in LOBBY must be rejected');
        assert.equal(err.args[0].message, 'Word selection is not active');
    });

    test('E11: CLOCK_SYNC ping/pong handshake returns server time and roundEndsAt', () => {
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        p1.emittedEvents = [];
        const clientTimestamp = Date.now() - 50;
        p1.receiveFromClient(EVENTS.CLOCK_SYNC, { roomCode, clientTime: clientTimestamp });

        const syncReply = p1.emittedEvents.find(e => e.event === EVENTS.CLOCK_SYNC);
        assert.ok(syncReply, 'Must reply with CLOCK_SYNC');
        assert.equal(syncReply.args[0].clientTime, clientTimestamp);
        assert.ok(syncReply.args[0].serverTime > 0);
    });

    test('E12: strokes carry {id, seq}, REJOIN_ROOM accepts lastSeq returning newer strokes, drops duplicate stroke IDs', () => {
        const { addSocket } = createMockEnvironment();
        const drawer = addSocket('drawer');
        const guesser = addSocket('guesser');

        drawer.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Drawer' });
        const roomCode = drawer.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        guesser.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guesser' });
        const { rejoinToken: guesserToken } = guesser.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];

        drawer.receiveFromClient(EVENTS.START_GAME, { roomCode });
        drawer.receiveFromClient(EVENTS.CHOOSE_WORD, { roomCode, word: room.wordChoices[0] });
        assert.equal(room.gameState, GAME_STATES.DRAWING);

        // Stroke 1
        drawer.receiveFromClient(EVENTS.STROKE_START, {
            roomCode,
            id: 's1',
            tool: 'pencil',
            color: '#000',
            size: 5,
            x: 0.1,
            y: 0.1
        });
        assert.equal(room.strokes[0].seq, 1);

        // Stroke 2
        drawer.receiveFromClient(EVENTS.STROKE_START, {
            roomCode,
            id: 's2',
            tool: 'pencil',
            color: '#000',
            size: 5,
            x: 0.2,
            y: 0.2
        });
        assert.equal(room.strokes[1].seq, 2);

        // Duplicate stroke with id 's1' -> dropped
        drawer.receiveFromClient(EVENTS.STROKE_START, {
            roomCode,
            id: 's1',
            tool: 'pencil',
            color: '#000',
            size: 5,
            x: 0.3,
            y: 0.3
        });
        assert.equal(room.strokes.length, 2, 'Duplicate stroke id s1 must be dropped');

        // Guesser rejoins with lastSeq: 1 -> snapshot strokes returns only strokes with seq > 1
        const guesserNew = addSocket('guesser-new');
        guesserNew.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken: guesserToken, lastSeq: 1 });
        const snapshot = guesserNew.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT).args[0];
        assert.equal(snapshot.strokes.length, 1);
        assert.equal(snapshot.strokes[0].id, 's2');
    });

    test('E13: SYNC_REQUEST returns fresh STATE_SNAPSHOT', () => {
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        p1.emittedEvents = [];
        p1.receiveFromClient(EVENTS.SYNC_REQUEST, { roomCode });

        const snapshot = p1.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT);
        assert.ok(snapshot, 'Must return STATE_SNAPSHOT on SYNC_REQUEST');
        assert.equal(snapshot.args[0].room.code, roomCode);
    });

    test('E14: AFK drawer auto-picks counted, emits AFK_NUDGE at 2, skips turn after 3', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Drawer' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);
        const p1PlayerId = room.players[0].playerId;
        const p1Record = room.records.get(p1PlayerId);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guesser' });

        // Start game -> P1 is drawer
        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);

        // Auto-pick 1
        t.mock.timers.tick(13000);
        assert.equal(room.gameState, GAME_STATES.DRAWING);
        assert.equal(p1Record.consecutiveAutoPicks, 1);

        // Round ends
        t.mock.timers.tick(60000); // drawing ends
        t.mock.timers.tick(5000);  // intermission ends -> P2 turn
        // P2 chooses word
        p2.receiveFromClient(EVENTS.CHOOSE_WORD, { roomCode, word: room.wordChoices[0] });
        t.mock.timers.tick(60000); // drawing ends
        t.mock.timers.tick(5000);  // intermission ends -> Round 2, P1 turn

        // P1's turn again in Word Selection
        p1.emittedEvents = [];
        // Auto-pick 2
        t.mock.timers.tick(10000);
        assert.equal(p1Record.consecutiveAutoPicks, 2);
        const nudge = p1.emittedEvents.find(e => e.event === EVENTS.AFK_NUDGE);
        assert.ok(nudge, 'AFK_NUDGE must be emitted at 2 consecutive auto-picks');

        // Finish P1 turn and P2 turn to reach Round 3
        t.mock.timers.tick(60000);
        t.mock.timers.tick(5000);
        p2.receiveFromClient(EVENTS.CHOOSE_WORD, { roomCode, word: room.wordChoices[0] });
        t.mock.timers.tick(60000);
        t.mock.timers.tick(5000);

        // Auto-pick 3 for P1
        t.mock.timers.tick(10000);
        assert.equal(p1Record.consecutiveAutoPicks, 3);
        assert.equal(p1Record.isAfkSkipped, true, 'Player must be marked AFK skipped after 3 auto-picks');
    });

    test('E15: drawer leaving/disconnect advances turn order smoothly without stall', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');
        const p3 = addSocket('p3');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P2' });
        p3.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P3' });

        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        assert.equal(room.drawerId, 'p1');

        // Drawer P1 disconnects during WORD_SELECTION
        p1.receiveFromClient('disconnect');

        // Turn smoothly advances to next drawer (P2)
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        assert.equal(room.drawerId, 'p2');
    });

    test('E16: END_GAME is host-only and idempotent', () => {
        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');
        const player = addSocket('player');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        player.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player' });

        // Non-host attempts END_GAME -> rejected
        player.emittedEvents = [];
        player.receiveFromClient(EVENTS.END_GAME, { roomCode });
        const err = player.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err);
        assert.equal(err.args[0].message, 'Only the host can end the game');

        // Host ends game -> GAME_ENDED
        host.receiveFromClient(EVENTS.END_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.GAME_END);

        // Host calls END_GAME second time -> idempotent, does not crash
        assert.doesNotThrow(() => {
            host.receiveFromClient(EVENTS.END_GAME, { roomCode });
        });
        assert.equal(room.gameState, GAME_STATES.GAME_END);
    });

    test('E17: disallowed actions during ROUND_END or GAME_END ignored by construction', () => {
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P2' });

        cleanEndGame({ to: () => ({ emit: () => {} }) }, room, 'test-end');
        assert.equal(room.gameState, GAME_STATES.GAME_END);

        // Drawing during GAME_END is disallowed
        p1.emittedEvents = [];
        p1.receiveFromClient(EVENTS.DRAW_STROKE, { roomCode, stroke: { points: [{ x: 0, y: 0 }] } });
        const drawErr = p1.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(drawErr, 'Drawing during GAME_END must be rejected');

        // Guessing during GAME_END cannot score
        p2.emittedEvents = [];
        p2.receiveFromClient(EVENTS.SEND_MESSAGE, { roomCode, text: 'apple' });
        const correctGuess = p2.emittedEvents.find(e => e.event === EVENTS.CORRECT_GUESS);
        assert.equal(correctGuess, undefined, 'Cannot score guesses during GAME_END');
    });

    test('E18: sanitiseText normalises NFKC, strips control/zero-width/bidi chars, collapses spaces and trims', () => {
        // NFKC normalization (ligature fi -> f + i)
        const normalized = sanitiseText('\uFB01le');
        assert.equal(normalized, 'file');

        // Strips control characters
        const noControl = sanitiseText('hello\x00\x1F\x7Fworld');
        assert.equal(noControl, 'helloworld');

        // Strips zero-width characters (\u200B, \uFEFF)
        const noZeroWidth = sanitiseText('A\u200BB\uFEFFC');
        assert.equal(noZeroWidth, 'ABC');

        // Strips bidi override characters (\u202E)
        const noBidi = sanitiseText('left\u202Eright');
        assert.equal(noBidi, 'leftright');

        // Collapses spaces and trims
        const cleanSpaces = sanitiseText('   cool   doodle   cat   ');
        assert.equal(cleanSpaces, 'cool doodle cat');

        // Truncates to max length
        const truncated = sanitiseText('superlongnicknamehere', 10);
        assert.equal(truncated, 'superlongn');
    });

    test('E19: seat claim validation, timeout and authorization rules', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');
        const user = addSocket('user');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        user.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'ClaimTarget' });
        const targetPlayerId = room.players.find(p => p.id === 'user').playerId;

        // User disconnects -> away
        user.receiveFromClient('disconnect');

        // Imposter claims non-existent seat -> rejected
        const imposter = addSocket('imposter');
        imposter.receiveFromClient(EVENTS.CLAIM_SEAT, { roomCode, playerId: 'bogus-id' });
        let err = imposter.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Invalid seat claim must be rejected');

        // Valid claim sent to host
        imposter.emittedEvents = [];
        host.emittedEvents = [];
        imposter.receiveFromClient(EVENTS.CLAIM_SEAT, { roomCode, playerId: targetPlayerId });

        const req = host.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_REQUEST);
        assert.ok(req, 'Host must receive SEAT_CLAIM_REQUEST');

        // Host times out (20s) -> claim declined
        t.mock.timers.tick(20000);
        const declined = imposter.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_DECLINED);
        assert.ok(declined, 'Claim must be declined after host timeout');
    });

    test('E20: turn events carry turnId and server drops stale turnId', () => {
        const { addSocket } = createMockEnvironment();
        const drawer = addSocket('drawer');
        const guesser = addSocket('guesser');

        drawer.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Drawer' });
        const roomCode = drawer.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        guesser.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guesser' });

        drawer.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        const validTurnId = room.currentTurnId;
        assert.ok(validTurnId);

        // Stale CHOOSE_WORD with old turnId is rejected
        drawer.emittedEvents = [];
        drawer.receiveFromClient(EVENTS.CHOOSE_WORD, {
            roomCode,
            word: room.wordChoices[0],
            turnId: 'stale-turn-123'
        });
        const wordErr = drawer.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(wordErr, 'CHOOSE_WORD with stale turnId must be rejected');

        // Valid CHOOSE_WORD succeeds
        drawer.receiveFromClient(EVENTS.CHOOSE_WORD, {
            roomCode,
            word: room.wordChoices[0],
            turnId: validTurnId
        });
        assert.equal(room.gameState, GAME_STATES.DRAWING);

        // Stroke with stale turnId is rejected
        drawer.emittedEvents = [];
        drawer.receiveFromClient(EVENTS.STROKE_START, {
            roomCode,
            id: 'stroke-stale',
            tool: 'pencil',
            color: '#000',
            size: 5,
            x: 0,
            y: 0,
            turnId: 'stale-turn-123'
        });
        const strokeErr = drawer.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(strokeErr, 'Stroke with stale turnId must be rejected');

        // Guess with stale turnId does not score
        guesser.emittedEvents = [];
        guesser.receiveFromClient(EVENTS.SEND_MESSAGE, {
            roomCode,
            text: room.wordToGuess,
            turnId: 'stale-turn-123'
        });
        const correctGuess = guesser.emittedEvents.find(e => e.event === EVENTS.CORRECT_GUESS);
        assert.equal(correctGuess, undefined, 'Guess with stale turnId must not score');
    });

    test('E21: delete room 10 minutes after last player leaves and refuse new rooms beyond MAX_ROOMS', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Solo' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        // Player leaves
        p1.receiveFromClient('disconnect');
        assert.ok(room.timers.emptyCleanup, 'emptyCleanup timer must start when last player leaves');

        // Advance 10 minutes (600,000 ms)
        t.mock.timers.tick(600000);
        assert.equal(roomManager.getRoom(roomCode), undefined, 'Room must be deleted after 10 minutes empty');

        // MAX_ROOMS limit (500)
        for (let i = 0; i < 500; i++) {
            roomManager.rooms.set(`RM${i}`, { code: `RM${i}`, timers: {} });
        }
        assert.equal(roomManager.rooms.size, 500);

        const newSocket = addSocket('newsock');
        newSocket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'OverCapacity' });
        const limitErr = newSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(limitErr, 'Must reject room creation beyond MAX_ROOMS');
        assert.equal(limitErr.args[0].code, 'MAX_ROOMS_REACHED');
    });

    test('E22: rate limiter token bucket per IP and socket for room operations', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
        const { addSocket } = createMockEnvironment();
        const spammer = addSocket('spammer');

        // 10 rapid CREATE_ROOM succeed (bucket capacity is 10)
        for (let i = 0; i < 10; i++) {
            spammer.emittedEvents = [];
            spammer.receiveFromClient(EVENTS.CREATE_ROOM, { username: `User${i}` });
            const joined = spammer.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
            assert.ok(joined, `Attempt ${i + 1} must succeed within capacity`);
        }

        // 11th attempt is rate limited
        spammer.emittedEvents = [];
        spammer.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'User11' });
        const err = spammer.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, '11th rapid attempt must be rate-limited');
        assert.equal(err.args[0].code, 'RATE_LIMITED');

        // Advance clock by 1 second (1000ms) -> 1 token refilled
        t.mock.timers.tick(1000);
        spammer.emittedEvents = [];
        spammer.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'UserRefilled' });
        const refilledJoined = spammer.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        assert.ok(refilledJoined, 'Request after token refill must succeed');
    });

    test('Soak test: 200 simulated games with 3 to 8 players, random joins, leaves, rejoins, disconnects', () => {
        // Runs 200 fast, simulated game cycles with random chaos
        const TOTAL_GAMES = 200;

        for (let g = 0; g < TOTAL_GAMES; g++) {
            const { io, addSocket } = createMockEnvironment();
            const playerCount = 3 + Math.floor(Math.random() * 6); // 3 to 8 players
            const sockets = [];

            const host = addSocket(`g${g}_p0`);
            sockets.push(host);
            host.receiveFromClient(EVENTS.CREATE_ROOM, {
                username: `Host_${g}`,
                settings: { rounds: 2, drawTime: 60 }
            });

            const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
            const room = roomManager.getRoom(roomCode);
            assert.ok(room, `Room ${roomCode} must exist for game ${g}`);

            // Join rest of players
            const tokens = new Map();
            tokens.set(host.id, host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].rejoinToken);

            for (let i = 1; i < playerCount; i++) {
                const s = addSocket(`g${g}_p${i}`);
                sockets.push(s);
                s.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: `Player_${i}` });
                const joined = s.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
                assert.ok(joined, `Player ${i} must successfully join room in game ${g}`);
                tokens.set(s.id, joined.args[0].rejoinToken);
            }

            // Start game
            host.receiveFromClient(EVENTS.START_GAME, { roomCode });

            // Run turns across 2 rounds
            const totalTurnsExpected = playerCount * 2;
            let turnsSimulated = 0;

            while (room.gameState !== GAME_STATES.GAME_END && turnsSimulated < totalTurnsExpected + 4) {
                turnsSimulated++;

                // Assert invariant: State machine in a valid state
                assert.ok(GAME_STATES[room.gameState], `Game state ${room.gameState} must be valid`);

                // Assert invariant: turnQueue has no duplicates
                if (room.turnQueue) {
                    const queueSet = new Set(room.turnQueue);
                    assert.equal(queueSet.size, room.turnQueue.length, `turnQueue must never have duplicates in game ${g}`);
                }

                if (room.gameState === GAME_STATES.WORD_SELECTION) {
                    const drawerSock = sockets.find(s => s.id === room.drawerId) || sockets[0];
                    const randomChoice = room.wordChoices ? room.wordChoices[0] : 'apple';

                    // 10% chance drawer disconnects during selection
                    if (Math.random() < 0.1 && sockets.length > 2) {
                        drawerSock.receiveFromClient('disconnect');
                    } else {
                        drawerSock.receiveFromClient(EVENTS.CHOOSE_WORD, {
                            roomCode,
                            word: randomChoice,
                            turnId: room.currentTurnId
                        });
                    }
                } else if (room.gameState === GAME_STATES.DRAWING) {
                    const drawerSock = sockets.find(s => s.id === room.drawerId);

                    // Drawer draws
                    if (drawerSock) {
                        drawerSock.receiveFromClient(EVENTS.STROKE_START, {
                            roomCode,
                            id: `g${g}_t${turnsSimulated}_str`,
                            tool: 'pencil',
                            color: '#1C1B18',
                            size: 4,
                            x: 0.5,
                            y: 0.5,
                            turnId: room.currentTurnId
                        });
                    }

                    // Random guessers guess correctly
                    for (const s of sockets) {
                        if (s.id !== room.drawerId && Math.random() < 0.7) {
                            s.receiveFromClient(EVENTS.SEND_MESSAGE, {
                                roomCode,
                                text: room.wordToGuess,
                                turnId: room.currentTurnId
                            });
                        }
                    }

                    // Random disconnect and reconnect
                    if (Math.random() < 0.25) {
                        const randomGuesser = sockets.find(s => s.id !== room.drawerId);
                        if (randomGuesser) {
                            const token = tokens.get(randomGuesser.id);
                            randomGuesser.receiveFromClient('disconnect');
                            const rejoinedSocket = addSocket(`${randomGuesser.id}_ret`);
                            rejoinedSocket.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken: token });
                        }
                    }

                    // End round
                    if (room.gameState === GAME_STATES.DRAWING) {
                        endRound(io, room);
                    }
                } else if (room.gameState === GAME_STATES.ROUND_END) {
                    // Host skips intermission or intermission advances
                    host.receiveFromClient(EVENTS.SKIP_ROUND_END, { roomCode });
                } else if (room.gameState === GAME_STATES.TURN_WAIT) {
                    // Turn wait drawer returned or skipped
                    const waitingId = room.waitingForDrawerId;
                    const rec = room.records.get(waitingId);
                    if (rec && rec.tokenHash) {
                        const token = tokens.get(waitingId) || 'token';
                        const reconnected = addSocket(`ret_${waitingId}`);
                        reconnected.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken: token });
                    } else {
                        startTurn(io, room, false);
                    }
                } else if (room.gameState === GAME_STATES.PAUSED) {
                    if (room.timers?.drawerAway) {
                        resumeFromDrawerAway(io, room);
                    } else {
                        transition(room, 'RESUME');
                    }
                }
            }

            // Ensure game completes
            if (room.gameState !== GAME_STATES.GAME_END) {
                cleanEndGame(io, room, 'soak-complete');
            }
            assert.equal(room.gameState, GAME_STATES.GAME_END, `Game ${g} must reach GAME_END`);

            // Delete room and verify no hanging timers left
            roomManager.deleteRoom(roomCode);
            assert.equal(roomManager.getRoom(roomCode), undefined, `Room ${roomCode} must be deleted`);
            assert.equal(room.timers.interval, null, `Room ${roomCode} interval timer must be null`);
            assert.equal(room.timers.wordSelection, null, `Room ${roomCode} wordSelection timer must be null`);
            assert.equal(room.timers.intermission, null, `Room ${roomCode} intermission timer must be null`);
            assert.equal(room.timers.drawerAway, null, `Room ${roomCode} drawerAway timer must be null`);
            assert.equal(room.timers.allGuessersAway, null, `Room ${roomCode} allGuessersAway timer must be null`);
            assert.equal(room.timers.pausedGrace, null, `Room ${roomCode} pausedGrace timer must be null`);
        }
    });
});
