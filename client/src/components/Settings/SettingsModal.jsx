import React, { useState, useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Volume2,
    VolumeX,
    Sparkles,
    Eye,
    Palette,
    Grid,
    Smartphone,
    RotateCcw,
    Keyboard,
    Sliders,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import Button from '../ui/Button';

/**
 * Accessible Neo-brutalist Toggle Switch
 */
const ToggleSwitch = ({ id, label, description, checked, onChange, disabled = false }) => {
    return (
        <div className="flex items-center justify-between gap-3 py-2">
            <div className="flex flex-col text-left">
                <label
                    htmlFor={id}
                    className="text-xs sm:text-sm font-bold text-ink select-none cursor-pointer"
                >
                    {label}
                </label>
                {description && (
                    <span className="text-[11px] sm:text-xs text-ink-soft select-none">
                        {description}
                    </span>
                )}
            </div>
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        onChange(!checked);
                    }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-ink p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1 ${
                    checked ? 'bg-leaf' : 'bg-paper'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
                <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 rounded-full border-2 border-ink bg-card shadow-sm transition-transform ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
};

export const SettingsModal = ({ isOpen, onClose }) => {
    const titleId = useId();
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);
    const { settings, updateSettings, resetSettings } = useSettings();
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Save and restore focus
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement;
        } else if (previousActiveElement.current) {
            previousActiveElement.current.focus?.();
            previousActiveElement.current = null;
        }
    }, [isOpen]);

    // Escape listener and focus trap
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
                return;
            }

            if (e.key === 'Tab') {
                const modal = modalRef.current;
                if (!modal) return;

                const focusable = modal.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) {
                    e.preventDefault();
                    return;
                }

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Initial focus
    useEffect(() => {
        if (isOpen && modalRef.current) {
            const focusable = modalRef.current.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable) {
                focusable.focus();
            } else {
                modalRef.current.focus();
            }
        }
    }, [isOpen]);

    const masterVolumePercent = Math.round((settings.masterVolume ?? 0.4) * 100);

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-modal flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/60"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose?.();
                        }
                    }}
                >
                    {/*
                      Desktop: Popover / Centered Card (max-w-md md:rounded-[12px])
                      Phone: Slide-up Bottom Sheet (w-full rounded-t-[16px])
                    */}
                    <motion.div
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        tabIndex={-1}
                        initial={{ opacity: 0, y: 40, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        className="relative w-full max-w-lg bg-card border-t-2 md:border-2 border-ink shadow-hard-lg rounded-t-[16px] md:rounded-[12px] p-4 sm:p-6 text-ink max-h-[85vh] md:max-h-[85vh] flex flex-col outline-none select-none"
                    >
                        {/* Mobile Drag/Grab Pill Handle */}
                        <div className="flex md:hidden justify-center pb-2">
                            <span className="w-10 h-1 rounded-full bg-ink/30" />
                        </div>

                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b-2 border-ink/15 shrink-0">
                            <div className="flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-cobalt" />
                                <h2 id={titleId} className="text-lg sm:text-xl font-heading font-black text-ink">
                                    Settings
                                </h2>
                            </div>
                            <Button
                                variant="quiet"
                                size="sm"
                                onClick={onClose}
                                aria-label="Close settings"
                                className="p-1 min-h-[36px] w-[36px] text-ink hover:bg-ink/10 rounded-[6px]"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 divide-y divide-ink/10 pr-1">
                            {/* Section 1: Audio & Sound */}
                            <div className="pb-3 flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                                    Audio & Sounds
                                </span>

                                {/* Master Volume Slider */}
                                <div className="flex flex-col gap-1.5 py-1">
                                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-ink">
                                        <div className="flex items-center gap-1.5">
                                            {settings.isMuted || masterVolumePercent === 0 ? (
                                                <VolumeX className="w-4 h-4 text-tomato" />
                                            ) : (
                                                <Volume2 className="w-4 h-4 text-ink" />
                                            )}
                                            <span>Master Volume</span>
                                        </div>
                                        <span className="font-mono tabular-nums text-ink-soft">
                                            {masterVolumePercent}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={settings.masterVolume ?? 0.4}
                                        aria-label="Master volume"
                                        onChange={(e) =>
                                            updateSettings({ masterVolume: parseFloat(e.target.value) })
                                        }
                                        className="w-full accent-cobalt cursor-pointer h-2 bg-paper rounded-lg border border-ink"
                                    />
                                </div>

                                {/* Sound Effects */}
                                <ToggleSwitch
                                    id="setting-sound-effects"
                                    label="Sound Effects"
                                    description="Taps, timer ticks, and round-end sounds"
                                    checked={settings.soundEffects}
                                    onChange={(val) => updateSettings({ soundEffects: val })}
                                />

                                {/* Voice Chat Output (Deafen) */}
                                <ToggleSwitch
                                    id="setting-voice-output"
                                    label="Voice Chat Output"
                                    description="Hear other players speaking in voice chat (Deafen)"
                                    checked={settings.voiceOutput}
                                    onChange={(val) => updateSettings({ voiceOutput: val })}
                                />

                                {/* Mute When Tab Hidden */}
                                <ToggleSwitch
                                    id="setting-mute-on-hidden"
                                    label="Mute in Background"
                                    description="Silence sounds when switching tabs or window is hidden"
                                    checked={settings.muteOnHidden}
                                    onChange={(val) => updateSettings({ muteOnHidden: val })}
                                />
                            </div>

                            {/* Section 2: Accessibility & Comfort */}
                            <div className="py-3 flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                                    Accessibility & Display
                                </span>

                                {/* Text Size Segmented Selector */}
                                <div className="flex items-center justify-between gap-2 py-1">
                                    <div className="flex flex-col text-left">
                                        <span className="text-xs sm:text-sm font-bold text-ink">Text Size</span>
                                        <span className="text-[11px] text-ink-soft">Overall typography scaling</span>
                                    </div>
                                    <div
                                        role="radiogroup"
                                        aria-label="Text size"
                                        className="flex items-center gap-1 bg-paper p-1 border-2 border-ink rounded-[6px]"
                                    >
                                        {[100, 115, 130].map((size) => {
                                            const isSelected = (settings.textSize ?? 100) === size;
                                            return (
                                                <button
                                                    key={size}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={isSelected}
                                                    onClick={() => updateSettings({ textSize: size })}
                                                    className={`px-2 py-1 text-xs font-black rounded-[4px] cursor-pointer transition-colors ${
                                                        isSelected
                                                            ? 'bg-cobalt text-white shadow-hard-xs border border-ink'
                                                            : 'text-ink-soft hover:text-ink hover:bg-card'
                                                    }`}
                                                >
                                                    {size}%
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Reduce Motion (Overrides OS) */}
                                <ToggleSwitch
                                    id="setting-reduce-motion"
                                    label="Reduce Motion"
                                    description="Disable spring animations and transitions"
                                    checked={settings.reducedMotion}
                                    onChange={(val) => updateSettings({ reducedMotion: val })}
                                />

                                {/* Colorblind-Friendly Palette */}
                                <ToggleSwitch
                                    id="setting-colorblind-palette"
                                    label="Colorblind-Friendly Palette"
                                    description="High-contrast swatches for drawing paper"
                                    checked={settings.colorBlindPalette}
                                    onChange={(val) => updateSettings({ colorBlindPalette: val })}
                                />

                                {/* Haptic Feedback */}
                                <ToggleSwitch
                                    id="setting-haptics"
                                    label="Haptic Feedback"
                                    description="Vibrate on correct guesses and round ends"
                                    checked={settings.haptics}
                                    onChange={(val) => updateSettings({ haptics: val })}
                                />

                                {/* Tab Title Flash */}
                                <ToggleSwitch
                                    id="setting-tab-title-flash"
                                    label="Flash Tab Title"
                                    description="Alert in tab title when it's your turn to draw"
                                    checked={settings.tabTitleFlash}
                                    onChange={(val) => updateSettings({ tabTitleFlash: val })}
                                />
                            </div>

                            {/* Section 3: Drawing Canvas & Layout */}
                            <div className="py-3 flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                                    Drawing & Layout
                                </span>

                                {/* Left-Handed Mode (tools on right) */}
                                <ToggleSwitch
                                    id="setting-left-handed"
                                    label="Left-Handed Mode"
                                    description="Place drawing tools on the right side of the canvas"
                                    checked={settings.leftHandedLayout}
                                    onChange={(val) => updateSettings({ leftHandedLayout: val })}
                                />

                                {/* Paper Grid */}
                                <ToggleSwitch
                                    id="setting-paper-grid"
                                    label="Paper Grid"
                                    description="Display faint grid guidelines on drawing paper"
                                    checked={settings.paperGrid}
                                    onChange={(val) => updateSettings({ paperGrid: val })}
                                />
                            </div>

                            {/* Section 4: Gameplay */}
                            <div className="py-3 flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                                    Gameplay
                                </span>

                                {/* Always pick randomly for me */}
                                <ToggleSwitch
                                    id="setting-always-pick-randomly"
                                    label="Always pick randomly for me"
                                    description="Auto-select default card after 1 second on your turn to draw"
                                    checked={Boolean(settings.alwaysPickRandomly)}
                                    onChange={(val) => updateSettings({ alwaysPickRandomly: val })}
                                />
                            </div>

                            {/* Section 5: Keyboard Shortcuts Collapsible */}
                            <div className="py-3">
                                <button
                                    type="button"
                                    onClick={() => setShowShortcuts((prev) => !prev)}
                                    aria-expanded={showShortcuts}
                                    className="w-full flex items-center justify-between text-left py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt rounded-[4px]"
                                >
                                    <div className="flex items-center gap-2">
                                        <Keyboard className="w-4 h-4 text-cobalt" />
                                        <span className="text-xs sm:text-sm font-bold text-ink">
                                            Keyboard Shortcuts
                                        </span>
                                    </div>
                                    {showShortcuts ? (
                                        <ChevronUp className="w-4 h-4 text-ink-soft" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-ink-soft" />
                                    )}
                                </button>

                                {showShortcuts && (
                                    <div className="mt-2.5 p-2.5 bg-paper rounded-[8px] border border-ink/20 grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center justify-between pr-2">
                                            <span className="text-ink-soft">Mute Audio</span>
                                            <kbd className="px-1.5 py-0.5 font-mono font-bold bg-card border border-ink/30 rounded text-[11px]">
                                                M
                                            </kbd>
                                        </div>
                                        <div className="flex items-center justify-between pr-2">
                                            <span className="text-ink-soft">Pencil Tool</span>
                                            <kbd className="px-1.5 py-0.5 font-mono font-bold bg-card border border-ink/30 rounded text-[11px]">
                                                P / B
                                            </kbd>
                                        </div>
                                        <div className="flex items-center justify-between pr-2">
                                            <span className="text-ink-soft">Eraser Tool</span>
                                            <kbd className="px-1.5 py-0.5 font-mono font-bold bg-card border border-ink/30 rounded text-[11px]">
                                                E
                                            </kbd>
                                        </div>
                                        <div className="flex items-center justify-between pr-2">
                                            <span className="text-ink-soft">Undo Stroke</span>
                                            <kbd className="px-1.5 py-0.5 font-mono font-bold bg-card border border-ink/30 rounded text-[11px]">
                                                Ctrl+Z
                                            </kbd>
                                        </div>
                                        <div className="flex items-center justify-between pr-2">
                                            <span className="text-ink-soft">Colors</span>
                                            <kbd className="px-1.5 py-0.5 font-mono font-bold bg-card border border-ink/30 rounded text-[11px]">
                                                1 – 9
                                            </kbd>
                                        </div>
                                        <div className="flex items-center justify-between pr-2">
                                            <span className="text-ink-soft">Close Dialog</span>
                                            <kbd className="px-1.5 py-0.5 font-mono font-bold bg-card border border-ink/30 rounded text-[11px]">
                                                Esc
                                            </kbd>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer: Reset Defaults & Done */}
                        <div className="pt-3 border-t-2 border-ink/15 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={resetSettings}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft hover:text-tomato cursor-pointer px-2 py-1 rounded hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reset defaults</span>
                            </button>

                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onClose}
                                className="font-bold text-xs uppercase px-4 min-h-[36px]"
                            >
                                Done
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SettingsModal;

