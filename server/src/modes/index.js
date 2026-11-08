const { ALLOWED_MODES } = require('../../../shared/types.cjs');
const classicMode = require('./classic');
const speedMode = require('./speed');
const teamMode = require('./team');
const relayMode = require('./relay');
const hardMode = require('./hard');
const customMode = require('./custom');

const MODES = {
    classic: classicMode,
    speed: speedMode,
    team: teamMode,
    relay: relayMode,
    hard: hardMode,
    custom: customMode,
};

function getMode(modeId) {
    if (typeof modeId === 'string' && MODES[modeId.toLowerCase()]) {
        return MODES[modeId.toLowerCase()];
    }
    return MODES.classic;
}

function registerMode(mode) {
    if (mode && mode.id) {
        MODES[mode.id.toLowerCase()] = mode;
    }
}

module.exports = {
    getMode,
    registerMode,
    MODES,
    ALLOWED_MODES,
};
