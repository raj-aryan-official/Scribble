import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { audioManager } from '../audio/manager';

export const SETTINGS_KEY = 'scribble_settings';
export const SOUND_HINT_KEY = 'scribble_sound_hint_dismissed';
export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS = {
    version: SETTINGS_VERSION,
    isMuted: false,
    masterVolume: 0.4,
    soundEffects: true,
    voiceOutput: true,
    haptics: true,
    tabTitleFlash: true,
    reducedMotion: false,
    colorBlindPalette: false,
    textSize: 100, // 100 | 115 | 130
    leftHandedLayout: false,
    paperGrid: false,
    muteOnHidden: false,
    alwaysPickRandomly: false,
};

/**
 * Safe storage resolver for browser and test environments
 */
export function getStorage() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        // Ignore restricted window.localStorage
    }
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage;
        }
    } catch {
        // Ignore restricted localStorage
    }
    return null;
}

/**
 * Migrate settings from older schemas or legacy storage keys.
 */
export function migrateSettings(raw) {
    let legacyMuted = false;
    try {
        const storage = getStorage();
        if (storage) {
            legacyMuted = storage.getItem('scribble_muted') === 'true';
        }
    } catch {
        // Ignore storage access errors
    }

    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_SETTINGS, isMuted: legacyMuted };
    }

    // Merge onto defaults
    const migrated = {
        ...DEFAULT_SETTINGS,
        isMuted: legacyMuted,
        ...raw,
        version: SETTINGS_VERSION,
    };

    // Normalize types & bounds
    migrated.masterVolume = Math.max(0, Math.min(1, typeof migrated.masterVolume === 'number' ? migrated.masterVolume : 0.4));
    migrated.textSize = [100, 115, 130].includes(Number(migrated.textSize)) ? Number(migrated.textSize) : 100;
    migrated.isMuted = Boolean(migrated.isMuted);
    migrated.soundEffects = Boolean(migrated.soundEffects);
    migrated.voiceOutput = Boolean(migrated.voiceOutput);
    migrated.haptics = Boolean(migrated.haptics);
    migrated.tabTitleFlash = Boolean(migrated.tabTitleFlash);
    migrated.reducedMotion = Boolean(migrated.reducedMotion);
    migrated.colorBlindPalette = Boolean(migrated.colorBlindPalette);
    migrated.leftHandedLayout = Boolean(migrated.leftHandedLayout);
    migrated.paperGrid = Boolean(migrated.paperGrid);
    migrated.muteOnHidden = Boolean(migrated.muteOnHidden);
    migrated.alwaysPickRandomly = Boolean(migrated.alwaysPickRandomly);

    return migrated;
}

/**
 * Safe load from localStorage inside try/catch.
 */
export function loadSettings() {
    try {
        const storage = getStorage();
        if (!storage) return { ...DEFAULT_SETTINGS };
        const item = storage.getItem(SETTINGS_KEY);
        if (!item) return migrateSettings(null);
        const parsed = JSON.parse(item);
        return migrateSettings(parsed);
    } catch {
        // Fallback to safe defaults if localStorage is blocked or throws
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * Safe save to localStorage inside try/catch.
 */
export function saveSettings(settings) {
    try {
        const storage = getStorage();
        if (!storage) return;
        storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        // Keep legacy key synced for backwards compatibility
        storage.setItem('scribble_muted', String(settings.isMuted));
    } catch {
        // Ignore quota/security errors in sandboxed/incognito contexts
    }
}

/**
 * Sound hint dismissed status helpers
 */
export function loadSoundHintDismissed() {
    try {
        const storage = getStorage();
        if (!storage) return false;
        return storage.getItem(SOUND_HINT_KEY) === 'true';
    } catch {
        return false;
    }
}

export function saveSoundHintDismissed() {
    try {
        const storage = getStorage();
        if (!storage) return;
        storage.setItem(SOUND_HINT_KEY, 'true');
    } catch {
        // Ignore blocked storage
    }
}

export const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => loadSettings());
    const [soundHintDismissed, setSoundHintDismissed] = useState(() => loadSoundHintDismissed());
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Apply audio settings to central AudioManager
    useEffect(() => {
        audioManager.applySettings(settings);
    }, [settings]);

    // Apply text size scaling to root document element
    useEffect(() => {
        if (typeof document !== 'undefined' && document.documentElement) {
            if (settings.textSize === 100) {
                document.documentElement.style.fontSize = '';
            } else {
                document.documentElement.style.fontSize = `${settings.textSize}%`;
            }
        }
    }, [settings.textSize]);

    const updateSettings = useCallback((partial) => {
        setSettings((prev) => {
            const next = { ...prev, ...partial };
            saveSettings(next);
            return next;
        });
    }, []);

    const toggleMute = useCallback(() => {
        setSettings((prev) => {
            const nextMuted = !prev.isMuted;
            const next = { ...prev, isMuted: nextMuted };
            saveSettings(next);
            audioManager.setMuted(nextMuted);
            return next;
        });
        setSoundHintDismissed(true);
        saveSoundHintDismissed();
    }, []);

    const dismissSoundHint = useCallback(() => {
        setSoundHintDismissed(true);
        saveSoundHintDismissed();
    }, []);

    const resetSettings = useCallback(() => {
        const next = { ...DEFAULT_SETTINGS };
        setSettings(next);
        saveSettings(next);
        audioManager.applySettings(next);
    }, []);

    // Global 'M' shortcut listener: toggles mute unless user is typing in a form input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'm' || e.key === 'M') {
                const target = e.target;
                const tagName = target?.tagName?.toLowerCase();
                if (
                    tagName === 'input' ||
                    tagName === 'textarea' ||
                    tagName === 'select' ||
                    target?.isContentEditable
                ) {
                    return;
                }
                e.preventDefault();
                toggleMute();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleMute]);

    const value = useMemo(
        () => ({
            settings,
            updateSettings,
            toggleMute,
            resetSettings,
            soundHintDismissed,
            dismissSoundHint,
            isSettingsOpen,
            setIsSettingsOpen,
            openSettings: () => setIsSettingsOpen(true),
            closeSettings: () => setIsSettingsOpen(false),
        }),
        [
            settings,
            updateSettings,
            toggleMute,
            resetSettings,
            soundHintDismissed,
            dismissSoundHint,
            isSettingsOpen,
        ]
    );

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        // Safe fallback for isolated unit tests rendered outside of SettingsProvider
        return {
            settings: DEFAULT_SETTINGS,
            updateSettings: () => {},
            toggleMute: () => audioManager.toggleMute(),
            resetSettings: () => {},
            soundHintDismissed: true,
            dismissSoundHint: () => {},
            isSettingsOpen: false,
            setIsSettingsOpen: () => {},
            openSettings: () => {},
            closeSettings: () => {},
        };
    }
    return context;
};

export default SettingsContext;
