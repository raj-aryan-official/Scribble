import { useState, useEffect, useRef, useCallback } from 'react';

const SOUND_FILES = {
    pencilTap: '/sounds/pencil-tap.wav',
    joinPop: '/sounds/join-pop.wav',
    tick: '/sounds/tick.wav',
    correct: '/sounds/correct-guess.wav',
    roundEnd: '/sounds/round-end.wav',
    win: '/sounds/win.wav',
};

// Aliases for compatibility
const ALIASES = {
    pop: 'joinPop',
    end: 'roundEnd',
    'pencil-tap': 'pencilTap',
    'join-pop': 'joinPop',
    'correct-guess': 'correct',
    'round-end': 'roundEnd',
};

const DEFAULT_VOLUME = 0.4;

const getInitialMute = () => {
    try {
        const stored = localStorage.getItem('scribble_muted');
        return stored === 'true';
    } catch {
        return false;
    }
};

export const useSound = () => {
    const [isMuted, setIsMuted] = useState(getInitialMute);
    const audioCacheRef = useRef({});
    const hasInteractedRef = useRef(false);

    // Save mute state to localStorage
    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('scribble_muted', String(next));
            } catch {
                // Ignore storage errors (incognito quota, etc.)
            }
            return next;
        });
    }, []);

    // Lazy preloading after first user interaction
    const preloadSounds = useCallback(() => {
        if (hasInteractedRef.current) return;
        hasInteractedRef.current = true;

        Object.entries(SOUND_FILES).forEach(([key, url]) => {
            try {
                const audio = new Audio();
                audio.src = url;
                audio.preload = 'auto';
                audio.volume = DEFAULT_VOLUME;
                audioCacheRef.current[key] = audio;
            } catch {
                // Ignore audio init errors
            }
        });
    }, []);

    useEffect(() => {
        const handleInteraction = () => {
            preloadSounds();
            window.removeEventListener('pointerdown', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };

        window.addEventListener('pointerdown', handleInteraction, { once: true });
        window.addEventListener('keydown', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('pointerdown', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [preloadSounds]);

    const play = useCallback((name) => {
        if (isMuted) return;

        const resolvedName = ALIASES[name] || name;
        const fileUrl = SOUND_FILES[resolvedName];
        if (!fileUrl) return;

        // Trigger vibration when supported
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
                if (resolvedName === 'correct') {
                    navigator.vibrate(50);
                } else if (resolvedName === 'roundEnd') {
                    navigator.vibrate([80, 50, 80]);
                }
            } catch {
                // Ignore vibration errors
            }
        }

        try {
            // Use cached audio or instantiate
            let audio = audioCacheRef.current[resolvedName];
            if (!audio) {
                audio = new Audio(fileUrl);
                audio.volume = DEFAULT_VOLUME;
                audioCacheRef.current[resolvedName] = audio;
            }

            // Reset and play
            audio.currentTime = 0;
            audio.volume = DEFAULT_VOLUME;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    // Autoplay prevented; ignore silently
                });
            }
        } catch {
            // Ignore audio play errors
        }
    }, [isMuted]);

    return {
        isMuted,
        toggleMute,
        play,
    };
};

export default useSound;
