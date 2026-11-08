const crypto = require('crypto');
const { TWIST_IDS, TWIST_DEFINITIONS } = require('../../../shared/types.cjs');

// Vibrant palette for one-colour twist (excluding white/erasers)
const ONE_COLOUR_PALETTE = [
    '#1C1B18', // Ink Black
    '#5B5649', // Graphite
    '#E4472B', // Tomato Red
    '#C93A20', // Rust Red
    '#F6B72C', // Marigold Yellow
    '#E69112', // Amber Orange
    '#2E9E6B', // Leaf Green
    '#1F7A50', // Forest Green
    '#2F4FD8', // Cobalt Blue
    '#1D3299', // Navy Blue
    '#8D4BE5'  // Violet Purple
];

const TOTAL_INK_BUDGET = 1200;

function selectTwistForTurn(room) {
    if (!room || !room.settings) return null;
    const mode = room.settings.twists || 'off';
    if (mode === 'off') {
        return null;
    }
    if (mode === 'sometimes') {
        const roll = crypto.randomInt(0, 100);
        if (roll >= 30) {
            return null;
        }
    } else if (mode !== 'every') {
        return null;
    }

    const enabled = (Array.isArray(room.settings.enabledTwists) && room.settings.enabledTwists.length > 0)
        ? room.settings.enabledTwists.filter(id => TWIST_IDS.includes(id))
        : TWIST_IDS;

    if (enabled.length === 0) {
        return null;
    }

    const selectedId = enabled[crypto.randomInt(0, enabled.length)];
    const def = TWIST_DEFINITIONS[selectedId];
    if (!def) return null;

    const twist = {
        id: def.id,
        name: def.name,
        rule: def.rule,
        badge: def.badge,
        icon: def.icon
    };

    if (twist.id === 'one-colour') {
        const colorIdx = crypto.randomInt(0, ONE_COLOUR_PALETTE.length);
        twist.color = ONE_COLOUR_PALETTE[colorIdx];
    } else if (twist.id === 'limited-ink') {
        twist.totalInk = TOTAL_INK_BUDGET;
        twist.remainingInk = TOTAL_INK_BUDGET;
        room.turnInkRemaining = TOTAL_INK_BUDGET;
    }

    return twist;
}

function calculateStrokeDistance(points) {
    if (!Array.isArray(points) || points.length === 0) return 0;
    if (points.length === 1) return 0.005;
    let dist = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = (points[i].x ?? 0) - (points[i - 1].x ?? 0);
        const dy = (points[i].y ?? 0) - (points[i - 1].y ?? 0);
        dist += Math.sqrt(dx * dx + dy * dy);
    }
    return dist;
}

function calculateInkCost(points, tool) {
    if (tool === 'eraser') return 0;
    const dist = calculateStrokeDistance(points);
    return Math.max(1, Math.round(dist * 1000));
}

function validateStrokeForTwist(room, stroke) {
    if (!room || !room.currentTwist || !stroke) {
        return { valid: true };
    }
    const twist = room.currentTwist;

    if (twist.id === 'one-colour') {
        if (stroke.tool !== 'eraser') {
            const strokeColor = (stroke.color || '').trim().toLowerCase();
            const twistColor = (twist.color || '').trim().toLowerCase();
            if (strokeColor !== twistColor) {
                return {
                    valid: false,
                    error: `Only color ${twist.color} is allowed in this twist`,
                    code: 'TWIST_ONE_COLOUR_VIOLATION'
                };
            }
        }
    } else if (twist.id === 'no-undo-eraser') {
        if (stroke.tool === 'eraser') {
            return {
                valid: false,
                error: 'Eraser is disabled in this twist',
                code: 'TWIST_NO_ERASER_VIOLATION'
            };
        }
    } else if (twist.id === 'thin-line') {
        if (typeof stroke.size === 'number' && stroke.size !== 2) {
            return {
                valid: false,
                error: 'Brush size must be 2 in thin-line twist',
                code: 'TWIST_THIN_LINE_VIOLATION'
            };
        }
    } else if (twist.id === 'limited-ink') {
        if (stroke.tool !== 'eraser') {
            const cost = calculateInkCost(stroke.points, stroke.tool);
            const remaining = room.turnInkRemaining ?? TOTAL_INK_BUDGET;
            if (cost > remaining) {
                return {
                    valid: false,
                    error: 'Out of ink',
                    code: 'OUT_OF_INK'
                };
            }
            room.turnInkRemaining = Math.max(0, remaining - cost);
            stroke.inkCost = cost;
        } else {
            stroke.inkCost = 0;
        }
    } else if (twist.id === 'wobbly-pen') {
        if (Array.isArray(stroke.points)) {
            for (let i = 0; i < stroke.points.length; i++) {
                const pt = stroke.points[i];
                if (pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1) {
                    return {
                        valid: false,
                        error: 'Point coordinates out of bounds',
                        code: 'OUT_OF_BOUNDS'
                    };
                }
                if (i > 0) {
                    const prev = stroke.points[i - 1];
                    const dist = Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
                    if (dist > 0.5) {
                        return {
                            valid: false,
                            error: 'Point distance exceeds maximum allowed jump',
                            code: 'POINT_STEP_TOO_LARGE'
                        };
                    }
                }
            }
        }
    }

    return { valid: true };
}

function validateUndoForTwist(room) {
    if (!room || !room.currentTwist) {
        return { valid: true };
    }
    if (room.currentTwist.id === 'no-undo-eraser') {
        return {
            valid: false,
            error: 'Undo is disabled in this twist',
            code: 'TWIST_NO_UNDO_VIOLATION'
        };
    }
    return { valid: true };
}

function refundInkOnUndo(room, removedStroke) {
    if (!room || room.currentTwist?.id !== 'limited-ink' || !removedStroke) return;
    const refund = removedStroke.inkCost || 0;
    if (refund > 0) {
        room.turnInkRemaining = Math.min(TOTAL_INK_BUDGET, (room.turnInkRemaining ?? 0) + refund);
    }
}

function createMirroredStroke(stroke) {
    if (!stroke || typeof stroke !== 'object') return null;
    return {
        ...stroke,
        id: `${stroke.id}-m`,
        isMirror: true,
        points: Array.isArray(stroke.points)
            ? stroke.points.map(p => ({
                x: Math.max(0, Math.min(1, 1 - p.x)),
                y: p.y
            }))
            : []
    };
}

module.exports = {
    ONE_COLOUR_PALETTE,
    TOTAL_INK_BUDGET,
    selectTwistForTurn,
    calculateStrokeDistance,
    calculateInkCost,
    validateStrokeForTwist,
    validateUndoForTwist,
    refundInkOnUndo,
    createMirroredStroke
};

