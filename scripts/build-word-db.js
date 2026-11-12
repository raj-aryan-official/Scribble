#!/usr/bin/env node
/**
 * Builds the flat per-difficulty word lists consumed by the server and client
 * from the category files in server/src/words/categories.
 *
 * Usage:
 *   node scripts/build-word-db.js          write generated lists
 *   node scripts/build-word-db.js --check  fail if generated lists are stale
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATEGORY_DIR = path.join(ROOT, 'server/src/words/categories');
const OUTPUT_DIR = path.join(ROOT, 'server/src/words');
const PACKS_PATH = path.join(ROOT, 'shared/wordPacks.json');
const blocklist = require(path.join(ROOT, 'server/src/blocklist.js'));

const LEVELS = ['easy', 'medium', 'hard', 'expert'];
const LEVEL_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
const WORD_PATTERN = /^[a-z]{3,14}$/;

function fail(message) {
    console.error(`Word DB error: ${message}`);
    process.exitCode = 1;
    throw new Error(message);
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatArray(words) {
    return `[\n${words.map((word) => `  ${JSON.stringify(word)}`).join(',\n')}\n]\n`;
}

function loadCategories() {
    const files = fs.readdirSync(CATEGORY_DIR).filter((name) => name.endsWith('.json')).sort();
    if (files.length === 0) fail('no category files found');

    const categories = new Map();
    for (const file of files) {
        const id = file.replace(/\.json$/, '');
        const data = readJson(path.join(CATEGORY_DIR, file));
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            fail(`category "${id}" must be an object with easy/medium/hard/expert arrays`);
        }
        for (const key of Object.keys(data)) {
            if (!LEVELS.includes(key)) fail(`category "${id}" has unknown key "${key}"`);
        }
        for (const level of LEVELS) {
            if (!Array.isArray(data[level]) || data[level].length === 0) {
                fail(`category "${id}" is missing a non-empty "${level}" array`);
            }
        }
        categories.set(id, data);
    }
    return categories;
}

function loadPacks(categories) {
    const packs = readJson(PACKS_PATH);
    if (!Array.isArray(packs) || packs.length === 0) fail('shared/wordPacks.json must be a non-empty array');

    const packIds = new Set();
    const usedCategories = new Set();
    for (const pack of packs) {
        if (!pack || typeof pack.id !== 'string' || typeof pack.label !== 'string') {
            fail('every pack needs an id and label');
        }
        if (packIds.has(pack.id)) fail(`duplicate pack id "${pack.id}"`);
        packIds.add(pack.id);
        if (!Array.isArray(pack.categories) || pack.categories.length === 0) {
            fail(`pack "${pack.id}" needs at least one category`);
        }
        for (const categoryId of pack.categories) {
            if (!categories.has(categoryId)) {
                fail(`pack "${pack.id}" references unknown category "${categoryId}"`);
            }
            usedCategories.add(categoryId);
        }
    }

    for (const categoryId of categories.keys()) {
        if (!usedCategories.has(categoryId)) {
            fail(`category "${categoryId}" is not included in any pack`);
        }
    }
    return packs;
}

function buildDatabase() {
    const categories = loadCategories();
    loadPacks(categories);

    const wordsByLevel = { easy: new Map(), medium: new Map(), hard: new Map(), expert: new Map() };
    const seenAcrossCategories = new Map();

    for (const [categoryId, data] of categories) {
        const seenInCategory = new Set();
        for (const level of LEVELS) {
            for (const raw of data[level]) {
                if (typeof raw !== 'string') fail(`${categoryId}/${level} contains a non-string entry`);
                const word = raw.trim().toLowerCase();
                if (word !== raw) fail(`${categoryId}/${level}: "${raw}" must be lowercase with no whitespace`);
                if (!WORD_PATTERN.test(word)) {
                    fail(`${categoryId}/${level}: "${raw}" must be 3-14 lowercase letters only`);
                }
                if (blocklist.includes(word)) fail(`${categoryId}/${level}: "${word}" is blocked`);
                if (seenInCategory.has(word)) fail(`category "${categoryId}" repeats "${word}"`);
                seenInCategory.add(word);

                const previous = seenAcrossCategories.get(word);
                if (previous) {
                    fail(
                        `"${word}" appears in both "${previous.category}" (${previous.level}) and "${categoryId}" (${level})`
                    );
                }
                seenAcrossCategories.set(word, { level, category: categoryId });
                wordsByLevel[level].set(word, true);
            }
        }
    }

    const result = {};
    for (const level of LEVELS) {
        result[level] = Array.from(wordsByLevel[level].keys()).sort();
    }
    return result;
}

function describeCounts(db) {
    return LEVELS.map((level) => `${LEVEL_LABELS[level]}: ${db[level].length}`).join(', ');
}

function main() {
    const check = process.argv.includes('--check');
    const db = buildDatabase();
    const total = LEVELS.reduce((sum, level) => sum + db[level].length, 0);
    let stale = [];

    for (const level of LEVELS) {
        const filePath = path.join(OUTPUT_DIR, `${level}.json`);
        const expected = formatArray(db[level]);
        if (check) {
            const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
            if (current !== expected) stale.push(`${level}.json`);
        } else {
            fs.writeFileSync(filePath, expected, 'utf8');
        }
    }

    if (check && stale.length > 0) {
        console.error(`Word DB is stale: ${stale.join(', ')}. Run "npm run sync:words".`);
        process.exit(1);
    }

    console.log(
        check
            ? `Word DB is up to date (${total} unique words: ${describeCounts(db)}).`
            : `Built ${total} unique words (${describeCounts(db)}).`
    );
}

if (require.main === module) {
    main();
}

module.exports = { buildDatabase, LEVELS, LEVEL_LABELS, WORD_PATTERN };
