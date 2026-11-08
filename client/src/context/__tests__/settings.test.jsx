import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    DEFAULT_SETTINGS,
    SETTINGS_KEY,
    SOUND_HINT_KEY,
    migrateSettings,
    loadSettings,
    saveSettings,
    loadSoundHintDismissed,
    saveSoundHintDismissed,
    SettingsContext,
    SettingsProvider,
} from '../SettingsContext';
import { audioManager } from '../../audio/manager';
import SettingsModal from '../../components/Settings/SettingsModal';
import SoundHint from '../../components/Settings/SoundHint';
import GameBar from '../../components/Game/GameBar';
import AppHeader from '../../components/Layout/AppHeader';
import Landing from '../../pages/Landing';
import ToolTray from '../../components/Canvas/ToolTray';
import ColorSwatches, { PRESET_COLORS, COLORBLIND_PALETTE } from '../../components/Canvas/ColorSwatches';
import DrawingCanvas from '../../components/Canvas/DrawingCanvas';
import { GameContext } from '../GameContext';

describe('Prompt 10: Sound Toggle, Settings Panel & Accessibility', () => {
    let mockStorage = {};
    let storageMock = null;

    beforeEach(() => {
        mockStorage = {};
        storageMock = {
            getItem: vi.fn((key) => mockStorage[key] || null),
            setItem: vi.fn((key, val) => {
                mockStorage[key] = String(val);
            }),
            removeItem: vi.fn((key) => {
                delete mockStorage[key];
            }),
            clear: vi.fn(() => {
                mockStorage = {};
            }),
        };

        vi.stubGlobal('localStorage', storageMock);
        if (typeof window !== 'undefined') {
            window.localStorage = storageMock;
        } else {
            vi.stubGlobal('window', { localStorage: storageMock });
        }

        audioManager.setMuted(false);
        audioManager.setMasterVolume(0.4);
        audioManager.setSoundEffects(true);
        audioManager.setHaptics(true);
        audioManager.setMuteOnHidden(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('1. Settings Storage, Migration & Blocked Fallback', () => {
        it('has correct DEFAULT_SETTINGS with all 12 options and version 1', () => {
            expect(DEFAULT_SETTINGS.version).toBe(1);
            expect(DEFAULT_SETTINGS.isMuted).toBe(false);
            expect(DEFAULT_SETTINGS.masterVolume).toBe(0.4);
            expect(DEFAULT_SETTINGS.soundEffects).toBe(true);
            expect(DEFAULT_SETTINGS.voiceOutput).toBe(true);
            expect(DEFAULT_SETTINGS.haptics).toBe(true);
            expect(DEFAULT_SETTINGS.tabTitleFlash).toBe(true);
            expect(DEFAULT_SETTINGS.reducedMotion).toBe(false);
            expect(DEFAULT_SETTINGS.colorBlindPalette).toBe(false);
            expect(DEFAULT_SETTINGS.textSize).toBe(100);
            expect(DEFAULT_SETTINGS.leftHandedLayout).toBe(false);
            expect(DEFAULT_SETTINGS.paperGrid).toBe(false);
            expect(DEFAULT_SETTINGS.muteOnHidden).toBe(false);
        });

        it('migrates legacy scribble_muted from localStorage when no settings exist', () => {
            mockStorage['scribble_muted'] = 'true';
            const settings = migrateSettings(null);
            expect(settings.isMuted).toBe(true);
            expect(settings.masterVolume).toBe(0.4);
            expect(settings.soundEffects).toBe(true);
        });

        it('migrates older or partial settings object and supplies defaults', () => {
            const raw = {
                version: 0,
                masterVolume: 0.8,
                textSize: 130,
            };
            const migrated = migrateSettings(raw);
            expect(migrated.version).toBe(1);
            expect(migrated.masterVolume).toBe(0.8);
            expect(migrated.textSize).toBe(130);
            expect(migrated.soundEffects).toBe(true);
            expect(migrated.leftHandedLayout).toBe(false);
        });

        it('falls back to DEFAULT_SETTINGS when localStorage throws a security error', () => {
            storageMock.getItem.mockImplementation(() => {
                throw new Error('SecurityError: The operation is insecure.');
            });
            const loaded = loadSettings();
            expect(loaded).toEqual(DEFAULT_SETTINGS);
        });

        it('saves settings safely and does not crash when localStorage is full/blocked', () => {
            storageMock.setItem.mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });
            expect(() => saveSettings({ ...DEFAULT_SETTINGS, masterVolume: 0.9 })).not.toThrow();
        });

        it('saves settings and syncs scribble_muted key', () => {
            saveSettings({ ...DEFAULT_SETTINGS, isMuted: true });
            expect(mockStorage['scribble_settings']).toContain('"isMuted":true');
            expect(mockStorage['scribble_muted']).toBe('true');
        });

        it('loads and saves one-time sound hint dismissed flag', () => {
            expect(loadSoundHintDismissed()).toBe(false);
            saveSoundHintDismissed();
            expect(loadSoundHintDismissed()).toBe(true);
        });
    });

    describe('2. Audio Manager Silence & Lifecycle', () => {
        it('muting immediately pauses all currently playing audio elements and resets currentTime to 0', () => {
            const pauseSpy = vi.fn();
            let currentTimeVal = 12.5;

            const fakeAudio = {
                pause: pauseSpy,
                get currentTime() {
                    return currentTimeVal;
                },
                set currentTime(val) {
                    currentTimeVal = val;
                },
                volume: 0.4,
                play: vi.fn().mockResolvedValue(undefined),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            };

            audioManager.cache['tick'] = fakeAudio;
            audioManager.activeAudios.add(fakeAudio);

            // Mute audio
            audioManager.setMuted(true);

            expect(pauseSpy).toHaveBeenCalled();
            expect(currentTimeVal).toBe(0);
            expect(audioManager.activeAudios.size).toBe(0);
            expect(audioManager.isMuted).toBe(true);
        });

        it('toggleMute toggles mute and calls stopAll', () => {
            const pauseSpy = vi.fn();
            const fakeAudio = {
                pause: pauseSpy,
                currentTime: 5,
                volume: 0.4,
            };
            audioManager.cache['pencilTap'] = fakeAudio;
            audioManager.setMuted(false);

            audioManager.toggleMute();
            expect(audioManager.isMuted).toBe(true);
            expect(pauseSpy).toHaveBeenCalled();
            expect(fakeAudio.currentTime).toBe(0);

            audioManager.toggleMute();
            expect(audioManager.isMuted).toBe(false);
        });

        it('setting master volume updates volume on all cached audio elements proportionally', () => {
            const audioPencil = { volume: 0.4 };
            const audioTick = { volume: 0.35 };
            audioManager.cache['pencilTap'] = audioPencil;
            audioManager.cache['tick'] = audioTick;

            // At master volume 0.8 (double)
            audioManager.setMasterVolume(0.8);
            expect(audioManager.masterVolume).toBe(0.8);
            expect(audioPencil.volume).toBeCloseTo(0.8);
            expect(audioTick.volume).toBeCloseTo(0.7);

            // At master volume 0
            audioManager.setMasterVolume(0);
            expect(audioPencil.volume).toBe(0);
            expect(audioTick.volume).toBe(0);
        });

        it('does not play sounds when muted', () => {
            const playSpy = vi.fn();
            audioManager.cache['pencilTap'] = {
                volume: 0.4,
                currentTime: 0,
                play: playSpy,
                addEventListener: vi.fn(),
            };

            audioManager.setMuted(true);
            audioManager.play('pencilTap');
            expect(playSpy).not.toHaveBeenCalled();
        });

        it('does not play sounds when soundEffects is false', () => {
            const playSpy = vi.fn();
            audioManager.cache['pencilTap'] = {
                volume: 0.4,
                currentTime: 0,
                play: playSpy,
                addEventListener: vi.fn(),
            };

            audioManager.setMuted(false);
            audioManager.setSoundEffects(false);
            audioManager.play('pencilTap');
            expect(playSpy).not.toHaveBeenCalled();
        });

        it('respects muteOnHidden when document.hidden is true', () => {
            const pauseSpy = vi.fn();
            const fakeAudio = {
                pause: pauseSpy,
                currentTime: 2,
                volume: 0.4,
            };
            audioManager.cache['tick'] = fakeAudio;
            audioManager.activeAudios.add(fakeAudio);

            // Setup document mock if needed
            if (typeof document === 'undefined') {
                const docMock = new EventTarget();
                docMock.hidden = true;
                vi.stubGlobal('document', docMock);
            } else {
                Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            }

            audioManager.setMuteOnHidden(true);
            document.dispatchEvent(new Event('visibilitychange'));

            expect(pauseSpy).toHaveBeenCalled();
            expect(fakeAudio.currentTime).toBe(0);
        });

        it('triggers haptic vibration on correct guess only when haptics is enabled', () => {
            const vibrateSpy = vi.fn();
            vi.stubGlobal('navigator', { vibrate: vibrateSpy });

            audioManager.setMuted(false);
            audioManager.setHaptics(true);
            audioManager.play('correct');
            expect(vibrateSpy).toHaveBeenCalledWith(50);

            vibrateSpy.mockClear();
            audioManager.setHaptics(false);
            audioManager.play('correct');
            expect(vibrateSpy).not.toHaveBeenCalled();
        });
    });

    describe('3. Settings Panel (SettingsModal) UI & Accessibility', () => {
        it('renders dialog with accessible labels, sliders, and toggles for all options', () => {
            const mockContextValue = {
                settings: DEFAULT_SETTINGS,
                updateSettings: vi.fn(),
                resetSettings: vi.fn(),
                soundHintDismissed: true,
                dismissSoundHint: vi.fn(),
                isSettingsOpen: true,
                setIsSettingsOpen: vi.fn(),
                openSettings: vi.fn(),
                closeSettings: vi.fn(),
            };

            const html = renderToStaticMarkup(
                <SettingsContext.Provider value={mockContextValue}>
                    <SettingsModal isOpen={true} onClose={vi.fn()} />
                </SettingsContext.Provider>
            );

            expect(html).toContain('role="dialog"');
            expect(html).toContain('aria-modal="true"');
            expect(html).toContain('Settings');
            expect(html).toContain('aria-label="Close settings"');

            // Sliders & Toggles
            expect(html).toContain('aria-label="Master volume"');
            expect(html).toContain('40%');
            expect(html).toContain('Sound Effects');
            expect(html).toContain('Voice Chat Output');
            expect(html).toContain('Mute in Background');
            expect(html).toContain('Text Size');
            expect(html).toContain('Reduce Motion');
            expect(html).toContain('Colorblind-Friendly Palette');
            expect(html).toContain('Haptic Feedback');
            expect(html).toContain('Flash Tab Title');
            expect(html).toContain('Left-Handed Mode');
            expect(html).toContain('Paper Grid');
            expect(html).toContain('Keyboard Shortcuts');
            expect(html).toContain('Reset defaults');
        });
    });

    describe('4. Component Integration with Settings & Sound Toggle', () => {
        const dummyGameState = {
            gameState: 'DRAWING',
            roomCode: 'SND123',
            currentRound: 1,
            totalRounds: 3,
            turnInfo: { turnInRound: 1, turnsInRound: 2 },
            drawerId: 'p1',
            currentUser: { id: 'p1', username: 'Maya', isHost: true },
            players: [{ id: 'p1', username: 'Maya', isHost: true }],
            wordToGuess: 'BANANA',
            timer: 45,
            settings: { drawTime: 60, rounds: 3 },
            guessedPlayers: [],
        };

        it('GameBar renders sound toggle with aria-pressed, tooltip label, one-time hint, and gear button', () => {
            const mockSettings = {
                ...DEFAULT_SETTINGS,
                isMuted: false,
            };
            const mockContextValue = {
                settings: mockSettings,
                updateSettings: vi.fn(),
                toggleMute: vi.fn(),
                resetSettings: vi.fn(),
                soundHintDismissed: false, // Show hint!
                dismissSoundHint: vi.fn(),
                isSettingsOpen: false,
                openSettings: vi.fn(),
                closeSettings: vi.fn(),
            };

            const html = renderToStaticMarkup(
                <SettingsContext.Provider value={mockContextValue}>
                    <GameContext.Provider value={{ state: dummyGameState, dispatch: vi.fn() }}>
                        <GameBar />
                    </GameContext.Provider>
                </SettingsContext.Provider>
            );

            // Sound Toggle
            expect(html).toContain('aria-label="Mute audio"');
            expect(html).toContain('aria-pressed="false"');
            // One-time hint
            expect(html).toContain('Sound is on. Tap to mute.');
            expect(html).toContain('data-testid="sound-hint-bubble"');
            // Settings Gear Button
            expect(html).toContain('aria-label="Settings"');
        });

        it('GameBar shows slashed icon and muted state when isMuted is true', () => {
            const mockSettings = {
                ...DEFAULT_SETTINGS,
                isMuted: true,
            };
            const mockContextValue = {
                settings: mockSettings,
                updateSettings: vi.fn(),
                toggleMute: vi.fn(),
                resetSettings: vi.fn(),
                soundHintDismissed: true,
                dismissSoundHint: vi.fn(),
                isSettingsOpen: false,
                openSettings: vi.fn(),
                closeSettings: vi.fn(),
            };

            const html = renderToStaticMarkup(
                <SettingsContext.Provider value={mockContextValue}>
                    <GameContext.Provider value={{ state: dummyGameState, dispatch: vi.fn() }}>
                        <GameBar />
                    </GameContext.Provider>
                </SettingsContext.Provider>
            );

            expect(html).toContain('aria-label="Unmute audio"');
            expect(html).toContain('aria-pressed="true"');
            expect(html).not.toContain('Sound is on. Tap to mute.');
        });

        it('AppHeader renders sound toggle, one-time hint, and settings gear button', () => {
            const mockSettings = { ...DEFAULT_SETTINGS, isMuted: false };
            const mockContextValue = {
                settings: mockSettings,
                soundHintDismissed: false,
                dismissSoundHint: vi.fn(),
                openSettings: vi.fn(),
                toggleMute: vi.fn(),
            };

            const html = renderToStaticMarkup(
                <SettingsContext.Provider value={mockContextValue}>
                    <GameContext.Provider value={{ state: dummyGameState, dispatch: vi.fn() }}>
                        <AppHeader />
                    </GameContext.Provider>
                </SettingsContext.Provider>
            );

            expect(html).toContain('aria-label="Mute sounds"');
            expect(html).toContain('Sound is on. Tap to mute.');
            expect(html).toContain('aria-label="Settings"');
        });

        it('ToolTray flips layout when leftHandedLayout is true', () => {
            // Standard layout
            const standardHtml = renderToStaticMarkup(
                <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, leftHandedLayout: false } }}>
                    <ToolTray />
                </SettingsContext.Provider>
            );
            expect(standardHtml).toContain('data-layout="right-handed"');
            expect(standardHtml).not.toContain('sm:flex-row-reverse');

            // Left-handed layout
            const leftHandedHtml = renderToStaticMarkup(
                <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, leftHandedLayout: true } }}>
                    <ToolTray />
                </SettingsContext.Provider>
            );
            expect(leftHandedHtml).toContain('data-layout="left-handed"');
            expect(leftHandedHtml).toContain('sm:flex-row-reverse');
        });

        it('ColorSwatches switches to COLORBLIND_PALETTE when colorBlindPalette is true', () => {
            // Standard
            const standardHtml = renderToStaticMarkup(
                <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, colorBlindPalette: false } }}>
                    <ColorSwatches />
                </SettingsContext.Provider>
            );
            expect(standardHtml).toContain('data-palette="standard"');
            expect(standardHtml).toContain('Tomato Red');

            // Colorblind
            const colorblindHtml = renderToStaticMarkup(
                <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, colorBlindPalette: true } }}>
                    <ColorSwatches />
                </SettingsContext.Provider>
            );
            expect(colorblindHtml).toContain('data-palette="colorblind"');
            expect(colorblindHtml).toContain('Bluish Green');
            expect(colorblindHtml).toContain('Sky Blue');
        });

        it('DrawingCanvas renders paper-grid overlay when paperGrid is true', () => {
            const noGridHtml = renderToStaticMarkup(
                <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, paperGrid: false } }}>
                    <DrawingCanvas roomCode="TEST1" isDrawer={true} />
                </SettingsContext.Provider>
            );
            expect(noGridHtml).not.toContain('data-testid="paper-grid"');

            const gridHtml = renderToStaticMarkup(
                <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, paperGrid: true } }}>
                    <DrawingCanvas roomCode="TEST1" isDrawer={true} />
                </SettingsContext.Provider>
            );
            expect(gridHtml).toContain('data-testid="paper-grid"');
        });
    });
});
