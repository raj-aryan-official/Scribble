/**
 * Emoji Shortcode and Detection Utilities
 */

export const SHORTCODE_MAP = {
    ':smile:': '😄',
    ':grin:': '😁',
    ':joy:': '😂',
    ':laughing:': '😆',
    ':wink:': '😉',
    ':sweat_smile:': '😅',
    ':heart_eyes:': '😍',
    ':love:': '😍',
    ':kiss:': '😘',
    ':sunglasses:': '😎',
    ':cool:': '😎',
    ':thinking:': '🤔',
    ':neutral_face:': '😐',
    ':rolling_eyes:': '🙄',
    ':sob:': '😭',
    ':cry:': '😢',
    ':party:': '🥳',
    ':clown:': '🤡',
    ':skull:': '💀',
    ':ghost:': '👻',
    ':alien:': '👽',
    ':robot:': '🤖',
    ':poop:': '💩',

    // Hand gestures & body
    ':clap:': '👏',
    ':thumbsup:': '👍',
    ':+1:': '👍',
    ':thumbsdown:': '👎',
    ':-1:': '👎',
    ':wave:': '👋',
    ':pray:': '🙏',
    ':muscle:': '💪',
    ':eyes:': '👀',

    // Hearts & symbols
    ':heart:': '❤️',
    ':broken_heart:': '💔',
    ':sparkles:': '✨',
    ':star:': '⭐',
    ':fire:': '🔥',
    ':100:': '💯',
    ':tada:': '🎉',
    ':check:': '✅',
    ':cross:': '❌',

    // Animals & Nature
    ':cat:': '🐱',
    ':dog:': '🐶',
    ':monkey:': '🐵',
    ':lion:': '🦁',
    ':unicorn:': '🦄',
    ':rainbow:': '🌈',

    // Food & Drink
    ':pizza:': '🍕',
    ':burger:': '🍔',
    ':fries:': '🍟',
    ':coffee:': '☕',
    ':cake:': '🎂',
    ':cookie:': '🍪',

    // Activities & Objects
    ':art:': '🎨',
    ':paint:': '🖌️',
    ':rocket:': '🚀',
    ':trophy:': '🏆',
    ':crown:': '👑',
    ':gem:': '💎',
    ':lightbulb:': '💡'
};

/**
 * Replace shortcodes like :smile: or :heart: with corresponding emoji.
 *
 * @param {string} text
 * @returns {string}
 */
export function replaceShortcodes(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match) => {
        return SHORTCODE_MAP[match] || match;
    });
}

/**
 * Test whether a text string contains only emojis and whitespace (at least one emoji).
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isOnlyEmoji(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Must have at least one emoji
    const emojiRegex = /\p{Extended_Pictographic}/u;
    if (!emojiRegex.test(trimmed)) return false;

    // Strip whitespace, zero-width characters, variation selectors, and skin tone modifiers
    const stripped = trimmed
        .replace(/\s+/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\uFE0E|\uFE0F/g, '')
        .replace(/[\uD83C][\uDFFB-\uDFFF]/g, '');

    // After removing all emojis, nothing should remain
    const withoutEmojis = stripped.replace(/\p{Extended_Pictographic}/gu, '');
    return withoutEmojis.length === 0;
}
