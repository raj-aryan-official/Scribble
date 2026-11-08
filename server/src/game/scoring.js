/**
 * Game Scoring Module
 * Pure functions for calculating player guess scores and drawer bonuses.
 */

function calculateGuessScore(timeLeft, totalDrawTime = 60, isFirstGuesser = false) {
    const safeTotal = totalDrawTime > 0 ? totalDrawTime : 60;
    const ratio = Math.max(0, Math.min(1, (timeLeft || 0) / safeTotal));
    const basePoints = Math.floor(50 + (450 * ratio));
    return isFirstGuesser ? basePoints + 50 : basePoints;
}

function calculateDrawerBonus(guesserGained) {
    if (!guesserGained || guesserGained <= 0) return 0;
    return Math.round(guesserGained * 0.1);
}

module.exports = {
    calculateGuessScore,
    calculateDrawerBonus
};
