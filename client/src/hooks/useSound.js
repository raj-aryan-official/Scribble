import { useState, useEffect, useCallback } from 'react';
import { audioManager } from '../audio/manager';

export const useSound = () => {
    const [soundState, setSoundState] = useState(() => ({
        isMuted: audioManager.isMuted,
        isDucked: audioManager.isDucked,
    }));

    useEffect(() => {
        // Subscribe to central audio manager events
        const unsubscribe = audioManager.subscribe((next) => {
            setSoundState(next);
        });
        return unsubscribe;
    }, []);

    const toggleMute = useCallback(() => {
        return audioManager.toggleMute();
    }, []);

    const play = useCallback((name) => {
        audioManager.play(name);
    }, []);

    const setDucking = useCallback((isSpeaking) => {
        audioManager.setDucking(isSpeaking);
    }, []);

    return {
        isMuted: soundState.isMuted,
        isDucked: soundState.isDucked,
        toggleMute,
        play,
        setDucking,
    };
};

export default useSound;
