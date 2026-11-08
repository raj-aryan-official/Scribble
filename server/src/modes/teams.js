/**
 * Team Management Helper for Team Mode
 */

const TEAM_DEFINITIONS = {
    'team-red': {
        id: 'team-red',
        name: 'Team Red',
        color: '#EF4444',
        badge: 'Red'
    },
    'team-blue': {
        id: 'team-blue',
        name: 'Team Blue',
        color: '#3B82F6',
        badge: 'Blue'
    },
    'team-green': {
        id: 'team-green',
        name: 'Team Green',
        color: '#10B981',
        badge: 'Green'
    },
    'team-yellow': {
        id: 'team-yellow',
        name: 'Team Yellow',
        color: '#F59E0B',
        badge: 'Yellow'
    }
};

const TEAM_IDS = ['team-red', 'team-blue', 'team-green', 'team-yellow'];

function getActiveTeamIds(teamCount = 2) {
    const count = Math.max(2, Math.min(4, Math.floor(teamCount)));
    return TEAM_IDS.slice(0, count);
}

function initTeams(room, teamCount = 2) {
    if (!room) return;
    const activeIds = getActiveTeamIds(teamCount);
    if (!room.teams) room.teams = {};
    if (!room.teamScores) room.teamScores = {};

    for (const tId of activeIds) {
        if (!room.teams[tId]) {
            room.teams[tId] = {
                ...TEAM_DEFINITIONS[tId],
                playerIds: []
            };
        }
        if (room.teamScores[tId] === undefined) {
            room.teamScores[tId] = 0;
        }
    }
}

function getPlayerTeam(room, playerId) {
    if (!room || !playerId) return null;
    // Check record
    const rec = room.records?.get(playerId);
    if (rec?.teamId) return rec.teamId;

    // Check players array
    const player = room.players?.find(p => p.id === playerId || p.playerId === playerId);
    if (player?.teamId) return player.teamId;

    // Check teams map
    if (room.teams) {
        for (const [tId, t] of Object.entries(room.teams)) {
            if (t.playerIds && t.playerIds.includes(playerId)) {
                return tId;
            }
        }
    }
    return null;
}

function assignPlayerToTeam(room, playerId, teamId) {
    if (!room || !playerId || !teamId) return;
    initTeams(room, room.settings?.teamCount || 2);

    // Remove player from any previous team
    if (room.teams) {
        for (const t of Object.values(room.teams)) {
            if (t.playerIds) {
                t.playerIds = t.playerIds.filter(id => id !== playerId);
            }
        }
    }

    if (room.teams[teamId]) {
        if (!room.teams[teamId].playerIds) room.teams[teamId].playerIds = [];
        room.teams[teamId].playerIds.push(playerId);
    }

    // Set on record
    const rec = room.records?.get(playerId);
    if (rec) rec.teamId = teamId;

    // Set on player
    const player = room.players?.find(p => p.id === playerId || p.playerId === playerId);
    if (player) player.teamId = teamId;
}

function getSmallerTeam(room, teamCount = 2) {
    const activeIds = getActiveTeamIds(teamCount);
    initTeams(room, teamCount);

    let smallestTeamId = activeIds[0];
    let minCount = Infinity;

    for (const tId of activeIds) {
        const count = room.teams[tId]?.playerIds?.length || 0;
        if (count < minCount) {
            minCount = count;
            smallestTeamId = tId;
        }
    }

    return smallestTeamId;
}

function randomizeTeams(room, teamCount = 2) {
    if (!room || !room.records) return;
    const activeIds = getActiveTeamIds(teamCount);
    initTeams(room, teamCount);

    const eligible = Array.from(room.records.values())
        .filter(r => !r.status || r.status === 'connected' || r.status === 'away')
        .map(r => r.playerId);

    // Fisher-Yates shuffle
    const shuffled = [...eligible];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Clear previous assignments
    for (const t of Object.values(room.teams)) {
        t.playerIds = [];
    }

    // Distribute evenly
    shuffled.forEach((pid, index) => {
        const teamId = activeIds[index % activeIds.length];
        assignPlayerToTeam(room, pid, teamId);
    });
}

module.exports = {
    TEAM_DEFINITIONS,
    TEAM_IDS,
    getActiveTeamIds,
    initTeams,
    getPlayerTeam,
    assignPlayerToTeam,
    getSmallerTeam,
    randomizeTeams
};

