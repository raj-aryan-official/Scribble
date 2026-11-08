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

// Map word -> { difficulty, level }
const wordDifficultyMap = new Map();
easyWords.forEach(w => wordDifficultyMap.set(w, { difficulty: 'Easy', level: 1 }));
mediumWords.forEach(w => wordDifficultyMap.set(w, { difficulty: 'Medium', level: 2 }));
hardWords.forEach(w => wordDifficultyMap.set(w, { difficulty: 'Hard', level: 3 }));

function getWordDifficulty(word) {
    if (!word || typeof word !== 'string') {
        return { difficulty: 'Medium', level: 2 };
    }
    const cleanWord = word.trim().toLowerCase();
    return wordDifficultyMap.get(cleanWord) || { difficulty: 'Medium', level: 2 };
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
 * Builds candidate pool from room.settings.difficulty and room.settings.packs.
 * Shuffles copy with Fisher-Yates. Excludes words in room.usedWords.
 * Resets usedWords except last 10 if pool runs dry.
 * Mixes in customWords at ~30% weight when present.
 */
function getWordChoices(room = {}, count = 3) {
    if (!room.usedWords || !(room.usedWords instanceof Set)) {
        room.usedWords = new Set();
    }

    const difficulty = room?.settings?.difficulty || 'Medium';
    const rawPacks = Array.isArray(room?.settings?.packs) ? room.settings.packs : [];
    const activePacks = rawPacks.filter(p => ALLOWED_PACKS.includes(p));

    const filterByPacks = (wordList) => {
        if (activePacks.length === 0) return wordList;
        const filtered = wordList.filter(w => activePacks.some(p => packSets[p]?.has(w)));
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
            // Mixed: one of each level (Easy, Medium, Hard)
            const easyPool = getUnusedPool(filterByPacks(easyWords)).filter(w => !customSet.has(w));
            const medPool = getUnusedPool(filterByPacks(mediumWords)).filter(w => !customSet.has(w));
            const hardPool = getUnusedPool(filterByPacks(hardWords)).filter(w => !customSet.has(w));

            const easyPick = shuffle(easyPool)[0] || 'cat';
            const medPick = shuffle(medPool)[0] || 'bicycle';
            const hardPick = shuffle(hardPool)[0] || 'astronaut';

            const mixedCandidates = [easyPick, medPick, hardPick];
            standardChoices = mixedCandidates.slice(0, needed);
        } else {
            const targetPool = difficulty === 'Easy' ? easyWords : difficulty === 'Hard' ? hardWords : mediumWords;

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
    getWordChoices,
    getWordDifficulty,
    getRandomWords,
    shuffle
};
