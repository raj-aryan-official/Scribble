const { calculateGuessScore, calculateDrawerBonus } = require('../game/scoring');
const { isCorrect, isClose } = require('../guess');
const {
    getActiveTeamIds,
    initTeams,
    getPlayerTeam,
    assignPlayerToTeam,
    getSmallerTeam
} = require('./teams');

/**
 * Team Mode Implementation
 * 2 to 4 teams. Teams draw in turns; only teammates guess for their team.
 * Team scores are shared and shown on the leaderboard.
 */
const teamMode = {
    id: 'team',
    name: 'Team',
    description: '2 to 4 teams. Teams draw in turns; only teammates guess for their team. Shared team scores on the leaderboard.',
    defaults: {
        drawTime: 60,
        rounds: 3,
        teamCount: 2,
        difficulty: 'Medium',
        wordChoice: 'pick',
    },

    canJoinMidGame(room, player) {
        if (!room || !player) return true;
        const pid = player.playerId || player.id;
        const teamCount = room.settings?.teamCount || 2;
        const smallerTeam = getSmallerTeam(room, teamCount);
        assignPlayerToTeam(room, pid, smallerTeam);
        return { allowed: true, teamId: smallerTeam };
    },

    buildTurnQueue(room) {
        if (!room || !room.records) return [];
        const teamCount = room.settings?.teamCount || 2;
        initTeams(room, teamCount);
        const activeTeamIds = getActiveTeamIds(teamCount);

        const eligibleRecords = Array.from(room.records.values())
            .filter((r) => r.status === 'connected' || r.status === 'away')
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

        // Ensure every eligible player is on a team
        for (const r of eligibleRecords) {
            let tId = getPlayerTeam(room, r.playerId);
            if (!tId || !activeTeamIds.includes(tId)) {
                tId = getSmallerTeam(room, teamCount);
                assignPlayerToTeam(room, r.playerId, tId);
            }
        }

        // Group players into team buckets (ordered by joinedAt)
        const teamBuckets = {};
        for (const tId of activeTeamIds) {
            teamBuckets[tId] = [];
        }
        for (const r of eligibleRecords) {
            const tId = getPlayerTeam(room, r.playerId);
            if (tId && teamBuckets[tId]) {
                teamBuckets[tId].push(r.playerId);
            }
        }

        // Interleave turns alternating between teams:
        // Team 0 player 0, Team 1 player 0, Team 0 player 1, Team 1 player 1...
        const queue = [];
        const maxLen = Math.max(...activeTeamIds.map(tId => teamBuckets[tId].length), 0);

        for (let i = 0; i < maxLen; i++) {
            for (const tId of activeTeamIds) {
                if (teamBuckets[tId][i]) {
                    queue.push(teamBuckets[tId][i]);
                }
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
        if (room) {
            const teamCount = room.settings?.teamCount || 2;
            initTeams(room, teamCount);
            room.currentDrawerTeamId = getPlayerTeam(room, room.drawerId);
        }
        return { ok: true };
    },

    onGuess(room, playerId, text) {
        if (!room || !room.wordToGuess) {
            return { allowed: false, isCorrect: false, isClose: false };
        }

        // Drawer cannot guess
        if (this.canDraw(room, playerId)) {
            return { allowed: false, isCorrect: false, isClose: false, reason: 'drawer' };
        }

        // Team rule: ONLY teammates can guess for their team
        const drawerTeamId = getPlayerTeam(room, room.drawerId);
        const guesserTeamId = getPlayerTeam(room, playerId);

        if (drawerTeamId && guesserTeamId && drawerTeamId !== guesserTeamId) {
            // Opposing team member: NOT allowed to guess!
            return {
                allowed: false,
                isCorrect: false,
                isClose: false,
                reason: 'opposing_team'
            };
        }

        // Already guessed
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
        const drawerTeamId = getPlayerTeam(room, room?.drawerId);
        if (!room.teamScores) room.teamScores = {};

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

            // Award points to the team
            if (drawerTeamId) {
                room.teamScores[drawerTeamId] = (room.teamScores[drawerTeamId] || 0) + gained;
            }

            return { points: gained, teamId: drawerTeamId };
        }

        if (event.type === 'drawerBonus') {
            const guesserGained = event.guesserGained || 0;
            let bonus = calculateDrawerBonus(guesserGained);
            if (room?.currentTwist?.id === 'speed') {
                bonus = bonus * 2;
            }

            // Award drawer bonus to the team
            if (drawerTeamId) {
                room.teamScores[drawerTeamId] = (room.teamScores[drawerTeamId] || 0) + bonus;
            }

            return { points: bonus, teamId: drawerTeamId };
        }

        return { points: 0 };
    },

    onTurnEnd(/* room */) {
        return { ok: true };
    }
};

module.exports = teamMode;
