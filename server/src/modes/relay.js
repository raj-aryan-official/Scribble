const { calculateGuessScore } = require('../game/scoring');
const { isCorrect, isClose } = require('../guess');

/**
 * Relay Mode Implementation
 * One secret word, N players each draw for 10 s in turn on the same paper.
 * Guessers guess at the end, and the score is split among everyone who drew plus the guesser.
 * Relay never gives a player two segments in a row.
 * Mid-game join rules: Relay joins at the next relay.
 */
const relayMode = {
    id: 'relay',
    name: 'Relay',
    description: 'One secret word, N players each draw for 10 s in turn on the same paper. Guessers guess at the end, and the score is split.',
    defaults: {
        drawTime: 10,
        rounds: 3,
        difficulty: 'Medium',
        wordChoice: 'pick',
    },

    canJoinMidGame(room, player) {
        if (!room) return true;
        // In relay mode, late joiner joins at the next relay round
        const pid = player?.playerId || player?.id;
        if (pid) {
            if (!Array.isArray(room.nextRoundQueue)) room.nextRoundQueue = [];
            if (!room.nextRoundQueue.includes(pid)) {
                room.nextRoundQueue.push(pid);
            }
        }
        return { allowed: true, deferToNextRelay: true };
    },

    /**
     * Builds a relay sequence ensuring no player gets two segments in a row.
     */
    buildRelaySequence(playerIds, segmentCount = 3) {
        if (!Array.isArray(playerIds) || playerIds.length === 0) return [];
        if (playerIds.length === 1) return Array(segmentCount).fill(playerIds[0]);

        const sequence = [];
        let lastId = null;

        for (let i = 0; i < segmentCount; i++) {
            // Filter out the player who just drew the last segment
            const available = playerIds.filter(id => id !== lastId);
            const chosen = available[i % available.length];
            sequence.push(chosen);
            lastId = chosen;
        }

        return sequence;
    },

    buildTurnQueue(room) {
        if (!room || !room.records) return [];
        const eligible = Array.from(room.records.values())
            .filter((r) => r.status === 'connected' || r.status === 'away')
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
            .map(r => r.playerId);

        return eligible;
    },

    canDraw(room, playerId) {
        if (!room || !playerId) return false;
        // In relay mode, check current relay segment drawer first
        const activeDrawerId = room.currentRelayDrawerId || room.drawerId;
        if (activeDrawerId) {
            if (activeDrawerId === playerId) return true;
            const rec = room.records?.get(activeDrawerId);
            if (rec && (rec.socketId === playerId || rec.playerId === playerId)) return true;
            for (const r of (room.records?.values() || [])) {
                if ((r.socketId === playerId || r.playerId === playerId) && (r.playerId === activeDrawerId || r.socketId === activeDrawerId)) {
                    return true;
                }
            }
        }
        return false;
    },

    onTurnStart(room) {
        if (!room) return { ok: true };
        if (room.settings) {
            room.settings.drawTime = 10;
        }

        // Initialize relay segments for this turn
        const eligible = Array.from(room.records?.values() || [])
            .filter((r) => r.status === 'connected')
            .map(r => r.playerId);

        const segmentCount = Math.max(2, Math.min(eligible.length, 4));
        room.relayDrawers = this.buildRelaySequence(eligible, segmentCount);
        room.currentRelaySegment = 0;
        room.currentRelayDrawerId = room.relayDrawers[0] || room.drawerId;
        room.relayContributors = new Set([room.currentRelayDrawerId]);

        return { ok: true };
    },

    onGuess(room, playerId, text) {
        if (!room || !room.wordToGuess) {
            return { allowed: false, isCorrect: false, isClose: false };
        }

        // Active segment drawer cannot guess
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

        if (event.type === 'guess') {
            const timeLeft = event.timeLeft !== undefined ? event.timeLeft : 0;
            const totalTime = 10;
            const isFirst = Boolean(event.isFirstGuesser);
            const rawGained = calculateGuessScore(timeLeft, totalTime, isFirst);

            // "the score is split among everyone who drew plus the guesser"
            const contributors = room.relayContributors ? Array.from(room.relayContributors) : [room.drawerId].filter(Boolean);
            const totalParticipants = contributors.length + 1; // drawers + guesser
            const splitScore = Math.max(10, Math.floor(rawGained / totalParticipants));

            // Award split score to each drawer who contributed to the relay
            if (contributors.length > 0) {
                for (const dId of contributors) {
                    const rec = room.records?.get(dId);
                    if (rec) rec.score = (rec.score || 0) + splitScore;
                    if (room.scores) {
                        room.scores[dId] = (room.scores[dId] || 0) + splitScore;
                        if (rec?.socketId) room.scores[rec.socketId] = rec.score;
                    }
                    if (room.roundGained) room.roundGained[dId] = (room.roundGained[dId] || 0) + splitScore;
                }
            }

            return {
                points: splitScore,
                totalPot: rawGained,
                splitCount: totalParticipants,
                contributors
            };
        }

        if (event.type === 'drawerBonus') {
            // In relay mode, drawers already receive their split of the pot on correct guess
            return { points: 0 };
        }

        return { points: 0 };
    },

    onTurnEnd(room) {
        if (room) {
            room.relayDrawers = null;
            room.currentRelaySegment = 0;
            room.currentRelayDrawerId = null;
            room.relayContributors = null;
        }
        return { ok: true };
    }
};

module.exports = relayMode;

