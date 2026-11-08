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
 * - Haptic vibration on correct guess (50ms) and round end ([80, 50, 80]ms) when supported.
 */

const STORAGE_KEY = 'scribble_muted';
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
        this.cache = {}; // soundName -> HTMLAudioElement
        this.listeners = new Set(); // Mute/state subscribers

        this.initUnlockListeners();
    }

    loadMuted() {
        if (typeof window === 'undefined') return false;
        try {
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
        const base = config.volume ?? this.masterVolume;
        const multiplier = this.isDucked ? DUCKED_VOLUME_MULTIPLIER : 1.0;
        return Math.max(0, Math.min(1, base * multiplier));
    }

    setDucking(isSpeaking) {
        this.isDucked = Boolean(isSpeaking);
        // Update volumes on currently cached sounds
        for (const [name, audio] of Object.entries(this.cache)) {
            const config = SOUNDS[name];
            if (config && audio) {
                audio.volume = this.calculateVolume(config);
            }
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.saveMuted(this.isMuted);
        this.notify();
        return this.isMuted;
    }

    setMuted(muted) {
        this.isMuted = Boolean(muted);
        this.saveMuted(this.isMuted);
        this.notify();
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
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
                navigator.vibrate(pattern);
            } catch {
                // Ignore vibration errors
            }
        }
    }

    play(name) {
        if (this.isMuted) return;

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
            const promise = audio.play();
            if (promise && typeof promise.catch === 'function') {
                promise.catch(() => {
                    // Autoplay prevented by browser gesture policy; ignore silently
                });
            }
        } catch {
            // Ignore play failure
        }
    }
}

export const audioManager = new AudioManager();
export default audioManager;

