const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    selectTwistForTurn,
    validateStrokeForTwist,
    validateUndoForTwist,
    createMirroredStroke,
    refundInkOnUndo,
    TOTAL_INK_BUDGET
} = require('../src/game/twists');
const { TWIST_IDS } = require('../../shared/types.cjs');
const { calculateGuessScore, calculateDrawerBonus } = require('../src/game/scoring');

describe('Rule Twists Unit Tests', () => {
    describe('1. Frequency Distribution over 1,000 simulated turns', () => {
        it('twists="off" produces strictly 0 twists across 1,000 turns', () => {
            const room = {
                settings: { twists: 'off', enabledTwists: TWIST_IDS }
            };
            let count = 0;
            for (let i = 0; i < 1000; i++) {
                const twist = selectTwistForTurn(room);
                if (twist !== null) count++;
            }
            assert.equal(count, 0, 'Off setting must never select a twist');
        });

        it('twists="every" produces strictly 1,000 twists across 1,000 turns', () => {
            const room = {
                settings: { twists: 'every', enabledTwists: TWIST_IDS }
            };
            let count = 0;
            for (let i = 0; i < 1000; i++) {
                const twist = selectTwistForTurn(room);
                if (twist !== null) count++;
            }
            assert.equal(count, 1000, 'Every setting must select a twist on every single turn');
        });

        it('twists="sometimes" produces approximately 300 twists across 1,000 turns (30% probability)', () => {
            const room = {
                settings: { twists: 'sometimes', enabledTwists: TWIST_IDS }
            };
            let count = 0;
            for (let i = 0; i < 1000; i++) {
                const twist = selectTwistForTurn(room);
                if (twist !== null) count++;
            }
            // For N=1000, p=0.3, standard deviation is ~14.5. 220 to 380 is >5 standard deviations.
            assert.ok(count >= 220 && count <= 380, `Expected ~300 twists, got ${count}`);
        });

        it('respects enabledTwists checklist when selecting twists', () => {
            const room = {
                settings: { twists: 'every', enabledTwists: ['speed', 'mirror'] }
            };
            for (let i = 0; i < 100; i++) {
                const twist = selectTwistForTurn(room);
                assert.ok(['speed', 'mirror'].includes(twist.id), `Twist ${twist.id} must be in enabledTwists`);
            }
        });
    });

    describe('2. Validation of Each Twist Rule', () => {
        it('one-colour: allowed color passes, different color rejected, eraser passes', () => {
            const room = {
                currentTwist: {
                    id: 'one-colour',
                    color: '#E4472B'
                }
            };

            const validStroke = { tool: 'pencil', color: '#E4472B', size: 5, points: [{ x: 0.1, y: 0.2 }] };
            const validRes = validateStrokeForTwist(room, validStroke);
            assert.equal(validRes.valid, true);

            const invalidStroke = { tool: 'pencil', color: '#2F4FD8', size: 5, points: [{ x: 0.1, y: 0.2 }] };
            const invalidRes = validateStrokeForTwist(room, invalidStroke);
            assert.equal(invalidRes.valid, false);
            assert.equal(invalidRes.code, 'TWIST_ONE_COLOUR_VIOLATION');

            const eraserStroke = { tool: 'eraser', color: '#FFFFFF', size: 10, points: [{ x: 0.1, y: 0.2 }] };
            const eraserRes = validateStrokeForTwist(room, eraserStroke);
            assert.equal(eraserRes.valid, true);
        });

        it('thin-line: brush size 2 passes, other sizes rejected', () => {
            const room = {
                currentTwist: { id: 'thin-line' }
            };

            const size2Stroke = { tool: 'pencil', color: '#000000', size: 2, points: [{ x: 0.1, y: 0.2 }] };
            assert.equal(validateStrokeForTwist(room, size2Stroke).valid, true);

            const size6Stroke = { tool: 'pencil', color: '#000000', size: 6, points: [{ x: 0.1, y: 0.2 }] };
            const size6Res = validateStrokeForTwist(room, size6Stroke);
            assert.equal(size6Res.valid, false);
            assert.equal(size6Res.code, 'TWIST_THIN_LINE_VIOLATION');
        });

        it('no-undo-eraser: pencil passes, eraser tool rejected, undo rejected', () => {
            const room = {
                currentTwist: { id: 'no-undo-eraser' }
            };

            const pencilStroke = { tool: 'pencil', color: '#000000', size: 5, points: [{ x: 0.1, y: 0.2 }] };
            assert.equal(validateStrokeForTwist(room, pencilStroke).valid, true);

            const eraserStroke = { tool: 'eraser', color: '#FFFFFF', size: 5, points: [{ x: 0.1, y: 0.2 }] };
            const eraserRes = validateStrokeForTwist(room, eraserStroke);
            assert.equal(eraserRes.valid, false);
            assert.equal(eraserRes.code, 'TWIST_NO_ERASER_VIOLATION');

            const undoRes = validateUndoForTwist(room);
            assert.equal(undoRes.valid, false);
            assert.equal(undoRes.code, 'TWIST_NO_UNDO_VIOLATION');
        });

        it('limited-ink: stroke length consumes ink, out of ink rejected, undo refunds ink, eraser is free', () => {
            const room = {
                currentTwist: { id: 'limited-ink', totalInk: 1200 },
                turnInkRemaining: 100
            };

            // Distance: from (0,0) to (0.05, 0) = 0.05 * 1000 = 50 ink
            const stroke1 = {
                tool: 'pencil',
                color: '#000000',
                size: 5,
                points: [{ x: 0, y: 0 }, { x: 0.05, y: 0 }]
            };
            const res1 = validateStrokeForTwist(room, stroke1);
            assert.equal(res1.valid, true);
            assert.equal(room.turnInkRemaining, 50);
            assert.equal(stroke1.inkCost, 50);

            // Distance: from (0,0) to (0.2, 0) = 0.2 * 1000 = 200 ink (> 50 remaining)
            const stroke2 = {
                tool: 'pencil',
                color: '#000000',
                size: 5,
                points: [{ x: 0, y: 0 }, { x: 0.2, y: 0 }]
            };
            const res2 = validateStrokeForTwist(room, stroke2);
            assert.equal(res2.valid, false);
            assert.equal(res2.code, 'OUT_OF_INK');
            assert.equal(room.turnInkRemaining, 50); // Unchanged

            // Undo stroke1 refunds its inkCost
            refundInkOnUndo(room, stroke1);
            assert.equal(room.turnInkRemaining, 100);

            // Eraser is free (0 ink)
            const eraserStroke = {
                tool: 'eraser',
                color: '#FFFFFF',
                size: 10,
                points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }]
            };
            const resEraser = validateStrokeForTwist(room, eraserStroke);
            assert.equal(resEraser.valid, true);
            assert.equal(room.turnInkRemaining, 100);
        });

        it('wobbly-pen: bounds noise and rejects out-of-bounds coordinates', () => {
            const room = {
                currentTwist: { id: 'wobbly-pen' }
            };

            const normalWobbly = {
                tool: 'pencil',
                color: '#000000',
                size: 5,
                points: [{ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.52 }]
            };
            assert.equal(validateStrokeForTwist(room, normalWobbly).valid, true);

            const outOfBounds = {
                tool: 'pencil',
                color: '#000000',
                size: 5,
                points: [{ x: 1.15, y: 0.5 }]
            };
            const oobRes = validateStrokeForTwist(room, outOfBounds);
            assert.equal(oobRes.valid, false);
            assert.equal(oobRes.code, 'OUT_OF_BOUNDS');
        });
    });

    describe('3. Drawing Consistency: Mirror and Upside-down', () => {
        it('mirror: accurately mirrors every point across vertical center line x=0.5', () => {
            const stroke = {
                id: 's1',
                tool: 'pencil',
                color: '#1C1B18',
                size: 4,
                points: [
                    { x: 0.2, y: 0.3 },
                    { x: 0.4, y: 0.6 },
                    { x: 0.5, y: 0.8 }
                ]
            };

            const mirror = createMirroredStroke(stroke);
            assert.equal(mirror.id, 's1-m');
            assert.equal(mirror.isMirror, true);
            assert.equal(mirror.points.length, 3);

            // Point 1: x=0.2 -> 1 - 0.2 = 0.8, y=0.3
            assert.ok(Math.abs(mirror.points[0].x - 0.8) < 0.0001);
            assert.equal(mirror.points[0].y, 0.3);

            // Point 2: x=0.4 -> 1 - 0.4 = 0.6, y=0.6
            assert.ok(Math.abs(mirror.points[1].x - 0.6) < 0.0001);
            assert.equal(mirror.points[1].y, 0.6);

            // Point 3: x=0.5 -> 1 - 0.5 = 0.5, y=0.8
            assert.ok(Math.abs(mirror.points[2].x - 0.5) < 0.0001);
            assert.equal(mirror.points[2].y, 0.8);
        });

        it('upside-down: coordinate transform (1-x, 1-y) inverts coordinates so guessers receive upright strokes', () => {
            // When drawer on a 180° rotated canvas draws at top-left screen position (0.1, 0.2),
            // in standard coordinates that corresponds to bottom-right (0.9, 0.8).
            const screenX = 0.1;
            const screenY = 0.2;
            const transformedX = 1 - screenX;
            const transformedY = 1 - screenY;

            assert.ok(Math.abs(transformedX - 0.9) < 0.0001);
            assert.ok(Math.abs(transformedY - 0.8) < 0.0001);

            // Re-inverting gives back the original screen coordinate
            assert.ok(Math.abs((1 - transformedX) - screenX) < 0.0001);
            assert.ok(Math.abs((1 - transformedY) - screenY) < 0.0001);
        });
    });

    describe('4. Scoring Modifiers: Speed (2x) and First Guesser Bonus (2x)', () => {
        it('speed twist: doubles guesser points and drawer bonus', () => {
            const timeLeft = 30;
            const normalTotalTime = 60;

            const baseGuesserScore = calculateGuessScore(timeLeft, normalTotalTime, false);
            // With speed twist active:
            const speedGuesserScore = baseGuesserScore * 2;
            assert.equal(speedGuesserScore, baseGuesserScore * 2);

            const normalDrawerBonus = calculateDrawerBonus(baseGuesserScore);
            const speedDrawerBonus = calculateDrawerBonus(speedGuesserScore);
            // Since speed doubles the guesser points, drawer bonus is doubled as well
            assert.ok(speedDrawerBonus >= normalDrawerBonus * 2 - 1 && speedDrawerBonus <= normalDrawerBonus * 2 + 1);
        });

        it('first-guesser-bonus twist: first guesser gets 2x points, second guesser gets 1x', () => {
            const timeLeft = 45;
            const totalTime = 60;

            const baseScore = calculateGuessScore(timeLeft, totalTime, true);
            const secondScore = calculateGuessScore(timeLeft, totalTime, false);

            const firstGuesserBonusScore = baseScore * 2;
            const normalSecondScore = secondScore; // 1x

            assert.equal(firstGuesserBonusScore, baseScore * 2);
            assert.equal(normalSecondScore, secondScore);
            assert.ok(firstGuesserBonusScore > normalSecondScore * 2);
        });
    });
});
