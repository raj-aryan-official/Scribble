import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, Eraser, PaintBucket, Undo2, Trash2 } from 'lucide-react';
import ColorSwatches from './ColorSwatches';
import BrushSize from './BrushSize';
import ShortcutHelp from './ShortcutHelp';
import ConfirmationModal from '../ui/ConfirmationModal';
import { useSettings } from '../../context/SettingsContext';

export const ToolTray = ({
    tool = 'pencil',
    setTool,
    lineWidth = 6,
    setLineWidth,
    color = '#1C1B18',
    setColor,
    undo,
    clearCanvas,
    twist = null,
    orientation = 'horizontal',
    className = '',
}) => {
    const { settings } = useSettings();
    const isLeftHanded = Boolean(settings?.leftHandedLayout);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const railScrollRef = useRef(null);
    const [railScroll, setRailScroll] = useState({ top: false, bottom: false });

    const updateRailScroll = useCallback(() => {
        const el = railScrollRef.current;
        if (!el) return;
        const next = {
            top: el.scrollTop > 2,
            bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2,
        };
        setRailScroll((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next));
    }, []);

    useEffect(() => {
        if (orientation !== 'vertical') return undefined;
        const el = railScrollRef.current;
        if (!el) return undefined;
        updateRailScroll();
        const observer = new ResizeObserver(updateRailScroll);
        observer.observe(el);
        el.addEventListener('scroll', updateRailScroll, { passive: true });
        window.addEventListener('resize', updateRailScroll);
        return () => {
            observer.disconnect();
            el.removeEventListener('scroll', updateRailScroll);
            window.removeEventListener('resize', updateRailScroll);
        };
    }, [orientation, updateRailScroll]);

    const isNoUndoEraser = twist?.id === 'no-undo-eraser';
    const isThinLine = twist?.id === 'thin-line';
    const lockedColor = twist?.id === 'one-colour' ? twist.color : null;

    const handleClearConfirm = () => {
        clearCanvas?.();
        setShowClearConfirm(false);
    };

    const TOOL_ORDER = ['pencil', 'eraser', 'fill'];

    const handleToolKeyDown = (e, currentTool) => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const enabled = TOOL_ORDER.filter((t) => !(t === 'eraser' && isNoUndoEraser));
        const idx = enabled.indexOf(currentTool);
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const next = enabled[(idx + dir + enabled.length) % enabled.length];
        setTool?.(next);
        const group = e.currentTarget.parentElement;
        group?.querySelector(`[data-tool="${next}"]`)?.focus();
    };

    if (orientation === 'vertical') {
        return (
            <section
                aria-label="Drawing tools"
                data-testid="tool-tray"
                data-orientation="vertical"
                data-layout={isLeftHanded ? 'left-handed' : 'right-handed'}
                className={`flex flex-col items-center gap-1.5 h-full w-[84px] shrink-0 p-1.5 bg-card border-2 border-ink shadow-hard rounded-[12px] select-none ${className}`}
            >
                <div
                    role="group"
                    aria-label="Drawing tool toggle"
                    className="flex flex-col items-center gap-1 bg-paper p-0.5 border-2 border-ink rounded-[6px] shrink-0"
                >
                    <button
                        type="button"
                        aria-pressed={tool === 'pencil'}
                        aria-label="Pencil tool (P)"
                        title="Pencil tool (P)"
                        onClick={() => setTool?.('pencil')}
                        className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
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
                        disabled={isNoUndoEraser}
                        aria-label="Eraser tool (E)"
                        title={isNoUndoEraser ? 'Eraser disabled in this twist' : 'Eraser tool (E)'}
                        onClick={() => !isNoUndoEraser && setTool?.('eraser')}
                        className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                            isNoUndoEraser
                                ? 'opacity-40 cursor-not-allowed text-ink-soft'
                                : tool === 'eraser'
                                ? 'bg-card text-ink border-2 border-ink shadow-hard-sm cursor-pointer'
                                : 'text-ink-soft hover:text-ink hover:bg-card/50 cursor-pointer'
                        }`}
                    >
                        <Eraser className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        aria-pressed={tool === 'fill'}
                        data-testid="fill-tool"
                        aria-label="Fill bucket tool (F)"
                        title="Fill bucket tool (F)"
                        onClick={() => setTool?.('fill')}
                        className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                            tool === 'fill'
                                ? 'bg-card text-ink border-2 border-ink shadow-hard-sm'
                                : 'text-ink-soft hover:text-ink hover:bg-card/50'
                        }`}
                    >
                        <PaintBucket className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable middle: brush size + palette stay reachable on short screens (landscape phones, small laptops) */}
                <div className="relative w-full flex-1 min-h-0">
                    <div
                        ref={railScrollRef}
                        className="absolute inset-0 flex flex-col items-center gap-1.5 overflow-y-auto overscroll-contain py-0.5"
                    >
                        <BrushSize
                            orientation="vertical"
                            lineWidth={lineWidth}
                            setLineWidth={setLineWidth}
                            isLockedSize={isThinLine}
                            className="shrink-0"
                        />

                        <ColorSwatches
                            orientation="vertical"
                            color={color}
                            setColor={setColor}
                            lockedColor={lockedColor}
                            className="shrink-0"
                        />
                    </div>
                    {railScroll.top && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-card to-transparent"
                        />
                    )}
                    {railScroll.bottom && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-card to-transparent"
                        />
                    )}
                </div>

                <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                        type="button"
                        aria-label="Undo stroke (Ctrl+Z)"
                        title={isNoUndoEraser ? 'Undo disabled in this twist' : 'Undo (Ctrl+Z)'}
                        disabled={isNoUndoEraser}
                        onClick={() => !isNoUndoEraser && undo?.()}
                        className={`min-w-[44px] min-h-[44px] p-2 border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-all ${
                            isNoUndoEraser
                                ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                                : 'bg-paper hover:bg-card text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                        }`}
                    >
                        <Undo2 className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Clear drawing"
                        title={isNoUndoEraser ? 'Clear disabled in this twist' : 'Clear drawing'}
                        disabled={isNoUndoEraser}
                        onClick={() => !isNoUndoEraser && setShowClearConfirm(true)}
                        className={`min-w-[44px] min-h-[44px] p-2 border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-all ${
                            isNoUndoEraser
                                ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                                : 'bg-paper hover:bg-tomato/15 text-tomato cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                        }`}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

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
    }

    return (
        <section
            aria-label="Drawing tools"
            data-testid="tool-tray"
            data-layout={isLeftHanded ? 'left-handed' : 'right-handed'}
            className={`w-full flex flex-col items-stretch gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-card border-2 border-ink shadow-hard rounded-[12px] select-none ${className}`}
        >
            {/* Row 1: Tools, brush size and actions */}
            <div className={`w-full flex items-center justify-between gap-2 ${
                isLeftHanded ? 'flex-row-reverse' : ''
            }`}>
                <div className="flex items-center gap-1.5">
                    {/* Tools: Pencil, Eraser & Fill with roving tabindex */}
                    <div
                        role="group"
                        aria-label="Drawing tool toggle"
                        className="flex items-center gap-1 bg-paper p-0.5 sm:p-1 border-2 border-ink rounded-[6px]"
                    >
                        <button
                            type="button"
                            data-tool="pencil"
                            aria-pressed={tool === 'pencil'}
                            tabIndex={tool === 'pencil' ? 0 : -1}
                            aria-label="Pencil tool (P)"
                            title="Pencil tool (P)"
                            onClick={() => setTool?.('pencil')}
                            onKeyDown={(e) => handleToolKeyDown(e, 'pencil')}
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
                            data-tool="eraser"
                            aria-pressed={tool === 'eraser'}
                            tabIndex={tool === 'eraser' ? 0 : -1}
                            disabled={isNoUndoEraser}
                            aria-label="Eraser tool (E)"
                            title={isNoUndoEraser ? 'Eraser disabled in this twist' : 'Eraser tool (E)'}
                            onClick={() => !isNoUndoEraser && setTool?.('eraser')}
                            onKeyDown={(e) => handleToolKeyDown(e, 'eraser')}
                            className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] font-bold flex items-center justify-center transition-transform focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                                isNoUndoEraser
                                    ? 'opacity-40 cursor-not-allowed text-ink-soft'
                                    : tool === 'eraser'
                                    ? 'bg-card text-ink border-2 border-ink shadow-hard-sm cursor-pointer'
                                    : 'text-ink-soft hover:text-ink hover:bg-card/50 cursor-pointer'
                            }`}
                        >
                            <Eraser className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            data-tool="fill"
                            data-testid="fill-tool"
                            aria-pressed={tool === 'fill'}
                            tabIndex={tool === 'fill' ? 0 : -1}
                            aria-label="Fill bucket tool (F)"
                            title="Fill bucket tool (F)"
                            onClick={() => setTool?.('fill')}
                            onKeyDown={(e) => handleToolKeyDown(e, 'fill')}
                            className={`min-w-[44px] min-h-[44px] p-2 rounded-[4px] font-bold flex items-center justify-center transition-transform cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                                tool === 'fill'
                                    ? 'bg-card text-ink border-2 border-ink shadow-hard-sm'
                                    : 'text-ink-soft hover:text-ink hover:bg-card/50'
                            }`}
                        >
                            <PaintBucket className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Brush Size Component: 3 Presets + Fine Slider Popover */}
                    <BrushSize
                        lineWidth={lineWidth}
                        setLineWidth={setLineWidth}
                        isLockedSize={isThinLine}
                    />
                </div>

                {/* Actions: Undo, Clear, Shortcut Help */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        aria-label="Undo stroke (Ctrl+Z)"
                        title={isNoUndoEraser ? 'Undo disabled in this twist' : 'Undo (Ctrl+Z)'}
                        disabled={isNoUndoEraser}
                        onClick={() => !isNoUndoEraser && undo?.()}
                        className={`min-w-[44px] min-h-[44px] p-2 border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-all ${
                            isNoUndoEraser
                                ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                                : 'bg-paper hover:bg-card text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                        }`}
                    >
                        <Undo2 className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        aria-label="Clear drawing"
                        title={isNoUndoEraser ? 'Clear disabled in this twist' : 'Clear drawing'}
                        disabled={isNoUndoEraser}
                        onClick={() => !isNoUndoEraser && setShowClearConfirm(true)}
                        className={`min-w-[44px] min-h-[44px] p-2 border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-all ${
                            isNoUndoEraser
                                ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                                : 'bg-paper hover:bg-tomato/15 text-tomato cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                        }`}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>

                    <ShortcutHelp />
                </div>
            </div>

            {/* Row 2: colour strip (scrolls horizontally when it cannot fit) */}
            <div className="w-full min-w-0 flex justify-center">
                <ColorSwatches
                    color={color}
                    setColor={setColor}
                    lockedColor={lockedColor}
                    className="w-full"
                />
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
