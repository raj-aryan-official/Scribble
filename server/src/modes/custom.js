const { calculateGuessScore, calculateDrawerBonus } = require('../game/scoring');
const { isCorrect, isClose } = require('../guess');

/**
 * Custom Mode Implementation
 * Host sets time, hint count, rounds, and a score multiplier.
 */
const customMode = {
    id: 'custom',
    name: 'Custom',
    description: 'Host sets time, hint count, rounds, and a score multiplier.',
    defaults: {
        drawTime: 60,
        rounds: 3,
        hints: 2,
        scoreMultiplier: 1.0,
        difficulty: 'Medium',
        wordChoice: 'pick',
    },

    canJoinMidGame(/* room, player */) {
        return true;
    },

    buildTurnQueue(room) {
        if (!room || !room.records) return [];
        const eligible = Array.from(room.records.values())
            .filter((r) => r.status === 'connected' || r.status === 'away')
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

        const seen = new Set();
        const queue = [];
        for (const p of eligible) {
            if (!seen.has(p.playerId)) {
                seen.add(p.playerId);
                queue.push(p.playerId);
            }
        }
        return queue;
    },

    canDraw(room, playerId) {
        if (!room || !playerId) return false;
        if (room.drawerId) {
            if (room.drawerId === playerId) return true;
            const rec = room.records?.get(room.drawerId);
            if (rec && (rec.socketId === playerId || rec.playerId === playerId)) return true;
            for (const r of (room.records?.values() || [])) {
                if ((r.socketId === playerId || r.playerId === playerId) && (r.playerId === room.drawerId || r.socketId === room.drawerId)) {
                    return true;
                }
            }
        }
        if (Array.isArray(room.players) && room.currentDrawerIndex !== undefined) {
            const drawer = room.players[room.currentDrawerIndex];
            if (drawer && (drawer.id === playerId || drawer.socketId === playerId || drawer.playerId === playerId)) {
                return true;
            }
        }
        return false;
    },

    onTurnStart(/* room */) {
        return { ok: true };
    },

    onGuess(room, playerId, text) {
        if (!room || !room.wordToGuess) {
            return { allowed: false, isCorrect: false, isClose: false };
        }

        if (this.canDraw(room, playerId)) {
            return { allowed: false, isCorrect: false, isClose: false, reason: 'drawer' };
        }

        const hasGuessed = Boolean(
            (room.guessedPlayers && (room.guessedPlayers.has(playerId) || room.guessedPlayers.has(room.records?.get(playerId)?.socketId))) ||
            (room.records?.get(playerId)?.guessedThisTurn)
        );
        if (hasGuessed) {
            return { allowed: false, isCorrect: false, isClose: false, reason: 'already_guessed' };
        }

        const correct = isCorrect(text, room.wordToGuess);
        const close = !correct && isClose(text, room.wordToGuess);

        return {
            allowed: true,
            isCorrect: correct,
            isClose: close,
        };
    },

    score(room, event) {
        if (!event) return { points: 0 };
        const multiplier = typeof room?.settings?.scoreMultiplier === 'number'
            ? room.settings.scoreMultiplier
            : 1.0;

        if (event.type === 'guess') {
            const rawDrawTime = room?.settings?.drawTime || 60;
            const totalTime = event.totalTime || (room?.currentTwist?.id === 'speed' ? Math.max(15, Math.round(rawDrawTime / 2)) : rawDrawTime);
            const timeLeft = event.timeLeft !== undefined ? event.timeLeft : 0;
            const isFirst = Boolean(event.isFirstGuesser);

            let gained = calculateGuessScore(timeLeft, totalTime, isFirst);
            if (room?.currentTwist?.id === 'speed') {
                gained = gained * 2;
            } else if (room?.currentTwist?.id === 'first-guesser-bonus' && isFirst) {
                gained = gained * 2;
            }

            gained = Math.round(gained * multiplier);
            return { points: gained };
        }

        if (event.type === 'drawerBonus') {
            const guesserGained = event.guesserGained || 0;
            let bonus = calculateDrawerBonus(guesserGained);
            if (room?.currentTwist?.id === 'speed') {
                bonus = bonus * 2;
            }
            bonus = Math.round(bonus * multiplier);
            return { points: bonus };
        }

        return { points: 0 };
    },

    onTurnEnd(/* room */) {
        return { ok: true };
    }
};

module.exports = customMode;
