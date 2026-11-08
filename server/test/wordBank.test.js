const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const easyWords = require('../src/words/easy.json');
const mediumWords = require('../src/words/medium.json');
const hardWords = require('../src/words/hard.json');

const packs = {
    animals: require('../src/words/packs/animals.json'),
    food: require('../src/words/packs/food.json'),
    places: require('../src/words/packs/places.json'),
    objects: require('../src/words/packs/objects.json'),
    actions: require('../src/words/packs/actions.json')
};

const blocklist = require('../src/blocklist.js');
const { getWordChoices, getWordDifficulty, ALLOWED_PACKS } = require('../src/wordBank.js');
const roomManager = require('../src/RoomManager.js');

describe('Word Bank & Pack Data Validation', () => {
    test('easy, medium, hard lists have reasonable sizes (~300, ~300, ~200)', () => {
        assert.ok(easyWords.length >= 250 && easyWords.length <= 450, `Easy count is ${easyWords.length}`);
        assert.ok(mediumWords.length >= 250 && mediumWords.length <= 450, `Medium count is ${mediumWords.length}`);
        assert.ok(hardWords.length >= 150 && hardWords.length <= 300, `Hard count is ${hardWords.length}`);
    });

    test('all words are lowercase, length 3 to 14 characters, and contain no blocklist words', () => {
        const checkWordList = (list, name) => {
            for (const word of list) {
                assert.equal(typeof word, 'string', `${name}: "${word}" must be a string`);
                assert.equal(word, word.toLowerCase(), `${name}: "${word}" must be lowercase`);
                assert.ok(word.length >= 3 && word.length <= 14, `${name}: "${word}" length must be 3-14 (got ${word.length})`);
                assert.ok(!blocklist.includes(word), `${name}: "${word}" must not be on blocklist`);
                assert.match(word, /^[a-z]+$/, `${name}: "${word}" must contain only lowercase letters`);
            }
        };

        checkWordList(easyWords, 'easy');
        checkWordList(mediumWords, 'medium');
        checkWordList(hardWords, 'hard');

        for (const [packName, packList] of Object.entries(packs)) {
            checkWordList(packList, `pack:${packName}`);
        }
    });

    test('no duplicates within easy, medium, or hard lists', () => {
        const checkUnique = (list, name) => {
            const seen = new Set();
            for (const w of list) {
                assert.ok(!seen.has(w), `${name} has duplicate word: "${w}"`);
                seen.add(w);
            }
            assert.equal(seen.size, list.length);
        };

        checkUnique(easyWords, 'easy');
        checkUnique(mediumWords, 'medium');
        checkUnique(hardWords, 'hard');

        for (const [packName, packList] of Object.entries(packs)) {
            checkUnique(packList, `pack:${packName}`);
        }
    });

    test('no duplicates across easy, medium, and hard lists (disjoint sets)', () => {
        const easySet = new Set(easyWords);
        const medSet = new Set(mediumWords);

        for (const w of mediumWords) {
            assert.ok(!easySet.has(w), `Word "${w}" is in both easy and medium`);
        }
        for (const w of hardWords) {
            assert.ok(!easySet.has(w), `Word "${w}" is in both easy and hard`);
            assert.ok(!medSet.has(w), `Word "${w}" is in both medium and hard`);
        }
    });

    test('every word in packs exists in one of the master difficulty lists', () => {
        const masterSet = new Set([...easyWords, ...mediumWords, ...hardWords]);
        for (const [packName, packList] of Object.entries(packs)) {
            for (const word of packList) {
                assert.ok(masterSet.has(word), `Pack "${packName}" word "${word}" not found in master dictionary`);
            }
        }
    });
});

describe('getWordChoices & Game Settings Validation', () => {
    test('Mixed difficulty gives 1 word from each level (Easy, Medium, Hard)', () => {
        const room = {
            settings: { difficulty: 'Mixed', packs: [] },
            usedWords: new Set()
        };

        for (let i = 0; i < 20; i++) {
            const choices = getWordChoices(room, 3);
            assert.equal(choices.length, 3, 'Must return 3 choices');

            const difficulties = choices.map(w => getWordDifficulty(w).difficulty).sort();
            assert.deepEqual(difficulties, ['Easy', 'Hard', 'Medium'], 'Mixed must offer 1 Easy, 1 Medium, and 1 Hard');

            const levels = choices.map(w => getWordDifficulty(w).level).sort();
            assert.deepEqual(levels, [1, 2, 3], 'Mixed must offer level 1, 2, and 3');

            // Verify against actual dictionary files
            const hasEasy = choices.some(w => easyWords.includes(w));
            const hasMed = choices.some(w => mediumWords.includes(w));
            const hasHard = choices.some(w => hardWords.includes(w));
            assert.ok(hasEasy, 'Must have 1 easy word');
            assert.ok(hasMed, 'Must have 1 medium word');
            assert.ok(hasHard, 'Must have 1 hard word');
        }
    });

    test('getWordChoices returns no repeats across a 12-round x 12-player game (144 turns)', () => {
        const room = {
            settings: { difficulty: 'Mixed', packs: [] },
            usedWords: new Set()
        };

        const chosenWords = [];
        const totalTurns = 12 * 12; // 144 turns

        for (let turn = 0; turn < totalTurns; turn++) {
            const choices = getWordChoices(room, 3);
            assert.equal(choices.length, 3);

            // Verify the 3 offered choices on this turn are distinct
            assert.equal(new Set(choices).size, 3, 'Offered choices must be distinct');

            // Drawer picks one choice
            const pick = choices[0];
            assert.ok(!room.usedWords.has(pick), `Turn ${turn}: chosen word "${pick}" was already used previously!`);

            room.usedWords.add(pick);
            chosenWords.push(pick);
        }

        assert.equal(new Set(chosenWords).size, totalTurns, 'All 144 chosen words must be unique');
        assert.equal(room.usedWords.size, totalTurns);
    });

    test('unknown packs are ignored and do not crash or corrupt selection', () => {
        // Only unknown packs: behaves like all packs (empty)
        const room1 = {
            settings: { difficulty: 'Easy', packs: ['unknown_pack_xyz', 'fake_pack_123'] },
            usedWords: new Set()
        };
        const choices1 = getWordChoices(room1, 3);
        assert.equal(choices1.length, 3);
        assert.ok(choices1.every(w => getWordDifficulty(w).difficulty === 'Easy'));

        // Mixture of valid and unknown pack: filters to only the valid pack
        const room2 = {
            settings: { difficulty: 'Medium', packs: ['animals', 'nonexistent_pack'] },
            usedWords: new Set()
        };
        const choices2 = getWordChoices(room2, 3);
        assert.equal(choices2.length, 3);
        for (const w of choices2) {
            assert.ok(packs.animals.includes(w), `Word "${w}" must belong to animals pack`);
        }
    });

    test('custom words are sanitised and picked (~30% weight)', () => {
        // Sanitize test
        const rawSettings = {
            rounds: 5,
            drawTime: 80,
            difficulty: 'Easy',
            packs: ['animals', 'bogus'],
            customWords: '  Spaceship , !!Laser Gun!!, a, toolongcustomwordlongerthan20chars, fuck, Dog '
        };

        const sanitized = roomManager.sanitizeSettings(rawSettings);
        assert.deepEqual(sanitized.packs, ['animals']);
        assert.deepEqual(sanitized.customWords, ['spaceship', 'laser gun', 'dog']);

        // Selection test: custom words mixed in
        const room = {
            settings: sanitized,
            usedWords: new Set()
        };

        let customWordPickedCount = 0;
        const totalCalls = 100;
        for (let i = 0; i < totalCalls; i++) {
            const choices = getWordChoices(room, 3);
            assert.equal(choices.length, 3);
            const hasCustom = choices.some(w => sanitized.customWords.includes(w));
            if (hasCustom) customWordPickedCount++;
        }

        // With 1 in 3 choices from custom words, every call offers at least 1 custom word
        assert.ok(customWordPickedCount >= 95, `Custom words should be picked reliably (picked ${customWordPickedCount}/${totalCalls})`);
    });

    test('pool dry reset: resets usedWords keeping last 10 words when pool is exhausted', () => {
        // Test custom words pool dry reset
        const smallCustom = ['wordone', 'wordtwo', 'wordthree', 'wordfour', 'wordfive', 'wordsix', 'wordseven', 'wordeight', 'wordnine', 'wordten', 'wordeleven', 'wordtwelve'];
        const room = {
            settings: { difficulty: 'Easy', packs: [], customWords: smallCustom },
            usedWords: new Set()
        };

        for (const w of smallCustom) {
            room.usedWords.add(w);
        }
        assert.equal(room.usedWords.size, 12);

        const choices = getWordChoices(room, 3);
        assert.ok(choices.length >= 3);
        assert.ok(room.usedWords.size <= 10, `usedWords must have been reset to at most 10 (got ${room.usedWords.size})`);

        // Test standard dictionary pool dry reset
        const roomHard = {
            settings: { difficulty: 'Hard', packs: [] },
            usedWords: new Set(hardWords)
        };
        assert.equal(roomHard.usedWords.size, hardWords.length);
        const choicesHard = getWordChoices(roomHard, 3);
        assert.equal(choicesHard.length, 3);
        assert.ok(roomHard.usedWords.size <= 10, `usedWords must have been reset to at most 10 (got ${roomHard.usedWords.size})`);
    });
});

describe('UPDATE_SETTINGS Event Security & Validation', () => {
    const EventEmitter = require('events');
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
                if (rooms.has(roomName)) rooms.get(roomName).delete(this.id);
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

        return { io, addSocket };
    }

    test('host can update settings in LOBBY and broadcasts ROOM_JOINED with toPublicRoom', () => {
        roomManager.rooms.clear();
        const { addSocket } = createMockServer();
        const hostSocket = addSocket('host-sock');
        const guestSocket = addSocket('guest-sock');

        // Create and join
        hostSocket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'HostUser' });
        const roomCode = hostSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        guestSocket.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'GuestUser' });

        // Host updates settings
        hostSocket.emittedEvents = [];
        guestSocket.emittedEvents = [];

        hostSocket.receiveFromClient(EVENTS.UPDATE_SETTINGS, {
            roomCode,
            settings: {
                rounds: 5,
                drawTime: 100,
                difficulty: 'Hard',
                packs: ['animals', 'food'],
                customWords: 'dragon, castle, wizard'
            }
        });

        // Host and guest both receive updated ROOM_JOINED
        const hostUpdate = hostSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        const guestUpdate = guestSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);

        assert.ok(hostUpdate, 'Host must receive broadcast ROOM_JOINED');
        assert.ok(guestUpdate, 'Guest must receive broadcast ROOM_JOINED');

        const publicRoom = hostUpdate.args[0];
        assert.equal(publicRoom.settings.rounds, 5);
        assert.equal(publicRoom.settings.drawTime, 100);
        assert.equal(publicRoom.settings.difficulty, 'Hard');
        assert.deepEqual(publicRoom.settings.packs, ['animals', 'food']);
        assert.deepEqual(publicRoom.settings.customWords, ['dragon', 'castle', 'wizard']);

        // Must still adhere to toPublicRoom rules (no wordToGuess, no sessionId)
        assert.equal(publicRoom.wordToGuess, undefined);
        assert.equal(publicRoom.strokes, undefined);
    });

    test('non-host cannot update settings and receives ERROR', () => {
        roomManager.rooms.clear();
        const { addSocket } = createMockServer();
        const hostSocket = addSocket('host-sock');
        const guestSocket = addSocket('guest-sock');

        hostSocket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'HostUser' });
        const roomCode = hostSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        guestSocket.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'GuestUser' });

        guestSocket.emittedEvents = [];
        guestSocket.receiveFromClient(EVENTS.UPDATE_SETTINGS, {
            roomCode,
            settings: { rounds: 10 }
        });

        const err = guestSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Guest must receive ERROR when attempting to update settings');
        assert.equal(err.args[0].message, 'Only the host can update room settings');
    });

    test('settings cannot be updated mid-game (only in LOBBY)', () => {
        roomManager.rooms.clear();
        const { addSocket } = createMockServer();
        const hostSocket = addSocket('host-sock');

        hostSocket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'HostUser' });
        const roomCode = hostSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        const room = roomManager.getRoom(roomCode);
        room.gameState = GAME_STATES.DRAWING;

        hostSocket.emittedEvents = [];
        hostSocket.receiveFromClient(EVENTS.UPDATE_SETTINGS, {
            roomCode,
            settings: { rounds: 10 }
        });

        const err = hostSocket.emittedEvents.find(e => e.event === EVENTS.ERROR);
        assert.ok(err, 'Updating settings mid-game must be rejected');
        assert.equal(err.args[0].message, 'Settings can only be updated in the lobby');
    });
});
