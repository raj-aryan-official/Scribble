const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

const roomManager = require('../src/RoomManager');
const socketHandlers = require('../src/socketHandlers');
const { resetModerationRateLimits } = require('../src/handlers/moderation');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');

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

        getEvents(eventName) {
            return this.emittedEvents.filter(e => e.event === eventName);
        }

        getLastEvent(eventName) {
            const evs = this.getEvents(eventName);
            return evs[evs.length - 1] || null;
        }

        clearEvents() {
            this.emittedEvents = [];
        }

        receiveFromClient(event, payload) {
            super.emit(event, payload);
        }
    }

    const io = {
        sockets: {
            sockets: sockets,
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

function agePlayers(room, msAgo = 70000) {
    const ts = Date.now() - msAgo;
    if (room.records) {
        for (const r of room.records.values()) {
            r.joinedAt = ts;
        }
    }
    if (room.players) {
        for (const p of room.players) {
            p.joinedAt = ts;
        }
    }
}

describe('Vote to Kick & Moderation Tests', () => {
    beforeEach(() => {
        roomManager.rooms.clear();
        resetModerationRateLimits();
    });

    test('1. Threshold calculations for 4, 5, and 8 connected players', () => {
        const { addSocket } = createMockServer();

        const setupRoomWithNPlayers = (n, prefix) => {
            const sockets = [];
            for (let i = 0; i < n; i++) {
                sockets.push(addSocket(`${prefix}-${i}`));
            }

            const host = { id: sockets[0].id, username: 'HostUser' };
            const room = roomManager.createRoom(host, {});
            sockets[0].join(room.code);

            for (let i = 1; i < n; i++) {
                const p = { id: sockets[i].id, username: `Player_${i}` };
                roomManager.joinRoom(room.code, p);
                sockets[i].join(room.code);
            }

            agePlayers(room, 70000);
            return { room, sockets };
        };

        // 4 Players: target excluded -> 3 eligible voters. ceil(0.6 * 3) = 2
        {
            const { room, sockets } = setupRoomWithNPlayers(4, 't1-4p');
            const initiator = sockets[1];
            const target = sockets[2];
            const voter = sockets[3];

            initiator.receiveFromClient(EVENTS.START_VOTE_KICK, {
                roomCode: room.code,
                targetId: target.id,
                reason: 'spam'
            });

            assert.ok(room.activeVote, 'Vote should be active');
            assert.equal(room.activeVote.total, 3, 'Eligible voters = 3');
            assert.equal(room.activeVote.threshold, 2, 'Threshold ceil(0.6 * 3) = 2');

            // 2nd yes from voter reaches threshold -> Early PASS
            voter.receiveFromClient(EVENTS.CAST_VOTE, {
                roomCode: room.code,
                voteId: room.activeVote.voteId,
                yes: true
            });

            assert.equal(room.activeVote, null, 'Vote should resolve and close');
            const kickedEv = target.getLastEvent(EVENTS.KICKED);
            assert.ok(kickedEv, 'Target should be kicked');
            assert.equal(kickedEv.args[0].by, 'vote');
        }

        // 5 Players: target excluded -> 4 eligible voters. ceil(0.6 * 4) = 3
        {
            const { room, sockets } = setupRoomWithNPlayers(5, 't1-5p');
            const initiator = sockets[1];
            const target = sockets[2];
            const voter1 = sockets[3];
            const voter2 = sockets[4];

            initiator.receiveFromClient(EVENTS.START_VOTE_KICK, {
                roomCode: room.code,
                targetId: target.id,
                reason: 'afk'
            });

            assert.ok(room.activeVote, 'Vote should be active');
            assert.equal(room.activeVote.total, 4, 'Eligible voters = 4');
            assert.equal(room.activeVote.threshold, 3, 'Threshold ceil(0.6 * 4) = 3');

            // 2nd vote yes (total = 2) -> not passed yet
            voter1.receiveFromClient(EVENTS.CAST_VOTE, {
                roomCode: room.code,
                voteId: room.activeVote.voteId,
                yes: true
            });
            assert.ok(room.activeVote, 'Vote should still be open with 2/3 votes');

            // 3rd vote yes (total = 3) -> reaches threshold, passes!
            voter2.receiveFromClient(EVENTS.CAST_VOTE, {
                roomCode: room.code,
                voteId: room.activeVote.voteId,
                yes: true
            });
            assert.equal(room.activeVote, null, 'Vote should resolve and close');
            const kickedEv = target.getLastEvent(EVENTS.KICKED);
            assert.ok(kickedEv, 'Target should be kicked with 3 yes votes in 5-player room');
        }

        // 8 Players: target excluded -> 7 eligible voters. ceil(0.6 * 7) = 5
        {
            const { room, sockets } = setupRoomWithNPlayers(8, 't1-8p');
            const initiator = sockets[1];
            const target = sockets[2];

            initiator.receiveFromClient(EVENTS.START_VOTE_KICK, {
                roomCode: room.code,
                targetId: target.id,
                reason: 'abuse'
            });

            assert.ok(room.activeVote, 'Vote should be active');
            assert.equal(room.activeVote.total, 7, 'Eligible voters = 7');
            assert.equal(room.activeVote.threshold, 5, 'Threshold ceil(0.6 * 7) = 5');
        }
    });

    test('2. Lone player or < 4 connected players cannot kick anyone', () => {
        const { addSocket } = createMockServer();
        const s1 = addSocket('t2-s1');
        const s2 = addSocket('t2-s2');
        const s3 = addSocket('t2-s3');

        const host = { id: s1.id, username: 'HostUser' };
        const room = roomManager.createRoom(host, {});
        s1.join(room.code);

        roomManager.joinRoom(room.code, { id: s2.id, username: 'Player2' });
        s2.join(room.code);
        roomManager.joinRoom(room.code, { id: s3.id, username: 'Player3' });
        s3.join(room.code);

        // 3 connected players only
        s2.receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: s3.id,
            reason: 'afk'
        });

        assert.ok(!room.activeVote, 'Vote must not start with only 3 players');
        const err = s2.getLastEvent(EVENTS.ERROR);
        assert.ok(err, 'Initiator should receive ERROR');
        assert.match(err.args[0].message, /At least 4 connected players/);
    });

    test('3. Cannot target self or the host', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t3-h'), addSocket('t3-p1'), addSocket('t3-p2'), addSocket('t3-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }

        agePlayers(room, 70000);

        // Player 1 tries to target self
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[1].id,
            reason: 'afk'
        });
        assert.ok(!room.activeVote);
        assert.match(sockets[1].getLastEvent(EVENTS.ERROR).args[0].message, /cannot target yourself/);

        // Player 1 tries to target host
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[0].id,
            reason: 'abuse'
        });
        assert.ok(!room.activeVote);
        assert.match(sockets[1].getLastEvent(EVENTS.ERROR).args[0].message, /cannot vote to kick the host/);
    });

    test('4. Protected first minute: target must have been in room for at least 60 s', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t4-h'), addSocket('t4-p1'), addSocket('t4-p2'), addSocket('t4-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }

        // Initiator joined 70s ago
        const initRec = Array.from(room.records.values()).find(r => r.socketId === sockets[1].id);
        initRec.joinedAt = Date.now() - 70000;
        room.players[1].joinedAt = initRec.joinedAt;

        // Target (p2) joined only 10s ago
        const targetRec = Array.from(room.records.values()).find(r => r.socketId === sockets[2].id);
        targetRec.joinedAt = Date.now() - 10000;
        room.players[2].joinedAt = targetRec.joinedAt;

        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'afk'
        });

        assert.ok(!room.activeVote, 'Vote must not start for protected target');
        assert.match(sockets[1].getLastEvent(EVENTS.ERROR).args[0].message, /less than 60 seconds/);

        // Advance target's joinedAt beyond 60s
        targetRec.joinedAt = Date.now() - 65000;
        room.players[2].joinedAt = targetRec.joinedAt;

        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'afk'
        });

        assert.ok(room.activeVote, 'Vote should now start successfully');
    });

    test('5. Only one vote at a time per room', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t5-h'), addSocket('t5-p1'), addSocket('t5-p2'), addSocket('t5-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        // P1 starts vote against P2
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'afk'
        });
        assert.ok(room.activeVote);

        // P3 attempts to start concurrent vote against P1
        sockets[3].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[1].id,
            reason: 'spam'
        });

        assert.match(sockets[3].getLastEvent(EVENTS.ERROR).args[0].message, /already in progress/);
    });

    test('6. Initiator 2-minute cooldown', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t6-h'), addSocket('t6-p1'), addSocket('t6-p2'), addSocket('t6-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        // P1 starts vote against P2
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'afk'
        });
        assert.ok(room.activeVote);

        // Host cancels vote
        sockets[0].receiveFromClient(EVENTS.CANCEL_VOTE_KICK, { roomCode: room.code });
        assert.equal(room.activeVote, null);

        // P1 tries to start another vote immediately
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[3].id,
            reason: 'spam'
        });
        assert.ok(!room.activeVote);
        assert.match(sockets[1].getLastEvent(EVENTS.ERROR).args[0].message, /wait 2 minutes/);

        // Advance initiator cooldown beyond 2 minutes
        const initRec = Array.from(room.records.values()).find(r => r.socketId === sockets[1].id);
        initRec.lastVoteStartedAt = Date.now() - 130000;
        if (!room.voteCooldowns) room.voteCooldowns = new Map();
        room.voteCooldowns.set(initRec.playerId, initRec.lastVoteStartedAt);
        room.voteCooldowns.set(sockets[1].id, initRec.lastVoteStartedAt);

        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[3].id,
            reason: 'spam'
        });
        assert.ok(room.activeVote, 'Vote should be allowed after 2 minutes');
    });

    test('7. Target 10-minute immunity on failed vote', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t7-h'), addSocket('t7-p1'), addSocket('t7-p2'), addSocket('t7-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        // P1 starts vote against P2 (threshold = 2)
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'afk'
        });
        assert.ok(room.activeVote, 'Vote should be active');

        // Host (voter) votes NO, P3 votes NO -> Early FAIL (remaining 0 + yes 1 < 2)
        sockets[0].receiveFromClient(EVENTS.CAST_VOTE, {
            roomCode: room.code,
            voteId: room.activeVote.voteId,
            yes: false
        });
        sockets[3].receiveFromClient(EVENTS.CAST_VOTE, {
            roomCode: room.code,
            voteId: room.activeVote.voteId,
            yes: false
        });

        assert.equal(room.activeVote, null, 'Vote should fail');

        // P3 tries to start another vote against P2
        sockets[3].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'abuse'
        });

        assert.ok(!room.activeVote);
        assert.match(sockets[3].getLastEvent(EVENTS.ERROR).args[0].message, /cannot be targeted for 10 minutes/);
    });

    test('8. Initiator whose votes failed 3 times cannot start votes for rest of game', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t8-h'), addSocket('t8-p1'), addSocket('t8-p2'), addSocket('t8-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        const initRec = Array.from(room.records.values()).find(r => r.socketId === sockets[1].id);
        initRec.failedVoteCount = 3;
        room.initiatorFailedVotes = new Map();
        room.initiatorFailedVotes.set(initRec.playerId, 3);
        room.initiatorFailedVotes.set(sockets[1].id, 3);
        initRec.lastVoteStartedAt = Date.now() - 150000;

        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'spam'
        });

        assert.ok(!room.activeVote);
        assert.match(sockets[1].getLastEvent(EVENTS.ERROR).args[0].message, /rest of the game/);
    });

    test('9. Early resolution: early pass and early fail without waiting for timer', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t9-h'), addSocket('t9-p1'), addSocket('t9-p2'), addSocket('t9-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        // P1 votes to kick P2 -> threshold 2. Initiator yes = 1
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'afk'
        });
        assert.ok(room.activeVote, 'Vote should be active');

        // P3 votes yes -> 2 yes >= threshold 2 -> EARLY PASS!
        sockets[3].receiveFromClient(EVENTS.CAST_VOTE, {
            roomCode: room.code,
            voteId: room.activeVote.voteId,
            yes: true
        });

        assert.equal(room.activeVote, null, 'Early pass resolves vote immediately');
        assert.ok(sockets[2].getLastEvent(EVENTS.KICKED));
    });

    test('10. Blocked rejoin for 10 minutes (soft block by rejoinToken and nickname)', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t10-h'), addSocket('t10-p1'), addSocket('t10-p2'), addSocket('t10-p3'), addSocket('t10-p4')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 5; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `Player_${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        const target = sockets[2];
        const targetRec = Array.from(room.records.values()).find(r => r.socketId === target.id);
        const targetUsername = targetRec.username;

        // Host direct kick
        sockets[0].receiveFromClient(EVENTS.KICK_PLAYER, {
            roomCode: room.code,
            targetId: target.id
        });

        // Verify target received KICKED with by: 'host'
        const kickEv = target.getLastEvent(EVENTS.KICKED);
        assert.ok(kickEv);
        assert.equal(kickEv.args[0].by, 'host');

        // Target tries to rejoin with rejoinToken
        const rejoinResult = roomManager.reconnectRecord(room, targetRec, 'new-sock-1');
        assert.ok(rejoinResult?.error, 'Rejoin with record must be rejected during soft block');
        assert.match(rejoinResult.error, /kicked from this room/);

        // Target tries to join as new player with same nickname
        const joinResult = roomManager.joinRoom(room.code, {
            id: 'new-sock-2',
            username: targetUsername
        });
        assert.ok(joinResult?.error || joinResult === null, 'Join with same nickname must be rejected during soft block');
        if (joinResult?.error) {
            assert.match(joinResult.error, /kicked from this room/);
        }

        // Advance block expiration beyond 10 minutes
        for (const [key] of room.kickedBlocks.entries()) {
            room.kickedBlocks.set(key, Date.now() - 1000);
        }

        // Now joining with same nickname is allowed
        const allowedJoin = roomManager.joinRoom(room.code, {
            id: 'new-sock-3',
            username: targetUsername
        });
        assert.ok(allowedJoin, 'Join should be allowed after 10-minute block expires');
    });

    test('11. GF3 Drawer kicked mid-turn with zero points', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t11-h'), addSocket('t11-p1'), addSocket('t11-p2'), addSocket('t11-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        // Start game and enter DRAWING state with P1 as drawer
        room.gameState = GAME_STATES.DRAWING;
        room.currentDrawerIndex = 1;
        room.drawerId = sockets[1].id;
        room.wordToGuess = 'GUITAR';
        room.roundGained = { [sockets[1].id]: 150 };

        // P2 starts vote kick against drawer P1
        sockets[2].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[1].id,
            reason: 'afk'
        });

        // Host votes yes -> 2 yes votes pass (threshold = 2)
        sockets[0].receiveFromClient(EVENTS.CAST_VOTE, {
            roomCode: room.code,
            voteId: room.activeVote.voteId,
            yes: true
        });

        // Check drawer was kicked
        assert.ok(sockets[1].getLastEvent(EVENTS.KICKED));

        // Check ROUND_ENDED was emitted with 0 gained and reason drawer-kicked
        const roundEndEvents = sockets[0].getEvents(EVENTS.ROUND_ENDED);
        assert.ok(roundEndEvents.length > 0, 'ROUND_ENDED must be broadcast');
        const endData = roundEndEvents[0].args[0];
        assert.equal(endData.reason, 'drawer-kicked');
        assert.deepEqual(endData.gained, {}, 'Gained points must be 0 for all');
        assert.equal(endData.drawerBonus, 0);
    });

    test('12. Host direct kick and Host cancelling a running vote', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t12-h'), addSocket('t12-p1'), addSocket('t12-p2'), addSocket('t12-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        // Non-host tries to direct kick
        sockets[1].receiveFromClient(EVENTS.KICK_PLAYER, {
            roomCode: room.code,
            targetId: sockets[2].id
        });
        assert.match(sockets[1].getLastEvent(EVENTS.ERROR).args[0].message, /Only the host/);

        // P1 starts vote kick on P2
        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'spam'
        });
        assert.ok(room.activeVote);

        // Non-host tries to cancel vote
        sockets[3].receiveFromClient(EVENTS.CANCEL_VOTE_KICK, { roomCode: room.code });
        assert.ok(room.activeVote, 'Vote should not be cancelled by non-host');

        // Host cancels vote
        sockets[0].receiveFromClient(EVENTS.CANCEL_VOTE_KICK, { roomCode: room.code });
        assert.equal(room.activeVote, null, 'Host should cancel active vote');
        const voteStateEvents = sockets[0].getEvents(EVENTS.VOTE_STATE);
        assert.equal(voteStateEvents[voteStateEvents.length - 1].args[0], null, 'VOTE_STATE should emit null on cancel');
    });

    test('13. VOTE_STATE broadcast contains counts only and no voter names', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t13-h'), addSocket('t13-p1'), addSocket('t13-p2'), addSocket('t13-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }
        agePlayers(room, 70000);

        sockets[1].receiveFromClient(EVENTS.START_VOTE_KICK, {
            roomCode: room.code,
            targetId: sockets[2].id,
            reason: 'afk'
        });

        const stateEv = sockets[0].getLastEvent(EVENTS.VOTE_STATE);
        assert.ok(stateEv, 'VOTE_STATE should be broadcast');
        const state = stateEv.args[0];
        assert.equal(typeof state.yes, 'number');
        assert.equal(typeof state.no, 'number');
        assert.equal(typeof state.total, 'number');
        assert.equal(state.voterNames, undefined, 'Must NOT contain voter names');
        assert.equal(state.voters, undefined, 'Must NOT contain voter list');
    });

    test('14. Moderation events rate limiting: rejected after 5 events in 3 seconds', () => {
        const { addSocket } = createMockServer();
        const sockets = [addSocket('t14-h'), addSocket('t14-p1'), addSocket('t14-p2'), addSocket('t14-p3')];
        const room = roomManager.createRoom({ id: sockets[0].id, username: 'HostUser' }, {});
        sockets[0].join(room.code);
        for (let i = 1; i < 4; i++) {
            roomManager.joinRoom(room.code, { id: sockets[i].id, username: `P${i}` });
            sockets[i].join(room.code);
        }

        // Send 5 quick cancel vote events (allowed)
        for (let i = 0; i < 5; i++) {
            sockets[0].receiveFromClient(EVENTS.CANCEL_VOTE_KICK, { roomCode: room.code });
        }

        // 6th event should be rejected by rate limiter
        sockets[0].receiveFromClient(EVENTS.CANCEL_VOTE_KICK, { roomCode: room.code });
        const lastErr = sockets[0].getLastEvent(EVENTS.ERROR);
        assert.ok(lastErr);
        assert.match(lastErr.args[0].message, /Slow down/);
    });
});
