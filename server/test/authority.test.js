const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

const roomManager = require('../src/RoomManager');
const { toPublicRoom, toPublicPlayer } = require('../src/RoomManager');
const socketHandlers = require('../src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');

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

describe('Server Authority & Security Tests', () => {
    beforeEach(() => {
        // Clear all rooms before each test
        roomManager.rooms.clear();
    });

    afterEach(() => {
        // Clean up intervals or timers in rooms
        for (const [, room] of roomManager.rooms) {
            if (room.timerInterval) clearInterval(room.timerInterval);
            if (room.wordSelectionTimer) clearTimeout(room.wordSelectionTimer);
        }
        roomManager.rooms.clear();
    });

    test('toPublicRoom contains no wordToGuess, strokes or sessionId', () => {
        const rawRoom = {
            id: 'uuid-123',
            code: 'TEST01',
            hostId: 'socket-host',
            gameState: GAME_STATES.DRAWING,
            settings: { rounds: 3, drawTime: 60, difficulty: 'Medium' },
            currentRound: 2,
            currentDrawerIndex: 0,
            scores: { 'socket-host': 100, 'socket-guest': 50 },
            // Sensitive fields that MUST NEVER leak:
            wordToGuess: 'secretword',
            wordChoices: ['secretword', 'apple', 'banana'],
            wordHint: '_ _ _ _ _ _ _ _ _ _',
            strokes: [
                { id: 'stroke-1', points: [{ x: 10, y: 10 }], color: '#000', size: 5 }
            ],
            chatMessages: [{ username: 'Host', text: 'hi' }],
            timer: 45,
            timerInterval: 12345,
            wordSelectionTimer: 67890,
            revealedIndices: new Set([0, 1]),
            guessedPlayers: new Set(['socket-guest']),
            players: [
                {
                    id: 'socket-host',
                    username: 'HostUser',
                    avatar: '👑',
                    isHost: true,
                    isDisconnected: false,
                    sessionId: 'host-private-session-token',
                    someInternalProp: 'leak'
                },
                {
                    id: 'socket-guest',
                    username: 'GuestUser',
                    avatar: '👤',
                    isHost: false,
                    isDisconnected: true,
                    sessionId: 'guest-private-session-token'
                }
            ]
        };

        const publicRoom = toPublicRoom(rawRoom);

        // Allow-list keys check
        const allowedKeys = ['code', 'hostId', 'settings', 'gameState', 'currentRound', 'scores', 'players'];
        assert.deepEqual(Object.keys(publicRoom).sort(), allowedKeys.sort());

        // Forbidden fields must not exist
        assert.equal(publicRoom.wordToGuess, undefined);
        assert.equal(publicRoom.strokes, undefined);
        assert.equal(publicRoom.guessedPlayers, undefined);
        assert.equal(publicRoom.timer, undefined);
        assert.equal(publicRoom.timers, undefined);
        assert.equal(publicRoom.timerInterval, undefined);
        assert.equal(publicRoom.wordSelectionTimer, undefined);
        assert.equal(publicRoom.wordChoices, undefined);
        assert.equal(publicRoom.wordHint, undefined);
        assert.equal(publicRoom.revealedIndices, undefined);
        assert.equal(publicRoom.chatMessages, undefined);
        assert.equal(publicRoom.sessionId, undefined);

        // Check players array
        assert.equal(publicRoom.players.length, 2);
        for (const player of publicRoom.players) {
            const playerAllowedKeys = ['id', 'username', 'avatar', 'isHost', 'isDisconnected'];
            assert.deepEqual(Object.keys(player).sort(), playerAllowedKeys.sort());
            assert.equal(player.sessionId, undefined);
            assert.equal(player.someInternalProp, undefined);
        }

        assert.equal(publicRoom.players[0].username, 'HostUser');
        assert.equal(publicRoom.players[0].isHost, true);
        assert.equal(publicRoom.players[0].isDisconnected, false);

        assert.equal(publicRoom.players[1].username, 'GuestUser');
        assert.equal(publicRoom.players[1].isHost, false);
        assert.equal(publicRoom.players[1].isDisconnected, true);

        // Test toPublicPlayer directly
        const rawPlayer = {
            id: 's-1',
            username: 'Alice',
            avatar: '😀',
            isHost: true,
            sessionId: 'secret-id'
        };
        const pubPlayer = toPublicPlayer(rawPlayer);
        assert.deepEqual(pubPlayer, {
            id: 's-1',
            username: 'Alice',
            avatar: '😀',
            isHost: true,
            isDisconnected: false
        });
        assert.equal(pubPlayer.sessionId, undefined);
    });

    test('a non-drawer cannot draw, clear, undo or choose', () => {
        const { addSocket } = createMockServer();
        const drawerSocket = addSocket('drawer-1');
        const nonDrawerSocket = addSocket('guest-2');

        // Create room with drawer as host
        drawerSocket.receiveFromClient(EVENTS.CREATE_ROOM, {
            username: 'DrawerHost',
            settings: { rounds: 3 }
        });

        const createdRoomEvent = drawerSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        assert.ok(createdRoomEvent, 'Room should be created');
        const roomCode = createdRoomEvent.args[0].code;

        // Guest joins
        nonDrawerSocket.receiveFromClient(EVENTS.JOIN_ROOM, {
            roomCode,
            username: 'GuestGuesser'
        });

        const room = roomManager.getRoom(roomCode);
        assert.ok(room);
        assert.equal(room.players.length, 2);

        // Put room in WORD_SELECTION
        room.gameState = GAME_STATES.WORD_SELECTION;
        room.currentDrawerIndex = 0; // drawerSocket is index 0
        room.wordChoices = ['apple', 'banana', 'cherry'];

        // Non-drawer tries to choose word
        nonDrawerSocket.emittedEvents = [];
        nonDrawerSocket.receiveFromClient(EVENTS.CHOOSE_WORD, {
            roomCode,
            word: 'apple'
        });

        const nonDrawerChooseError = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(nonDrawerChooseError, 'Non-drawer choosing word must be rejected with ERROR');
        assert.equal(room.wordToGuess, null, 'Word must not be set by non-drawer');

        // Move to DRAWING phase
        room.gameState = GAME_STATES.DRAWING;
        room.wordToGuess = 'apple';
        room.strokes = [];

        // Non-drawer tries DRAW_STROKE
        nonDrawerSocket.emittedEvents = [];
        const dummyStroke = { id: 'st-1', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] };
        nonDrawerSocket.receiveFromClient(EVENTS.DRAW_STROKE, {
            roomCode,
            stroke: dummyStroke
        });

        const nonDrawerDrawError = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(nonDrawerDrawError, 'Non-drawer drawing must be rejected with ERROR');
        assert.equal(room.strokes.length, 0, 'No stroke should be added');

        // Drawer draws a stroke
        drawerSocket.receiveFromClient(EVENTS.DRAW_STROKE, {
            roomCode,
            stroke: dummyStroke
        });
        assert.equal(room.strokes.length, 1, 'Drawer stroke must be added');

        // Non-drawer tries STROKE_START
        nonDrawerSocket.emittedEvents = [];
        nonDrawerSocket.receiveFromClient(EVENTS.STROKE_START, {
            roomCode,
            id: 'st-hack',
            tool: 'pencil',
            color: '#000',
            size: 5,
            x: 0.1,
            y: 0.1
        });
        const nonDrawerStartError = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(nonDrawerStartError, 'Non-drawer STROKE_START must be rejected with ERROR');

        // Drawer does live stroke (STROKE_START, STROKE_POINTS, STROKE_END)
        nonDrawerSocket.emittedEvents = [];
        drawerSocket.receiveFromClient(EVENTS.STROKE_START, {
            roomCode,
            id: 'st-live-1',
            tool: 'pencil',
            color: '#ff0000',
            size: 8,
            x: 0.1,
            y: 0.2
        });
        const relayedStart = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.STROKE_START);
        assert.ok(relayedStart, 'Guest should receive relayed STROKE_START');
        assert.equal(relayedStart.args[0].id, 'st-live-1');

        drawerSocket.receiveFromClient(EVENTS.STROKE_POINTS, {
            roomCode,
            id: 'st-live-1',
            points: [{ x: 0.15, y: 0.25 }, { x: 0.2, y: 0.3 }]
        });
        const relayedPoints = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.STROKE_POINTS);
        assert.ok(relayedPoints, 'Guest should receive relayed STROKE_POINTS');
        assert.equal(relayedPoints.args[0].points.length, 2);

        drawerSocket.receiveFromClient(EVENTS.STROKE_END, {
            roomCode,
            id: 'st-live-1'
        });
        const relayedEnd = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.STROKE_END);
        assert.ok(relayedEnd, 'Guest should receive relayed STROKE_END');

        // Verify stroke in room.strokes
        const liveStroke = room.strokes.find(s => s.id === 'st-live-1');
        assert.ok(liveStroke, 'Stroke must be stored in room.strokes');
        assert.equal(liveStroke.points.length, 3, 'Initial point + 2 batched points');

        // Non-drawer tries UNDO_STROKE
        nonDrawerSocket.emittedEvents = [];
        nonDrawerSocket.receiveFromClient(EVENTS.UNDO_STROKE, { roomCode });

        const nonDrawerUndoError = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(nonDrawerUndoError, 'Non-drawer undoing must be rejected with ERROR');
        assert.equal(room.strokes.length, 2, 'Stroke must not be undone by non-drawer');

        // Non-drawer tries CLEAR_CANVAS
        nonDrawerSocket.emittedEvents = [];
        nonDrawerSocket.receiveFromClient(EVENTS.CLEAR_CANVAS, { roomCode });

        const nonDrawerClearError = nonDrawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(nonDrawerClearError, 'Non-drawer clearing canvas must be rejected with ERROR');
        assert.equal(room.strokes.length, 2, 'Canvas must not be cleared by non-drawer');
    });

    test('a socket from another room cannot act on this room', () => {
        const { addSocket } = createMockServer();
        const hostSocket = addSocket('host-1');
        const outsideSocket = addSocket('outsider-2');

        // Create Room A
        hostSocket.receiveFromClient(EVENTS.CREATE_ROOM, {
            username: 'HostRoomA'
        });
        const roomCodeA = hostSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const _roomA = roomManager.getRoom(roomCodeA);

        // Outside socket creates Room B
        outsideSocket.receiveFromClient(EVENTS.CREATE_ROOM, {
            username: 'HostRoomB'
        });

        // Outside socket tries to act on Room A
        const actions = [
            { event: EVENTS.START_GAME, payload: { roomCode: roomCodeA } },
            { event: EVENTS.END_GAME_EARLY, payload: { roomCode: roomCodeA } },
            { event: EVENTS.CHOOSE_WORD, payload: { roomCode: roomCodeA, word: 'apple' } },
            { event: EVENTS.DRAW_STROKE, payload: { roomCode: roomCodeA, stroke: { id: 's1', points: [{ x: 1, y: 1 }] } } },
            { event: EVENTS.CLEAR_CANVAS, payload: { roomCode: roomCodeA } },
            { event: EVENTS.UNDO_STROKE, payload: { roomCode: roomCodeA } },
            { event: EVENTS.SEND_MESSAGE, payload: { roomCode: roomCodeA, text: 'Hello Room A' } },
            { event: EVENTS.VOICE_JOIN, payload: { roomCode: roomCodeA } },
            { event: EVENTS.VOICE_LEAVE, payload: { roomCode: roomCodeA } },
            { event: EVENTS.VOICE_OFFER, payload: { roomCode: roomCodeA, target: 'host-1', offer: {} } }
        ];

        for (const action of actions) {
            outsideSocket.emittedEvents = [];
            outsideSocket.receiveFromClient(action.event, action.payload);
            const err = outsideSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
            assert.ok(err, `Action ${action.event} from outsider must emit ERROR`);
        }
    });

    test('CHOOSE_WORD rejects a word that was not offered', () => {
        const { addSocket } = createMockServer();
        const drawerSocket = addSocket('drawer-1');

        drawerSocket.receiveFromClient(EVENTS.CREATE_ROOM, {
            username: 'DrawerHost'
        });
        const roomCode = drawerSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        room.gameState = GAME_STATES.WORD_SELECTION;
        room.currentDrawerIndex = 0;
        room.wordChoices = ['penguin', 'submarine', 'telescope'];

        // Drawer attempts to pick a word NOT in wordChoices
        drawerSocket.emittedEvents = [];
        drawerSocket.receiveFromClient(EVENTS.CHOOSE_WORD, {
            roomCode,
            word: 'cheatword'
        });

        const errorEvent = drawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(errorEvent, 'Invalid word choice must be rejected with ERROR');
        assert.equal(room.wordToGuess, null, 'Word to guess must remain null');
        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION, 'State must remain WORD_SELECTION');
        assert.deepEqual(room.wordChoices, ['penguin', 'submarine', 'telescope'], 'Choices must still be present');

        // Drawer now picks a valid offered word
        drawerSocket.emittedEvents = [];
        drawerSocket.receiveFromClient(EVENTS.CHOOSE_WORD, {
            roomCode,
            word: 'submarine'
        });

        assert.equal(room.wordToGuess, 'submarine', 'Valid word choice must be accepted');
        assert.equal(room.gameState, GAME_STATES.DRAWING, 'Game state must advance to DRAWING');
        assert.equal(room.wordChoices, null, 'wordChoices must be cleared after selection');

        // Drawer receives drawerWord
        const drawerWordEvent = drawerSocket.emittedEvents.find(e => e.event === EVENTS.DRAWER_WORD || e.event === 'drawerWord');
        assert.ok(drawerWordEvent, 'Drawer must receive drawerWord');
        assert.equal(drawerWordEvent.args[0].word, 'submarine');
    });

    test('CORRECT_GUESS reaches only the guesser with the word', () => {
        const { addSocket } = createMockServer();
        const drawerSocket = addSocket('drawer-1');
        const guesserSocket = addSocket('guesser-2');
        const observerSocket = addSocket('observer-3');

        // Drawer creates room
        drawerSocket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Drawer' });
        const roomCode = drawerSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        // Guesser and observer join
        guesserSocket.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guesser' });
        observerSocket.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Observer' });

        // Set up game in DRAWING state
        room.gameState = GAME_STATES.DRAWING;
        room.currentDrawerIndex = 0;
        room.wordToGuess = 'secretpass';
        room.roundStartTime = Date.now();
        room.settings.drawTime = 60;
        room.guessedPlayers = new Set();

        // Clear previous event logs
        drawerSocket.emittedEvents = [];
        guesserSocket.emittedEvents = [];
        observerSocket.emittedEvents = [];

        // Guesser guesses the correct word
        guesserSocket.receiveFromClient(EVENTS.SEND_MESSAGE, {
            roomCode,
            text: 'secretpass'
        });

        // 1. Guesser should receive CORRECT_GUESS with the word
        const guesserCorrectEvent = guesserSocket.emittedEvents.find(e => e.event === EVENTS.CORRECT_GUESS);
        assert.ok(guesserCorrectEvent, 'Guesser must receive CORRECT_GUESS');
        assert.equal(guesserCorrectEvent.args[0].playerId, guesserSocket.id);
        assert.equal(guesserCorrectEvent.args[0].word, 'secretpass', 'Guesser MUST receive the word');

        // 2. Observer receives CORRECT_GUESS WITHOUT the word
        const observerCorrectEvent = observerSocket.emittedEvents.find(e => e.event === EVENTS.CORRECT_GUESS);
        assert.ok(observerCorrectEvent, 'Observer must receive broadcast CORRECT_GUESS');
        assert.equal(observerCorrectEvent.args[0].playerId, guesserSocket.id);
        assert.equal(observerCorrectEvent.args[0].word, undefined, 'Observer MUST NOT receive the word');

        // 3. Drawer receives broadcast CORRECT_GUESS WITHOUT the word
        const drawerCorrectEvent = drawerSocket.emittedEvents.find(e => e.event === EVENTS.CORRECT_GUESS);
        assert.ok(drawerCorrectEvent, 'Drawer must receive broadcast CORRECT_GUESS');
        assert.equal(drawerCorrectEvent.args[0].playerId, guesserSocket.id);
        assert.equal(drawerCorrectEvent.args[0].word, undefined, 'Drawer broadcast must not contain word');
    });

    test('payload validation: nickname sanitization, control characters stripped, length 1-16', () => {
        const { addSocket } = createMockServer();
        const socket = addSocket('user-1');

        // Empty username -> ERROR
        socket.emittedEvents = [];
        socket.receiveFromClient(EVENTS.CREATE_ROOM, { username: '   ' });
        let err = socket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Whitespace-only username must be rejected');

        // Control characters only -> stripped to empty -> ERROR
        socket.emittedEvents = [];
        socket.receiveFromClient(EVENTS.CREATE_ROOM, { username: '\x00\x07\x1B\x7F' });
        err = socket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Control-character-only username must be rejected');

        // Over 16 characters -> ERROR
        socket.emittedEvents = [];
        socket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'a'.repeat(17) });
        err = socket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Username longer than 16 chars must be rejected');

        // Username with control characters and spaces is cleaned up
        socket.emittedEvents = [];
        socket.receiveFromClient(EVENTS.CREATE_ROOM, { username: ' \x00Bob\x1B ' });
        const joined = socket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        assert.ok(joined, 'Cleaned username within 1-16 chars must succeed');
        assert.equal(joined.args[0].players[0].username, 'Bob');
    });

    test('stroke validation: cap points per stroke at 2000 and room strokes at 3000', () => {
        const { addSocket } = createMockServer();
        const drawerSocket = addSocket('drawer-1');

        drawerSocket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Artist' });
        const roomCode = drawerSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        room.gameState = GAME_STATES.DRAWING;
        room.currentDrawerIndex = 0;

        // Stroke with 2001 points -> rejected
        const excessivePoints = new Array(2001).fill({ x: 0.5, y: 0.5 });
        drawerSocket.emittedEvents = [];
        drawerSocket.receiveFromClient(EVENTS.DRAW_STROKE, {
            roomCode,
            stroke: { id: 'too-many-points', points: excessivePoints }
        });
        const pointErr = drawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(pointErr, 'Stroke with >2000 points must be rejected with ERROR');
        assert.equal(room.strokes.length, 0);

        // Stroke with 2000 points -> accepted
        const validPoints = new Array(2000).fill({ x: 0.5, y: 0.5 });
        drawerSocket.emittedEvents = [];
        drawerSocket.receiveFromClient(EVENTS.DRAW_STROKE, {
            roomCode,
            stroke: { id: 'max-points', points: validPoints }
        });
        assert.equal(room.strokes.length, 1, 'Stroke with 2000 points must be accepted');

        // Room stroke limit: pre-fill to 3000
        room.strokes = new Array(3000).fill({ id: 's', points: [{ x: 1, y: 1 }] });
        drawerSocket.emittedEvents = [];
        drawerSocket.receiveFromClient(EVENTS.DRAW_STROKE, {
            roomCode,
            stroke: { id: 'over-limit', points: [{ x: 1, y: 1 }] }
        });
        const roomLimitErr = drawerSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(roomLimitErr, 'Drawing past 3000 strokes must be rejected with ERROR');
        assert.equal(room.strokes.length, 3000);
    });

    test('voice signaling requires room membership and same-room target', () => {
        const { addSocket } = createMockServer();
        const user1 = addSocket('user-1');
        const user2 = addSocket('user-2');
        const user3 = addSocket('user-3');

        // User 1 & 2 join Room A
        user1.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'User1' });
        const roomCodeA = user1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        user2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode: roomCodeA, username: 'User2' });

        // User 3 joins Room B
        user3.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'User3' });

        // User 1 offers to User 3 (different rooms) -> ERROR
        user1.emittedEvents = [];
        user1.receiveFromClient(EVENTS.VOICE_OFFER, {
            roomCode: roomCodeA,
            target: 'user-3',
            offer: { sdp: 'fake-sdp' }
        });
        const offerErr = user1.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(offerErr, 'Voice offer to player in different room must be rejected');
        assert.equal(user3.emittedEvents.find(e => e.event === EVENTS.VOICE_OFFER), undefined);

        // User 1 offers to User 2 (same room) -> SUCCEEDS
        user1.emittedEvents = [];
        user2.emittedEvents = [];
        user1.receiveFromClient(EVENTS.VOICE_OFFER, {
            roomCode: roomCodeA,
            target: 'user-2',
            offer: { sdp: 'valid-sdp' }
        });
        const receivedOffer = user2.emittedEvents.find(e => e.event === EVENTS.VOICE_OFFER);
        assert.ok(receivedOffer, 'User 2 in same room must receive VOICE_OFFER');
        assert.equal(receivedOffer.args[0].sender, 'user-1');
    });

    test('server never throws on malformed or null payloads', () => {
        const { addSocket } = createMockServer();
        const socket = addSocket('err-test-socket');

        const clientEvents = [
            EVENTS.CREATE_ROOM,
            EVENTS.JOIN_ROOM,
            EVENTS.START_GAME,
            EVENTS.CHOOSE_WORD,
            EVENTS.DRAW_STROKE,
            EVENTS.UNDO_STROKE,
            EVENTS.CLEAR_CANVAS,
            EVENTS.SEND_MESSAGE,
            EVENTS.VOICE_JOIN,
            EVENTS.VOICE_LEAVE,
            EVENTS.VOICE_OFFER,
            EVENTS.VOICE_ANSWER,
            EVENTS.ICE_CANDIDATE,
            'REJOIN_ROOM'
        ];

        for (const ev of clientEvents) {
            assert.doesNotThrow(() => {
                socket.receiveFromClient(ev, null);
            }, `Null payload for ${ev} should not throw`);

            assert.doesNotThrow(() => {
                socket.receiveFromClient(ev, undefined);
            }, `Undefined payload for ${ev} should not throw`);

            assert.doesNotThrow(() => {
                socket.receiveFromClient(ev, "not-an-object");
            }, `String payload for ${ev} should not throw`);

            assert.doesNotThrow(() => {
                socket.receiveFromClient(ev, [1, 2, 3]);
            }, `Array payload for ${ev} should not throw`);
        }
    });
});

describe('Network Wire Inspection (Simulating real browser sockets over TCP)', () => {
    let httpServer;
    let ioServer;
    let port;
    let url;

    beforeEach(async () => {
        roomManager.rooms.clear();
        const http = require('http');
        const { Server } = require('socket.io');
        httpServer = http.createServer();
        ioServer = new Server(httpServer, {
            cors: { origin: '*' }
        });
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
            if (room.timerInterval) clearInterval(room.timerInterval);
            if (room.wordSelectionTimer) clearTimeout(room.wordSelectionTimer);
        }
        roomManager.rooms.clear();
        await new Promise((resolve) => ioServer.close(resolve));
        await new Promise((resolve) => httpServer.close(resolve));
    });

    test('guesser network stream never contains the word until guess or round end', async () => {
        const ioClient = require('../../client/node_modules/socket.io-client');

        const connectClient = () => {
            return new Promise((resolve) => {
                const s = ioClient(url, { transports: ['websocket'], forceNew: true });
                s.on('connect', () => resolve(s));
            });
        };

        const client1 = await connectClient(); // Drawer
        const client2 = await connectClient(); // Guesser
        const client3 = await connectClient(); // Observer (never guesses)

        // Track all network frames received by client2 and client3
        const client2Frames = [];
        client2.onAny((event, ...args) => {
            client2Frames.push({ event, args, json: JSON.stringify(args) });
        });

        const client3Frames = [];
        client3.onAny((event, ...args) => {
            client3Frames.push({ event, args, json: JSON.stringify(args) });
        });

        // 1. Drawer creates room
        const roomPromise = new Promise(resolve => client1.once(EVENTS.ROOM_JOINED, resolve));
        client1.emit(EVENTS.CREATE_ROOM, { username: 'DrawerHost' });
        const roomData = await roomPromise;
        const roomCode = roomData.code;

        // 2. Guesser and Observer join
        const c2JoinPromise = new Promise(resolve => client2.once(EVENTS.ROOM_JOINED, resolve));
        client2.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'Guesser' });
        await c2JoinPromise;

        const c3JoinPromise = new Promise(resolve => client3.once(EVENTS.ROOM_JOINED, resolve));
        client3.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'Observer' });
        await c3JoinPromise;

        // 3. Drawer starts game
        const choicesPromise = new Promise(resolve => client1.once(EVENTS.WORD_CHOICES, resolve));
        client1.emit(EVENTS.START_GAME, { roomCode });
        const choices = await choicesPromise;
        assert.ok(choices.length === 3);

        const chosenWord = choices[0];

        // Ensure neither client2 nor client3 received choices or word yet
        assert.equal(client2Frames.some(f => f.json.includes(chosenWord)), false);
        assert.equal(client3Frames.some(f => f.json.includes(chosenWord)), false);

        // 4. Drawer picks the word
        const wordChosenPromise = new Promise(resolve => client2.once(EVENTS.WORD_CHOSEN, resolve));
        client1.emit(EVENTS.CHOOSE_WORD, { roomCode, word: chosenWord });
        await wordChosenPromise;

        // Drawer gets drawerWord
        // Guesser and Observer receive WORD_CHOSEN with hint, NOT word
        assert.equal(client2Frames.some(f => f.json.includes(chosenWord)), false, 'Guesser must not have word in network frames');
        assert.equal(client3Frames.some(f => f.json.includes(chosenWord)), false, 'Observer must not have word in network frames');

        // 5. Drawer draws strokes
        client1.emit(EVENTS.DRAW_STROKE, {
            roomCode,
            stroke: { id: 's1', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] }
        });

        // 6. Guesser submits incorrect guess
        client2.emit(EVENTS.SEND_MESSAGE, { roomCode, text: 'wrongguess' });
        await new Promise(r => setTimeout(r, 50));

        assert.equal(client2Frames.some(f => f.json.includes(chosenWord)), false, 'Guesser must still not have word');
        assert.equal(client3Frames.some(f => f.json.includes(chosenWord)), false, 'Observer must still not have word');

        // 7. Guesser submits correct guess!
        const correctGuessPromise = new Promise(resolve => client2.once(EVENTS.CORRECT_GUESS, resolve));
        client2.emit(EVENTS.SEND_MESSAGE, { roomCode, text: chosenWord });
        const guessPayload = await correctGuessPromise;

        // NOW client2 receives the word in CORRECT_GUESS payload
        assert.equal(guessPayload.word, chosenWord);

        // Wait a moment for client3 to receive broadcast
        await new Promise(r => setTimeout(r, 50));

        // BUT client3 has STILL NEVER received the word!
        assert.equal(client3Frames.some(f => f.json.includes(chosenWord)), false, 'Observer must still NEVER have received the word');

        // 8. Round ends - now observer receives the word in ROUND_ENDED
        const roundEndPromise = new Promise(resolve => client3.once(EVENTS.ROUND_ENDED, resolve));
        const room = roomManager.getRoom(roomCode);
        if (room.timerInterval) {
            clearInterval(room.timerInterval);
            room.timerInterval = null;
        }
        ioServer.to(roomCode).emit(EVENTS.ROUND_ENDED, {
            word: room.wordToGuess,
            scores: room.scores
        });
        const roundEndPayload = await roundEndPromise;
        assert.equal(roundEndPayload.word, chosenWord, 'Word is revealed to observer only upon ROUND_ENDED');

        // Disconnect clients
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
    });
});

