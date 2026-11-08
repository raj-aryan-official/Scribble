const { EVENTS, GAME_STATES } = require('../../../shared/types.cjs');
const { rejectWithError, getMemberRoom, isDrawer } = require('./utils');
const { canDraw } = require('../game/machine');

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

        stroke.seq = ++room.strokeSeq;
        stroke.turnId = room.currentTurnId;
        resetAfk(room);

        room.strokes.push(stroke);
        socket.to(room.code).emit(EVENTS.STROKE_RECEIVED, stroke);
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
        const tool = payload.tool === 'eraser' ? 'eraser' : 'pencil';
        const color = typeof payload.color === 'string' ? payload.color.slice(0, 32) : '#000000';
        const size = typeof payload.size === 'number' && payload.size > 0 ? Math.min(100, payload.size) : 5;

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
            stroke.points.push(...pointsToAdd);
            socket.to(room.code).emit(EVENTS.STROKE_POINTS, {
                id,
                points: pointsToAdd
            });
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
        if (room.strokes.length > 0) {
            const removedStroke = room.strokes.pop();
            io.to(room.code).emit(EVENTS.STROKE_UNDONE, { strokeId: removedStroke?.id });
        }
    });
}

module.exports = { registerDrawingHandlers };
