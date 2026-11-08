const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

const roomManager = require('../src/RoomManager');
const { startTurn, makeSnapshot } = require('../src/game/loop');
const { getWordChoices } = require('../src/wordBank');
const socketHandlers = require('../src/socketHandlers');
const { EVENTS, GAME_STATES } = require('../../shared/types.cjs');

function createMockServer() {
    const sockets = new Map();
    const rooms = new Map();

    class MockSocket extends EventEmitter {
        constructor(id) {
            super();
            this.id = id;
            this.emittedEvents = [];
        }

        join(roomName) {
            if (!rooms.has(roomName)) rooms.set(roomName, new Set());
            rooms.get(roomName).add(this.id);
        }

        leave(roomName) {
            if (rooms.has(roomName)) {
                rooms.get(roomName).delete(this.id);
            }
        }

        emit(event, ...args) {
            this.emittedEvents.push({ event, args });
            return true;
        }

        receiveFromClient(event, payload) {
            super.emit(event, payload);
        }
    }

    const io = {
        sockets: {
            adapter: {
                rooms: {
                    get(roomName) {
                        return rooms.get(roomName) || new Set();
                    }
                }
            }
        },
        to(target) {
            return {
                emit(event, ...args) {
                    if (rooms.has(target)) {
                        for (const socketId of rooms.get(target)) {
                            const s = sockets.get(socketId);
                            if (s) s.emittedEvents.push({ event, args });
                        }
                    } else if (sockets.has(target)) {
                        const s = sockets.get(target);
                        if (s) s.emittedEvents.push({ event, args });
                    }
                }
            };
        }
    };

    function addSocket(id) {
        const socket = new MockSocket(id);
        sockets.set(id, socket);
        socketHandlers(io, socket);
        return socket;
    }

    return { io, sockets, rooms, addSocket };
}

describe('Word Choice Settings & Random Mode Tests', () => {
    beforeEach(() => {
        roomManager.rooms.clear();
    });

    test('1. Host setting wordChoice validation: accepts pick and random, defaults invalid to pick', () => {
        const host = { id: 'host-1', username: 'HostUser' };

        // Test default
        const room1 = roomManager.createRoom(host, {});
        assert.equal(room1.settings.wordChoice, 'pick');

        // Test explicit random
        const room2 = roomManager.createRoom(host, { wordChoice: 'random' });
        assert.equal(room2.settings.wordChoice, 'random');

        // Test explicit pick
        const room3 = roomManager.createRoom(host, { wordChoice: 'pick' });
        assert.equal(room3.settings.wordChoice, 'pick');

        // Test invalid values fallback to pick
        const room4 = roomManager.createRoom(host, { wordChoice: 'invalid-choice' });
        assert.equal(room4.settings.wordChoice, 'pick');

        const room5 = roomManager.createRoom(host, { wordChoice: 12345 });
        assert.equal(room5.settings.wordChoice, 'pick');
    });

    test('2. In pick mode, preselected defaultChoice is within [0, choices.length - 1]', () => {
        const { io, addSocket } = createMockServer();
        const sock1 = addSocket('sock-1');
        const sock2 = addSocket('sock-2');

        const room = roomManager.createRoom({ id: 'sock-1', username: 'Host' }, { wordChoice: 'pick' });
        sock1.join(room.code);
        sock2.join(room.code);
        roomManager.joinRoom(room.code, { id: 'sock-2', username: 'Guesser' });

        startTurn(io, room, true);

        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        assert.ok(Array.isArray(room.wordChoices));
        assert.equal(room.wordChoices.length, 3);
        assert.equal(typeof room.defaultChoice, 'number');
        assert.ok(room.defaultChoice >= 0 && room.defaultChoice < room.wordChoices.length);

        // Drawer receives WORD_CHOICES with choices and defaultChoice index
        const drawerEvents = sock1.emittedEvents.filter(e => e.event === EVENTS.WORD_CHOICES);
        assert.equal(drawerEvents.length, 1);
        const [choices, defaultIdx] = drawerEvents[0].args;
        assert.deepEqual(choices, room.wordChoices);
        assert.equal(defaultIdx, room.defaultChoice);

        // Guesser NEVER receives WORD_CHOICES
        const guesserEvents = sock2.emittedEvents.filter(e => e.event === EVENTS.WORD_CHOICES);
        assert.equal(guesserEvents.length, 0);

        // Clear timer
        if (room.timers.wordSelection) clearTimeout(room.timers.wordSelection);
    });

    test('3. In pick mode, doing nothing for 10 s picks the card marked Default', () => {
        const { io, addSocket } = createMockServer();
        const sock1 = addSocket('sock-1');
        const sock2 = addSocket('sock-2');

        const room = roomManager.createRoom({ id: 'sock-1', username: 'Host' }, { wordChoice: 'pick' });
        sock1.join(room.code);
        sock2.join(room.code);
        roomManager.joinRoom(room.code, { id: 'sock-2', username: 'Guesser' });

        startTurn(io, room, true);

        const expectedDefaultWord = typeof room.wordChoices[room.defaultChoice] === 'string'
            ? room.wordChoices[room.defaultChoice]
            : room.wordChoices[room.defaultChoice].word;

        // Force timeout callback immediately
        clearTimeout(room.timers.wordSelection);
        const defIdx = room.defaultChoice;
        const defaultChoice = room.wordChoices[defIdx];
        const defaultWord = typeof defaultChoice === 'string' ? defaultChoice : defaultChoice.word;
        const { startRound } = require('../src/game/loop');
        startRound(io, room, defaultWord, true);

        // Word to guess matches the preselected default
        assert.equal(room.wordToGuess, expectedDefaultWord);
        assert.equal(room.gameState, GAME_STATES.DRAWING);

        // Drawer receives DRAWER_WORD with autoPicked: true
        const drawerWordEvents = sock1.emittedEvents.filter(e => e.event === EVENTS.DRAWER_WORD);
        assert.ok(drawerWordEvents.length >= 1);
        const lastDrawerWord = drawerWordEvents[drawerWordEvents.length - 1].args[0];
        assert.equal(lastDrawerWord.word, expectedDefaultWord);
        assert.equal(lastDrawerWord.autoPicked, true);

        // Clear timers
        if (room.timers.interval) clearInterval(room.timers.interval);
    });

    test('4. In random mode, server assigns random word at once with no choice screen', () => {
        const { io, addSocket } = createMockServer();
        const sock1 = addSocket('sock-1');
        const sock2 = addSocket('sock-2');

        const room = roomManager.createRoom({ id: 'sock-1', username: 'Host' }, { wordChoice: 'random' });
        sock1.join(room.code);
        sock2.join(room.code);
        roomManager.joinRoom(room.code, { id: 'sock-2', username: 'Guesser' });

        startTurn(io, room, true);

        assert.equal(room.gameState, GAME_STATES.WORD_SELECTION);
        assert.equal(room.wordChoices, null);
        assert.equal(room.defaultChoice, null);
        assert.ok(typeof room.wordToGuess === 'string' && room.wordToGuess.length > 0);

        // No socket receives WORD_CHOICES in random mode
        const allWordChoiceEvents = [...sock1.emittedEvents, ...sock2.emittedEvents].filter(
            e => e.event === EVENTS.WORD_CHOICES
        );
        assert.equal(allWordChoiceEvents.length, 0);

        // Drawer receives DRAWER_WORD with randomMode: true
        const drawerWordEvents = sock1.emittedEvents.filter(e => e.event === EVENTS.DRAWER_WORD);
        assert.equal(drawerWordEvents.length, 1);
        assert.equal(drawerWordEvents[0].args[0].word, room.wordToGuess);
        assert.equal(drawerWordEvents[0].args[0].randomMode, true);

        // Guesser NEVER receives DRAWER_WORD
        const guesserDrawerWordEvents = sock2.emittedEvents.filter(e => e.event === EVENTS.DRAWER_WORD);
        assert.equal(guesserDrawerWordEvents.length, 0);

        // Clear timer
        if (room.timers.wordSelection) clearTimeout(room.timers.wordSelection);
    });

    test('5. Non-drawers never receive word choices or word in snapshot', () => {
        const room = roomManager.createRoom(
            { id: 'sock-1', username: 'Host' },
            { wordChoice: 'pick' }
        );
        roomManager.joinRoom(room.code, { id: 'sock-2', username: 'Guesser' });

        room.gameState = GAME_STATES.WORD_SELECTION;
        room.drawerId = 'sock-1';
        room.wordChoices = ['apple', 'banana', 'cherry'];
        room.defaultChoice = 1;
        room.wordToGuess = 'banana';

        // Drawer snapshot
        const drawerSnap = makeSnapshot(room, 'sock-1');
        assert.deepEqual(drawerSnap.wordChoices, ['apple', 'banana', 'cherry']);
        assert.equal(drawerSnap.defaultChoice, 1);
        assert.equal(drawerSnap.word, 'banana');

        // Guesser snapshot
        const guesserSnap = makeSnapshot(room, 'sock-2');
        assert.equal(guesserSnap.wordChoices, null);
        assert.equal(guesserSnap.defaultChoice, null);
        assert.equal(guesserSnap.word, null);
    });

    test('6. Respects usedWords with no repeated words across a full 12-round game', () => {
        const room = roomManager.createRoom(
            { id: 'host-1', username: 'Host' },
            { rounds: 12, wordChoice: 'random', difficulty: 'Medium' }
        );

        const chosenWords = [];
        // 12 rounds x 4 players = 48 turns
        for (let turn = 0; turn < 48; turn++) {
            const choices = getWordChoices(room, 1);
            const word = typeof choices[0] === 'string' ? choices[0] : choices[0].word;
            assert.ok(!room.usedWords.has(word), `Word "${word}" was repeated at turn ${turn}`);
            room.usedWords.add(word);
            chosenWords.push(word);
        }

        const uniqueWords = new Set(chosenWords);
        assert.equal(uniqueWords.size, 48, 'All 48 words played must be unique');
    });

    test('7. UPDATE_SETTINGS allows host to toggle wordChoice in LOBBY', () => {
        const { addSocket } = createMockServer();
        const hostSocket = addSocket('host-sock');
        const guesserSocket = addSocket('guesser-sock');

        const room = roomManager.createRoom({ id: 'host-sock', username: 'Host' }, { wordChoice: 'pick' });
        hostSocket.join(room.code);
        guesserSocket.join(room.code);
        roomManager.joinRoom(room.code, { id: 'guesser-sock', username: 'Guesser' });

        // Non-host attempts to update settings -> rejected
        guesserSocket.receiveFromClient(EVENTS.UPDATE_SETTINGS, {
            roomCode: room.code,
            settings: { wordChoice: 'random' }
        });
        assert.equal(room.settings.wordChoice, 'pick');

        // Host updates settings -> accepted
        hostSocket.receiveFromClient(EVENTS.UPDATE_SETTINGS, {
            roomCode: room.code,
            settings: { wordChoice: 'random' }
        });
        assert.equal(room.settings.wordChoice, 'random');
    });
});

