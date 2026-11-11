const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, isCorrect, isClose } = require('../src/guess');
const roomManager = require('../src/RoomManager');
const socketHandlers = require('../src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');

describe('Guess Logic, Normalization & Similarity Tests', () => {
    it('normalize handles trimming, lowercasing, accents, punctuation, and spaces', () => {
        // Accents
        assert.equal(normalize('Café'), 'cafe');
        assert.equal(normalize('Crème Brûlée'), 'creme brulee');
        assert.equal(normalize('résumé'), 'resume');
        assert.equal(normalize('piñata'), 'pinata');

        // Punctuation and spaces
        assert.equal(normalize('  Hello, World!  '), 'hello world');
        assert.equal(normalize('ice-cream'), 'icecream');
        assert.equal(normalize('ice cream'), 'ice cream');
        assert.equal(normalize('super    mario...'), 'super mario');
        assert.equal(normalize('rock & roll'), 'rock roll');
        assert.equal(normalize(''), '');
        assert.equal(normalize(null), '');
    });

    it('isCorrect correctly matches exact words, case-insensitive, with accents', () => {
        assert.equal(isCorrect('apple', 'apple'), true);
        assert.equal(isCorrect('Apple', 'apple'), true);
        assert.equal(isCorrect('café', 'cafe'), true);
        assert.equal(isCorrect('CAFE', 'café'), true);
        assert.equal(isCorrect('ice cream', 'ice cream'), true);

        // Incorrect cases
        assert.equal(isCorrect('apples', 'apple'), false);
        assert.equal(isCorrect('icecream', 'ice cream'), false);
        assert.equal(isCorrect('', 'apple'), false);
        assert.equal(isCorrect(null, 'apple'), false);
    });

    it('isClose matches near misses with Levenshtein distance: 1 for <=7 letters, 2 for >7 letters', () => {
        // Table of test cases: [guess, secretWord, expectedIsClose, reason]
        const cases = [
            // Plurals (distance 1 or 2)
            ['apples', 'apple', true, 'distance 1 on 5-letter word (<=7)'],
            ['apple', 'apples', true, 'distance 1 on 6-letter word (<=7)'],
            ['cats', 'cat', true, 'distance 1 on 3-letter word (<=7)'],
            ['sandwiches', 'sandwich', true, 'distance 2 on 8-letter word (>7)'],
            ['sandwich', 'sandwiches', true, 'distance 2 on 10-letter word (>7)'],

            // 'ice cream' vs 'icecream' (distance 1 due to space)
            ['ice cream', 'icecream', true, 'distance 1 on 8-letter word (>7)'],
            ['icecream', 'ice cream', true, 'distance 1 on 9-letter word (>7)'],

            // Accents with typos
            ['caffe', 'cafe', true, 'distance 1 on 4-letter word (<=7)'],
            ['café', 'cafe', false, 'already exact match -> not close'],

            // Typo distance 1 on <=7 letters
            ['elephent', 'elephant', true, 'distance 1 on 8-letter word (>7)'],
            ['aple', 'apple', true, 'distance 1 on 5-letter word (<=7)'],
            ['hous', 'house', true, 'distance 1 on 5-letter word (<=7)'],

            // Too far (distance > threshold)
            ['applesss', 'apple', false, 'distance 3 on 5-letter word -> too far'],
            ['dog', 'elephant', false, 'completely different word -> false'],
            ['pear', 'apple', false, 'distance 4 -> false'],
            ['', 'apple', false, 'empty guess -> false']
        ];

        for (const [guess, word, expected, reason] of cases) {
            const actual = isClose(guess, word);
            assert.equal(
                actual,
                expected,
                `isClose('${guess}', '${word}') failed: expected ${expected} (${reason}), got ${actual}`
            );
        }
    });
});

describe('Rate Limiter, Word Masking & Channel Routing over TCP Wire', () => {
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

    it('rate limits to 5 messages per 3 seconds and rejects the 6th with Slow down', async () => {
        const ioClient = require('socket.io-client');
        const socket = ioClient(url, { transports: ['websocket'], forceNew: true });
        await new Promise(r => socket.on('connect', r));

        const roomCode = await new Promise(resolve => {
            socket.emit('createRoom', { username: 'Spammer' });
            socket.on('roomJoined', (room) => resolve(room.code));
        });

        const errors = [];
        socket.on('error', (err) => {
            errors.push(err);
        });

        // Send 5 messages in quick succession
        for (let i = 1; i <= 5; i++) {
            socket.emit('sendMessage', { roomCode, text: `Message ${i}` });
        }

        // Send 6th message immediately
        socket.emit('sendMessage', { roomCode, text: 'Message 6' });

        await new Promise(r => setTimeout(r, 80));

        assert.equal(errors.length, 1, '6th message must trigger rate-limit error');
        assert.equal(errors[0].message, 'Slow down');

        socket.disconnect();
    });

    it('masks any message containing the secret word in both channels', async () => {
        const ioClient = require('socket.io-client');
        const drawer = ioClient(url, { transports: ['websocket'], forceNew: true });
        const guesser = ioClient(url, { transports: ['websocket'], forceNew: true });

        await Promise.all([
            new Promise(r => drawer.on('connect', r)),
            new Promise(r => guesser.on('connect', r))
        ]);

        const roomCode = await new Promise(resolve => {
            drawer.emit('createRoom', { username: 'Drawer' });
            drawer.on('roomJoined', (room) => resolve(room.code));
        });

        await new Promise(resolve => {
            guesser.emit('joinRoom', { roomCode, username: 'Guesser' });
            guesser.on('roomJoined', () => resolve());
        });

        const room = roomManager.getRoom(roomCode);
        assert.ok(room);
        room.gameState = GAME_STATES.DRAWING;
        room.currentDrawerIndex = 0;
        room.drawerId = drawer.id;
        room.wordToGuess = 'banana';

        // Drawer joins :guessed channel
        const drawerServerSock = ioServer.sockets.sockets.get(drawer.id);
        drawerServerSock.join(`${roomCode}:guessed`);

        const guesserReceived = [];
        guesser.on('messageReceived', (msg) => guesserReceived.push(msg));

        // Guesser sends message containing the secret word
        guesser.emit('sendMessage', { roomCode, text: 'I think the banana is yellow' });

        await new Promise(r => setTimeout(r, 60));

        assert.ok(guesserReceived.length >= 1);
        const lastMsg = guesserReceived[guesserReceived.length - 1];
        assert.equal(lastMsg.text, 'I think the ****** is yellow', 'Secret word must be masked with asterisks');

        drawer.disconnect();
        guesser.disconnect();
    });

    it('channel routing: correct guesser chats in :guessed and chat is invisible to people still guessing', async () => {
        const ioClient = require('socket.io-client');
        const drawer = ioClient(url, { transports: ['websocket'], forceNew: true });
        const guesser1 = ioClient(url, { transports: ['websocket'], forceNew: true });
        const guesser2 = ioClient(url, { transports: ['websocket'], forceNew: true });

        await Promise.all([
            new Promise(r => drawer.on('connect', r)),
            new Promise(r => guesser1.on('connect', r)),
            new Promise(r => guesser2.on('connect', r))
        ]);

        const roomCode = await new Promise(resolve => {
            drawer.emit('createRoom', { username: 'DrawerHost' });
            drawer.on('roomJoined', (room) => resolve(room.code));
        });

        await Promise.all([
            new Promise(resolve => {
                guesser1.emit('joinRoom', { roomCode, username: 'Guesser1' });
                guesser1.on('roomJoined', () => resolve());
            }),
            new Promise(resolve => {
                guesser2.emit('joinRoom', { roomCode, username: 'Guesser2' });
                guesser2.on('roomJoined', () => resolve());
            })
        ]);

        const room = roomManager.getRoom(roomCode);
        assert.ok(room);
        room.gameState = GAME_STATES.DRAWING;
        room.currentDrawerIndex = 0;
        room.drawerId = drawer.id;
        room.wordToGuess = 'guitar';
        room.roundEndsAt = Date.now() + 60000;

        // Drawer joins :guessed
        const drawerServerSock = ioServer.sockets.sockets.get(drawer.id);
        drawerServerSock.join(`${roomCode}:guessed`);

        // Guesser1 guesses 'guitr' (near miss) -> CLOSE_GUESS only to guesser1
        let guesser1Close = false;
        let guesser2Close = false;
        guesser1.on('closeGuess', () => { guesser1Close = true; });
        guesser2.on('closeGuess', () => { guesser2Close = true; });

        guesser1.emit('sendMessage', { roomCode, text: 'guitr' });
        await new Promise(r => setTimeout(r, 60));

        assert.equal(guesser1Close, true, 'Guesser 1 should receive closeGuess event');
        assert.equal(guesser2Close, false, 'Guesser 2 must NOT receive closeGuess event');

        // Guesser 1 now guesses correctly
        const correctPromise = new Promise(resolve => guesser1.on('correctGuess', resolve));
        guesser1.emit('sendMessage', { roomCode, text: 'guitar' });
        const correctData = await correctPromise;

        assert.equal(correctData.playerId, guesser1.id);
        assert.equal(correctData.word, 'guitar');
        assert.ok(correctData.gained > 0);
        // First guesser gets +50 bonus
        assert.ok(correctData.gained >= 50);

        // Guesser 2 tracks messages received
        const guesser2Messages = [];
        guesser2.on('messageReceived', (msg) => guesser2Messages.push(msg));

        // Drawer tracks messages received
        const drawerMessages = [];
        drawer.on('messageReceived', (msg) => drawerMessages.push(msg));

        // Now Guesser 1 (who already guessed) sends a chat in the :guessed channel
        guesser1.emit('sendMessage', { roomCode, text: 'Great drawing drawer!' });
        await new Promise(r => setTimeout(r, 80));

        // Drawer should have received the message in :guessed
        const drawerGotChat = drawerMessages.find(m => m.text === 'Great drawing drawer!');
        assert.ok(drawerGotChat, 'Drawer in :guessed channel must receive the message');

        // Guesser 2 (still guessing) must NOT have received it!
        const guesser2GotChat = guesser2Messages.find(m => m.text === 'Great drawing drawer!');
        assert.equal(guesser2GotChat, undefined, 'Guesser 2 still guessing must NOT receive :guessed chat');

        drawer.disconnect();
        guesser1.disconnect();
        guesser2.disconnect();
    });
});

