import React, { useState } from 'react';
import { Pencil, Eraser, Undo2, Trash2 } from 'lucide-react';
import ColorSwatches from './ColorSwatches';
import BrushSize from './BrushSize';
import ShortcutHelp from './ShortcutHelp';
import ConfirmationModal from '../ui/ConfirmationModal';

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
            data-testid="tool-tray"
        >
            {/* Left Group: Tool Toggle Buttons + Size Controls */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Tools: Pencil & Eraser */}
                <div
                    role="group"
                    aria-label="Drawing tool toggle"
                    className="flex items-center gap-1 bg-paper p-1 border-2 border-ink rounded-[6px]"
                >
                    <button
                        type="button"
                        aria-pressed={tool === 'pencil'}
                        aria-label="Pencil tool (P)"
                        title="Pencil tool (P)"
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
                        aria-label="Eraser tool (E)"
                        title="Eraser tool (E)"
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

                {/* Brush Size Component: 3 Presets + Fine Slider Popover */}
                <BrushSize
                    lineWidth={lineWidth}
                    setLineWidth={setLineWidth}
                />
            </div>

            {/* Middle Group: Color Swatches (12 in 2x6 on desktop, 1 scroll-snap row on phone) */}
            <div className="order-last sm:order-none w-full sm:w-auto flex justify-center sm:justify-start">
                <ColorSwatches
                    color={color}
                    setColor={setColor}
                />
            </div>

            {/* Right Group: Undo, Clear, and Shortcut Help */}
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    aria-label="Undo stroke (Ctrl+Z)"
                    title="Undo (Ctrl+Z)"
                    onClick={undo}
                    className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-all"
                >
                    <Undo2 className="w-5 h-5" />
                </button>

                <button
                    type="button"
                    aria-label="Clear drawing"
                    title="Clear drawing"
                    onClick={() => setShowClearConfirm(true)}
                    className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-tomato/15 text-tomato border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-all"
                >
                    <Trash2 className="w-5 h-5" />
                </button>

                <ShortcutHelp />
            </div>

            {/* Clear Canvas Confirmation Modal */}
            <ConfirmationModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearConfirm}
                title="Clear the whole drawing?"
                message="Are you sure? All strokes will be erased."
                confirmText="Clear Paper"
                cancelText="Cancel"
                isDanger={true}
            />
        </section>
    );
};

export default ToolTray;
