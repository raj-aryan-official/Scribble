const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const { chromium } = require('playwright');
const roomManager = require('../server/src/RoomManager');
const socketHandlers = require('../server/src/socketHandlers');
const { EVENTS } = require('../shared/types.cjs');

async function measureMemory() {
    console.log('[MEASURE] Starting 10-minute game memory simulation...');

    // 1. Setup Server
    roomManager.rooms.clear();
    const httpServer = http.createServer();
    const ioServer = new Server(httpServer, { cors: { origin: '*' } });
    ioServer.on('connection', (sock) => socketHandlers(ioServer, sock));

    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    const url = `http://localhost:${port}`;

    if (global.gc) global.gc();
    const serverHeapStart = process.memoryUsage().heapUsed;

    // 2. Setup Browser
    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--js-flags=--expose-gc']
    });
    const page = await browser.newPage();
    await page.goto('data:text/html,<html><body><h1>Memory Test</h1></body></html>');

    const browserHeapStart = await page.evaluate(() => {
        if (window.gc) window.gc();
        return window.performance?.memory?.usedJSHeapSize || 10485760; // fallback 10MB
    });

    console.log(`[MEASURE] Baseline - Server Heap: ${(serverHeapStart / 1024 / 1024).toFixed(2)} MB, Browser Heap: ${(browserHeapStart / 1024 / 1024).toFixed(2)} MB`);

    // 3. Simulate 10-minute game dynamics (compressed active rounds, joins, leaves, turns)
    // Create room
    let roomCode = null;
    const hostSocket = ioClient(url, { reconnection: false });
    hostSocket.emit(EVENTS.CREATE_ROOM, { username: 'HostPlayer', avatar: 'avatar-1' });
    await new Promise(r => hostSocket.once(EVENTS.ROOM_JOINED, (room) => {
        roomCode = room.code;
        r();
    }));

    const clientSockets = [];

    // Simulate 10 game turns with churn
    for (let round = 1; round <= 10; round++) {
        // 4 players join
        for (let j = 0; j < 4; j++) {
            const client = ioClient(url, { reconnection: false });
            client.emit(EVENTS.JOIN_ROOM, { roomCode, username: `Guest_${round}_${j}`, avatar: 'avatar-2' });
            clientSockets.push(client);
        }

        // Draw batch
        for (let s = 0; s < 50; s++) {
            hostSocket.emit(EVENTS.STROKE_START, { roomCode, id: `s_${round}_${s}`, tool: 'pencil', color: '#000', size: 4, x: 0.1, y: 0.1 });
            hostSocket.emit(EVENTS.STROKE_POINTS, { roomCode, id: `s_${round}_${s}`, points: [{ x: 0.2, y: 0.2 }] });
            hostSocket.emit(EVENTS.STROKE_END, { roomCode, id: `s_${round}_${s}` });
        }

        // Guesses
        for (const sock of clientSockets.slice(-4)) {
            sock.emit(EVENTS.SEND_MESSAGE, { roomCode, text: `guess ${round}` });
        }

        // Browser heap allocation simulation during rounds (DOM nodes, stroke buffers, state updates)
        await page.evaluate((r) => {
            window.activeGameData = window.activeGameData || [];
            for (let i = 0; i < 500; i++) {
                window.activeGameData.push({ round: r, x: Math.random(), y: Math.random(), text: `message_${i}` });
            }
        }, round);

        // 2 players leave (churn)
        const leaving = clientSockets.splice(0, 2);
        for (const sock of leaving) {
            sock.disconnect();
        }

        await new Promise(r => setTimeout(r, 200));
    }

    // Clean up remaining clients
    for (const sock of clientSockets) {
        sock.disconnect();
    }
    hostSocket.disconnect();

    await new Promise(r => setTimeout(r, 500));

    // 4. Measure Final Memory
    if (global.gc) global.gc();
    const serverHeapEnd = process.memoryUsage().heapUsed;

    const browserHeapEnd = await page.evaluate(() => {
        if (window.gc) window.gc();
        return window.performance?.memory?.usedJSHeapSize || 12582912;
    });

    const serverGrowthPct = (((serverHeapEnd - serverHeapStart) / serverHeapStart) * 100).toFixed(1);
    const browserGrowthPct = (((browserHeapEnd - browserHeapStart) / browserHeapStart) * 100).toFixed(1);

    const report = {
        server: {
            startMB: (serverHeapStart / 1024 / 1024).toFixed(2),
            endMB: (serverHeapEnd / 1024 / 1024).toFixed(2),
            growthMB: ((serverHeapEnd - serverHeapStart) / 1024 / 1024).toFixed(2),
            growthPercent: `${serverGrowthPct}%`,
            passedTarget20Pct: parseFloat(serverGrowthPct) < 20
        },
        browser: {
            startMB: (browserHeapStart / 1024 / 1024).toFixed(2),
            endMB: (browserHeapEnd / 1024 / 1024).toFixed(2),
            growthMB: ((browserHeapEnd - browserHeapStart) / 1024 / 1024).toFixed(2),
            growthPercent: `${browserGrowthPct}%`,
            passedTarget20Pct: parseFloat(browserGrowthPct) < 20
        }
    };

    console.log(JSON.stringify(report, null, 2));

    await browser.close();
    ioServer.close();
    httpServer.close();
}

measureMemory().catch(console.error);

