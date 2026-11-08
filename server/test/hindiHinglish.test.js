const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { normalize, getGraphemes, isCorrect, isClose } = require('../src/guess');
const { getWordChoices, getAliases, REGIONAL_PACKS } = require('../src/wordBank');
const { sanitizeSettings } = require('../src/RoomManager');
const blocklist = require('../src/blocklist');

describe('Hindi & Hinglish Guess Logic, Normalization & Similarity', () => {
    it('normalizes Devanagari while preserving vowel signs (matras) and conjuncts', () => {
        assert.equal(normalize('पानी'), 'पानी');
        assert.equal(normalize('नमस्ते'), 'नमस्ते');
        assert.equal(normalize('क्रिकेट'), 'क्रिकेट');
        assert.equal(normalize('ऑटो-रिक्शा'), 'ऑटोरिक्शा');
        assert.equal(normalize('  चाय  '), 'चाय');
        // Still strips Latin diacritics
        assert.equal(normalize('Café'), 'cafe');
    });

    it('segments Devanagari conjuncts and vowel signs as single grapheme clusters', () => {
        const paniGraphemes = getGraphemes('पानी');
        assert.deepEqual(paniGraphemes, ['पा', 'नी']);
        assert.equal(paniGraphemes.length, 2);

        const cricketGraphemes = getGraphemes('क्रिकेट');
        assert.deepEqual(cricketGraphemes, ['क्रि', 'के', 'ट']);
        assert.equal(cricketGraphemes.length, 3);

        const namasteGraphemes = getGraphemes('नमस्ते');
        assert.deepEqual(namasteGraphemes, ['न', 'म', 'स्ते']);
        assert.equal(namasteGraphemes.length, 3);
    });

    it('table of accepted and rejected guesses for aliases and 1-edit misspellings', () => {
        const targetWord = 'pani';
        const aliases = ['pani', 'paani', 'पानी', 'water', 'jal'];

        // Table: [guess, expectedCorrect, expectedClose, reason]
        const table = [
            // Exact matches to word or aliases
            ['pani', true, false, 'exact match to word'],
            ['paani', true, false, 'exact match to Hinglish alias'],
            ['पानी', true, false, 'exact match to Devanagari alias'],
            ['water', true, false, 'exact match to English alias'],
            ['jal', true, false, 'exact match to Hindi alias'],
            ['PANI', true, false, 'case-insensitive exact match'],
            [' Paani  ', true, false, 'trimmed exact match'],

            // 1-edit matches (accepted within one edit)
            ['pany', true, false, '1-edit substitution on pani'],
            ['paan', true, false, '1-edit deletion on paani'],
            ['pan', true, false, '1-edit deletion on pani'],
            ['paanii', true, false, '1-edit insertion on paani'],

            // Not correct, but close (2-edit distance)
            ['panika', false, true, 'distance 2 from pani (close guess)'],

            // Rejected (far away)
            ['paneer', false, false, 'distance 3 from pani (too far)'],
            ['doodh', false, false, 'completely different word'],
            ['दूध', false, false, 'completely different Devanagari word'],
            ['apple', false, false, 'unrelated word'],
            ['', false, false, 'empty guess']
        ];

        for (const [guess, expectedCorrect, expectedClose, reason] of table) {
            const actualCorrect = isCorrect(guess, targetWord, aliases);
            const actualClose = isClose(guess, targetWord, aliases);

            assert.equal(
                actualCorrect,
                expectedCorrect,
                `isCorrect('${guess}') failed: expected ${expectedCorrect} (${reason}), got ${actualCorrect}`
            );
            assert.equal(
                actualClose,
                expectedClose,
                `isClose('${guess}') failed: expected ${expectedClose} (${reason}), got ${actualClose}`
            );
        }
    });

    it('hint reveals across Devanagari conjuncts as whole tiles', () => {
        // Simulation of loop.js hint builder
        const buildHint = (word, revealedSet) => {
            const graphemes = getGraphemes(word);
            let hint = '';
            for (let i = 0; i < graphemes.length; i++) {
                if (graphemes[i] === ' ') {
                    hint += '  ';
                } else if (revealedSet.has(i)) {
                    hint += graphemes[i] + ' ';
                } else {
                    hint += '_ ';
                }
            }
            return hint.trim();
        };

        // For 'पानी' (2 graphemes: पा, नी)
        assert.equal(buildHint('पानी', new Set()), '_ _');
        assert.equal(buildHint('पानी', new Set([0])), 'पा _');
        assert.equal(buildHint('पानी', new Set([1])), '_ नी');
        assert.equal(buildHint('पानी', new Set([0, 1])), 'पा नी');

        // For 'क्रिकेट' (3 graphemes: क्रि, के, ट)
        assert.equal(buildHint('क्रिकेट', new Set()), '_ _ _');
        assert.equal(buildHint('क्रिकेट', new Set([0])), 'क्रि _ _');
        assert.equal(buildHint('क्रिकेट', new Set([1])), '_ के _');
        assert.equal(buildHint('क्रिकेट', new Set([2])), '_ _ ट');

        // For 'नमस्ते' (3 graphemes: न, म, स्ते)
        assert.equal(buildHint('नमस्ते', new Set()), '_ _ _');
        assert.equal(buildHint('नमस्ते', new Set([2])), '_ _ स्ते');
    });

    it('word masking in chat works on secret word and all aliases with grapheme counts', () => {
        const { getGraphemes } = require('../src/guess');
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const maskWord = (text, secretWord, aliases = []) => {
            if (!text || !secretWord) return text;
            const wordsToMask = [secretWord, ...(Array.isArray(aliases) ? aliases : [])]
                .map(w => (typeof w === 'string' ? w.trim() : ''))
                .filter(w => w.length > 0);
            wordsToMask.sort((a, b) => b.length - a.length);
            let result = text;
            for (const target of wordsToMask) {
                const escaped = escapeRegExp(target);
                const regex = new RegExp(escaped, 'gi');
                result = result.replace(regex, (match) => {
                    const count = getGraphemes(match).length;
                    return '*'.repeat(Math.max(1, count));
                });
            }
            return result;
        };

        const secret = 'पानी';
        const aliases = ['pani', 'paani', 'water'];

        // Masks Roman aliases
        assert.equal(maskWord('is it pani or paani?', secret, aliases), 'is it **** or *****?');
        // Masks Devanagari characters with 2 asterisks for 2 graphemes
        assert.equal(maskWord('mujhe पानी do', secret, aliases), 'mujhe ** do');
        // Masks English alias
        assert.equal(maskWord('give me water', secret, aliases), 'give me *****');
    });
});

describe('Regional Packs Data Integrity Validator', () => {
    const packsDir = path.join(__dirname, '..', 'src', 'words');

    it('contains all 8 required regional packs for both Hindi and Hinglish', () => {
        const expectedPacks = ['objects', 'food', 'festivals', 'cricket', 'subjects', 'places', 'animals', 'cinema'];
        assert.deepEqual(REGIONAL_PACKS.slice().sort(), expectedPacks.slice().sort());

        for (const p of expectedPacks) {
            const hiPath = path.join(packsDir, 'hi', 'packs', `${p}.json`);
            const hinglishPath = path.join(packsDir, 'hinglish', 'packs', `${p}.json`);
            assert.ok(fs.existsSync(hiPath), `Hindi pack missing: ${p}`);
            assert.ok(fs.existsSync(hinglishPath), `Hinglish pack missing: ${p}`);
        }
    });

    it('validates each Hindi pack: >=140 words, no duplicates, valid aliases, no banned words', () => {
        for (const p of REGIONAL_PACKS) {
            const hiFile = path.join(packsDir, 'hi', 'packs', `${p}.json`);
            const items = JSON.parse(fs.readFileSync(hiFile, 'utf8'));

            assert.ok(items.length >= 140, `Hindi pack ${p} has fewer than 140 words (${items.length})`);

            const seenWords = new Set();
            for (const item of items) {
                assert.ok(item.word && typeof item.word === 'string', `Invalid word in ${p}`);
                const norm = item.word.trim();
                assert.ok(!seenWords.has(norm), `Duplicate word in Hindi pack ${p}: ${norm}`);
                seenWords.add(norm);

                // Every Hindi word has an alias list
                assert.ok(Array.isArray(item.aliases) && item.aliases.length >= 1, `Missing aliases for ${item.word} in ${p}`);

                // No banned / blocklist words
                for (const bad of blocklist) {
                    assert.notEqual(norm.toLowerCase(), bad.toLowerCase(), `Banned word in Hindi pack ${p}: ${norm}`);
                }
            }
        }
    });

    it('validates each Hinglish pack: >=140 words, no duplicates, valid aliases, no banned words', () => {
        for (const p of REGIONAL_PACKS) {
            const hinglishFile = path.join(packsDir, 'hinglish', 'packs', `${p}.json`);
            const items = JSON.parse(fs.readFileSync(hinglishFile, 'utf8'));

            assert.ok(items.length >= 140, `Hinglish pack ${p} has fewer than 140 words (${items.length})`);

            const seenWords = new Set();
            for (const item of items) {
                assert.ok(item.word && typeof item.word === 'string', `Invalid word in ${p}`);
                const norm = item.word.trim().toLowerCase();
                assert.ok(!seenWords.has(norm), `Duplicate word in Hinglish pack ${p}: ${norm}`);
                seenWords.add(norm);

                // Every Hinglish word has an alias list
                assert.ok(Array.isArray(item.aliases) && item.aliases.length >= 1, `Missing aliases for ${item.word} in ${p}`);

                // No banned / blocklist words
                for (const bad of blocklist) {
                    assert.notEqual(norm, bad.toLowerCase(), `Banned word in Hinglish pack ${p}: ${norm}`);
                }
            }
        }
    });
});

describe('Room Settings & Word Choices for Hindi and Hinglish', () => {
    it('sanitizes and validates wordLanguage setting', () => {
        assert.equal(sanitizeSettings({ wordLanguage: 'hindi' }).wordLanguage, 'hindi');
        assert.equal(sanitizeSettings({ wordLanguage: 'hinglish' }).wordLanguage, 'hinglish');
        assert.equal(sanitizeSettings({ wordLanguage: 'english' }).wordLanguage, 'english');
        assert.equal(sanitizeSettings({ wordLanguage: 'klingon' }).wordLanguage, 'english');
        assert.equal(sanitizeSettings({}).wordLanguage, 'english');
    });

    it('returns Hindi words when wordLanguage is hindi', () => {
        const room = {
            settings: { wordLanguage: 'hindi', difficulty: 'Medium', packs: ['food'] },
            usedWords: new Set()
        };
        const choices = getWordChoices(room, 3);
        assert.equal(choices.length, 3);
        // Verify words contain Devanagari characters
        for (const word of choices) {
            assert.match(word, /[\u0900-\u097F]/, `Word '${word}' should contain Devanagari characters`);
            const aliases = getAliases(word);
            assert.ok(aliases.length > 0, `Aliases should be available for '${word}'`);
        }
    });

    it('returns Hinglish words when wordLanguage is hinglish', () => {
        const room = {
            settings: { wordLanguage: 'hinglish', difficulty: 'Medium', packs: ['cricket'] },
            usedWords: new Set()
        };
        const choices = getWordChoices(room, 3);
        assert.equal(choices.length, 3);
        for (const word of choices) {
            assert.ok(typeof word === 'string' && word.length > 0);
            const aliases = getAliases(word);
            assert.ok(aliases.length > 0, `Aliases should be available for '${word}'`);
        }
    });

    it('aliases are resolved for both Hindi and Hinglish words', () => {
        const samosaAliases = getAliases('समोसा');
        assert.ok(samosaAliases.includes('samosa'));
        assert.ok(samosaAliases.includes('समोसा'));

        const paniAliases = getAliases('pani');
        assert.ok(paniAliases.includes('paani'));
        assert.ok(paniAliases.includes('pani'));
        assert.ok(paniAliases.includes('पानी'));
    });
});
