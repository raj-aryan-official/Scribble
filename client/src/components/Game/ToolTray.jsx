import React, { useState } from 'react';
import { Pencil, Eraser, Undo2, Trash2 } from 'lucide-react';
import ConfirmationModal from '../ui/ConfirmationModal';

const PRESET_COLORS = [
    { name: 'Ink', hex: '#1C1B18' },
    { name: 'Graphite', hex: '#5B5649' },
    { name: 'Paper White', hex: '#FBF6EA' },
    { name: 'Tomato Red', hex: '#E4472B' },
    { name: 'Rust', hex: '#C93A20' },
    { name: 'Marigold', hex: '#F6B72C' },
    { name: 'Amber', hex: '#E69112' },
    { name: 'Leaf Green', hex: '#2E9E6B' },
    { name: 'Forest', hex: '#1F7A50' },
    { name: 'Cobalt Blue', hex: '#2F4FD8' },
    { name: 'Navy', hex: '#1D3299' },
    { name: 'Violet', hex: '#8D4BE5' },
];

export const ToolTray = ({
    tool = 'pencil',
    setTool,
    lineWidth = 6,
    setLineWidth,
    color = '#1C1B18',
    setColor,
    undo,
    clearCanvas,
    className = '',
}) => {
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const handleClearConfirm = () => {
        clearCanvas?.();
        setShowClearConfirm(false);
    };

    return (
        <section
            aria-label="Drawing tools"
            className={`w-full flex items-center justify-between flex-wrap gap-2 sm:gap-3 p-2 sm:p-2.5 bg-card border-2 border-ink shadow-hard rounded-[12px] select-none ${className}`}
        >
            {/* Tool Selection: Pencil & Eraser */}
            <div className="flex items-center gap-1 bg-paper p-1 border-2 border-ink rounded-[6px]">
                <button
                    type="button"
                    aria-pressed={tool === 'pencil'}
                    aria-label="Pencil tool"
                    onClick={() => setTool?.('pencil')}
                    className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] font-bold flex items-center justify-center transition-transform cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                        tool === 'pencil'
                            ? 'bg-card text-ink border-2 border-ink shadow-hard-sm'
                            : 'text-ink-soft hover:text-ink hover:bg-card/50'
                    }`}
                >
                    <Pencil className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    aria-pressed={tool === 'eraser'}
                    aria-label="Eraser tool"
                    onClick={() => setTool?.('eraser')}
                    className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] font-bold flex items-center justify-center transition-transform cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                        tool === 'eraser'
                            ? 'bg-card text-ink border-2 border-ink shadow-hard-sm'
                            : 'text-ink-soft hover:text-ink hover:bg-card/50'
                    }`}
                >
                    <Eraser className="w-5 h-5" />
                </button>
            </div>

            {/* Brush Size Dot Preview & Slider */}
            <div className="flex items-center gap-2 px-1">
                <div
                    className="w-11 h-11 flex items-center justify-center bg-paper border-2 border-ink rounded-[6px] shadow-hard-sm"
                    title={`Brush size: ${lineWidth}px`}
                    aria-hidden="true"
                >
                    <div
                        className="rounded-full bg-ink transition-all"
                        style={{
                            width: `${Math.max(4, Math.min(26, lineWidth))}px`,
                            height: `${Math.max(4, Math.min(26, lineWidth))}px`,
                        }}
                    />
                </div>
                <label htmlFor="brush-size-slider" className="sr-only">
                    Brush size
                </label>
                <input
                    id="brush-size-slider"
                    type="range"
                    min="2"
                    max="36"
                    value={lineWidth}
                    onChange={(e) => setLineWidth?.(Number(e.target.value))}
                    className="w-16 sm:w-24 md:w-28 accent-ink h-2 bg-paper border-2 border-ink rounded-[4px] cursor-pointer min-h-[44px]"
                />
            </div>

            {/* Undo & Clear Canvas Actions */}
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    aria-label="Undo stroke (Ctrl+Z)"
                    title="Undo (Ctrl+Z)"
                    onClick={undo}
                    className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                >
                    <Undo2 className="w-5 h-5" />
                </button>

                <button
                    type="button"
                    aria-label="Clear canvas"
                    title="Clear canvas"
                    onClick={() => setShowClearConfirm(true)}
                    className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-tomato/10 text-tomato border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

            {/* Preset Paint Dabs + Custom Color Picker */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-hide max-w-full">
                {PRESET_COLORS.map(({ name, hex }) => {
                    const isSelected = color.toLowerCase() === hex.toLowerCase();
                    return (
                        <button
                            key={hex}
                            type="button"
                            aria-label={`Select ${name} color`}
                            title={name}
                            onClick={() => setColor?.(hex)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer p-1 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded-full"
                        >
                            <span
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-ink transition-transform ${
                                    isSelected
                                        ? 'scale-110 ring-2 ring-cobalt ring-offset-2 shadow-hard-sm'
                                        : 'hover:scale-105 opacity-90'
                                }`}
                                style={{ backgroundColor: hex }}
                            />
                        </button>
                    );
                })}

                {/* Custom Color Picker Dab */}
                <div className="min-w-[44px] min-h-[44px] flex items-center justify-center relative cursor-pointer p-1">
                    <label
                        htmlFor="custom-color-input"
                        title="Custom Color"
                        aria-label="Custom color picker"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-ink flex items-center justify-center overflow-hidden cursor-pointer shadow-hard-sm"
                        style={{
                            background:
                                'conic-gradient(from 180deg at 50% 50%, #E4472B 0deg, #F6B72C 72deg, #2E9E6B 144deg, #2F4FD8 216deg, #8D4BE5 288deg, #E4472B 360deg)',
                        }}
                    >
                        <input
                            id="custom-color-input"
                            type="color"
                            value={color}
                            onChange={(e) => setColor?.(e.target.value)}
                            aria-label="Custom color"
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                    </label>
                </div>
            </div>

            {/* Clear Canvas Confirmation Modal */}
            <ConfirmationModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearConfirm}
                title="Clear Canvas?"
                message="Are you sure you want to clear the entire paper? All strokes will be erased."
                confirmText="Clear Paper"
                cancelText="Cancel"
                isDanger={true}
            />
        </section>
    );
};

export default ToolTray;
