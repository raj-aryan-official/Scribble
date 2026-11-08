const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');
const http = require('http');

const roomManager = require('../src/RoomManager');
const { clearRoomTimers, ROOM_CODE_ALPHABET } = require('../src/RoomManager');
const socketHandlers = require('../src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');
const { app } = require('../src/server');

// Mock socket infrastructure
function createMockServer() {
    const sockets = new Map();
    const rooms = new Map();

    class MockSocket extends EventEmitter {
        constructor(id) {
            super();
            this.id = id;
            this.emittedEvents = [];
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
        sockets.set(id, socket);
        socketHandlers(io, socket);
        return socket;
    }

    return { io, sockets, rooms, addSocket };
}

describe('Host Handover, Drawer Leaving, Timers & Host Features', () => {
    beforeEach(() => {
        for (const [, room] of roomManager.rooms) {
            clearRoomTimers(room);
        }
        roomManager.rooms.clear();
    });

    afterEach(() => {
        for (const [, room] of roomManager.rooms) {
            clearRoomTimers(room);
        }
        roomManager.rooms.clear();
    });

    test('host handover: passes host to longest-present player and keeps isHost flags consistent', () => {
        const { addSocket } = createMockServer();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');
        const p3 = addSocket('p3');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Player1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2' });
        p3.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player3' });

        assert.equal(room.hostId, 'p1');
        assert.equal(room.players.find(p => p.id === 'p1').isHost, true);
        assert.equal(room.players.find(p => p.id === 'p2').isHost, false);
        assert.equal(room.players.find(p => p.id === 'p3').isHost, false);

        // Host P1 disconnects
        p1.receiveFromClient('disconnect');

        // P2 was longest-present (index 0 now), must become host
        assert.equal(room.hostId, 'p2');
        assert.equal(room.players.find(p => p.id === 'p2').isHost, true);
        assert.equal(room.players.find(p => p.id === 'p3').isHost, false);

        // P2 disconnects -> P3 becomes host
        p2.receiveFromClient('disconnect');
        assert.equal(room.hostId, 'p3');
        assert.equal(room.players.find(p => p.id === 'p3').isHost, true);
    });

    test('drawer leaving advances the turn', () => {
        const { addSocket } = createMockServer();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');
        const p3 = addSocket('p3');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Player1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2' });
        p3.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player3' });

        // Start game
        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        assert.equal(room.currentDrawerIndex, 0);
        assert.equal(room.players[0].id, 'p1');

        p2.emittedEvents = [];
        p3.emittedEvents = [];

        // Drawer P1 leaves during WORD_SELECTION
        p1.receiveFromClient('disconnect');

        // ROUND_ENDED must be emitted with reason 'drawer-left'
        const roundEndEvent = p2.emittedEvents.find(e => e.event === EVENTS.ROUND_ENDED);
        assert.ok(roundEndEvent, 'ROUND_ENDED event must be emitted');
        assert.equal(roundEndEvent.args[0].reason, 'drawer-left');

        // Turn must advance to P2
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        const gameStartedEvent = p2.emittedEvents.find(e => e.event === EVENTS.GAME_STARTED);
        assert.ok(gameStartedEvent, 'GAME_STARTED event for next turn must be emitted');
        assert.equal(gameStartedEvent.args[0].drawerId, 'p2');
        assert.equal(room.players[room.currentDrawerIndex].id, 'p2');
    });

    test('fewer than 2 players remain mid-game ends game with GAME_ENDED', () => {
        const { addSocket } = createMockServer();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Player1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2' });

        p1.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);

        p2.emittedEvents = [];
        // P1 leaves, only 1 player remains mid-game
        p1.receiveFromClient('disconnect');

        assert.equal(room.gameState, GAME_STATES.GAME_END);
        const gameEndedEvent = p2.emittedEvents.find(e => e.event === EVENTS.GAME_ENDED);
        assert.ok(gameEndedEvent, 'GAME_ENDED must be emitted when fewer than 2 players remain');
    });

    test('the last player leaving clears timers and deletes the room with no later callback', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

        const { addSocket } = createMockServer();
        const p1 = addSocket('p1');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Solo' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        // Put active timer on room
        room.timers.wordSelection = setTimeout(() => {
            throw new Error('This callback must never fire');
        }, 5000);

        room.timers.interval = setInterval(() => {
            throw new Error('This interval must never fire');
        }, 1000);

        // P1 leaves (last player)
        p1.receiveFromClient('disconnect');

        // Room is deleted
        assert.equal(roomManager.getRoom(roomCode), undefined);
        assert.equal(room.timers.wordSelection, null);
        assert.equal(room.timers.interval, null);

        // Advance mock time significantly
        t.mock.timers.tick(60000);

        // Should not throw or recreate room
        assert.equal(roomManager.getRoom(roomCode), undefined);

        t.mock.timers.reset();
    });

    test('START_GAME rules: host only, state LOBBY or GAME_END only, at least 2 players', () => {
        const { addSocket } = createMockServer();
        const host = addSocket('host');
        const guest = addSocket('guest');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        // 1 player only -> ERROR
        host.emittedEvents = [];
        host.receiveFromClient(EVENTS.START_GAME, { roomCode });
        let err = host.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'START_GAME with 1 player must fail');

        // Guest joins (now 2 players)
        guest.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guest' });

        // Non-host tries to start game -> ERROR
        guest.emittedEvents = [];
        guest.receiveFromClient(EVENTS.START_GAME, { roomCode });
        err = guest.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Non-host starting game must fail');

        // Host starts from LOBBY -> SUCCESS
        host.emittedEvents = [];
        host.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);

        // Host tries to start while already in WORD_SELECTION -> ERROR
        host.emittedEvents = [];
        host.receiveFromClient(EVENTS.START_GAME, { roomCode });
        err = host.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'START_GAME while already in WORD_SELECTION must fail');

        // End game to GAME_END
        room.gameState = GAME_STATES.GAME_END;

        // Host starts from GAME_END -> SUCCESS
        host.emittedEvents = [];
        host.receiveFromClient(EVENTS.START_GAME, { roomCode });
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
    });

    test('settings validation: allowed rounds, drawTime, difficulty, maxPlayers, unambiguous room code', () => {
        const { addSocket } = createMockServer();
        const socket = addSocket('host');

        // Test with invalid / out-of-spec settings and extra keys
        socket.receiveFromClient(EVENTS.CREATE_ROOM, {
            username: 'Tester',
            settings: {
                rounds: 99,           // not in [2,3,5,7,10,12] -> default 3
                drawTime: 25,         // not in [60,80,100,120] -> default 60
                difficulty: 'Crazy',  // not in [Easy,Medium,Hard,Mixed] -> default Medium
                maxPlayers: 100,      // not 2-12 -> default 12
                secretApiKey: 'leak', // extra key -> ignored
                isAdmin: true         // extra key -> ignored
            }
        });

        const roomData = socket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];
        const room = roomManager.getRoom(roomData.code);

        assert.equal(room.settings.rounds, 3);
        assert.equal(room.settings.drawTime, 60);
        assert.equal(room.settings.difficulty, 'Medium');
        assert.equal(room.settings.maxPlayers, 12);
        assert.equal(room.settings.secretApiKey, undefined);
        assert.equal(room.settings.isAdmin, undefined);

        // Verify room code is 6 characters from unambiguous alphabet (no 0, O, 1, I)
        assert.equal(room.code.length, 6);
        for (const char of room.code) {
            assert.ok(ROOM_CODE_ALPHABET.includes(char), `Character ${char} must be in unambiguous alphabet`);
            assert.ok(!['0', 'O', '1', 'I'].includes(char), `Character ${char} must not be ambiguous`);
        }

        // Test valid custom settings
        const socket2 = addSocket('host2');
        socket2.receiveFromClient(EVENTS.CREATE_ROOM, {
            username: 'Host2',
            settings: {
                rounds: 5,
                drawTime: 100,
                difficulty: 'Hard',
                maxPlayers: 6
            }
        });
        const room2Data = socket2.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];
        const room2 = roomManager.getRoom(room2Data.code);
        assert.equal(room2.settings.rounds, 5);
        assert.equal(room2.settings.drawTime, 100);
        assert.equal(room2.settings.difficulty, 'Hard');
        assert.equal(room2.settings.maxPlayers, 6);
    });

    test('PLAY_AGAIN: host-only event resets scores, strokes, round and drawer index, sets state LOBBY', () => {
        const { addSocket } = createMockServer();
        const host = addSocket('host');
        const guest = addSocket('guest');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);
        guest.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guest' });

        // Simulate game that reached GAME_END with scores, strokes, etc.
        room.gameState = GAME_STATES.GAME_END;
        room.currentRound = 3;
        room.currentDrawerIndex = 1;
        room.strokes = [{ id: 's1', points: [] }];
        room.scores = { host: 350, guest: 420 };

        // Guest tries PLAY_AGAIN -> ERROR
        guest.emittedEvents = [];
        guest.receiveFromClient(EVENTS.PLAY_AGAIN, { roomCode });
        let err = guest.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Guest cannot trigger PLAY_AGAIN');

        // Host triggers PLAY_AGAIN
        host.emittedEvents = [];
        guest.emittedEvents = [];
        host.receiveFromClient(EVENTS.PLAY_AGAIN, { roomCode });

        assert.equal(room.gameState, GAME_STATES.LOBBY);
        assert.equal(room.currentRound, 0);
        assert.equal(room.currentDrawerIndex, 0);
        assert.equal(room.strokes.length, 0);
        assert.deepEqual(room.scores, { host: 0, guest: 0 });

        // Both players receive ROOM_JOINED with fresh public room
        const hostRoomJoined = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        const guestRoomJoined = guest.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        assert.ok(hostRoomJoined);
        assert.ok(guestRoomJoined);
        assert.equal(guestRoomJoined.args[0].gameState, GAME_STATES.LOBBY);
    });

    test('a kicked session cannot rejoin the room', () => {
        const { addSocket } = createMockServer();
        const host = addSocket('host');
        const guest = addSocket('guest');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host', sessionId: 'sess-host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        guest.receiveFromClient(EVENTS.JOIN_ROOM, {
            roomCode,
            username: 'BadActor',
            sessionId: 'sess-bad-actor'
        });

        assert.equal(room.players.length, 2);

        // Non-host attempts to kick -> ERROR
        guest.emittedEvents = [];
        guest.receiveFromClient(EVENTS.KICK_PLAYER, { roomCode, targetId: 'host' });
        let err = guest.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Non-host cannot kick');

        // Host attempts to kick self -> ERROR
        host.emittedEvents = [];
        host.receiveFromClient(EVENTS.KICK_PLAYER, { roomCode, targetId: 'host' });
        err = host.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Host cannot kick self');

        // Host kicks guest
        guest.emittedEvents = [];
        host.receiveFromClient(EVENTS.KICK_PLAYER, { roomCode, targetId: 'guest' });

        // Target receives KICKED event
        const kickedEvent = guest.emittedEvents.find(e => e.event === EVENTS.KICKED || e.event === 'KICKED');
        assert.ok(kickedEvent, 'Target must receive KICKED event');
        assert.equal(room.players.length, 1);

        // Kicked session attempts to JOIN_ROOM -> Rejected
        guest.emittedEvents = [];
        guest.receiveFromClient(EVENTS.JOIN_ROOM, {
            roomCode,
            username: 'BadActor',
            sessionId: 'sess-bad-actor'
        });
        err = guest.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Kicked session must be rejected on JOIN_ROOM');

        // Kicked session attempts to REJOIN_ROOM -> Rejected
        guest.emittedEvents = [];
        guest.receiveFromClient(EVENTS.REJOIN_ROOM, {
            roomCode,
            sessionId: 'sess-bad-actor'
        });
        err = guest.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Kicked session must be rejected on REJOIN_ROOM');

        // A new player with different sessionId CAN join
        const guest2 = addSocket('guest2');
        guest2.receiveFromClient(EVENTS.JOIN_ROOM, {
            roomCode,
            username: 'GoodActor',
            sessionId: 'sess-good-actor'
        });
        assert.equal(room.players.length, 2);
    });

    test('grace timer: seat is kept for 60s, then removed', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

        const { addSocket } = createMockServer();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Player1', sessionId: 'sess-1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2', sessionId: 'sess-2' });

        assert.equal(room.players.length, 2);
        assert.equal(room.hostId, 'p1');

        // P1 disconnects
        p1.receiveFromClient('disconnect');

        // Immediately after disconnect: seat is still kept, isDisconnected = true
        assert.equal(room.players.length, 2);
        const p1Data = room.players.find(p => p.sessionId === 'sess-1');
        assert.equal(p1Data.isDisconnected, true);
        assert.ok(p1Data.disconnectedAt);
        assert.ok(room.timers.grace['sess-1'], 'Grace timer must be started');

        // Tick 30 seconds -> still kept
        t.mock.timers.tick(30000);
        assert.equal(room.players.length, 2);

        // Tick another 30 seconds (total 60s) -> grace period expires, player removed
        t.mock.timers.tick(30001);

        assert.equal(room.players.length, 1);
        assert.equal(room.players[0].sessionId, 'sess-2');
        assert.equal(room.hostId, 'p2', 'Host should hand over to P2 after grace expires');

        t.mock.timers.reset();
    });

    test('REJOIN_ROOM with a wrong sessionId is refused', () => {
        const { addSocket } = createMockServer();
        const p1 = addSocket('p1');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Player1', sessionId: 'valid-sess-token' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        // Attacker attempts to rejoin with wrong sessionId
        const attacker = addSocket('attacker');
        attacker.receiveFromClient(EVENTS.REJOIN_ROOM, {
            roomCode,
            sessionId: 'invalid-token-xyz'
        });

        const err = attacker.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Wrong sessionId must be rejected with ERROR');
        assert.equal(err.args[0].code, 'SESSION_EXPIRED');

        // Original player rejoins with valid sessionId
        const p1NewSocket = addSocket('p1-new-socket');
        p1NewSocket.receiveFromClient(EVENTS.REJOIN_ROOM, {
            roomCode,
            sessionId: 'valid-sess-token'
        });

        const snapshot = p1NewSocket.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT || e.event === 'STATE_SNAPSHOT');
        assert.ok(snapshot, 'Valid sessionId should succeed and receive STATE_SNAPSHOT');
        assert.equal(room.players.find(p => p.sessionId === 'valid-sess-token').id, 'p1-new-socket');
    });

    test('REJOIN_ROOM and late JOIN_ROOM receive STATE_SNAPSHOT with word secrecy', () => {
        const { addSocket } = createMockServer();
        const drawer = addSocket('drawer');
        const guesser = addSocket('guesser');
        const observer = addSocket('observer');

        drawer.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Drawer', sessionId: 'sess-drawer' });
        const roomCode = drawer.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        guesser.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guesser', sessionId: 'sess-guesser' });
        observer.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Observer', sessionId: 'sess-observer' });

        // Set game state to DRAWING
        room.gameState = GAME_STATES.DRAWING;
        room.currentDrawerIndex = 0;
        room.drawerId = 'drawer';
        room.wordToGuess = 'secretvolcano';
        room.hint = '_ _ _ _ _ _ _ _ _ _ _ _ _';
        room.roundEndsAt = Date.now() + 60000;
        room.strokes = [{ id: 's1', points: [{ x: 1, y: 1 }] }];
        room.guessedPlayers = new Set(['guesser']); // guesser has guessed correctly

        // 1. Guesser rejoins -> STATE_SNAPSHOT must contain the word
        const guesserTab2 = addSocket('guesser-tab2');
        guesserTab2.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, sessionId: 'sess-guesser' });
        const guesserSnapshot = guesserTab2.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT || e.event === 'STATE_SNAPSHOT').args[0];
        assert.equal(guesserSnapshot.word, 'secretvolcano', 'Guesser who guessed correctly must receive word in snapshot');
        assert.equal(guesserSnapshot.hint, '_ _ _ _ _ _ _ _ _ _ _ _ _');
        assert.ok(guesserSnapshot.timeLeft > 0);
        assert.equal(guesserSnapshot.strokes.length, 1);

        // 2. Observer rejoins -> STATE_SNAPSHOT must NOT contain the word
        const observerTab2 = addSocket('observer-tab2');
        observerTab2.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, sessionId: 'sess-observer' });
        const observerSnapshot = observerTab2.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT || e.event === 'STATE_SNAPSHOT').args[0];
        assert.equal(observerSnapshot.word, null, 'Observer must NOT receive the secret word in snapshot');

        // 3. Late joiner joins during DRAWING -> receives STATE_SNAPSHOT with word === null
        const lateJoiner = addSocket('late-joiner');
        lateJoiner.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'LateComer', sessionId: 'sess-late' });
        const lateSnapshot = lateJoiner.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT || e.event === 'STATE_SNAPSHOT').args[0];
        assert.ok(lateSnapshot, 'Late joiner must receive STATE_SNAPSHOT');
        assert.equal(lateSnapshot.word, null, 'Late joiner must NOT receive the secret word in snapshot');
        assert.equal(lateSnapshot.strokes.length, 1);
    });

    test('new tab wins: connecting same sessionId closes old socket seat claim', () => {
        const { addSocket } = createMockServer();
        const tab1 = addSocket('tab1');

        tab1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'TabUser', sessionId: 'sess-tab' });
        const roomCode = tab1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        assert.equal(room.players[0].id, 'tab1');

        // Tab 2 connects with same sessionId
        const tab2 = addSocket('tab2');
        tab2.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, sessionId: 'sess-tab' });

        // Tab 1 gets SESSION_REPLACED notification
        const replacedErr = tab1.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(replacedErr, 'Old tab must receive error');
        assert.equal(replacedErr.args[0].code, 'SESSION_REPLACED');

        // Tab 2 has the seat now
        assert.equal(room.players[0].id, 'tab2');
    });

    test('GET /healthz returns 200 with room count', async () => {
        const testServer = http.createServer(app);
        await new Promise(resolve => testServer.listen(0, resolve));
        const port = testServer.address().port;

        // Create 2 rooms
        roomManager.createRoom({ id: 'u1', username: 'U1' });
        roomManager.createRoom({ id: 'u2', username: 'U2' });

        const res = await fetch(`http://localhost:${port}/healthz`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.rooms, 2);

        await new Promise(resolve => testServer.close(resolve));
    });
});

describe('Disconnect Resilience Script (3 socket.io-client sockets)', () => {
    let httpServer;
    let ioServer;
    let port;
    let url;

    beforeEach(async () => {
        for (const [, room] of roomManager.rooms) {
            clearRoomTimers(room);
        }
        roomManager.rooms.clear();

        const { Server } = require('socket.io');
        httpServer = http.createServer();
        ioServer = new Server(httpServer, { cors: { origin: '*' } });
        ioServer.on('connection', (sock) => {
            socketHandlers(ioServer, sock);
        });

        await new Promise((resolve) => {
            httpServer.listen(0, () => {
                port = httpServer.address().port;
                url = `http://localhost:${port}`;
                resolve();
            });
        });
    });

    afterEach(async () => {
        for (const [, room] of roomManager.rooms) {
            clearRoomTimers(room);
        }
        roomManager.rooms.clear();
        await new Promise(resolve => ioServer.close(resolve));
        await new Promise(resolve => httpServer.close(resolve));
    });

    test('connects 3 sockets, starts game, disconnects them one by one, never throws and process stays up', async () => {
        const ioClient = require('../../client/node_modules/socket.io-client');

        const connectClient = () => {
            return new Promise((resolve) => {
                const s = ioClient(url, { transports: ['websocket'], forceNew: true });
                s.on('connect', () => resolve(s));
            });
        };

        const client1 = await connectClient();
        const client2 = await connectClient();
        const client3 = await connectClient();

        // 1. Create room and join
        const roomPromise = new Promise(resolve => client1.once(EVENTS.ROOM_JOINED, resolve));
        client1.emit(EVENTS.CREATE_ROOM, { username: 'Host1' });
        const roomData = await roomPromise;
        const roomCode = roomData.code;

        const c2Join = new Promise(resolve => client2.once(EVENTS.ROOM_JOINED, resolve));
        client2.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2' });
        await c2Join;

        const c3Join = new Promise(resolve => client3.once(EVENTS.ROOM_JOINED, resolve));
        client3.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'Player3' });
        await c3Join;

        // 2. Start game
        const startedPromise = new Promise(resolve => client1.once(EVENTS.GAME_STARTED, resolve));
        client1.emit(EVENTS.START_GAME, { roomCode });
        await startedPromise;

        const room = roomManager.getRoom(roomCode);
        assert.ok(room);
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);

        // 3. Disconnect drawer (client1) mid-turn
        client1.disconnect();
        await new Promise(r => setTimeout(r, 100));

        // Game must survive, advance turn, host handover to client2
        assert.equal(room.players.length, 2);
        assert.equal(room.hostId, client2.id);

        // 4. Disconnect next player (client2)
        client2.disconnect();
        await new Promise(r => setTimeout(r, 100));

        // Only 1 player left mid-game -> game ended safely
        assert.equal(room.players.length, 1);
        assert.equal(room.gameState, GAME_STATES.GAME_END);

        // 5. Disconnect last player (client3)
        client3.disconnect();
        await new Promise(r => setTimeout(r, 100));

        // Room cleaned up
        assert.equal(roomManager.getRoom(roomCode), undefined);
    });
});

