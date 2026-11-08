import React from 'react';

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

export const ColorSwatches = ({ color = '#1C1B18', setColor, className = '' }) => {
    return (
        <div
            role="group"
            aria-label="Color palette"
            className={`flex items-center gap-1.5 ${className}`}
            data-testid="color-swatches"
        >
            {/* Desktop: 2 rows of 6. Phone: 1 row with horizontal scroll-snap */}
            <div
                role="group"
                aria-label="Color swatches"
                className="flex md:grid md:grid-cols-6 md:grid-rows-2 items-center gap-1.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide py-1 max-w-full"
            >
                {PRESET_COLORS.map(({ name, hex }, index) => {
                    const isSelected = color.toLowerCase() === hex.toLowerCase();
                    return (
                        <button
                            key={hex}
                            type="button"
                            aria-pressed={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            aria-label={`Select ${name} color (Key ${index < 9 ? index + 1 : ''})`}
                            title={`${name} ${index < 9 ? `(${index + 1})` : ''}`}
                            onClick={() => setColor?.(hex)}
                            onKeyDown={(e) => {
                                let nextIndex = null;
                                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    nextIndex = (index + 1) % PRESET_COLORS.length;
                                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    nextIndex = (index - 1 + PRESET_COLORS.length) % PRESET_COLORS.length;
                                }
                                if (nextIndex !== null) {
                                    const nextColor = PRESET_COLORS[nextIndex];
                                    setColor?.(nextColor.hex);
                                    e.currentTarget.parentElement?.children[nextIndex]?.focus();
                                }
                            }}
                            className="min-w-[44px] min-h-[44px] snap-center flex items-center justify-center cursor-pointer p-1 rounded-full focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none shrink-0"
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

