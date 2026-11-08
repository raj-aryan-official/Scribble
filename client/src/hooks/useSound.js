import { useState, useEffect, useCallback } from 'react';
import { audioManager } from '../audio/manager';
import { useSettings } from '../context/SettingsContext';

export const useSound = () => {
    const { settings, toggleMute: settingsToggleMute } = useSettings();
    const [soundState, setSoundState] = useState(() => ({
        isMuted: settings?.isMuted ?? audioManager.isMuted,
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
        if (settingsToggleMute) {
            settingsToggleMute();
            return !settings?.isMuted;
        }
        return audioManager.toggleMute();
    }, [settingsToggleMute, settings?.isMuted]);

    const play = useCallback((name) => {
        audioManager.play(name);
    }, []);

    const setDucking = useCallback((isSpeaking) => {
        audioManager.setDucking(isSpeaking);
    }, []);

    return {
        isMuted: settings?.isMuted ?? soundState.isMuted,
        isDucked: soundState.isDucked,
        toggleMute,
        play,
        setDucking,
    };
};

export default useSound;
