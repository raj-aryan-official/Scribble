/**
 * Pure functions for guessing, normalization, Levenshtein distance, and similarity checks.
 * Supports Unicode NFC normalization, grapheme clusters (Intl.Segmenter), and aliases.
 */

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function getGraphemes(text) {
    if (typeof text !== 'string' || !text) return [];
    if (segmenter) {
        return Array.from(segmenter.segment(text), s => s.segment);
    }
    return Array.from(text);
}

function normalize(text) {
    if (typeof text !== 'string') return '';
    return text
        .trim()
        .toLowerCase()
        // Strip Latin diacritical marks (e.g. café -> cafe) while preserving Devanagari characters
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Normalize to Unicode NFC as specified
        .normalize('NFC')
        // Strip punctuation (retain letters, combining marks, digits, and spaces)
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, '')
        // Collapse whitespace sequences into a single space
        .replace(/\s+/g, ' ')
        .trim();
}

function graphemeLevenshteinDistance(g1, g2) {
    if (g1 === g2) return 0;
    const len1 = g1.length;
    const len2 = g2.length;
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    let prevRow = new Array(len2 + 1);
    let currRow = new Array(len2 + 1);

    for (let j = 0; j <= len2; j++) {
        prevRow[j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        currRow[0] = i;
        const char1 = g1[i - 1];

        for (let j = 1; j <= len2; j++) {
            const cost = char1 === g2[j - 1] ? 0 : 1;
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

function levenshteinDistance(s1, s2) {
    const g1 = Array.isArray(s1) ? s1 : getGraphemes(s1);
    const g2 = Array.isArray(s2) ? s2 : getGraphemes(s2);
    return graphemeLevenshteinDistance(g1, g2);
}

function isCorrect(guess, word, aliases = [], options = {}) {
    if (!guess || !word) return false;
    const normGuess = normalize(guess);
    const normWord = normalize(word);
    if (!normGuess || !normWord) return false;

    // Exact match against secret word
    if (normGuess === normWord) return true;

    const candidateList = Array.isArray(aliases) ? aliases : [];
    const normAliases = candidateList.map(a => normalize(a)).filter(Boolean);

    // Exact match against any alias
    if (normAliases.some(a => a === normGuess)) return true;

    // Accept an alias or a match within one edit
    const allowOneEdit = options.allowOneEdit ?? (normAliases.length > 0);
    if (allowOneEdit) {
        const guessGraphemes = getGraphemes(normGuess);
        const allCandidates = [normWord, ...normAliases];
        for (const cand of allCandidates) {
            const candGraphemes = getGraphemes(cand);
            if (candGraphemes.length >= 2 && Math.abs(guessGraphemes.length - candGraphemes.length) <= 1) {
                const dist = graphemeLevenshteinDistance(guessGraphemes, candGraphemes);
                if (dist <= 1) {
                    return true;
                }
            }
        }
    }

    return false;
}

function isClose(guess, word, aliases = [], options = {}) {
    if (!guess || !word) return false;
    const normGuess = normalize(guess);
    const normWord = normalize(word);
    if (!normGuess || !normWord) return false;

    // A guess cannot be close if it is already correct
    if (isCorrect(guess, word, aliases, options)) return false;

    const candidateList = Array.isArray(aliases) ? aliases : [];
    const normAliases = candidateList.map(a => normalize(a)).filter(Boolean);
    const allCandidates = [normWord, ...normAliases];
    const guessGraphemes = getGraphemes(normGuess);
    const hasAliases = normAliases.length > 0;

    for (const cand of allCandidates) {
        const candGraphemes = getGraphemes(cand);
        const dist = graphemeLevenshteinDistance(guessGraphemes, candGraphemes);

        if (hasAliases) {
            // Since 1-edit is already accepted as correct, distance 2 is close for words with length >= 4
            if (candGraphemes.length >= 4 && dist === 2) {
                return true;
            }
        } else {
            // Standard English threshold: 1 for <= 7 letters, 2 for > 7 letters
            const maxAllowedDistance = candGraphemes.length <= 7 ? 1 : 2;
            if (dist <= maxAllowedDistance) {
                return true;
            }
        }
    }

    return false;
}

module.exports = {
    getGraphemes,
    normalize,
    levenshteinDistance,
    graphemeLevenshteinDistance,
    isCorrect,
    isClose
};

