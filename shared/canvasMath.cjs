/**
 * Canvas geometry and streaming math utilities
 */

const MIN_POINT_DISTANCE = 0.002;
const MAX_POINTS_PER_STROKE = 2000;
const HIGH_POINT_THRESHOLD = 500;
const BATCH_INTERVAL_MS = 40;

const round6 = (num) => Math.round(num * 1e6) / 1e6;

function shouldAcceptPoint(lastPoint, newPoint, minDistance = MIN_POINT_DISTANCE) {
    if (!lastPoint) return true;
    const dx = newPoint.x - lastPoint.x;
    const dy = newPoint.y - lastPoint.y;
    return Math.hypot(dx, dy) >= minDistance;
}

function buildMidpointCurve(points) {
    if (!Array.isArray(points) || points.length === 0) {
        return [];
    }

    if (points.length === 1) {
        return [{ type: 'dot', x: round6(points[0].x), y: round6(points[0].y) }];
    }

    // Performance guardrail: drop to plain line if more than 500 points
    if (points.length > HIGH_POINT_THRESHOLD) {
        const commands = [{ type: 'move', x: round6(points[0].x), y: round6(points[0].y) }];
        for (let i = 1; i < points.length; i++) {
            commands.push({ type: 'line', x: round6(points[i].x), y: round6(points[i].y) });
        }
        return commands;
    }

    if (points.length === 2) {
        return [
            { type: 'move', x: round6(points[0].x), y: round6(points[0].y) },
            { type: 'line', x: round6(points[1].x), y: round6(points[1].y) }
        ];
    }

    const commands = [];
    commands.push({ type: 'move', x: round6(points[0].x), y: round6(points[0].y) });

    // Line to the first midpoint
    const m1 = {
        x: round6((points[0].x + points[1].x) / 2),
        y: round6((points[0].y + points[1].y) / 2)
    };
    commands.push({ type: 'line', x: m1.x, y: m1.y });

    // Quadratic curve through each subsequent midpoint
    for (let i = 1; i < points.length - 1; i++) {
        const nextMid = {
            x: round6((points[i].x + points[i + 1].x) / 2),
            y: round6((points[i].y + points[i + 1].y) / 2)
        };
        commands.push({
            type: 'quadratic',
            cpX: round6(points[i].x),
            cpY: round6(points[i].y),
            x: nextMid.x,
            y: nextMid.y
        });
    }

    // Line to the final point
    const last = points[points.length - 1];
    commands.push({ type: 'line', x: round6(last.x), y: round6(last.y) });

    return commands;
}

function createPointBatcher(options = {}) {
    const onBatch = typeof options.onBatch === 'function' ? options.onBatch : () => {};
    const intervalMs = typeof options.intervalMs === 'number' ? options.intervalMs : BATCH_INTERVAL_MS;
    const minDistance = typeof options.minDistance === 'number' ? options.minDistance : MIN_POINT_DISTANCE;
    const maxPoints = typeof options.maxPoints === 'number' ? options.maxPoints : MAX_POINTS_PER_STROKE;

    let buffer = [];
    let lastPoint = null;
    let totalPoints = 0;
    let timer = null;
    let lastFlushTime = Date.now();

    const flush = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        if (buffer.length === 0) return;
        const toSend = buffer;
        buffer = [];
        lastFlushTime = Date.now();
        onBatch(toSend);
    };

    const addPoint = (x, y) => {
        if (totalPoints >= maxPoints) {
            return false;
        }

        const candidate = { x: round6(x), y: round6(y) };
        if (lastPoint && !shouldAcceptPoint(lastPoint, candidate, minDistance)) {
            return false;
        }

        buffer.push(candidate);
        lastPoint = candidate;
        totalPoints++;

        const now = Date.now();
        const elapsed = now - lastFlushTime;

        if (elapsed >= intervalMs) {
            flush();
        } else if (!timer) {
            timer = setTimeout(flush, Math.max(1, intervalMs - elapsed));
        }

        return true;
    };

    const reset = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        buffer = [];
        lastPoint = null;
        totalPoints = 0;
        lastFlushTime = Date.now();
    };

    return {
        addPoint,
        flush,
        reset,
        getTotalPoints: () => totalPoints,
        getPendingCount: () => buffer.length
    };
}

module.exports = {
    MIN_POINT_DISTANCE,
    MAX_POINTS_PER_STROKE,
    HIGH_POINT_THRESHOLD,
    BATCH_INTERVAL_MS,
    shouldAcceptPoint,
    buildMidpointCurve,
    createPointBatcher
};
