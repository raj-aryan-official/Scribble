const { normalize } = require('./guess');

// English words
const easyWords = require('./words/easy.json');
const mediumWords = require('./words/medium.json');
const hardWords = require('./words/hard.json');

const packs = {
    animals: require('./words/packs/animals.json'),
    food: require('./words/packs/food.json'),
    places: require('./words/packs/places.json'),
    objects: require('./words/packs/objects.json'),
    actions: require('./words/packs/actions.json')
};

const ALLOWED_PACKS = ['animals', 'food', 'places', 'objects', 'actions'];

const packSets = {
    animals: new Set(packs.animals),
    food: new Set(packs.food),
    places: new Set(packs.places),
    objects: new Set(packs.objects),
    actions: new Set(packs.actions)
};

// Regional Pack IDs for Hindi and Hinglish
const REGIONAL_PACKS = [
    'objects',
    'food',
    'festivals',
    'cricket',
    'subjects',
    'places',
    'animals',
    'cinema'
];

// Helper to extract word strings from [{ word, aliases }] or string[]
const extractWords = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map(item => (typeof item === 'object' && item !== null ? item.word : item));
};

// Global Alias Index (normalized word -> aliases[])
const aliasMap = new Map();

function indexAliases(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        if (typeof item === 'object' && item !== null && item.word && Array.isArray(item.aliases)) {
            const key = normalize(item.word);
            if (key) {
                aliasMap.set(key, item.aliases);
            }
        }
    }
}

// Load Hindi packs and master difficulties
const rawHiEasy = require('./words/hi/easy.json');
const rawHiMedium = require('./words/hi/medium.json');
const rawHiHard = require('./words/hi/hard.json');

const hiEasyWords = extractWords(rawHiEasy);
const hiMediumWords = extractWords(rawHiMedium);
const hiHardWords = extractWords(rawHiHard);

indexAliases(rawHiEasy);
indexAliases(rawHiMedium);
indexAliases(rawHiHard);

const hiPacks = {
    objects: extractWords(require('./words/hi/packs/objects.json')),
    food: extractWords(require('./words/hi/packs/food.json')),
    festivals: extractWords(require('./words/hi/packs/festivals.json')),
    cricket: extractWords(require('./words/hi/packs/cricket.json')),
    subjects: extractWords(require('./words/hi/packs/subjects.json')),
    places: extractWords(require('./words/hi/packs/places.json')),
    animals: extractWords(require('./words/hi/packs/animals.json')),
    cinema: extractWords(require('./words/hi/packs/cinema.json'))
};

const hiPackSets = {};
for (const p of REGIONAL_PACKS) {
    hiPackSets[p] = new Set(hiPacks[p]);
    indexAliases(require(`./words/hi/packs/${p}.json`));
}

// Load Hinglish packs and master difficulties
const rawHinglishEasy = require('./words/hinglish/easy.json');
const rawHinglishMedium = require('./words/hinglish/medium.json');
const rawHinglishHard = require('./words/hinglish/hard.json');

const hinglishEasyWords = extractWords(rawHinglishEasy);
const hinglishMediumWords = extractWords(rawHinglishMedium);
const hinglishHardWords = extractWords(rawHinglishHard);

indexAliases(rawHinglishEasy);
indexAliases(rawHinglishMedium);
indexAliases(rawHinglishHard);

const hinglishPacks = {
    objects: extractWords(require('./words/hinglish/packs/objects.json')),
    food: extractWords(require('./words/hinglish/packs/food.json')),
    festivals: extractWords(require('./words/hinglish/packs/festivals.json')),
    cricket: extractWords(require('./words/hinglish/packs/cricket.json')),
    subjects: extractWords(require('./words/hinglish/packs/subjects.json')),
    places: extractWords(require('./words/hinglish/packs/places.json')),
    animals: extractWords(require('./words/hinglish/packs/animals.json')),
    cinema: extractWords(require('./words/hinglish/packs/cinema.json'))
};

const hinglishPackSets = {};
for (const p of REGIONAL_PACKS) {
    hinglishPackSets[p] = new Set(hinglishPacks[p]);
    indexAliases(require(`./words/hinglish/packs/${p}.json`));
}

// Map word -> { difficulty, level }
const englishDifficultyMap = new Map();
easyWords.forEach(w => englishDifficultyMap.set(w.toLowerCase(), { difficulty: 'Easy', level: 1 }));
mediumWords.forEach(w => englishDifficultyMap.set(w.toLowerCase(), { difficulty: 'Medium', level: 2 }));
hardWords.forEach(w => englishDifficultyMap.set(w.toLowerCase(), { difficulty: 'Hard', level: 3 }));

const regionalDifficultyMap = new Map();
hiEasyWords.forEach(w => regionalDifficultyMap.set(w.trim(), { difficulty: 'Easy', level: 1 }));
hiMediumWords.forEach(w => regionalDifficultyMap.set(w.trim(), { difficulty: 'Medium', level: 2 }));
hiHardWords.forEach(w => regionalDifficultyMap.set(w.trim(), { difficulty: 'Hard', level: 3 }));

hinglishEasyWords.forEach(w => regionalDifficultyMap.set(w.toLowerCase().trim(), { difficulty: 'Easy', level: 1 }));
hinglishMediumWords.forEach(w => regionalDifficultyMap.set(w.toLowerCase().trim(), { difficulty: 'Medium', level: 2 }));
hinglishHardWords.forEach(w => regionalDifficultyMap.set(w.toLowerCase().trim(), { difficulty: 'Hard', level: 3 }));

function getWordDifficulty(word) {
    if (!word || typeof word !== 'string') {
        return { difficulty: 'Medium', level: 2 };
    }
    const cleanWord = word.trim().toLowerCase();
    if (englishDifficultyMap.has(cleanWord)) {
        return englishDifficultyMap.get(cleanWord);
    }
    return regionalDifficultyMap.get(cleanWord) || regionalDifficultyMap.get(word.trim()) || { difficulty: 'Medium', level: 2 };
}

function getAliases(word) {
    if (!word || typeof word !== 'string') return [];
    const key = normalize(word);
    return aliasMap.get(key) ? aliasMap.get(key).slice() : [];
}

/**
 * Fisher-Yates shuffle algorithm. Operates on a shallow copy.
 * Never sorts or mutates the source array.
 */
function shuffle(array) {
    if (!Array.isArray(array)) return [];
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

/**
 * getWordChoices(room, count = 3)
 * Builds candidate pool from room.settings.difficulty, room.settings.packs, and room.settings.wordLanguage.
 * Shuffles copy with Fisher-Yates. Excludes words in room.usedWords.
 * Resets usedWords except last 10 if pool runs dry.
 * Mixes in customWords at ~30% weight when present.
 */
function getWordChoices(room = {}, count = 3) {
    if (!room.usedWords || !(room.usedWords instanceof Set)) {
        room.usedWords = new Set();
    }

    const wordLanguage = room?.settings?.wordLanguage || 'english';
    const isHindi = wordLanguage === 'hindi';
    const isHinglish = wordLanguage === 'hinglish';

    const currentPackSets = isHindi ? hiPackSets : (isHinglish ? hinglishPackSets : packSets);
    const allowedPacks = (isHindi || isHinglish) ? REGIONAL_PACKS : ALLOWED_PACKS;

    const currentEasy = isHindi ? hiEasyWords : (isHinglish ? hinglishEasyWords : easyWords);
    const currentMed = isHindi ? hiMediumWords : (isHinglish ? hinglishMediumWords : mediumWords);
    const currentHard = isHindi ? hiHardWords : (isHinglish ? hinglishHardWords : hardWords);

    const difficulty = room?.settings?.difficulty || 'Medium';
    const rawPacks = Array.isArray(room?.settings?.packs) ? room.settings.packs : [];
    const activePacks = rawPacks.filter(p => allowedPacks.includes(p));

    const filterByPacks = (wordList) => {
        if (activePacks.length === 0) return wordList;
        const filtered = wordList.filter(w => activePacks.some(p => currentPackSets[p]?.has(w)));
        return filtered.length > 0 ? filtered : wordList;
    };

    const getUnusedPool = (basePool) => {
        let available = basePool.filter(w => !room.usedWords.has(w));
        if (available.length < 1) {
            // Pool ran dry, reset usedWords except for the last 10 words
            const last10 = Array.from(room.usedWords).slice(-10);
            room.usedWords = new Set(last10);
            available = basePool.filter(w => !room.usedWords.has(w));
            if (available.length < 1) {
                available = basePool.slice();
            }
        }
        return available;
    };

    // Custom words handling (~30% weight: 1 out of 3 choices for count = 3)
    const customWords = Array.isArray(room?.settings?.customWords) ? room.settings.customWords : [];
    let pickedCustom = [];
    if (customWords.length > 0) {
        let availableCustom = customWords.filter(w => !room.usedWords.has(w));
        if (availableCustom.length < 1) {
            const last10 = Array.from(room.usedWords).slice(-10);
            room.usedWords = new Set(last10);
            availableCustom = customWords.filter(w => !room.usedWords.has(w));
            if (availableCustom.length < 1) {
                availableCustom = customWords.slice();
            }
        }
        const customTarget = Math.min(availableCustom.length, Math.max(1, Math.round(count * 0.3)));
        const shuffledCustom = shuffle(availableCustom);
        pickedCustom = shuffledCustom.slice(0, customTarget);
    }

    const needed = Math.max(0, count - pickedCustom.length);
    const customSet = new Set(pickedCustom);
    let standardChoices = [];

    if (needed > 0) {
        if (difficulty === 'Mixed') {
            const easyPool = getUnusedPool(filterByPacks(currentEasy)).filter(w => !customSet.has(w));
            const medPool = getUnusedPool(filterByPacks(currentMed)).filter(w => !customSet.has(w));
            const hardPool = getUnusedPool(filterByPacks(currentHard)).filter(w => !customSet.has(w));

            const defaultEasy = isHindi ? 'चाय' : (isHinglish ? 'chai' : 'cat');
            const defaultMed = isHindi ? 'समोसा' : (isHinglish ? 'samosa' : 'bicycle');
            const defaultHard = isHindi ? 'हेलिकॉप्टर' : (isHinglish ? 'helicopter' : 'astronaut');

            const easyPick = shuffle(easyPool)[0] || defaultEasy;
            const medPick = shuffle(medPool)[0] || defaultMed;
            const hardPick = shuffle(hardPool)[0] || defaultHard;

            const mixedCandidates = [easyPick, medPick, hardPick];
            standardChoices = mixedCandidates.slice(0, needed);
        } else {
            const targetPool = difficulty === 'Easy' ? currentEasy : difficulty === 'Hard' ? currentHard : currentMed;

            let candidates = getUnusedPool(filterByPacks(targetPool)).filter(w => !customSet.has(w));
            if (candidates.length < needed) {
                const last10 = Array.from(room.usedWords).slice(-10);
                room.usedWords = new Set(last10);
                candidates = filterByPacks(targetPool).filter(w => !room.usedWords.has(w) && !customSet.has(w));
                if (candidates.length < needed) {
                    candidates = filterByPacks(targetPool);
                }
            }

            const shuffled = shuffle(candidates);
            standardChoices = shuffled.slice(0, needed);
        }
    }

    return [...pickedCustom, ...standardChoices];
}

const words = {
    Easy: easyWords,
    Medium: mediumWords,
    Hard: hardWords
};

const getRandomWords = (count = 3, difficulty = 'Medium') => {
    const mockRoom = { settings: { difficulty, packs: [] }, usedWords: new Set() };
    return getWordChoices(mockRoom, count);
};

module.exports = {
    words,
    packs,
    ALLOWED_PACKS,
    REGIONAL_PACKS,
    getWordChoices,
    getWordDifficulty,
    getRandomWords,
    getAliases,
    shuffle
};
