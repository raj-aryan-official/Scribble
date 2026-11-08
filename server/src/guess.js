/**
 * Pure functions for guessing, normalization, Levenshtein distance, and similarity checks
 */

function normalize(text) {
    if (typeof text !== 'string') return '';
    return text
        .trim()
        .toLowerCase()
        // Strip accents / diacritics (e.g. café -> cafe)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Strip punctuation (retain letters, digits, and spaces)
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        // Collapse whitespace sequences into a single space
        .replace(/\s+/g, ' ')
        .trim();
}

function levenshteinDistance(s1, s2) {
    if (s1 === s2) return 0;
    if (!s1 || s1.length === 0) return s2 ? s2.length : 0;
    if (!s2 || s2.length === 0) return s1.length;

    const len1 = s1.length;
    const len2 = s2.length;

    let prevRow = new Array(len2 + 1);
    let currRow = new Array(len2 + 1);

    for (let j = 0; j <= len2; j++) {
        prevRow[j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        currRow[0] = i;
        const char1 = s1.charCodeAt(i - 1);

        for (let j = 1; j <= len2; j++) {
            const cost = char1 === s2.charCodeAt(j - 1) ? 0 : 1;
            currRow[j] = Math.min(
                prevRow[j] + 1,       // deletion
                currRow[j - 1] + 1,   // insertion
                prevRow[j - 1] + cost // substitution
            );
        }

        const temp = prevRow;
        prevRow = currRow;
        currRow = temp;
    }

    return prevRow[len2];
}

function isCorrect(guess, word) {
    if (!guess || !word) return false;
    const normGuess = normalize(guess);
    const normWord = normalize(word);
    if (!normGuess || !normWord) return false;
    return normGuess === normWord;
}

function isClose(guess, word) {
    if (!guess || !word) return false;
    const normGuess = normalize(guess);
    const normWord = normalize(word);
    if (!normGuess || !normWord) return false;

    // A guess cannot be close if it is already correct
    if (normGuess === normWord) return false;

    const dist = levenshteinDistance(normGuess, normWord);
    // Close when distance is 1 for words up to 7 letters, 2 for longer words
    const maxAllowedDistance = normWord.length <= 7 ? 1 : 2;
    return dist <= maxAllowedDistance;
}

module.exports = {
    normalize,
    levenshteinDistance,
    isCorrect,
    isClose
};

