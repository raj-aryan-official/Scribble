const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { rejectWithError, getMemberRoom, isDrawer } = require('./utils');
const { canDraw } = require('../game/machine');
const {
    validateStrokeForTwist,
    validateUndoForTwist,
    refundInkOnUndo,
    calculateInkCost,
    createMirroredStroke
} = require('../game/twists');

function registerDrawingHandlers(io, socket, safeOn) {
    function resetAfk(room) {
        if (!room) return;
        const drawerRec = room.records
            ? (room.records.get(room.drawerId) || Array.from(room.records.values()).find(r => r.socketId === socket.id))
            : null;
        if (drawerRec) {
            drawerRec.consecutiveAutoPicks = 0;
            drawerRec.isAfkSkipped = false;
        }
    }

    safeOn(EVENTS.DRAW_STROKE, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isDrawer(room, socket)) {
            return rejectWithError(socket, 'Only the drawer can draw');
        }
        if (!canDraw(room)) {
            return rejectWithError(socket, 'Drawing is not active');
        }
        // E20: Turn ID check
        if (payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId) {
            return rejectWithError(socket, 'Stale turn ID', 'STALE_TURN');
        }
        const stroke = payload.stroke;
        if (!stroke || typeof stroke !== 'object' || !Array.isArray(stroke.points)) {
            return rejectWithError(socket, 'Invalid stroke data');
        }
        // E12: Drop stroke whose id it already has
        if (stroke.id && room.strokes.some(s => s.id === stroke.id)) {
            return;
        }
        if (stroke.points.length > 2000) {
            return rejectWithError(socket, 'Points per stroke limit exceeded (max 2000)');
        }
        if (room.strokes.length >= 3000) {
            return rejectWithError(socket, 'Room stroke limit reached (max 3000)');
        }

        const twistCheck = validateStrokeForTwist(room, stroke);
        if (!twistCheck.valid) {
            return rejectWithError(socket, twistCheck.error, twistCheck.code);
        }

        stroke.seq = ++room.strokeSeq;
        stroke.turnId = room.currentTurnId;
        resetAfk(room);

        room.strokes.push(stroke);
        socket.to(room.code).emit(EVENTS.STROKE_RECEIVED, stroke);

        if (room.currentTwist?.id === 'mirror') {
            const mirrorStroke = createMirroredStroke(stroke);
            if (mirrorStroke) {
                mirrorStroke.seq = ++room.strokeSeq;
                mirrorStroke.turnId = room.currentTurnId;
                room.strokes.push(mirrorStroke);
                socket.to(room.code).emit(EVENTS.STROKE_RECEIVED, mirrorStroke);
            }
        }
    });

    safeOn(EVENTS.STROKE_START, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isDrawer(room, socket)) {
            return rejectWithError(socket, 'Only the drawer can draw');
        }
        if (!canDraw(room)) {
            return rejectWithError(socket, 'Drawing is not active');
        }
        // E20: Turn ID check
        if (payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId) {
            return rejectWithError(socket, 'Stale turn ID', 'STALE_TURN');
        }
        const id = typeof payload.id === 'string' ? payload.id.trim() : null;
        if (!id) {
            return rejectWithError(socket, 'Invalid stroke ID');
        }
        // E12: Drop duplicate stroke ID
        if (room.strokes.some(s => s.id === id)) {
            return;
        }
        if (room.strokes.length >= 3000) {
            return rejectWithError(socket, 'Room stroke limit reached (max 3000)');
        }
        const x = typeof payload.x === 'number' && Number.isFinite(payload.x) ? Math.max(0, Math.min(1, payload.x)) : 0;
        const y = typeof payload.y === 'number' && Number.isFinite(payload.y) ? Math.max(0, Math.min(1, payload.y)) : 0;
        const tool = payload.tool === 'eraser' || payload.tool === 'fill' ? payload.tool : 'pencil';
        const color = typeof payload.color === 'string' ? payload.color.slice(0, 32) : '#000000';
        const size = typeof payload.size === 'number' && payload.size > 0 ? Math.min(100, payload.size) : 5;

        const twistCheck = validateStrokeForTwist(room, { tool, color, size, points: [{ x, y }] });
        if (!twistCheck.valid) {
            return rejectWithError(socket, twistCheck.error, twistCheck.code);
        }

        resetAfk(room);

        const stroke = {
            id,
            seq: ++room.strokeSeq,
            turnId: room.currentTurnId,
            tool,
            color,
            size,
            points: [{ x, y }]
        };
        room.strokes.push(stroke);

        socket.to(room.code).emit(EVENTS.STROKE_START, {
            id,
            seq: stroke.seq,
            tool,
            color,
            size,
            x,
            y
        });

        if (room.currentTwist?.id === 'mirror') {
            const mirrorX = Math.max(0, Math.min(1, 1 - x));
            const mirrorStroke = {
                id: `${id}-m`,
                isMirror: true,
                seq: ++room.strokeSeq,
                turnId: room.currentTurnId,
                tool,
                color,
                size,
                points: [{ x: mirrorX, y }]
            };
            room.strokes.push(mirrorStroke);

            socket.to(room.code).emit(EVENTS.STROKE_START, {
                id: `${id}-m`,
                seq: mirrorStroke.seq,
                tool,
                color,
                size,
                x: mirrorX,
                y
            });
        }
    });

    safeOn(EVENTS.STROKE_POINTS, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isDrawer(room, socket)) {
            return rejectWithError(socket, 'Only the drawer can draw');
        }
        if (!canDraw(room)) {
            return rejectWithError(socket, 'Drawing is not active');
        }
        // E20: Turn ID check
        if (payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId) {
            return rejectWithError(socket, 'Stale turn ID', 'STALE_TURN');
        }
        const id = typeof payload.id === 'string' ? payload.id.trim() : null;
        if (!id || !Array.isArray(payload.points) || payload.points.length === 0) {
            return rejectWithError(socket, 'Invalid stroke points payload');
        }
        const stroke = room.strokes.find(s => s.id === id);
        if (!stroke) {
            return rejectWithError(socket, 'Stroke not found');
        }

        const validPoints = [];
        for (const pt of payload.points) {
            if (pt && typeof pt.x === 'number' && typeof pt.y === 'number' && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
                validPoints.push({
                    x: Math.max(0, Math.min(1, pt.x)),
                    y: Math.max(0, Math.min(1, pt.y))
                });
            }
        }

        const remainingCapacity = Math.max(0, 2000 - stroke.points.length);
        const pointsToAdd = validPoints.slice(0, remainingCapacity);
        if (pointsToAdd.length > 0) {
            if (room.currentTwist?.id === 'limited-ink') {
                if (stroke.tool !== 'eraser') {
                    const cost = calculateInkCost(pointsToAdd, stroke.tool);
                    const remaining = room.turnInkRemaining ?? 1200;
                    if (cost > remaining) {
                        return rejectWithError(socket, 'Out of ink', 'OUT_OF_INK');
                    }
                    room.turnInkRemaining = Math.max(0, remaining - cost);
                    stroke.inkCost = (stroke.inkCost || 0) + cost;
                }
            }

            stroke.points.push(...pointsToAdd);
            socket.to(room.code).emit(EVENTS.STROKE_POINTS, {
                id,
                points: pointsToAdd
            });

            if (room.currentTwist?.id === 'mirror') {
                const mirrorStroke = room.strokes.find(s => s.id === `${id}-m`);
                if (mirrorStroke) {
                    const mirrorPoints = pointsToAdd.map(pt => ({
                        x: Math.max(0, Math.min(1, 1 - pt.x)),
                        y: pt.y
                    }));
                    mirrorStroke.points.push(...mirrorPoints);
                    socket.to(room.code).emit(EVENTS.STROKE_POINTS, {
                        id: `${id}-m`,
                        points: mirrorPoints
                    });
                }
            }
        }
    });

    safeOn(EVENTS.STROKE_END, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isDrawer(room, socket)) {
            return rejectWithError(socket, 'Only the drawer can draw');
        }
        if (!canDraw(room)) {
            return rejectWithError(socket, 'Drawing is not active');
        }
        // E20: Turn ID check
        if (payload.turnId && room.currentTurnId && payload.turnId !== room.currentTurnId) {
            return rejectWithError(socket, 'Stale turn ID', 'STALE_TURN');
        }
        const id = typeof payload.id === 'string' ? payload.id.trim() : null;
        if (!id) {
            return rejectWithError(socket, 'Invalid stroke ID');
        }
        socket.to(room.code).emit(EVENTS.STROKE_END, { id });
        if (room.currentTwist?.id === 'mirror') {
            socket.to(room.code).emit(EVENTS.STROKE_END, { id: `${id}-m` });
        }
    });

    safeOn(EVENTS.CLEAR_CANVAS, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isDrawer(room, socket)) {
            return rejectWithError(socket, 'Only the drawer can clear canvas');
        }
        if (!canDraw(room)) {
            return rejectWithError(socket, 'Drawing is not active');
        }
        if (room.currentTwist?.id === 'no-undo-eraser') {
            return rejectWithError(socket, 'Clearing canvas is disabled in No undo or eraser twist', 'TWIST_NO_UNDO_VIOLATION');
        }
        room.strokes = [];
        io.to(room.code).emit(EVENTS.CANVAS_CLEARED);
    });

    safeOn(EVENTS.UNDO_STROKE, (payload) => {
        if (!payload || typeof payload !== 'object') {
            return rejectWithError(socket, 'Invalid payload');
        }
        const room = getMemberRoom(socket, payload.roomCode);
        if (!room) {
            return rejectWithError(socket, 'Not a member of this room');
        }
        if (!isDrawer(room, socket)) {
            return rejectWithError(socket, 'Only the drawer can undo strokes');
        }
        if (!canDraw(room)) {
            return rejectWithError(socket, 'Drawing is not active');
        }
        const undoCheck = validateUndoForTwist(room);
        if (!undoCheck.valid) {
            return rejectWithError(socket, undoCheck.error, undoCheck.code);
        }
        if (room.strokes.length > 0) {
            const last = room.strokes[room.strokes.length - 1];
            if (last?.isMirror) {
                const mirrorStroke = room.strokes.pop();
                const origStroke = room.strokes.pop();
                refundInkOnUndo(room, origStroke);
                io.to(room.code).emit(EVENTS.STROKE_UNDONE, { strokeId: mirrorStroke?.id });
                io.to(room.code).emit(EVENTS.STROKE_UNDONE, { strokeId: origStroke?.id });
            } else {
                const removedStroke = room.strokes.pop();
                refundInkOnUndo(room, removedStroke);
                io.to(room.code).emit(EVENTS.STROKE_UNDONE, { strokeId: removedStroke?.id });
            }
        }
    });
}

module.exports = { registerDrawingHandlers };
