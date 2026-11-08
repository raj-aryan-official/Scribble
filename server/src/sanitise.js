/**
 * Text sanitisation helper using NFKC normalisation, stripping control,
 * zero-width, and bidi-override characters, collapsing spaces and trimming.
 *
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
function sanitiseText(text, max = undefined) {
    if (typeof text !== 'string') return '';
    let cleaned = text.normalize('NFKC');
    // Strip control (\x00-\x1F, \x7F-\x9F), zero-width (\u200B-\u200D, \uFEFF, \u200E, \u200F, \u2060, \u180E),
    // and bidi-override (\u202A-\u202E, \u2066-\u2069) characters
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF\u200E\u200F\u2060\u180E\u202A-\u202E\u2066-\u2069]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (typeof max === 'number' && max > 0) {
        cleaned = cleaned.slice(0, max);
    }
    return cleaned;
}

function sanitizeNickname(raw) {
    // Normalise, strip control/zero-width/bidi chars, collapse spaces and trim (without truncating, so validator can enforce 1-16)
    return sanitiseText(raw);
}

module.exports = {
    sanitiseText,
    sanitizeNickname
};
