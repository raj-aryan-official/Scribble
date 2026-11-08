const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const roomManager = require('../server/src/RoomManager');
const socketHandlers = require('../server/src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../shared/types.cjs');
const { makeSnapshot } = require('../server/src/game/loop');

async function measureNetwork() {
    roomManager.rooms.clear();
    const httpServer = http.createServer();
    const ioServer = new Server(httpServer, { cors: { origin: '*' } });
    ioServer.on('connection', (sock) => {
        socketHandlers(ioServer, sock);
    });

    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    const url = `http://localhost:${port}`;

    let drawerMessagesOut = 0;
    let drawerBytesOut = 0;
    let drawerMessagesIn = 0;
    let drawerBytesIn = 0;

    let guesserMessagesIn = 0;
    let guesserBytesIn = 0;
    let guesserMessagesOut = 0;
    let guesserBytesOut = 0;

    const drawer = ioClient(url, { reconnection: false });
    const guesser = ioClient(url, { reconnection: false });

    drawer.onAny((event, ...args) => {
        drawerMessagesIn++;
        drawerBytesIn += Buffer.byteLength(JSON.stringify({ event, args }));
    });

    guesser.onAny((event, ...args) => {
        guesserMessagesIn++;
        guesserBytesIn += Buffer.byteLength(JSON.stringify({ event, args }));
    });

    await new Promise((resolve) => {
        let c = 0;
        const cb = () => { if (++c === 2) resolve(); };
        drawer.on('connect', cb);
        guesser.on('connect', cb);
    });

    // Setup room
    let roomCode = null;
    drawer.emit(EVENTS.CREATE_ROOM, { username: 'DrawerAlice', avatar: 'avatar-1' });
    await new Promise((resolve) => {
        drawer.on(EVENTS.ROOM_JOINED, (room) => {
            roomCode = room.code;
            resolve();
        });
    });

    guesser.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'GuesserBob', avatar: 'avatar-2' });
    await new Promise((resolve) => guesser.on(EVENTS.ROOM_JOINED, () => resolve()));

    drawer.emit(EVENTS.START_GAME, { roomCode });
    const choicesData = await new Promise((resolve) => drawer.once(EVENTS.WORD_CHOICES, (data) => resolve(data)));
    const chosenWord = Array.isArray(choicesData) ? choicesData[0] : (choicesData?.choices?.[0] || 'apple');

    drawer.emit(EVENTS.CHOOSE_WORD, { roomCode, word: chosenWord });
    await new Promise((resolve) => drawer.once(EVENTS.WORD_CHOSEN, () => resolve()));

    // Reset counters for active drawing window
    drawerMessagesOut = 0;
    drawerBytesOut = 0;
    drawerMessagesIn = 0;
    drawerBytesIn = 0;
    guesserMessagesIn = 0;
    guesserBytesIn = 0;
    guesserMessagesOut = 0;
    guesserBytesOut = 0;

    console.log('[MEASURE] Starting 5-second intense drawing & guessing burst...');
    const startTime = Date.now();
    const durationMs = 5000;

    let strokeIdCounter = 0;
    const interval = setInterval(() => {
        const id = `s_${++strokeIdCounter}`;
        const startPayload = { roomCode, id, tool: 'pencil', color: '#1C1B18', size: 6, x: 0.1, y: 0.1 };
        drawer.emit(EVENTS.STROKE_START, startPayload);
        drawerMessagesOut++;
        drawerBytesOut += Buffer.byteLength(JSON.stringify(startPayload));

        // 3 point batch emissions per stroke
        for (let i = 0; i < 3; i++) {
            const pointsPayload = {
                roomCode,
                id,
                points: [{ x: 0.1 + (i * 0.05), y: 0.1 + (i * 0.05) }]
            };
            drawer.emit(EVENTS.STROKE_POINTS, pointsPayload);
            drawerMessagesOut++;
            drawerBytesOut += Buffer.byteLength(JSON.stringify(pointsPayload));
        }

        const endPayload = { roomCode, id };
        drawer.emit(EVENTS.STROKE_END, endPayload);
        drawerMessagesOut++;
        drawerBytesOut += Buffer.byteLength(JSON.stringify(endPayload));

        // Guesser sends guess periodically
        if (strokeIdCounter % 5 === 0) {
            const guessPayload = { roomCode, text: 'piano' };
            guesser.emit(EVENTS.SEND_MESSAGE, guessPayload);
            guesserMessagesOut++;
            guesserBytesOut += Buffer.byteLength(JSON.stringify(guessPayload));
        }
    }, 100); // 10 strokes per second = 50 packets/sec sent by drawer

    await new Promise((resolve) => setTimeout(resolve, durationMs));
    clearInterval(interval);
    await new Promise((resolve) => setTimeout(resolve, 500)); // wait for in-flight

    const elapsedSec = (Date.now() - startTime) / 1000;
    const minutesMultiplier = 60 / elapsedSec;

    // Measure full room snapshot payload size
    const room = roomManager.getRoom(roomCode);
    const snapshot = makeSnapshot(room, guesser.id);
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));

    const results = {
        durationSec: elapsedSec.toFixed(2),
        drawer: {
            sentMsgsPerSec: (drawerMessagesOut / elapsedSec).toFixed(1),
            recvMsgsPerSec: (drawerMessagesIn / elapsedSec).toFixed(1),
            totalMsgsPerSec: ((drawerMessagesOut + drawerMessagesIn) / elapsedSec).toFixed(1),
            bytesPerMinuteSent: Math.round(drawerBytesOut * minutesMultiplier),
            bytesPerMinuteRecv: Math.round(drawerBytesIn * minutesMultiplier),
            bytesPerMinuteTotal: Math.round((drawerBytesOut + drawerBytesIn) * minutesMultiplier)
        },
        guesser: {
            sentMsgsPerSec: (guesserMessagesOut / elapsedSec).toFixed(1),
            recvMsgsPerSec: (guesserMessagesIn / elapsedSec).toFixed(1),
            totalMsgsPerSec: ((guesserMessagesOut + guesserMessagesIn) / elapsedSec).toFixed(1),
            bytesPerMinuteSent: Math.round(guesserBytesOut * minutesMultiplier),
            bytesPerMinuteRecv: Math.round(guesserBytesIn * minutesMultiplier),
            bytesPerMinuteTotal: Math.round((guesserBytesOut + guesserBytesIn) * minutesMultiplier)
        },
        snapshotPayloadBytes: snapshotBytes
    };

    console.log(JSON.stringify(results, null, 2));

    drawer.disconnect();
    guesser.disconnect();
    ioServer.close();
    httpServer.close();
}

measureNetwork().catch(console.error);
