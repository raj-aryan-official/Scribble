const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const roomManager = require('../src/RoomManager');
const socketHandlers = require('../src/socketHandlers');
const {
    createPointBatcher,
    buildMidpointCurve,
    MIN_POINT_DISTANCE,
    MAX_POINTS_PER_STROKE
} = require('../../shared/canvasMath.cjs');

describe('Canvas Math & Point Batching Tests', () => {
    it('point batcher batches points and flushes them', async () => {
        const batches = [];
        const batcher = createPointBatcher({
            onBatch: (pts) => batches.push(pts),
            intervalMs: 40
        });

        // Add 3 points that exceed the min distance
        batcher.addPoint(0.1, 0.1);
        batcher.addPoint(0.15, 0.15);
        batcher.addPoint(0.2, 0.2);

        // Flushed points should be batched
        batcher.flush();
        assert.strictEqual(batches.length, 1);
        assert.strictEqual(batches[0].length, 3);
        assert.deepStrictEqual(batches[0][0], { x: 0.1, y: 0.1 });
        assert.deepStrictEqual(batches[0][2], { x: 0.2, y: 0.2 });
    });

    it('point batcher skips points closer than 0.002 apart', () => {
        const batches = [];
        const batcher = createPointBatcher({
            onBatch: (pts) => batches.push(pts),
            intervalMs: 40,
            minDistance: 0.002
        });

        // Point 1
        const p1 = batcher.addPoint(0.5, 0.5);
        assert.strictEqual(p1, true);

        // Point 2: distance = 0.0005 < 0.002 -> should be rejected/skipped
        const p2 = batcher.addPoint(0.5003, 0.5004);
        assert.strictEqual(p2, false);

        // Point 3: distance = 0.01 > 0.002 -> should be accepted
        const p3 = batcher.addPoint(0.51, 0.5);
        assert.strictEqual(p3, true);

        batcher.flush();
        assert.strictEqual(batches.length, 1);
        assert.strictEqual(batches[0].length, 2);
    });

    it('point batcher caps points at maxPoints (2000)', () => {
        const batches = [];
        const batcher = createPointBatcher({
            onBatch: (pts) => batches.push(pts),
            maxPoints: 5,
            minDistance: 0.001
        });

        for (let i = 0; i < 10; i++) {
            batcher.addPoint(i * 0.01, i * 0.01);
        }

        assert.strictEqual(batcher.getTotalPoints(), 5);
        batcher.flush();
        assert.strictEqual(batches[0].length, 5);
    });

    it('buildMidpointCurve handles empty, 1, 2, and multi-point strokes', () => {
        // Empty
        assert.deepStrictEqual(buildMidpointCurve([]), []);

        // 1 point: dot
        const dot = buildMidpointCurve([{ x: 0.5, y: 0.5 }]);
        assert.strictEqual(dot.length, 1);
        assert.strictEqual(dot[0].type, 'dot');
        assert.strictEqual(dot[0].x, 0.5);
        assert.strictEqual(dot[0].y, 0.5);

        // 2 points: move + line
        const twoPoints = buildMidpointCurve([
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.2 }
        ]);
        assert.strictEqual(twoPoints.length, 2);
        assert.strictEqual(twoPoints[0].type, 'move');
        assert.strictEqual(twoPoints[1].type, 'line');
        assert.strictEqual(twoPoints[1].x, 0.2);

        // 3 points: move, line to midpoint, quadratic to last midpoint, line to last point
        const threePoints = [
            { x: 0.0, y: 0.0 },
            { x: 0.2, y: 0.4 },
            { x: 0.4, y: 0.0 }
        ];
        const curve = buildMidpointCurve(threePoints);
        assert.strictEqual(curve.length, 4);
        assert.strictEqual(curve[0].type, 'move');
        assert.strictEqual(curve[0].x, 0.0);
        assert.strictEqual(curve[1].type, 'line');
        assert.strictEqual(curve[1].x, 0.1); // midpoint of (0,0) and (0.2, 0.4)
        assert.strictEqual(curve[1].y, 0.2);
        assert.strictEqual(curve[2].type, 'quadratic');
        assert.strictEqual(curve[2].cpX, 0.2);
        assert.strictEqual(curve[2].cpY, 0.4);
        assert.strictEqual(curve[2].x, 0.3); // midpoint of (0.2, 0.4) and (0.4, 0.0)
        assert.strictEqual(curve[2].y, 0.2);
        assert.strictEqual(curve[3].type, 'line');
        assert.strictEqual(curve[3].x, 0.4);
        assert.strictEqual(curve[3].y, 0.0);
    });

    it('buildMidpointCurve drops to plain line if more than 500 points', () => {
        const largePoints = [];
        for (let i = 0; i < 505; i++) {
            largePoints.push({ x: i / 1000, y: i / 1000 });
        }

        const cmds = buildMidpointCurve(largePoints);
        assert.strictEqual(cmds.length, 505);
        assert.strictEqual(cmds[0].type, 'move');
        // None should be quadratic
        const hasQuadratic = cmds.some(c => c.type === 'quadratic');
        assert.strictEqual(hasQuadratic, false);
        assert.strictEqual(cmds[1].type, 'line');
        assert.strictEqual(cmds[cmds.length - 1].type, 'line');
    });
});

describe('Live Stroke Streaming over TCP Wire', () => {
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
        roomManager.rooms.clear();
        if (ioServer) await ioServer.close();
        if (httpServer) await new Promise(r => httpServer.close(r));
    });

    it('streams STROKE_START, STROKE_POINTS, STROKE_END from drawer to guesser in <100ms', async () => {
        const ioClient = require('socket.io-client');
        const drawerSocket = ioClient(url, { transports: ['websocket'], forceNew: true });
        const guesserSocket = ioClient(url, { transports: ['websocket'], forceNew: true });

        await Promise.all([
            new Promise(r => drawerSocket.on('connect', r)),
            new Promise(r => guesserSocket.on('connect', r))
        ]);

        const roomCode = await new Promise(resolve => {
            drawerSocket.emit('createRoom', { username: 'DrawerHost' });
            drawerSocket.on('roomJoined', (room) => resolve(room.code));
        });

        await new Promise(resolve => {
            guesserSocket.emit('joinRoom', { roomCode, username: 'Guesser' });
            guesserSocket.on('roomJoined', () => resolve());
        });

        const room = roomManager.getRoom(roomCode);
        assert.ok(room);
        room.gameState = 'DRAWING';
        room.currentDrawerIndex = 0;
        room.wordToGuess = 'elephant';
        room.strokes = [];

        // Track received live stroke events on guesser socket
        const receivedStart = new Promise(resolve => {
            guesserSocket.on('strokeStart', (data) => resolve(data));
        });
        const receivedPoints = new Promise(resolve => {
            guesserSocket.on('strokePoints', (data) => resolve(data));
        });
        const receivedEnd = new Promise(resolve => {
            guesserSocket.on('strokeEnd', (data) => resolve(data));
        });

        const strokeId = 'test-stroke-live';

        // 1. Drawer emits STROKE_START
        const startTime = Date.now();
        drawerSocket.emit('strokeStart', {
            roomCode,
            id: strokeId,
            tool: 'pencil',
            color: '#3B82F6',
            size: 8,
            x: 0.1,
            y: 0.2
        });

        const startData = await receivedStart;
        assert.strictEqual(startData.id, strokeId);
        assert.strictEqual(startData.color, '#3B82F6');
        assert.strictEqual(startData.x, 0.1);

        // 2. Drawer emits batched STROKE_POINTS
        drawerSocket.emit('strokePoints', {
            roomCode,
            id: strokeId,
            points: [{ x: 0.15, y: 0.25 }, { x: 0.2, y: 0.3 }]
        });

        const pointsData = await receivedPoints;
        assert.strictEqual(pointsData.id, strokeId);
        assert.strictEqual(pointsData.points.length, 2);

        // 3. Drawer emits STROKE_END
        drawerSocket.emit('strokeEnd', {
            roomCode,
            id: strokeId
        });

        const endData = await receivedEnd;
        assert.strictEqual(endData.id, strokeId);

        const totalLatency = Date.now() - startTime;
        assert.ok(totalLatency < 200, `Streaming took ${totalLatency}ms, expected <200ms`);

        // Check room.strokes on server has the complete combined stroke
        assert.strictEqual(room.strokes.length, 1);
        assert.strictEqual(room.strokes[0].id, strokeId);
        assert.strictEqual(room.strokes[0].points.length, 3);

        drawerSocket.disconnect();
        guesserSocket.disconnect();
    });
});
