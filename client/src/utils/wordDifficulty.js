import easyWords from '../../../server/src/words/easy.json';
import hardWords from '../../../server/src/words/hard.json';

const easySet = new Set(easyWords);
const hardSet = new Set(hardWords);

export function getWordDifficulty(word) {
    if (!word || typeof word !== 'string') return { difficulty: 'Medium', level: 2 };
    const clean = word.trim().toLowerCase();
    if (easySet.has(clean)) return { difficulty: 'Easy', level: 1 };
    if (hardSet.has(clean)) return { difficulty: 'Hard', level: 3 };
    return { difficulty: 'Medium', level: 2 };
}

