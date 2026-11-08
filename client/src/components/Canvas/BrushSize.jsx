import React, { useState, useRef, useEffect } from 'react';
import { Sliders, X } from 'lucide-react';

const SIZE_PRESETS = [
    { name: 'Small', size: 4, dotClass: 'w-2 h-2' },
    { name: 'Medium', size: 10, dotClass: 'w-3.5 h-3.5' },
    { name: 'Large', size: 22, dotClass: 'w-5.5 h-5.5' },
];

export const BrushSize = ({ lineWidth = 6, setLineWidth, isLockedSize = false, className = '' }) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const popoverRef = useRef(null);

    // Close popover when clicking outside or pressing Escape
    useEffect(() => {
        if (!isPopoverOpen) return;

        const handlePointerDown = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsPopoverOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsPopoverOpen(false);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isPopoverOpen]);

    return (
        <div
            role="group"
            aria-label="Brush size options"
            className={`flex items-center gap-1.5 relative ${className}`}
            data-testid="brush-size-controls"
        >
            {/* Three presets (Small, Medium, Large) with roving tabindex */}
            <div
                role="group"
                aria-label="Brush size presets"
                className="flex items-center gap-1 bg-paper p-1 border-2 border-ink rounded-[6px]"
            >
                {SIZE_PRESETS.map((preset, index) => {
                    const isSelected = lineWidth === preset.size;
                    return (
                        <button
                            key={preset.name}
                            type="button"
                            aria-pressed={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            disabled={isLockedSize}
                            aria-label={`Brush size ${preset.name} (${preset.size}px)`}
                            title={isLockedSize ? 'Brush size locked' : `${preset.name} (${preset.size}px)`}
                            onClick={() => !isLockedSize && setLineWidth?.(preset.size)}
                            onKeyDown={(e) => {
                                if (isLockedSize) return;
                                let nextIndex = null;
                                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    nextIndex = (index + 1) % SIZE_PRESETS.length;
                                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    nextIndex = (index - 1 + SIZE_PRESETS.length) % SIZE_PRESETS.length;
                                }
                                if (nextIndex !== null) {
                                    const nextPreset = SIZE_PRESETS[nextIndex];
                                    setLineWidth?.(nextPreset.size);
                                    e.currentTarget.parentElement?.children[nextIndex]?.focus();
                                }
                            }}
                            className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                                isLockedSize
                                    ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                                    : isSelected
                                    ? 'bg-card border-2 border-ink shadow-hard-sm cursor-pointer'
                                    : 'hover:bg-card/50 text-ink-soft cursor-pointer'
                            }`}
                        >
                            <span
                                className={`rounded-full bg-ink block ${preset.dotClass}`}
                                aria-hidden="true"
                            />
                        </button>
                    );
                })}
            </div>

            {/* Fine Slider Popover Toggle Button */}
            <button
                type="button"
                aria-label="Open fine brush size slider"
                aria-haspopup="dialog"
                aria-expanded={isPopoverOpen}
                disabled={isLockedSize}
                title={isLockedSize ? 'Size adjustment locked' : 'Fine size adjustment ([ / ])'}
                onClick={() => !isLockedSize && setIsPopoverOpen(!isPopoverOpen)}
                className={`min-w-[44px] min-h-[44px] p-2 rounded-[6px] border-2 border-ink shadow-hard-sm flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-all ${
                    isLockedSize
                        ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                        : isPopoverOpen
                        ? 'bg-marigold text-ink cursor-pointer'
                        : 'bg-paper text-ink hover:bg-card cursor-pointer'
                }`}
            >
                <Sliders className="w-5 h-5" />
            </button>

            {/* Fine Size Adjustment Popover */}
            {isPopoverOpen && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label="Fine brush size slider"
                    className="absolute bottom-full mb-2 left-0 z-popover bg-card border-2 border-ink shadow-hard-lg rounded-[12px] p-4 w-60 sm:w-64 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                    <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-ink">
                            Brush Width: <span className="font-mono">{lineWidth}px</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsPopoverOpen(false)}
                            aria-label="Close size popover"
                            className="p-1 text-ink-soft hover:text-ink cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Live Dot Preview */}
                    <div className="w-full h-12 flex items-center justify-center bg-paper border-2 border-ink rounded-[6px]">
                        <div
                            className="rounded-full bg-ink transition-all"
                            style={{
                                width: `${Math.max(2, Math.min(40, lineWidth))}px`,
                                height: `${Math.max(2, Math.min(40, lineWidth))}px`,
                            }}
                        />
                    </div>

                    {/* Range Slider */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="fine-brush-slider" className="sr-only">
                            Fine brush size
                        </label>
                        <input
                            id="fine-brush-slider"
                            type="range"
                            min="2"
                            max="40"
                            step="1"
                            value={lineWidth}
                            onChange={(e) => setLineWidth?.(Number(e.target.value))}
                            className="w-full accent-ink h-2.5 bg-paper border-2 border-ink rounded-full cursor-pointer min-h-[44px]"
                        />
                        <div className="flex justify-between text-[10px] font-bold text-ink-soft px-1">
                            <span>2px (Fine)</span>
                            <span>40px (Broad)</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrushSize;

