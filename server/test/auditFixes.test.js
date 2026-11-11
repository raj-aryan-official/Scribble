const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

const roomManager = require('../src/RoomManager');
const { clearRoomTimers } = require('../src/RoomManager');
const socketHandlers = require('../src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');
const { resetRateLimits } = require('../src/handlers/rateLimiter');
const { startGameLoop } = require('../src/game/loop');

function createMockEnvironment() {
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
            rooms.get(roomName)?.delete(this.id);
        }

        emit(event, ...args) {
            this.emittedEvents.push({ event, args });
            return true;
        }

        receiveFromClient(event, payload) {
            super.emit(event, payload);
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
                    const targets = rooms.get(target);
                    if (targets) {
                        for (const socketId of targets) {
                            sockets.get(socketId)?.emit(event, ...args);
                        }
                    } else if (sockets.has(target)) {
                        sockets.get(target).emit(event, ...args);
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

describe('Backend audit fixes', () => {
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

    test('SYNC_REQUEST rejects sockets that are not members of the room', () => {
        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');
        const outsider = addSocket('outsider');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        outsider.emittedEvents = [];
        outsider.receiveFromClient(EVENTS.SYNC_REQUEST, { roomCode, strokesOnly: true });

        const snapshot = outsider.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT);
        const history = outsider.emittedEvents.find(e => e.event === EVENTS.STROKE_HISTORY);
        const error = outsider.emittedEvents.find(e => e.event === EVENTS.ERROR);

        assert.equal(snapshot, undefined, 'Outsider must not receive a snapshot');
        assert.equal(history, undefined, 'Outsider must not receive strokes');
        assert.ok(error, 'Outsider must receive an error');
        assert.match(error.args[0].message, /Not a member/);
    });

    test('SYNC_REQUEST with strokesOnly replays strokes without a full snapshot', () => {
        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);
        room.strokes = [{ id: 's1', seq: 1, points: [{ x: 0.2, y: 0.2 }] }];

        host.emittedEvents = [];
        host.receiveFromClient(EVENTS.SYNC_REQUEST, { roomCode, strokesOnly: true });

        const snapshot = host.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT);
        const history = host.emittedEvents.find(e => e.event === EVENTS.STROKE_HISTORY);
        assert.equal(snapshot, undefined, 'strokesOnly must not emit a full snapshot');
        assert.ok(history, 'strokesOnly must replay the stroke history');
        assert.equal(history.args[0].length, 1);
        assert.equal(history.args[0][0].id, 's1');
    });

    test('Starting a new match from GAME_END resets record scores and per-turn stats', () => {
        const { io, addSocket } = createMockEnvironment();
        const p1 = addSocket('p1');
        const p2 = addSocket('p2');

        p1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'P1' });
        const roomCode = p1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);
        p2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'P2' });

        for (const rec of room.records.values()) {
            rec.score = 420;
            rec.correctGuesses = 3;
        }
        room.scores = { p1: 420, p2: 310 };
        room.gameState = GAME_STATES.GAME_END;

        startGameLoop(io, roomCode);

        for (const rec of room.records.values()) {
            assert.equal(rec.score, 0);
            assert.equal(rec.correctGuesses, 0);
        }
        for (const score of Object.values(room.scores)) {
            assert.equal(score, 0);
        }
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        clearRoomTimers(room);
    });
});
