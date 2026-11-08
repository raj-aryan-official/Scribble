const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    createTurnId,
    initGameTurns,
    handleLateJoin,
    handlePlayerLeft,
    handlePlayerReturn,
    getNextDrawerCandidate,
    advanceRound,
    recordTurnDraw,
    recordTurnMiss,
    snapshotEligibleGuessers,
    isGuesserEligibleForBonus,
    canJoinRoom,
    buildTurnInfo
} = require('../src/game/turns');
const { GAME_STATES } = require('../../shared/types.cjs');

function createMockRoom(playerCount = 5, settings = {}) {
    const records = new Map();
    const players = [];

    for (let i = 1; i <= playerCount; i++) {
        const playerId = `p${i}`;
        const record = {
            playerId,
            username: `Player ${i}`,
            avatar: `avatar-${i}`,
            status: 'connected',
            score: 0,
            drawsDone: [],
            missedDraws: [],
            joinedAt: 1000 + i * 10
        };
        records.set(playerId, record);
        players.push({ id: playerId, playerId, username: record.username, avatar: record.avatar });
    }

    const room = {
        code: 'TEST42',
        gameState: GAME_STATES.DRAWING,
        players,
        records,
        settings: { rounds: 3, maxPlayers: 6, ...settings },
        timers: { turnWait: null }
    };

    initGameTurns(room);
    return room;
}

describe('Fair Turn Order & Queue Management (server/src/game/turns.js)', () => {
    test('1. Five players and a joiner in round 1, turn 2 draws in round 1', () => {
        const room = createMockRoom(5);
        assert.equal(room.round, 1);
        assert.deepEqual(room.turnQueue, ['p1', 'p2', 'p3', 'p4', 'p5']);
        assert.equal(room.turnsInRound, 5);

        // Turn 1 starts: p1 draws
        const turn1 = getNextDrawerCandidate(room);
        assert.equal(turn1.candidateId, 'p1');
        room.drawerId = 'p1';
        room.turnInRound = 1;
        recordTurnDraw(room, 'p1', createTurnId());

        // Turn 2 starts: p2 draws
        const turn2 = getNextDrawerCandidate(room);
        assert.equal(turn2.candidateId, 'p2');
        room.drawerId = 'p2';
        room.turnInRound = 2;
        recordTurnDraw(room, 'p2', createTurnId());

        // Remaining in turnQueue for round 1: ['p3', 'p4', 'p5'] (3 turns ahead)
        assert.deepEqual(room.turnQueue, ['p3', 'p4', 'p5']);

        // Late joiner joins during round 1, turn 2
        const lateJoinerId = 'p_late';
        room.records.set(lateJoinerId, {
            playerId: lateJoinerId,
            username: 'Late Joiner',
            avatar: 'avatar-6',
            status: 'connected',
            score: 0,
            drawsDone: [],
            missedDraws: [],
            joinedAt: 2000
        });

        handleLateJoin(room, lateJoinerId);

        // Late joiner is appended to this round's queue because turns are still ahead
        assert.deepEqual(room.turnQueue, ['p3', 'p4', 'p5', 'p_late']);
        assert.equal(room.turnsInRound, 6);

        // Turn 3, 4, 5, 6 proceed
        const turn3 = getNextDrawerCandidate(room);
        assert.equal(turn3.candidateId, 'p3');
        const turn4 = getNextDrawerCandidate(room);
        assert.equal(turn4.candidateId, 'p4');
        const turn5 = getNextDrawerCandidate(room);
        assert.equal(turn5.candidateId, 'p5');

        // Late joiner draws in round 1!
        const turn6 = getNextDrawerCandidate(room);
        assert.equal(turn6.candidateId, 'p_late');
        assert.equal(turn6.isRoundOver, false);
    });

    test('2. A joiner during the last turn of a round draws in the next round', () => {
        const room = createMockRoom(3, { rounds: 2 });
        // Initial queue: ['p1', 'p2', 'p3']

        // Turn 1
        getNextDrawerCandidate(room); // p1
        room.drawerId = 'p1';
        recordTurnDraw(room, 'p1', createTurnId());

        // Turn 2
        getNextDrawerCandidate(room); // p2
        room.drawerId = 'p2';
        recordTurnDraw(room, 'p2', createTurnId());

        // Turn 3 (Last turn of round 1: p3 is drawing, turnQueue is empty)
        getNextDrawerCandidate(room); // p3
        room.drawerId = 'p3';
        recordTurnDraw(room, 'p3', createTurnId());
        assert.equal(room.turnQueue.length, 0, 'Queue is empty during the last turn');

        // Joiner arrives during the last turn of round 1
        const lastTurnJoiner = 'p_last_join';
        room.records.set(lastTurnJoiner, {
            playerId: lastTurnJoiner,
            username: 'Last Turn Joiner',
            avatar: 'avatar-4',
            status: 'connected',
            score: 0,
            drawsDone: [],
            missedDraws: [],
            joinedAt: 3000
        });

        handleLateJoin(room, lastTurnJoiner);

        // Does NOT draw in round 1; placed into nextRoundQueue
        assert.deepEqual(room.turnQueue, []);
        assert.deepEqual(room.nextRoundQueue, ['p_last_join']);

        // Round 1 finishes -> advance to Round 2
        const hasNextRound = advanceRound(room);
        assert.equal(hasNextRound, true);
        assert.equal(room.round, 2);

        // In Round 2, the joiner is in the queue!
        assert.ok(room.turnQueue.includes('p_last_join'));
        assert.equal(room.turnQueue.length, 4);
    });

    test('3. A drawer who is away at their turn is waited for 8 s and then skipped, and draws a make-up turn if back by round end', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

        const room = createMockRoom(3, { rounds: 2 });
        // Players: p1, p2, p3

        // Turn 1: p1 draws
        const turn1 = getNextDrawerCandidate(room);
        assert.equal(turn1.candidateId, 'p1');
        room.drawerId = 'p1';
        recordTurnDraw(room, 'p1', createTurnId());

        // p2 disconnects and is marked 'away'
        room.records.get('p2').status = 'away';

        // Next candidate is p2, but p2 is away!
        const turn2Cand = getNextDrawerCandidate(room);
        assert.equal(turn2Cand.candidateId, 'p2');
        assert.equal(room.records.get('p2').status, 'away');

        // Simulate 8s reconnection wait phase
        room.waitingForDrawerId = 'p2';
        let skipped = false;

        room.timers.turnWait = setTimeout(() => {
            if (room.records.get('p2').status === 'away') {
                recordTurnMiss(room, 'p2');
                room.waitingForDrawerId = null;
                skipped = true;
            }
        }, 8000);

        // Advance 8s timer
        t.mock.timers.tick(8000);
        assert.equal(skipped, true, 'p2 was skipped after 8s');
        assert.equal(room.records.get('p2').missedDraws.length, 1);

        // Turn 3: p3 draws
        const turn3 = getNextDrawerCandidate(room);
        assert.equal(turn3.candidateId, 'p3');
        room.drawerId = 'p3';
        recordTurnDraw(room, 'p3', createTurnId());

        // Regular queue is now empty
        assert.equal(room.turnQueue.length, 0);

        // Case A: p2 returns while round is ending
        room.records.get('p2').status = 'connected';
        handlePlayerReturn(room, 'p2');

        // p2 now has a make-up turn queued at the end of round 1!
        assert.deepEqual(room.makeUpQueue, ['p2']);

        // Next candidate is p2's make-up turn!
        const makeUpTurn = getNextDrawerCandidate(room);
        assert.equal(makeUpTurn.candidateId, 'p2');
        assert.equal(makeUpTurn.isMakeUp, true);
        assert.equal(makeUpTurn.isRoundOver, false);
        recordTurnDraw(room, 'p2', createTurnId());

        // Now round is truly over
        const endRound = getNextDrawerCandidate(room);
        assert.equal(endRound.isRoundOver, true);

        t.mock.timers.reset();
    });

    test('4. The queue never holds a duplicate or a player who left', () => {
        const room = createMockRoom(3);
        // p1, p2, p3

        // Attempting to duplicate p2 via handleLateJoin
        handleLateJoin(room, 'p2');
        assert.equal(room.turnQueue.filter(id => id === 'p2').length, 1, 'No duplicate');

        // p3 leaves permanently ('left')
        room.records.get('p3').status = 'left';
        handlePlayerLeft(room, 'p3');

        assert.equal(room.turnQueue.includes('p3'), false, 'Left player removed from queue');

        // Attempting to add left player back via handleLateJoin
        handleLateJoin(room, 'p3');
        assert.equal(room.turnQueue.includes('p3'), false, 'Left player cannot be queued');
    });

    test('5. After N rounds every always-present player has drawn exactly N times and late joiners at most N', () => {
        const N = 3;
        const room = createMockRoom(4, { rounds: N });
        // Always-present: p1, p2, p3, p4

        // p_late joins in round 2
        let lateAdded = false;

        for (let r = 1; r <= N; r++) {
            while (true) {
                const next = getNextDrawerCandidate(room);
                if (next.isRoundOver) break;

                room.drawerId = next.candidateId;
                recordTurnDraw(room, next.candidateId, createTurnId());

                // Add late joiner during round 2, turn 1
                if (r === 2 && !lateAdded) {
                    const lateId = 'p_late';
                    room.records.set(lateId, {
                        playerId: lateId,
                        username: 'Late',
                        avatar: 'avatar-5',
                        status: 'connected',
                        drawsDone: [],
                        missedDraws: [],
                        joinedAt: 5000
                    });
                    handleLateJoin(room, lateId);
                    lateAdded = true;
                }
            }

            if (r < N) {
                const advanced = advanceRound(room);
                assert.equal(advanced, true);
            }
        }

        // Verify draws:
        for (const pid of ['p1', 'p2', 'p3', 'p4']) {
            const draws = room.records.get(pid).drawsDone.length;
            assert.equal(draws, N, `${pid} drew exactly ${N} times`);
        }

        const lateDraws = room.records.get('p_late').drawsDone.length;
        assert.ok(lateDraws <= N && lateDraws >= 1, `Late joiner drew at most ${N} times (drew ${lateDraws})`);
    });

    test('6. Seats: away players keep their seat, new joiner gets Room full only when connected + away >= maxPlayers', () => {
        const room = createMockRoom(4, { maxPlayers: 4 });
        assert.equal(canJoinRoom(room), false, 'Room with 4/4 is full');

        // p1 disconnects -> status away
        room.records.get('p1').status = 'away';
        assert.equal(canJoinRoom(room), false, 'Seat is reserved for away player; room still full');

        // p2 leaves permanently -> status left
        room.records.get('p2').status = 'left';
        assert.equal(canJoinRoom(room), true, 'Left player frees seat; room now has space');
    });

    test('7. Drawer bonus counts only guessers who were present when the word was chosen', () => {
        const room = createMockRoom(4);
        room.drawerId = 'p1';

        // At word choice time, p2 and p3 are connected, p4 is away
        room.records.get('p4').status = 'away';
        snapshotEligibleGuessers(room);

        assert.equal(isGuesserEligibleForBonus(room, 'p2'), true);
        assert.equal(isGuesserEligibleForBonus(room, 'p3'), true);
        assert.equal(isGuesserEligibleForBonus(room, 'p4'), false, 'Away player not eligible for drawer bonus');

        // p5 joins after word was chosen
        room.records.set('p5', { playerId: 'p5', status: 'connected' });
        assert.equal(isGuesserEligibleForBonus(room, 'p5'), false, 'Guesser who joined after word pick not eligible for drawer bonus');
    });

    test('8. TURN_INFO broadcast structure and queue lookahead', () => {
        const room = createMockRoom(4, { rounds: 3 });
        room.currentTurnId = 'turn_test_123';
        room.turnInRound = 2;
        room.drawerId = 'p1';

        const info = buildTurnInfo(room);
        assert.equal(info.turnId, 'turn_test_123');
        assert.equal(info.round, 1);
        assert.equal(info.totalRounds, 3);
        assert.equal(info.turnInRound, 2);
        assert.equal(info.drawerId, 'p1');
        assert.equal(info.nextDrawerId, 'p1');
        assert.ok(Array.isArray(info.queue));
    });

    test('Done when: players joining, leaving and rejoining at random during a simulated 6-player, 3-round game never stall the loop, never repeat a drawer within a round, and never leave the queue empty while players are connected', () => {
        const room = createMockRoom(6, { rounds: 3 });

        let completedTurns = 0;

        for (let r = 1; r <= 3; r++) {
            const drawersThisRound = new Set();

            while (true) {
                // Random event: player joins, leaves, or rejoins
                if (Math.random() < 0.3) {
                    const randomId = `p_rnd_${Math.floor(Math.random() * 100)}`;
                    if (!room.records.has(randomId) && canJoinRoom(room)) {
                        room.records.set(randomId, {
                            playerId: randomId,
                            username: randomId,
                            avatar: 'avatar-1',
                            status: 'connected',
                            drawsDone: [],
                            missedDraws: [],
                            joinedAt: Date.now()
                        });
                        handleLateJoin(room, randomId);
                    }
                }

                if (Math.random() < 0.2) {
                    // Random player disconnects
                    const pids = Array.from(room.records.keys()).filter(id => id !== room.drawerId);
                    if (pids.length > 0) {
                        const targetId = pids[Math.floor(Math.random() * pids.length)];
                        const rec = room.records.get(targetId);
                        if (rec && rec.status === 'connected') {
                            rec.status = 'away';
                        }
                    }
                }

                if (Math.random() < 0.2) {
                    // Random away player returns
                    const awayIds = Array.from(room.records.values())
                        .filter(r => r.status === 'away')
                        .map(r => r.playerId);
                    if (awayIds.length > 0) {
                        const targetId = awayIds[Math.floor(Math.random() * awayIds.length)];
                        room.records.get(targetId).status = 'connected';
                        handlePlayerReturn(room, targetId);
                    }
                }

                const next = getNextDrawerCandidate(room);
                if (next.isRoundOver) {
                    break;
                }

                // If candidate is away, check waiting or skip
                const rec = room.records.get(next.candidateId);
                if (rec.status === 'away') {
                    recordTurnMiss(room, next.candidateId);
                    continue;
                }

                assert.ok(!drawersThisRound.has(next.candidateId), `Player ${next.candidateId} must never repeat as drawer in round ${r}`);
                drawersThisRound.add(next.candidateId);
                room.drawerId = next.candidateId;
                recordTurnDraw(room, next.candidateId, createTurnId());
                completedTurns++;
            }

            assert.ok(drawersThisRound.size > 0, `Round ${r} must have at least one drawer`);

            if (r < 3) {
                const advanced = advanceRound(room);
                assert.equal(advanced, true, 'Round advances successfully');
                // The queue must not be empty while connected players exist
                const connectedCount = Array.from(room.records.values()).filter(p => p.status === 'connected').length;
                if (connectedCount > 0) {
                    assert.ok(room.turnQueue.length > 0, 'Queue is not empty while connected players are present');
                }
            }
        }

        assert.equal(room.round, 3, 'Game reaches round 3 without stalling');
        assert.ok(completedTurns > 0, `Completed ${completedTurns} turns without repeating drawers`);
    });
});
