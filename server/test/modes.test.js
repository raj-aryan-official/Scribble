const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { getMode, MODES, ALLOWED_MODES } = require('../src/modes');
const { initTeams, assignPlayerToTeam, randomizeTeams, getSmallerTeam, getPlayerTeam } = require('../src/modes/teams');

describe('Game Modes Unit Tests', () => {
    describe('1. Interface Compliance across all Modes', () => {
        const expectedModes = ['classic', 'speed', 'team', 'relay', 'hard', 'custom'];

        it('all 6 modes are registered and allowed', () => {
            assert.deepEqual(ALLOWED_MODES, expectedModes);
            for (const modeId of expectedModes) {
                const mode = getMode(modeId);
                assert.ok(mode, `Mode ${modeId} should exist`);
                assert.equal(mode.id, modeId);
                assert.ok(typeof mode.name === 'string');
                assert.ok(typeof mode.description === 'string');
                assert.ok(typeof mode.defaults === 'object');
                assert.equal(typeof mode.canJoinMidGame, 'function');
                assert.equal(typeof mode.buildTurnQueue, 'function');
                assert.equal(typeof mode.canDraw, 'function');
                assert.equal(typeof mode.onTurnStart, 'function');
                assert.equal(typeof mode.onGuess, 'function');
                assert.equal(typeof mode.score, 'function');
                assert.equal(typeof mode.onTurnEnd, 'function');
            }
        });
    });

    describe('2. Scoring for each Mode', () => {
        const fakeRoom = {
            settings: { drawTime: 60 },
            wordToGuess: 'guitar',
            drawerId: 'player-1',
            records: new Map([
                ['player-1', { playerId: 'player-1', socketId: 's1', score: 0 }],
                ['player-2', { playerId: 'player-2', socketId: 's2', score: 0 }]
            ])
        };

        it('Classic mode scoring gives standard points and 10% drawer bonus', () => {
            const classic = getMode('classic');
            const guessScore = classic.score(fakeRoom, {
                type: 'guess',
                guesserId: 'player-2',
                timeLeft: 30,
                totalTime: 60,
                isFirstGuesser: false
            });
            // 50 + 450 * 0.5 = 275
            assert.equal(guessScore.points, 275);

            const bonus = classic.score(fakeRoom, {
                type: 'drawerBonus',
                drawerId: 'player-1',
                guesserGained: 275
            });
            assert.equal(bonus.points, 28); // round(27.5)
        });

        it('Speed mode scoring uses 30s base time', () => {
            const speed = getMode('speed');
            const guessScore = speed.score(fakeRoom, {
                type: 'guess',
                guesserId: 'player-2',
                timeLeft: 15,
                isFirstGuesser: false
            });
            // 50 + 450 * 0.5 = 275
            assert.equal(guessScore.points, 275);
        });

        it('Hard mode scoring awards 1.5x points for guesser and drawer', () => {
            const hard = getMode('hard');
            const guessScore = hard.score(fakeRoom, {
                type: 'guess',
                guesserId: 'player-2',
                timeLeft: 30,
                totalTime: 60,
                isFirstGuesser: false
            });
            // 275 * 1.5 = 412.5 -> 413
            assert.equal(guessScore.points, 413);

            const bonus = hard.score(fakeRoom, {
                type: 'drawerBonus',
                drawerId: 'player-1',
                guesserGained: 413
            });
            // round(413 * 0.1) = 41 * 1.5 = 61.5 -> 62
            assert.equal(bonus.points, 62);
        });

        it('Custom mode scoring applies scoreMultiplier setting', () => {
            const custom = getMode('custom');
            const customRoom = {
                ...fakeRoom,
                settings: { drawTime: 60, scoreMultiplier: 2.0 }
            };
            const guessScore = custom.score(customRoom, {
                type: 'guess',
                guesserId: 'player-2',
                timeLeft: 30,
                totalTime: 60,
                isFirstGuesser: false
            });
            // 275 * 2.0 = 550
            assert.equal(guessScore.points, 550);
        });

        it('Team mode scoring credits team score', () => {
            const team = getMode('team');
            const teamRoom = {
                ...fakeRoom,
                settings: { mode: 'team', teamCount: 2 },
                teamScores: { 'team-red': 0, 'team-blue': 0 }
            };
            assignPlayerToTeam(teamRoom, 'player-1', 'team-red');
            assignPlayerToTeam(teamRoom, 'player-2', 'team-red');

            const guessScore = team.score(teamRoom, {
                type: 'guess',
                guesserId: 'player-2',
                timeLeft: 30,
                totalTime: 60,
                isFirstGuesser: false
            });
            assert.equal(guessScore.points, 275);
            assert.equal(guessScore.teamId, 'team-red');
            assert.equal(teamRoom.teamScores['team-red'], 275);
        });

        it('Relay mode scoring splits score among all drawers plus guesser', () => {
            const relay = getMode('relay');
            const relayRoom = {
                ...fakeRoom,
                settings: { mode: 'relay' },
                drawerId: 'p1',
                relayContributors: new Set(['p1', 'p2', 'p3']),
                scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
                roundGained: {}
            };

            const result = relay.score(relayRoom, {
                type: 'guess',
                guesserId: 'p4',
                timeLeft: 10,
                isFirstGuesser: false
            });

            // 3 drawers + 1 guesser = 4 participants
            // 500 total points / 4 = 125 each
            assert.equal(result.splitCount, 4);
            assert.equal(result.points, 125);
            assert.equal(relayRoom.scores.p1, 125);
            assert.equal(relayRoom.scores.p2, 125);
            assert.equal(relayRoom.scores.p3, 125);
        });
    });

    describe('3. Turn Queues for each Mode', () => {
        it('Team mode alternates turns between teams (Red, Blue, Red, Blue)', () => {
            const team = getMode('team');
            const room = {
                settings: { mode: 'team', teamCount: 2 },
                records: new Map([
                    ['p1', { playerId: 'p1', status: 'connected', joinedAt: 100 }],
                    ['p2', { playerId: 'p2', status: 'connected', joinedAt: 200 }],
                    ['p3', { playerId: 'p3', status: 'connected', joinedAt: 300 }],
                    ['p4', { playerId: 'p4', status: 'connected', joinedAt: 400 }],
                ])
            };
            initTeams(room, 2);
            assignPlayerToTeam(room, 'p1', 'team-red');
            assignPlayerToTeam(room, 'p2', 'team-blue');
            assignPlayerToTeam(room, 'p3', 'team-red');
            assignPlayerToTeam(room, 'p4', 'team-blue');

            const queue = team.buildTurnQueue(room);
            assert.deepEqual(queue, ['p1', 'p2', 'p3', 'p4']);
            // p1 (Red), p2 (Blue), p3 (Red), p4 (Blue)
            assert.equal(getPlayerTeam(room, queue[0]), 'team-red');
            assert.equal(getPlayerTeam(room, queue[1]), 'team-blue');
            assert.equal(getPlayerTeam(room, queue[2]), 'team-red');
            assert.equal(getPlayerTeam(room, queue[3]), 'team-blue');
        });

        it('Relay never gives a player two segments in a row', () => {
            const relay = getMode('relay');
            const players = ['alice', 'bob', 'charlie'];
            const sequence = relay.buildRelaySequence(players, 10);

            assert.equal(sequence.length, 10);
            for (let i = 1; i < sequence.length; i++) {
                assert.notEqual(
                    sequence[i],
                    sequence[i - 1],
                    `Segment ${i} (${sequence[i]}) should not equal segment ${i - 1} (${sequence[i - 1]})`
                );
            }
        });

        it('Relay sequence with 2 players strictly alternates', () => {
            const relay = getMode('relay');
            const sequence = relay.buildRelaySequence(['p1', 'p2'], 6);
            assert.deepEqual(sequence, ['p1', 'p2', 'p1', 'p2', 'p1', 'p2']);
        });
    });

    describe('4. Team Guessing Rule: Team never lets an opposing team guess', () => {
        it('opposing team player typing exact word is disallowed from guessing', () => {
            const team = getMode('team');
            const room = {
                settings: { mode: 'team', teamCount: 2 },
                drawerId: 'red-drawer',
                wordToGuess: 'sunset',
                records: new Map([
                    ['red-drawer', { playerId: 'red-drawer', status: 'connected' }],
                    ['red-guesser', { playerId: 'red-guesser', status: 'connected' }],
                    ['blue-player', { playerId: 'blue-player', status: 'connected' }],
                ])
            };
            initTeams(room, 2);
            assignPlayerToTeam(room, 'red-drawer', 'team-red');
            assignPlayerToTeam(room, 'red-guesser', 'team-red');
            assignPlayerToTeam(room, 'blue-player', 'team-blue');

            // 1. Drawer cannot guess
            const drawerGuess = team.onGuess(room, 'red-drawer', 'sunset');
            assert.equal(drawerGuess.allowed, false);
            assert.equal(drawerGuess.reason, 'drawer');

            // 2. Opposing team member types the exact word -> REJECTED!
            const opposingGuess = team.onGuess(room, 'blue-player', 'sunset');
            assert.equal(opposingGuess.allowed, false);
            assert.equal(opposingGuess.isCorrect, false);
            assert.equal(opposingGuess.reason, 'opposing_team');

            // 3. Teammate types exact word -> ALLOWED & CORRECT!
            const teammateGuess = team.onGuess(room, 'red-guesser', 'sunset');
            assert.equal(teammateGuess.allowed, true);
            assert.equal(teammateGuess.isCorrect, true);
        });
    });

    describe('5. Mid-Game Join Rules per Mode', () => {
        it('Team mode assigns mid-game joiner to the smaller team', () => {
            const team = getMode('team');
            const room = {
                settings: { mode: 'team', teamCount: 2 },
                records: new Map([
                    ['p1', { playerId: 'p1', teamId: 'team-red' }],
                    ['p2', { playerId: 'p2', teamId: 'team-red' }],
                    ['p3', { playerId: 'p3', teamId: 'team-blue' }],
                ])
            };
            initTeams(room, 2);
            room.teams['team-red'].playerIds = ['p1', 'p2'];
            room.teams['team-blue'].playerIds = ['p3'];

            const result = team.canJoinMidGame(room, { playerId: 'p4' });
            assert.equal(result.allowed, true);
            assert.equal(result.teamId, 'team-blue'); // Blue had 1 player, Red had 2
            assert.equal(getPlayerTeam(room, 'p4'), 'team-blue');
        });

        it('Relay mode defers late joiner to the next relay', () => {
            const relay = getMode('relay');
            const room = {
                settings: { mode: 'relay' },
                nextRoundQueue: []
            };
            const result = relay.canJoinMidGame(room, { playerId: 'late-comer' });
            assert.equal(result.allowed, true);
            assert.equal(result.deferToNextRelay, true);
            assert.ok(room.nextRoundQueue.includes('late-comer'));
        });

        it('randomizeTeams distributes players evenly across teams', () => {
            const room = {
                records: new Map([
                    ['p1', { playerId: 'p1' }],
                    ['p2', { playerId: 'p2' }],
                    ['p3', { playerId: 'p3' }],
                    ['p4', { playerId: 'p4' }],
                ])
            };
            initTeams(room, 2);
            randomizeTeams(room);
            const redCount = room.teams['team-red'].playerIds.length;
            const blueCount = room.teams['team-blue'].playerIds.length;
            assert.equal(redCount, 2);
            assert.equal(blueCount, 2);
            assert.ok(getSmallerTeam(room));
        });
    });
});
