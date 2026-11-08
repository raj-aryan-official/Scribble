/**
 * Central Audio Manager for Scribble
 *
 * Requirements:
 * - Unlocks AudioContext and HTMLAudioElements on first user interaction (pointerdown, keydown, touchstart).
 * - Preloads lazily once unlocked.
 * - Plays six self-hosted sounds:
 *   1. pencilTap: '/sounds/pencil-tap.wav'
 *   2. joinPop: '/sounds/join-pop.wav'
 *   3. tick: '/sounds/tick.wav'
 *   4. correct: '/sounds/correct-guess.wav'
 *   5. roundEnd: '/sounds/round-end.wav'
 *   6. win: '/sounds/win.wav'
 * - Volumes per category with default master volume 0.4.
 * - Audio ducking: lowers sound volumes while someone speaks on voice.
 * - Persisted mute toggle in localStorage (try/catch protected).
 * - Immediate stop of playing sounds when muted or sound effects disabled.
 * - Haptic vibration on correct guess (50ms) and round end ([80, 50, 80]ms) when supported & enabled.
 * - Mute when tab hidden listener.
 */

const STORAGE_KEY = 'scribble_muted';
const SETTINGS_KEY = 'scribble_settings';
const DEFAULT_VOLUME = 0.4;
const DUCKED_VOLUME_MULTIPLIER = 0.3; // 30% volume while someone speaks on voice

export const SOUNDS = {
    pencilTap: { src: '/sounds/pencil-tap.wav', category: 'ui', volume: 0.4 },
    joinPop: { src: '/sounds/join-pop.wav', category: 'presence', volume: 0.4 },
    tick: { src: '/sounds/tick.wav', category: 'gameplay', volume: 0.35 },
    correct: { src: '/sounds/correct-guess.wav', category: 'reward', volume: 0.45 },
    roundEnd: { src: '/sounds/round-end.wav', category: 'intermission', volume: 0.4 },
    win: { src: '/sounds/win.wav', category: 'celebration', volume: 0.45 },
};

// Aliases for backwards compatibility with earlier calls
const ALIASES = {
    pop: 'joinPop',
    end: 'roundEnd',
    'pencil-tap': 'pencilTap',
    'join-pop': 'joinPop',
    'correct-guess': 'correct',
    'round-end': 'roundEnd',
};

class AudioManager {
    constructor() {
        this.isMuted = this.loadMuted();
        this.isUnlocked = false;
        this.isDucked = false;
        this.masterVolume = DEFAULT_VOLUME;
        this.soundEffects = true;
        this.haptics = true;
        this.muteOnHidden = false;
        this.cache = {}; // soundName -> HTMLAudioElement
        this.activeAudios = new Set(); // Currently playing HTMLAudioElements
        this.listeners = new Set(); // Mute/state subscribers

        this.initUnlockListeners();
        this.initVisibilityListener();
    }

    loadMuted() {
        if (typeof window === 'undefined') return false;
        try {
            const rawSettings = localStorage.getItem(SETTINGS_KEY);
            if (rawSettings) {
                const parsed = JSON.parse(rawSettings);
                if (typeof parsed.isMuted === 'boolean') {
                    return parsed.isMuted;
                }
            }
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    }

    saveMuted(muted) {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY, String(muted));
        } catch {
            // Ignore quota or private-browsing errors
        }
    }

    initUnlockListeners() {
        if (typeof window === 'undefined') return;

        const unlock = () => {
            if (this.isUnlocked) return;
            this.isUnlocked = true;
            this.preload();

            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('touchstart', unlock);
        };

        window.addEventListener('pointerdown', unlock, { once: true, passive: true });
        window.addEventListener('keydown', unlock, { once: true, passive: true });
        window.addEventListener('touchstart', unlock, { once: true, passive: true });
    }

    initVisibilityListener() {
        if (typeof document === 'undefined') return;
        if (this.hasVisibilityListener) return;
        this.hasVisibilityListener = true;
        document.addEventListener('visibilitychange', () => {
            if (this.muteOnHidden && document.hidden) {
                this.stopAll();
            }
        });
    }

    preload() {
        if (typeof window === 'undefined') return;
        for (const [name, config] of Object.entries(SOUNDS)) {
            if (!this.cache[name]) {
                try {
                    const audio = new Audio(config.src);
                    audio.preload = 'auto';
                    audio.volume = this.calculateVolume(config);
                    this.cache[name] = audio;
                } catch {
                    // Ignore audio instantiation errors in restricted environments
                }
            }
        }
    }

    calculateVolume(config) {
        const relative = (config.volume ?? DEFAULT_VOLUME) / DEFAULT_VOLUME;
        const base = relative * this.masterVolume;
        const multiplier = this.isDucked ? DUCKED_VOLUME_MULTIPLIER : 1.0;
        return Math.max(0, Math.min(1, base * multiplier));
    }

    setMasterVolume(vol) {
        this.masterVolume = Math.max(0, Math.min(1, Number(vol) || 0));
        // Update volumes on all cached sounds
        for (const [name, audio] of Object.entries(this.cache)) {
            const config = SOUNDS[name];
            if (config && audio) {
                try {
                    audio.volume = this.calculateVolume(config);
                } catch {
                    // Ignore volume setting errors
                }
            }
        }
    }

    setSoundEffects(enabled) {
        this.soundEffects = Boolean(enabled);
        if (!this.soundEffects) {
            this.stopAll();
        }
    }

    setHaptics(enabled) {
        this.haptics = Boolean(enabled);
    }

    setMuteOnHidden(enabled) {
        this.muteOnHidden = Boolean(enabled);
        if (this.muteOnHidden) {
            this.initVisibilityListener();
            if (typeof document !== 'undefined' && document.hidden) {
                this.stopAll();
            }
        }
    }

    setDucking(isSpeaking) {
        this.isDucked = Boolean(isSpeaking);
        // Update volumes on currently cached sounds
        for (const [name, audio] of Object.entries(this.cache)) {
            const config = SOUNDS[name];
            if (config && audio) {
                try {
                    audio.volume = this.calculateVolume(config);
                } catch {
                    // Ignore volume setting errors
                }
            }
        }
    }

    stopAll() {
        for (const audio of this.activeAudios) {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch {
                // Ignore pause errors
            }
        }
        this.activeAudios.clear();

        for (const audio of Object.values(this.cache)) {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch {
                // Ignore pause errors
            }
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopAll();
        }
        this.saveMuted(this.isMuted);
        this.notify();
        return this.isMuted;
    }

    setMuted(muted) {
        this.isMuted = Boolean(muted);
        if (this.isMuted) {
            this.stopAll();
        }
        this.saveMuted(this.isMuted);
        this.notify();
        return this.isMuted;
    }

    applySettings(settings) {
        if (!settings) return;
        if (settings.masterVolume !== undefined) {
            this.setMasterVolume(settings.masterVolume);
        }
        if (settings.soundEffects !== undefined) {
            this.setSoundEffects(settings.soundEffects);
        }
        if (settings.haptics !== undefined) {
            this.setHaptics(settings.haptics);
        }
        if (settings.muteOnHidden !== undefined) {
            this.setMuteOnHidden(settings.muteOnHidden);
        }
        if (settings.isMuted !== undefined) {
            this.setMuted(settings.isMuted);
        }
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify() {
        for (const listener of this.listeners) {
            try {
                listener({ isMuted: this.isMuted, isDucked: this.isDucked });
            } catch {
                // Ignore listener exceptions
            }
        }
    }

    vibrate(pattern) {
        if (!this.haptics) return;
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
                navigator.vibrate(pattern);
            } catch {
                // Ignore vibration errors
            }
        }
    }

    play(name) {
        if (this.isMuted || !this.soundEffects) return;
        if (this.muteOnHidden && typeof document !== 'undefined' && document.hidden) return;

        const resolved = ALIASES[name] || name;
        const config = SOUNDS[resolved];
        if (!config) return;

        // Haptic feedback triggers
        if (resolved === 'correct') {
            this.vibrate(50);
        } else if (resolved === 'roundEnd') {
            this.vibrate([80, 50, 80]);
        }

        if (typeof window === 'undefined') return;

        try {
            let audio = this.cache[resolved];
            if (!audio) {
                audio = new Audio(config.src);
                this.cache[resolved] = audio;
            }

            audio.volume = this.calculateVolume(config);
            audio.currentTime = 0;
            this.activeAudios.add(audio);

            const handleEnded = () => {
                this.activeAudios.delete(audio);
                audio.removeEventListener('ended', handleEnded);
            };
            audio.addEventListener('ended', handleEnded);

            const promise = audio.play();
            if (promise && typeof promise.catch === 'function') {
                promise.catch(() => {
                    this.activeAudios.delete(audio);
                });
            }
        } catch {
            // Ignore play failure
        }
    }
}

export const audioManager = new AudioManager();
export default audioManager;
