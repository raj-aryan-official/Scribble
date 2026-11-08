const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

const roomManager = require('../src/RoomManager');
const { toPublicRoom } = require('../src/RoomManager');
const { FileStore, MemoryStore } = require('../src/RoomStore');
const socketHandlers = require('../src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');

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
        sockets.set(id, socket);
        socketHandlers(io, socket);
        return socket;
    }

    return { io, sockets, rooms, addSocket, rm: roomManager };
}

describe('Player Identity, Token Rejoin & Persistence Tests', () => {
    beforeEach(() => {
        roomManager.rooms.clear();
    });

    afterEach(() => {
        roomManager.rooms.clear();
    });
    test('leave and rejoin after 10 s keeps the score', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });

        const { addSocket, rm } = createMockEnvironment();
        const host = addSocket('host-sock');
        const player = addSocket('player-sock');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'HostUser' });
        const roomJoinedHost = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        const roomCode = roomJoinedHost.args[0].code;
        const room = rm.getRoom(roomCode);

        player.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Maya', sessionId: 'maya-sess' });
        const roomJoinedPlayer = player.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        assert.ok(roomJoinedPlayer, 'Player receives ROOM_JOINED');
        const { playerId, rejoinToken } = roomJoinedPlayer.args[0];
        assert.ok(playerId, 'Player must have a public playerId');
        assert.ok(rejoinToken, 'Player must receive secret rejoinToken');

        // Award Maya 420 points
        const mayaRecord = room.records.get(playerId);
        assert.ok(mayaRecord);
        mayaRecord.score = 420;
        room.scores[playerId] = 420;
        room.scores[player.id] = 420;

        // Maya closes the tab (disconnects)
        player.receiveFromClient('disconnect');
        assert.equal(mayaRecord.status, 'away');
        assert.equal(mayaRecord.score, 420);

        // Advance clock by 10 seconds
        t.mock.timers.tick(10000);
        assert.equal(mayaRecord.status, 'away', 'Still away after 10 seconds');

        // Maya reconnects on a new socket with rejoinToken
        const player2 = addSocket('player-new-sock');
        player2.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken });

        const snapshotEvent = player2.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT);
        assert.ok(snapshotEvent, 'Must receive STATE_SNAPSHOT');
        const snapshot = snapshotEvent.args[0];
        assert.equal(snapshot.ownRecord.score, 420, 'Score must be preserved as 420');
        assert.equal(snapshot.ownRecord.status, 'connected');
        assert.equal(mayaRecord.status, 'connected');
        assert.equal(mayaRecord.score, 420);

        t.mock.timers.reset();
    });

    test('leave and rejoin after 5 minutes keeps the score and restores turn order', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });

        const { addSocket, rm } = createMockEnvironment();
        const host = addSocket('host-sock');
        const player = addSocket('player-sock');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'HostUser' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = rm.getRoom(roomCode);

        player.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Maya', sessionId: 'maya-sess' });
        const { playerId, rejoinToken } = player.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];

        // Give 420 points
        const mayaRecord = room.records.get(playerId);
        mayaRecord.score = 420;

        // Disconnect
        player.receiveFromClient('disconnect');
        assert.equal(mayaRecord.status, 'away');

        // Advance clock by 5 minutes (300 seconds > 90s away timeout)
        t.mock.timers.tick(300000);
        assert.equal(mayaRecord.status, 'left', 'Status must be left after 90s');
        assert.equal(room.turnQueue.includes(playerId), false, 'Removed from turn order when left');

        // Rejoin after 5 minutes with rejoinToken
        const playerNew = addSocket('player-new-sock');
        playerNew.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken });

        assert.equal(mayaRecord.status, 'connected', 'Status restored to connected');
        assert.equal(mayaRecord.score, 420, 'Score 420 kept intact');
        assert.equal(room.turnQueue.includes(playerId), true, 'Re-added to turn order');

        const snapshot = playerNew.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT).args[0];
        assert.equal(snapshot.ownRecord.score, 420);

        t.mock.timers.reset();
    });

    test('the token never appears in any emitted broadcast or in toPublicRoom', () => {
        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');
        const guest = addSocket('guest');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = roomManager.getRoom(roomCode);

        guest.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Guest' });
        const guestJoinEvent = guest.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        const { rejoinToken } = guestJoinEvent.args[0];
        assert.ok(rejoinToken, 'Token was sent in direct reply to guest');

        // Check toPublicRoom directly
        const pubRoom = toPublicRoom(room);
        const pubJson = JSON.stringify(pubRoom);
        assert.equal(pubJson.includes(rejoinToken), false, 'toPublicRoom must never contain rejoinToken');

        // Check events emitted to host
        for (const ev of host.emittedEvents) {
            const evJson = JSON.stringify(ev);
            assert.equal(evJson.includes(rejoinToken), false, `Host event ${ev.event} must never leak rejoinToken`);
        }

        // Check broadcast PLAYER_JOINED event
        const playerJoinedEvent = host.emittedEvents.find(e => e.event === EVENTS.PLAYER_JOINED);
        assert.ok(playerJoinedEvent);
        assert.equal(JSON.stringify(playerJoinedEvent.args).includes(rejoinToken), false);

        // Check PLAYER_STATUS broadcast
        const playerStatusEvent = host.emittedEvents.find(e => e.event === EVENTS.PLAYER_STATUS);
        assert.ok(playerStatusEvent);
        assert.equal(JSON.stringify(playerStatusEvent.args).includes(rejoinToken), false);
    });

    test('a second socket supersedes the first', () => {
        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');
        const sock1 = addSocket('sock1');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        sock1.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'MultiTabUser', sessionId: 'sess-mt' });
        const { rejoinToken } = sock1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];

        // Second socket connects with the same token
        const sock2 = addSocket('sock2');
        sock2.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken });

        // Sock 1 must be told SUPERSEDED and disconnected
        const supersededEv = sock1.emittedEvents.find(e => e.event === EVENTS.SUPERSEDED);
        assert.ok(supersededEv, 'First socket must receive SUPERSEDED');
        assert.equal(sock1.disconnected, true, 'First socket must be disconnected');

        // Sock 2 is the active connected socket
        const snapshot = sock2.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT);
        assert.ok(snapshot, 'Second socket succeeds and gets STATE_SNAPSHOT');
    });

    test('seat claim without token accepted by host', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });

        const { addSocket, rm } = createMockEnvironment();
        const host = addSocket('host');
        const maya1 = addSocket('maya1');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = rm.getRoom(roomCode);

        maya1.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Maya', sessionId: 'sess-maya' });
        const { playerId } = maya1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];
        const record = room.records.get(playerId);
        record.score = 300;

        // Maya disconnects -> away
        maya1.receiveFromClient('disconnect');
        assert.equal(record.status, 'away');

        // Maya joins from a new device without a token (using same nickname 'Maya')
        const maya2 = addSocket('maya2');
        maya2.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Maya' });

        // Receives SEAT_CLAIM_AVAILABLE
        const claimAvail = maya2.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_AVAILABLE);
        assert.ok(claimAvail, 'Should receive SEAT_CLAIM_AVAILABLE');
        assert.equal(claimAvail.args[0].playerId, playerId);

        // Maya sends CLAIM_SEAT
        host.emittedEvents = [];
        maya2.receiveFromClient(EVENTS.CLAIM_SEAT, { roomCode, playerId });

        // Host receives prompt
        const claimReq = host.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_REQUEST);
        assert.ok(claimReq, 'Host receives SEAT_CLAIM_REQUEST');
        const { claimId } = claimReq.args[0];

        // Host accepts
        host.receiveFromClient(EVENTS.RESOLVE_SEAT_CLAIM, { claimId, accepted: true });

        // Maya2 receives acceptance and fresh token
        const acceptEv = maya2.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_ACCEPTED);
        assert.ok(acceptEv, 'Maya2 receives SEAT_CLAIM_ACCEPTED');
        assert.ok(acceptEv.args[0].rejoinToken, 'Fresh token issued');
        assert.equal(record.score, 300, 'Score 300 preserved');
        assert.equal(record.status, 'connected');

        t.mock.timers.reset();
    });

    test('seat claim declined by host or timeout', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });

        const { addSocket } = createMockEnvironment();
        const host = addSocket('host');
        const maya1 = addSocket('maya1');

        host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
        const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        maya1.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Maya', sessionId: 'sess-m1' });
        const { playerId } = maya1.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];
        maya1.receiveFromClient('disconnect');

        // Case 1: Host declines
        const imposter = addSocket('imposter');
        imposter.receiveFromClient(EVENTS.CLAIM_SEAT, { roomCode, playerId });
        const claimReq = host.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_REQUEST);
        assert.ok(claimReq);
        host.receiveFromClient(EVENTS.RESOLVE_SEAT_CLAIM, { claimId: claimReq.args[0].claimId, accepted: false });

        const declinedEv = imposter.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_DECLINED);
        assert.ok(declinedEv, 'Imposter receives SEAT_CLAIM_DECLINED');

        // Case 2: Host times out (20s)
        const candidate = addSocket('candidate');
        host.emittedEvents = [];
        candidate.receiveFromClient(EVENTS.CLAIM_SEAT, { roomCode, playerId });
        assert.ok(host.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_REQUEST));

        // Advance 20s
        t.mock.timers.tick(20000);
        const timeoutDeclined = candidate.emittedEvents.find(e => e.event === EVENTS.SEAT_CLAIM_DECLINED);
        assert.ok(timeoutDeclined, 'Candidate receives decline on 20s timeout');

        t.mock.timers.reset();
    });

    test('FileStore snapshot restores records after a simulated restart', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scribble-store-'));
        try {
            const fileStore1 = new FileStore(tmpDir);
            roomManager.roomStore = fileStore1;
            const env1 = createMockEnvironment();

            const host = env1.addSocket('host');
            const player = env1.addSocket('player');

            host.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'Host' });
            const roomCode = host.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
            const room = roomManager.getRoom(roomCode);

            player.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'Maya', sessionId: 'sess-maya' });
            const { playerId, rejoinToken } = player.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];

            // Award points
            const record = room.records.get(playerId);
            record.score = 420;
            record.avatar = 'avatar-5';

            // Save snapshot immediately to disk
            const { saveRoomSnapshotImmediate } = require('../src/RoomStore');
            await saveRoomSnapshotImmediate(fileStore1, room);

            // Verify file exists on disk
            const jsonFile = path.join(tmpDir, `${roomCode}.json`);
            assert.equal(fs.existsSync(jsonFile), true, 'JSON file must exist on disk');

            // Simulate server restart: clear memory, new FileStore, restore
            roomManager.rooms.clear();
            const fileStore2 = new FileStore(tmpDir);
            roomManager.roomStore = fileStore2;
            await roomManager.restoreFromStore();

            const restoredRoom = roomManager.getRoom(roomCode);
            assert.ok(restoredRoom, 'Room must be restored');
            const restoredMaya = restoredRoom.records.get(playerId);
            assert.ok(restoredMaya, 'Maya record must be restored');
            assert.equal(restoredMaya.score, 420, 'Score 420 restored from file');
            assert.equal(restoredMaya.status, 'away', 'On restart, all players marked away');
            assert.equal(restoredMaya.avatar, 'avatar-5');

            // Maya rejoins server with her secret token
            const env2 = createMockEnvironment();
            const playerRejoin = env2.addSocket('maya-new-socket');
            playerRejoin.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken });

            const snapshotEv = playerRejoin.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT);
            assert.ok(snapshotEv, 'Restored room accepts token rejoin and returns snapshot');
            assert.equal(snapshotEv.args[0].ownRecord.score, 420);
            assert.equal(restoredMaya.status, 'connected');
        } finally {
            roomManager.rooms.clear();
            roomManager.roomStore = new MemoryStore();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('Done when: a player with 420 points closes the tab, returns 3 minutes later and still has 420 points, the same avatar and name, and their guessed flag for the current turn', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });

        const { addSocket, rm } = createMockEnvironment();
        const drawer = addSocket('drawer');
        const maya = addSocket('maya');

        drawer.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'DrawerHost' });
        const roomCode = drawer.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;
        const room = rm.getRoom(roomCode);

        maya.receiveFromClient(EVENTS.JOIN_ROOM, {
            roomCode,
            username: 'Maya',
            avatar: 'avatar-7',
            sessionId: 'maya-sess'
        });
        const { playerId, rejoinToken } = maya.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0];

        // Active game in DRAWING state
        room.gameState = GAME_STATES.DRAWING;
        room.currentDrawerIndex = 0;
        room.drawerId = 'drawer';
        room.wordToGuess = 'guitar';
        room.roundEndsAt = Date.now() + 600000;

        // Maya guesses word correctly -> gets 420 points and guessedThisTurn = true
        const mayaRecord = room.records.get(playerId);
        mayaRecord.score = 420;
        mayaRecord.guessedThisTurn = true;
        room.guessedPlayers.add(maya.id);
        room.guessedPlayers.add(playerId);

        // Maya closes the tab
        maya.receiveFromClient('disconnect');
        assert.equal(mayaRecord.status, 'away');

        // Returns 3 minutes later (180,000 ms)
        t.mock.timers.tick(180000);

        // Maya connects with a new socket and rejoins
        const mayaNewTab = addSocket('maya-returned-tab');
        mayaNewTab.receiveFromClient(EVENTS.REJOIN_ROOM, { roomCode, rejoinToken });

        const snapshot = mayaNewTab.emittedEvents.find(e => e.event === EVENTS.STATE_SNAPSHOT).args[0];
        assert.ok(snapshot, 'Maya receives STATE_SNAPSHOT on return');
        assert.equal(snapshot.ownRecord.score, 420, 'Score is 420 points');
        assert.equal(snapshot.ownRecord.username, 'Maya', 'Username is Maya');
        assert.equal(snapshot.ownRecord.avatar, 'avatar-7', 'Avatar is avatar-7');
        assert.equal(snapshot.ownRecord.guessedThisTurn, true, 'guessed flag for the current turn preserved');
        assert.equal(snapshot.word, 'guitar', 'Guessed player receives secret word');

        t.mock.timers.reset();
    });
});
