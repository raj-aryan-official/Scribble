import React from 'react';
import { useSettings } from '../../context/SettingsContext';

export const PRESET_COLORS = [
    { name: 'Ink Black', hex: '#1C1B18' },
    { name: 'Graphite', hex: '#5B5649' },
    { name: 'Paper White', hex: '#FBF6EA' },
    { name: 'Tomato Red', hex: '#E4472B' },
    { name: 'Rust Red', hex: '#C93A20' },
    { name: 'Marigold Yellow', hex: '#F6B72C' },
    { name: 'Amber Orange', hex: '#E69112' },
    { name: 'Leaf Green', hex: '#2E9E6B' },
    { name: 'Forest Green', hex: '#1F7A50' },
    { name: 'Cobalt Blue', hex: '#2F4FD8' },
    { name: 'Navy Blue', hex: '#1D3299' },
    { name: 'Violet Purple', hex: '#8D4BE5' },
];

export const COLORBLIND_PALETTE = [
    { name: 'Black', hex: '#000000' },
    { name: 'Graphite', hex: '#555555' },
    { name: 'Paper White', hex: '#FFFFFF' },
    { name: 'Amber', hex: '#D55E00' },
    { name: 'Rust', hex: '#8C510A' },
    { name: 'Yellow', hex: '#F0E442' },
    { name: 'Orange', hex: '#E69F00' },
    { name: 'Bluish Green', hex: '#009E73' },
    { name: 'Dark Teal', hex: '#014636' },
    { name: 'Sky Blue', hex: '#56B4E9' },
    { name: 'Blue', hex: '#0072B2' },
    { name: 'Reddish Purple', hex: '#CC79A7' },
];

export const ColorSwatches = ({ color = '#1C1B18', setColor, lockedColor = null, orientation = 'horizontal', className = '' }) => {
    const { settings } = useSettings();
    const activePalette = settings?.colorBlindPalette ? COLORBLIND_PALETTE : PRESET_COLORS;

    if (orientation === 'vertical') {
        return (
            <div
                role="group"
                aria-label="Color palette"
                data-palette={settings?.colorBlindPalette ? 'colorblind' : 'standard'}
                className={`grid grid-cols-2 gap-1 ${className}`}
                data-testid="color-swatches"
            >
                {activePalette.map(({ name, hex }) => {
                    const isSelected = color.toLowerCase() === hex.toLowerCase();
                    const isLockedOut = Boolean(lockedColor && hex.toLowerCase() !== lockedColor.toLowerCase());
                    return (
                        <button
                            key={hex}
                            type="button"
                            aria-pressed={isSelected}
                            disabled={isLockedOut}
                            aria-label={`Select ${name} color`}
                            title={isLockedOut ? `${name} (Locked)` : name}
                            onClick={() => {
                                if (!isLockedOut) setColor?.(hex);
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none shrink-0 ${
                                isLockedOut ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                        >
                            <span
                                className={`w-6 h-6 rounded-full border-2 border-ink transition-transform ${
                                    isSelected
                                        ? 'scale-110 ring-2 ring-ink ring-offset-1 ring-offset-paper'
                                        : 'hover:scale-105 opacity-90'
                                }`}
                                style={{ backgroundColor: hex }}
                            />
                        </button>
                    );
                })}

                <div className="w-8 h-8 flex items-center justify-center relative cursor-pointer">
                    <label
                        htmlFor="custom-color-picker-vertical"
                        title="Custom Color"
                        aria-label="Custom color picker"
                        className="w-6 h-6 rounded-full border-2 border-ink flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                        style={{
                            background:
                                'conic-gradient(from 180deg at 50% 50%, #E4472B 0deg, #F6B72C 72deg, #2E9E6B 144deg, #2F4FD8 216deg, #8D4BE5 288deg, #E4472B 360deg)',
                        }}
                    >
                        <input
                            id="custom-color-picker-vertical"
                            type="color"
                            value={color}
                            onChange={(e) => setColor?.(e.target.value)}
                            aria-label="Custom color picker input"
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                    </label>
                </div>
            </div>
        );
    }

    return (
        <div
            role="group"
            aria-label="Color palette"
            data-palette={settings?.colorBlindPalette ? 'colorblind' : 'standard'}
            className={`flex items-center gap-1.5 ${className}`}
            data-testid="color-swatches"
        >
            {/* Desktop: 2 rows of 6. Phone: 1 row with horizontal scroll-snap */}
            <div
                role="group"
                aria-label="Color swatches"
                className="flex md:grid md:grid-cols-6 md:grid-rows-2 items-center gap-1.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide py-1 max-w-full"
            >
                {activePalette.map(({ name, hex }, index) => {
                    const isSelected = color.toLowerCase() === hex.toLowerCase();
                    const isLockedOut = Boolean(lockedColor && hex.toLowerCase() !== lockedColor.toLowerCase());
                    return (
                        <button
                            key={hex}
                            type="button"
                            aria-pressed={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            disabled={isLockedOut}
                            aria-label={`Select ${name} color (Key ${index < 9 ? index + 1 : ''})`}
                            title={isLockedOut ? `${name} (Locked)` : `${name} ${index < 9 ? `(${index + 1})` : ''}`}
                            onClick={() => {
                                if (!isLockedOut) setColor?.(hex);
                            }}
                            onKeyDown={(e) => {
                                if (lockedColor) return;
                                let nextIndex = null;
                                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    nextIndex = (index + 1) % activePalette.length;
                                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    nextIndex = (index - 1 + activePalette.length) % activePalette.length;
                                }
                                if (nextIndex !== null) {
                                    const nextColor = activePalette[nextIndex];
                                    setColor?.(nextColor.hex);
                                    e.currentTarget.parentElement?.children[nextIndex]?.focus();
                                }
                            }}
                            className={`min-w-[44px] min-h-[44px] snap-center flex items-center justify-center p-1 rounded-full focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none shrink-0 ${
                                isLockedOut ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                        >
                            <span
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-ink transition-all ${
                                    isSelected
                                        ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-paper shadow-hard-sm'
                                        : 'hover:scale-105 opacity-90'
                                }`}
                                style={{ backgroundColor: hex }}
                            />
                        </button>
                    );
                })}

                {/* Custom Color Picker at the end */}
                <div className="min-w-[44px] min-h-[44px] snap-center flex items-center justify-center relative cursor-pointer p-1 shrink-0">
                    <label
                        htmlFor="custom-color-picker-input"
                        title="Custom Color"
                        aria-label="Custom color picker"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-ink flex items-center justify-center overflow-hidden cursor-pointer shadow-hard-sm hover:scale-105 transition-transform"
                        style={{
                            background:
                                'conic-gradient(from 180deg at 50% 50%, #E4472B 0deg, #F6B72C 72deg, #2E9E6B 144deg, #2F4FD8 216deg, #8D4BE5 288deg, #E4472B 360deg)',
                        }}
                    >
                        <input
                            id="custom-color-picker-input"
                            type="color"
                            value={color}
                            onChange={(e) => setColor?.(e.target.value)}
                            aria-label="Custom color picker input"
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default ColorSwatches;
