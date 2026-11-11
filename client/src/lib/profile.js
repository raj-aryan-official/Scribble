const STORAGE_KEY = 'scribble_profile';

const DEFAULT_PROFILE = {
    version: 1,
    nickname: '',
    avatarParts: { face: 'face-1', hair: 'hair-1', hat: null, accessory: null, color: 'skin-1' },
    xp: 0,
    level: 1,
    stats: { games: 0, wins: 0, correctGuesses: 0, drawingsLiked: 0 },
    badges: [],
    createdAt: null,
};

export function loadProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_PROFILE };
        const parsed = JSON.parse(raw);
        // Schema migration: merge missing fields with defaults
        if (!parsed.version || parsed.version < 1) {
            return { ...DEFAULT_PROFILE, ...parsed, version: 1 };
        }
        // Merge to ensure all keys exist (future-proof)
        return {
            ...DEFAULT_PROFILE,
            ...parsed,
            avatarParts: { ...DEFAULT_PROFILE.avatarParts, ...(parsed.avatarParts || {}) },
            stats: { ...DEFAULT_PROFILE.stats, ...(parsed.stats || {}) },
            badges: Array.isArray(parsed.badges) ? parsed.badges : [],
        };
    } catch {
        return { ...DEFAULT_PROFILE };
    }
}

export function saveProfile(profile) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
        // Storage unavailable — game still works without saving
    }
}

export function createProfile(nickname, avatarParts) {
    const profile = {
        ...DEFAULT_PROFILE,
        nickname: typeof nickname === 'string' ? nickname.trim() : '',
        avatarParts: avatarParts
            ? { ...DEFAULT_PROFILE.avatarParts, ...avatarParts }
            : { ...DEFAULT_PROFILE.avatarParts },
        createdAt: new Date().toISOString(),
    };
    saveProfile(profile);
    return profile;
}

export function exportProfile() {
    try {
        const profile = loadProfile();
        const json = JSON.stringify(profile, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scribble-profile.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch {
        // Download failed silently
    }
}

export function deleteProfile() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Storage unavailable
    }
}
