import easyWords from '../../../server/src/words/easy.json';
import mediumWords from '../../../server/src/words/medium.json';
import hardWords from '../../../server/src/words/hard.json';
import expertWords from '../../../server/src/words/expert.json';

const levels = [
    { difficulty: 'Easy', level: 1, words: new Set(easyWords) },
    { difficulty: 'Medium', level: 2, words: new Set(mediumWords) },
    { difficulty: 'Hard', level: 3, words: new Set(hardWords) },
    { difficulty: 'Expert', level: 4, words: new Set(expertWords) }
];

export function getWordDifficulty(word) {
    if (!word || typeof word !== 'string') return { difficulty: 'Medium', level: 2 };
    const clean = word.trim().toLowerCase();
    for (const { difficulty, level, words } of levels) {
        if (words.has(clean)) return { difficulty, level };
    }
    return { difficulty: 'Medium', level: 2 };
}
