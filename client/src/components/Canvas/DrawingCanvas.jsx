import React, { useState, useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import ToolTray from '../Game/ToolTray';

const DrawingCanvasComponent = ({ roomCode, isDrawer }) => {
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
    } = useCanvas(roomCode, isDrawer);

    const [canvasWidth, setCanvasWidth] = useState(800);

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

    const displayRingDiameter = Math.max(4, Math.round(lineWidth * (canvasWidth / 800)));

    return (
        <div className="flex flex-col h-full w-full min-h-0 overflow-hidden select-none gap-2">
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
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                        onPointerEnter={onPointerEnter}
                        onPointerLeave={onPointerLeave}
                        className={`w-full h-full block touch-none select-none ${
                            isDrawer ? 'cursor-none' : 'cursor-default'
                        }`}
                        style={{ touchAction: 'none' }}
                    />

                    {/* Drawer Brush Size Ring Cursor */}
                    {isDrawer && isCursorInside && (
                        <div
                            className="pointer-events-none absolute rounded-full border-2 border-ink -translate-x-1/2 -translate-y-1/2 z-30 transition-none"
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
                    />
                </div>
            )}
        </div>
    );
};

export const DrawingCanvas = React.memo(DrawingCanvasComponent);
export default DrawingCanvas;
