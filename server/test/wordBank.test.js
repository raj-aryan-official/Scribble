const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const easyWords = require('../src/words/easy.json');
const mediumWords = require('../src/words/medium.json');
const hardWords = require('../src/words/hard.json');
const expertWords = require('../src/words/expert.json');

const categoriesDir = path.join(__dirname, '..', 'src', 'words', 'categories');
const categories = {};
for (const file of fs.readdirSync(categoriesDir).sort()) {
    if (file.endsWith('.json')) {
        categories[path.basename(file, '.json')] = require(path.join(categoriesDir, file));
    }
}

const packDefinitions = require('../../shared/wordPacks.json');
const blocklist = require('../src/blocklist.js');
const {
    packs,
    ALLOWED_PACKS,
    ALLOWED_DIFFICULTIES,
    getWordChoices,
    getWordDifficulty,
    getRandomWords
} = require('../src/wordBank.js');
const roomManager = require('../src/RoomManager.js');
const { buildDatabase, LEVELS, WORD_PATTERN } = require('../../scripts/build-word-db.js');

const masterLists = {
    easy: easyWords,
    medium: mediumWords,
    hard: hardWords,
    expert: expertWords
};
const masterSet = new Set([...easyWords, ...mediumWords, ...hardWords, ...expertWords]);

describe('Word Bank & Category Data Validation', () => {
    test('database contains thousands of words across four tiers', () => {
        assert.ok(masterSet.size >= 3000, `Expected at least 3000 unique words, got ${masterSet.size}`);
        assert.ok(easyWords.length >= 500, `Easy count is ${easyWords.length}`);
        assert.ok(mediumWords.length >= 900, `Medium count is ${mediumWords.length}`);
        assert.ok(hardWords.length >= 700, `Hard count is ${hardWords.length}`);
        assert.ok(expertWords.length >= 400, `Expert count is ${expertWords.length}`);
    });

    test('generated tier files exactly match the category source files', () => {
        const built = buildDatabase();
        for (const level of LEVELS) {
            assert.deepEqual(masterLists[level], built[level], `${level}.json is stale; run npm run sync:words`);
        }
    });

    test('all category words are lowercase, 3-14 letters, and not blocked', () => {
        for (const [categoryId, data] of Object.entries(categories)) {
            for (const level of LEVELS) {
                assert.ok(Array.isArray(data[level]), `${categoryId}/${level} must be an array`);
                for (const word of data[level]) {
                    assert.equal(typeof word, 'string', `${categoryId}/${level}: non-string entry`);
                    assert.ok(WORD_PATTERN.test(word), `${categoryId}/${level}: "${word}" must be 3-14 lowercase letters`);
                    assert.ok(!blocklist.includes(word), `${categoryId}/${level}: "${word}" is blocked`);
                }
            }
        }
    });

    test('no duplicate words within any category or across all categories', () => {
        const seen = new Map();
        for (const [categoryId, data] of Object.entries(categories)) {
            const seenInCategory = new Set();
            for (const level of LEVELS) {
                for (const word of data[level]) {
                    assert.ok(!seenInCategory.has(word), `category "${categoryId}" repeats "${word}"`);
                    seenInCategory.add(word);
                    assert.equal(seen.get(word), undefined, `"${word}" also appears in "${seen.get(word)}"`);
                    seen.set(word, `${categoryId}/${level}`);
                }
            }
        }
        assert.equal(seen.size, masterSet.size);
    });

    test('every word in the master tiers comes from a category', () => {
        const categorySet = new Set();
        for (const data of Object.values(categories)) {
            for (const level of LEVELS) {
                for (const word of data[level]) categorySet.add(word);
            }
        }
        for (const word of masterSet) {
            assert.ok(categorySet.has(word), `Master word "${word}" is not present in any category`);
        }
    });

    test('shared pack definitions reference real categories and cover every category', () => {
        const usedCategories = new Set();
        for (const def of packDefinitions) {
            assert.equal(typeof def.id, 'string');
            assert.equal(typeof def.label, 'string');
            assert.ok(Array.isArray(def.categories) && def.categories.length > 0);
            for (const categoryId of def.categories) {
                assert.ok(categories[categoryId], `Pack "${def.id}" references missing category "${categoryId}"`);
                usedCategories.add(categoryId);
            }
        }
        for (const categoryId of Object.keys(categories)) {
            assert.ok(usedCategories.has(categoryId), `Category "${categoryId}" is not part of any pack`);
        }
        assert.deepEqual(ALLOWED_PACKS, packDefinitions.map(p => p.id));
        assert.ok(ALLOWED_PACKS.includes('animals'));
        assert.ok(ALLOWED_PACKS.includes('food'));
        assert.ok(ALLOWED_PACKS.includes('objects'));
        assert.ok(ALLOWED_PACKS.includes('places'));
        assert.ok(ALLOWED_PACKS.includes('actions'));
    });

    test('every pack word exists in the master dictionary and matches its category membership', () => {
        for (const def of packDefinitions) {
            const expected = new Set();
            for (const categoryId of def.categories) {
                for (const level of LEVELS) {
                    for (const word of categories[categoryId][level]) expected.add(word);
                }
            }
            const packSet = new Set(packs[def.id]);
            assert.equal(packSet.size, expected.size, `Pack "${def.id}" size mismatch`);
            for (const word of expected) {
                assert.ok(packSet.has(word), `Pack "${def.id}" is missing "${word}"`);
                assert.ok(masterSet.has(word), `Pack "${def.id}" word "${word}" not in master dictionary`);
            }
        }
    });
});

describe('getWordDifficulty', () => {
    test('returns the correct tier and level for words in every tier', () => {
        assert.deepEqual(getWordDifficulty('apple'), { difficulty: 'Easy', level: 1 });
        assert.deepEqual(getWordDifficulty(mediumWords[0]), { difficulty: 'Medium', level: 2 });
        assert.deepEqual(getWordDifficulty(hardWords[0]), { difficulty: 'Hard', level: 3 });
        assert.deepEqual(getWordDifficulty(expertWords[0]), { difficulty: 'Expert', level: 4 });
        assert.deepEqual(getWordDifficulty('notawordatall'), { difficulty: 'Medium', level: 2 });
        assert.deepEqual(getWordDifficulty(null), { difficulty: 'Medium', level: 2 });
    });
});

describe('getWordChoices & Game Settings Validation', () => {
    test('Mixed difficulty offers three distinct tiers with an approachable and a challenging word', () => {
        const room = {
            settings: { difficulty: 'Mixed', packs: [] },
            usedWords: new Set()
        };

        for (let i = 0; i < 40; i++) {
            const choices = getWordChoices(room, 3);
            assert.equal(choices.length, 3, 'Must return 3 choices');
            assert.equal(new Set(choices).size, 3, 'Choices must be distinct');

            const levels = choices.map(w => getWordDifficulty(w).level).sort();
            assert.equal(new Set(levels).size, 3, `Expected 3 distinct tiers, got ${levels.join(',')}`);
            assert.ok(levels.includes(1) || levels.includes(2), 'Mixed must include an Easy or Medium word');
            assert.ok(levels.includes(3) || levels.includes(4), 'Mixed must include a Hard or Expert word');
            assert.ok(levels.includes(1) && levels.includes(2), `Expected Easy and Medium in ${levels.join(',')}`);
        }
    });

    test('Mixed eventually offers Expert words', () => {
        const room = { settings: { difficulty: 'Mixed', packs: [] }, usedWords: new Set() };
        let sawExpert = false;
        for (let i = 0; i < 80 && !sawExpert; i++) {
            sawExpert = getWordChoices(room, 3).some(w => getWordDifficulty(w).level === 4);
        }
        assert.ok(sawExpert, 'Mixed mode should sometimes surface Expert words');
    });

    test('fixed difficulty modes only return words from that tier', () => {
        for (const [difficulty, expectedLevel] of [['Easy', 1], ['Medium', 2], ['Hard', 3], ['Expert', 4]]) {
            const room = { settings: { difficulty, packs: [] }, usedWords: new Set() };
            for (let i = 0; i < 10; i++) {
                const choices = getWordChoices(room, 3);
                assert.equal(choices.length, 3);
                for (const word of choices) {
                    assert.equal(getWordDifficulty(word).level, expectedLevel, `${difficulty} returned "${word}"`);
                }
            }
        }
    });

    test('returns no repeats across a 12-round x 12-player game (144 turns)', () => {
        const room = {
            settings: { difficulty: 'Mixed', packs: [] },
            usedWords: new Set()
        };

        const chosenWords = [];
        const totalTurns = 12 * 12;

        for (let turn = 0; turn < totalTurns; turn++) {
            const choices = getWordChoices(room, 3);
            assert.equal(choices.length, 3);
            assert.equal(new Set(choices).size, 3, 'Offered choices must be distinct');

            const pick = choices[0];
            assert.ok(!room.usedWords.has(pick), `Turn ${turn}: chosen word "${pick}" was already used`);
            room.usedWords.add(pick);
            chosenWords.push(pick);
        }

        assert.equal(new Set(chosenWords).size, totalTurns, 'All 144 chosen words must be unique');
    });

    test('recently offered but unchosen words are avoided when alternatives exist', () => {
        const room = { settings: { difficulty: 'Easy', packs: [] }, usedWords: new Set() };
        const first = getWordChoices(room, 3);
        const next = getWordChoices(room, 3);
        for (const word of next) {
            assert.ok(!first.includes(word), `"${word}" was offered twice in a row`);
        }
    });

    test('unknown packs are ignored and do not crash or corrupt selection', () => {
        const room1 = {
            settings: { difficulty: 'Easy', packs: ['unknown_pack_xyz', 'fake_pack_123'] },
            usedWords: new Set()
        };
        const choices1 = getWordChoices(room1, 3);
        assert.equal(choices1.length, 3);
        assert.ok(choices1.every(w => getWordDifficulty(w).difficulty === 'Easy'));

        const room2 = {
            settings: { difficulty: 'Medium', packs: ['animals', 'nonexistent_pack'] },
            usedWords: new Set()
        };
        const choices2 = getWordChoices(room2, 3);
        assert.equal(choices2.length, 3);
        const animals = new Set(packs.animals);
        for (const w of choices2) {
            assert.ok(animals.has(w), `Word "${w}" must belong to animals pack`);
        }
    });

    test('pack filtering works for the expanded pack set', () => {
        for (const packId of ['sports', 'science', 'fantasy', 'music', 'vehicles', 'body']) {
            const room = {
                settings: { difficulty: 'Expert', packs: [packId] },
                usedWords: new Set()
            };
            const choices = getWordChoices(room, 3);
            assert.equal(choices.length, 3);
            const packSet = new Set(packs[packId]);
            for (const word of choices) {
                assert.ok(packSet.has(word), `Pack "${packId}" returned foreign word "${word}"`);
                assert.equal(getWordDifficulty(word).level, 4);
            }
        }
    });

    test('custom words are sanitised and always represented in pick mode', () => {
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

        const room = { settings: sanitized, usedWords: new Set() };

        let customWordPickedCount = 0;
        const totalCalls = 100;
        for (let i = 0; i < totalCalls; i++) {
            const choices = getWordChoices(room, 3);
            assert.equal(choices.length, 3);
            if (choices.some(w => sanitized.customWords.includes(w))) customWordPickedCount++;
        }

        assert.ok(customWordPickedCount >= 95, `Custom words should appear reliably (${customWordPickedCount}/${totalCalls})`);
    });

    test('pool dry reset keeps at most the last 10 used words', () => {
        const smallCustom = ['wordone', 'wordtwo', 'wordthree', 'wordfour', 'wordfive', 'wordsix', 'wordseven', 'wordeight', 'wordnine', 'wordten', 'wordeleven', 'wordtwelve'];
        const room = {
            settings: { difficulty: 'Easy', packs: [], customWords: smallCustom },
            usedWords: new Set()
        };

        for (const w of smallCustom) room.usedWords.add(w);
        assert.equal(room.usedWords.size, 12);

        const choices = getWordChoices(room, 3);
        assert.ok(choices.length >= 3);
        assert.ok(room.usedWords.size <= 10, `usedWords must shrink to at most 10 (got ${room.usedWords.size})`);

        const roomHard = {
            settings: { difficulty: 'Hard', packs: [] },
            usedWords: new Set(hardWords)
        };
        const choicesHard = getWordChoices(roomHard, 3);
        assert.equal(choicesHard.length, 3);
        assert.ok(roomHard.usedWords.size <= 10, `usedWords must shrink to at most 10 (got ${roomHard.usedWords.size})`);
    });

    test('getRandomWords supports every tier', () => {
        for (const difficulty of ALLOWED_DIFFICULTIES) {
            const words = getRandomWords(3, difficulty);
            assert.equal(words.length, 3);
            assert.equal(new Set(words).size, 3);
        }
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

        hostSocket.receiveFromClient(EVENTS.CREATE_ROOM, { username: 'HostUser' });
        const roomCode = hostSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED).args[0].code;

        guestSocket.receiveFromClient(EVENTS.JOIN_ROOM, { roomCode, username: 'GuestUser' });

        hostSocket.emittedEvents = [];
        guestSocket.emittedEvents = [];

        hostSocket.receiveFromClient(EVENTS.UPDATE_SETTINGS, {
            roomCode,
            settings: {
                rounds: 5,
                drawTime: 100,
                difficulty: 'Expert',
                packs: ['animals', 'sports', 'science'],
                customWords: 'dragon, castle, wizard'
            }
        });

        const hostUpdate = hostSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);
        const guestUpdate = guestSocket.emittedEvents.find(e => e.event === EVENTS.ROOM_JOINED);

        assert.ok(hostUpdate, 'Host must receive broadcast ROOM_JOINED');
        assert.ok(guestUpdate, 'Guest must receive broadcast ROOM_JOINED');

        const publicRoom = hostUpdate.args[0];
        assert.equal(publicRoom.settings.rounds, 5);
        assert.equal(publicRoom.settings.drawTime, 100);
        assert.equal(publicRoom.settings.difficulty, 'Expert');
        assert.deepEqual(publicRoom.settings.packs, ['animals', 'sports', 'science']);
        assert.deepEqual(publicRoom.settings.customWords, ['dragon', 'castle', 'wizard']);

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
