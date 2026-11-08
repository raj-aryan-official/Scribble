const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const assert = require('assert');
const roomManager = require('../server/src/RoomManager');
const socketHandlers = require('../server/src/socketHandlers');
const { EVENTS } = require('../shared/types.cjs');
const { v4: uuidv4 } = require('uuid');

async function testChatThreePlayers() {
    console.log('[TEST] Starting 3-player chat exact-once delivery test...');
    roomManager.rooms.clear();

    const httpServer = http.createServer();
    const ioServer = new Server(httpServer, { cors: { origin: '*' } });
    ioServer.on('connection', (sock) => socketHandlers(ioServer, sock));

    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    const url = `http://localhost:${port}`;

    // Connect 3 players
    const p1 = ioClient(url, { reconnection: false });
    const p2 = ioClient(url, { reconnection: false });
    const p3 = ioClient(url, { reconnection: false });

    await new Promise((resolve) => {
        let connectedCount = 0;
        const onConnect = () => { if (++connectedCount === 3) resolve(); };
        p1.on('connect', onConnect);
        p2.on('connect', onConnect);
        p3.on('connect', onConnect);
    });

    let roomCode = null;
    p1.emit(EVENTS.CREATE_ROOM, { username: 'Player1', avatar: 'avatar-1' });
    await new Promise((resolve) => p1.once(EVENTS.ROOM_JOINED, (room) => {
        roomCode = room.code;
        resolve();
    }));

    p2.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'Player2', avatar: 'avatar-2' });
    await new Promise((resolve) => p2.once(EVENTS.ROOM_JOINED, resolve));

    p3.emit(EVENTS.JOIN_ROOM, { roomCode, username: 'Player3', avatar: 'avatar-3' });
    await new Promise((resolve) => p3.once(EVENTS.ROOM_JOINED, resolve));

    // Message tracking per player: msgId -> count
    const p1Messages = new Map();
    const p2Messages = new Map();
    const p3Messages = new Map();

    p1.on(EVENTS.MESSAGE_RECEIVED, (msg) => {
        if (msg.type === 'chat') {
            p1Messages.set(msg.id, (p1Messages.get(msg.id) || 0) + 1);
        }
    });

    p2.on(EVENTS.MESSAGE_RECEIVED, (msg) => {
        if (msg.type === 'chat') {
            p2Messages.set(msg.id, (p2Messages.get(msg.id) || 0) + 1);
        }
    });

    p3.on(EVENTS.MESSAGE_RECEIVED, (msg) => {
        if (msg.type === 'chat') {
            p3Messages.set(msg.id, (p3Messages.get(msg.id) || 0) + 1);
        }
    });

    // P1 sends 3 messages, P2 sends 3 messages, P3 sends 3 messages
    const sentClientMsgIds = [];
    const senders = [p1, p2, p3];

    for (let s = 0; s < 3; s++) {
        for (let m = 0; m < 3; m++) {
            const clientMsgId = uuidv4();
            sentClientMsgIds.push(clientMsgId);
            senders[s].emit(EVENTS.SEND_MESSAGE, {
                roomCode,
                text: `Message from P${s + 1} #${m + 1}`,
                clientMsgId
            });
            await new Promise((r) => setTimeout(r, 60));
        }
    }

    // Now test duplicate clientMsgId submission (should be dropped by server)
    const duplicateId = sentClientMsgIds[0];
    p1.emit(EVENTS.SEND_MESSAGE, {
        roomCode,
        text: 'Duplicate replay message',
        clientMsgId: duplicateId
    });

    await new Promise((r) => setTimeout(r, 500));

    console.log(`[TEST] Player 1 received ${p1Messages.size} chat messages.`);
    console.log(`[TEST] Player 2 received ${p2Messages.size} chat messages.`);
    console.log(`[TEST] Player 3 received ${p3Messages.size} chat messages.`);

    // Assertions
    assert.strictEqual(p1Messages.size, 9, 'Player 1 must receive exactly 9 distinct chat messages');
    assert.strictEqual(p2Messages.size, 9, 'Player 2 must receive exactly 9 distinct chat messages');
    assert.strictEqual(p3Messages.size, 9, 'Player 3 must receive exactly 9 distinct chat messages');

    for (const [id, count] of p1Messages.entries()) {
        assert.strictEqual(count, 1, `Player 1 received message ${id} ${count} times (expected 1)`);
    }
    for (const [id, count] of p2Messages.entries()) {
        assert.strictEqual(count, 1, `Player 2 received message ${id} ${count} times (expected 1)`);
    }
    for (const [id, count] of p3Messages.entries()) {
        assert.strictEqual(count, 1, `Player 3 received message ${id} ${count} times (expected 1)`);
    }

    console.log('✅ ALL 3 PLAYERS RECEIVED EACH MESSAGE EXACTLY ONCE! DUPLICATE REPLAY WAS DROPPED.');

    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
    ioServer.close();
    httpServer.close();
}

testChatThreePlayers().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

