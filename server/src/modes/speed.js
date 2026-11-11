const { calculateGuessScore, calculateDrawerBonus } = require('../game/scoring');
const { isCorrect, isClose } = require('../guess');

/**
 * Speed Mode Implementation
 * 30 s turns, 8 short rounds, smaller word pool of easy words.
 */
const speedMode = {
    id: 'speed',
    name: 'Speed',
    description: '30 s turns, 8 short rounds, and a smaller word pool of easy words.',
    defaults: {
        drawTime: 30,
        rounds: 8,
        difficulty: 'Easy',
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

    onTurnStart(room) {
        if (room && room.settings) {
            // Guarantee 30s draw time and Easy difficulty in Speed mode
            room.settings.drawTime = 30;
            room.settings.difficulty = 'Easy';
        }
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
        const totalTime = 30;
        if (event.type === 'guess') {
            const timeLeft = event.timeLeft !== undefined ? event.timeLeft : 0;
            const isFirst = Boolean(event.isFirstGuesser);
            let gained = calculateGuessScore(timeLeft, totalTime, isFirst);
            if (room?.currentTwist?.id === 'speed') {
                gained = gained * 2;
            } else if (room?.currentTwist?.id === 'first-guesser-bonus' && isFirst) {
                gained = gained * 2;
            }
            return { points: gained };
        }

        if (event.type === 'drawerBonus') {
            const guesserGained = event.guesserGained || 0;
            let bonus = calculateDrawerBonus(guesserGained);
            if (room?.currentTwist?.id === 'speed') {
                bonus = bonus * 2;
            }
            return { points: bonus };
        }

        return { points: 0 };
    },

    onTurnEnd(/* room */) {
        return { ok: true };
    }
};

module.exports = speedMode;

