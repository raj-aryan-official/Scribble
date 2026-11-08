const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const roomManager = require('../server/src/RoomManager');
const socketHandlers = require('../server/src/socketHandlers');
const { EVENTS } = require('../shared/types.cjs');

async function measureChatFrames() {
    console.log('[MEASURE] Starting measurement of chat frames per send...');
    roomManager.rooms.clear();

    const httpServer = http.createServer();
    const ioServer = new Server(httpServer, { cors: { origin: '*' } });
    ioServer.on('connection', (sock) => socketHandlers(ioServer, sock));

    await new Promise((r) => httpServer.listen(0, r));
    const port = httpServer.address().port;
    const url = `http://localhost:${port}`;

    const client1 = ioClient(url, { reconnection: false });
    const client2 = ioClient(url, { reconnection: false });

    await new Promise((resolve) => {
        let count = 0;
        const cb = () => { if (++count === 2) resolve(); };
        client1.on('connect', cb);
        client2.on('connect', cb);
    });

    let roomCode = null;
    client1.emit(EVENTS.CREATE_ROOM, { username: 'Player1', avatar: 'avatar-1' });
    await new Promise((r) => client1.once(EVENTS.ROOM_JOINED, (room) => {
        roomCode = room.code;
        r();
    }));

    client2.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2', avatar: 'avatar-2' });
    await new Promise((r) => client2.once(EVENTS.ROOM_JOINED, r));

    let c1Sent = 0;
    let c1Recv = 0;
    let c2Recv = 0;

    client1.on(EVENTS.MESSAGE_RECEIVED, (msg) => {
        c1Recv++;
        console.log(`[CLIENT 1] Received MESSAGE_RECEIVED:`, msg.text, 'id:', msg.id);
    });

    client2.on(EVENTS.MESSAGE_RECEIVED, (msg) => {
        c2Recv++;
        console.log(`[CLIENT 2] Received MESSAGE_RECEIVED:`, msg.text, 'id:', msg.id);
    });

    // Send 5 messages from Player1
    for (let i = 1; i <= 5; i++) {
        const text = `Test message ${i}`;
        client1.emit(EVENTS.SEND_MESSAGE, { roomCode, text });
        c1Sent++;
        await new Promise((r) => setTimeout(r, 100));
    }

    await new Promise((r) => setTimeout(r, 500));

    console.log('\n--- MEASUREMENT RESULTS ---');
    console.log(`Sent by Player 1 (sendMessage frames): ${c1Sent}`);
    console.log(`Received by Player 1 (messageReceived frames): ${c1Recv}`);
    console.log(`Received by Player 2 (messageReceived frames): ${c2Recv}`);

    client1.disconnect();
    client2.disconnect();
    ioServer.close();
    httpServer.close();
}

measureChatFrames().catch(console.error);

