import React, { useState, useEffect } from 'react';
import { EyeOff, Zap } from 'lucide-react';
import { useCanvas } from '../../hooks/useCanvas';
import { useSettings } from '../../context/SettingsContext';
import ToolTray from '../Game/ToolTray';

const DrawingCanvasComponent = ({ roomCode, isDrawer, drawerName = 'Maya', twist = null }) => {
    const { settings } = useSettings();
    const {
        canvasRef,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onPointerEnter,
        onPointerLeave,
        setColor,
        setLineWidth,
        setTool,
        clearCanvas,
        undo,
        color,
        lineWidth,
        tool,
        cursorPos,
        isCursorInside,
        strokeCount,
        inkRemaining,
    } = useCanvas(roomCode, isDrawer, twist);

    const [canvasWidth, setCanvasWidth] = useState(800);
    const [showBlindfold, setShowBlindfold] = useState(false);

    useEffect(() => {
        const updateWidth = () => {
            if (canvasRef.current?.clientWidth) {
                setCanvasWidth(canvasRef.current.clientWidth);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [canvasRef]);

    // Blindfold twist: after 3 seconds, drawer's paper goes dark
    useEffect(() => {
        if (!isDrawer || twist?.id !== 'blindfold') {
            setShowBlindfold(false);
            return;
        }
        const timer = setTimeout(() => {
            setShowBlindfold(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, [isDrawer, twist?.id]);

    const displayRingDiameter = Math.max(4, Math.round(lineWidth * (canvasWidth / 800)));

    return (
        <div className="flex flex-col h-full w-full min-h-0 overflow-hidden select-none gap-2">
            {/* Limited Ink Bar for Drawer */}
            {isDrawer && twist?.id === 'limited-ink' && (
                <div
                    data-testid="ink-bar"
                    className="w-full flex items-center gap-2 px-3 py-1 bg-paper border-2 border-ink rounded-[6px] shadow-hard-xs shrink-0"
                >
                    <span className="text-[11px] font-black uppercase tracking-wider text-ink shrink-0 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-cobalt" />
                        Ink: {Math.max(0, Math.round(((inkRemaining ?? 1200) / 1200) * 100))}%
                    </span>
                    <div className="flex-1 h-2.5 bg-card border border-ink/40 rounded-full overflow-hidden p-0.5">
                        <div
                            className={`h-full rounded-full transition-all duration-150 ${
                                (inkRemaining ?? 1200) <= 300 ? 'bg-tomato' : 'bg-cobalt'
                            }`}
                            style={{
                                width: `${Math.max(0, Math.min(100, ((inkRemaining ?? 1200) / 1200) * 100))}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Fixed 4:3 Letterboxed Paper Area */}
            <div
                className="w-full flex-1 min-h-0 flex items-center justify-center p-1 md:p-3 overflow-hidden"
                style={{ containerType: 'size' }}
            >
                <div
                    className="relative bg-card rounded-[12px] shadow-hard border-2 border-ink overflow-hidden flex items-center justify-center"
                    style={{
                        aspectRatio: '4 / 3',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'min(100cqw, calc(100cqh * 4 / 3))',
                        height: 'min(100cqh, calc(100cqw * 3 / 4))',
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        role="img"
                        data-testid="canvas-element"
                        aria-label={
                            isDrawer
                                ? 'Drawing paper. Sketch your secret word.'
                                : `Drawing in progress by ${drawerName}`
                        }
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                        onPointerEnter={onPointerEnter}
                        onPointerLeave={onPointerLeave}
                        className={`w-full h-full block touch-none select-none ${
                            isDrawer ? 'cursor-none' : 'cursor-default'
                        }`}
                        style={{
                            touchAction: 'none',
                            transform: (isDrawer && twist?.id === 'upside-down') ? 'rotate(180deg)' : undefined
                        }}
                    />

                    {/* Paper Grid Overlay */}
                    {settings?.paperGrid && (
                        <div
                            data-testid="paper-grid"
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 z-0 opacity-15"
                            style={{
                                backgroundImage:
                                    'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                                backgroundSize: '24px 24px',
                            }}
                        />
                    )}

                    {/* Faint Start Drawing Prompt */}
                    {isDrawer && strokeCount === 0 && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center select-none transition-opacity duration-300"
                            data-testid="empty-canvas-prompt"
                        >
                            <span className="text-sm sm:text-base font-bold font-heading text-ink-soft italic tracking-wide">
                                Start drawing. No letters or numbers!
                            </span>
                        </div>
                    )}

                    {/* Blindfold Overlay for Drawer */}
                    {isDrawer && showBlindfold && twist?.id === 'blindfold' && (
                        <div
                            data-testid="blindfold-overlay"
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-ink/95 z-20 flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn"
                        >
                            <EyeOff className="w-12 h-12 text-marigold mb-2" />
                            <h3 className="text-xl font-heading font-black text-paper">Blindfold Active!</h3>
                            <p className="text-xs font-bold text-paper/80 mt-1 max-w-xs">
                                Keep drawing from memory! Your strokes are streaming to the guessers.
                            </p>
                        </div>
                    )}

                    {/* Drawer Brush Size Ring Cursor */}
                    {isDrawer && isCursorInside && !showBlindfold && (
                        <div
                            className="pointer-events-none absolute rounded-full border-2 border-ink -translate-x-1/2 -translate-y-1/2 z-cursor transition-none"
                            style={{
                                left: cursorPos.x,
                                top: cursorPos.y,
                                width: displayRingDiameter,
                                height: displayRingDiameter,
                                backgroundColor:
                                    tool === 'eraser'
                                        ? 'rgba(251, 246, 234, 0.7)'
                                        : `${color}33`,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Tool Tray below the paper */}
            {isDrawer && (
                <div className="shrink-0 w-full">
                    <ToolTray
                        tool={tool}
                        setTool={setTool}
                        lineWidth={lineWidth}
                        setLineWidth={setLineWidth}
                        color={color}
                        setColor={setColor}
                        undo={undo}
                        clearCanvas={clearCanvas}
                        twist={twist}
                    />
                </div>
            )}
        </div>
    );
};

export const DrawingCanvas = React.memo(DrawingCanvasComponent);
export default DrawingCanvas;
