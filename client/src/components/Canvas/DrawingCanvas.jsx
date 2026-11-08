import React, { useState, useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { Eraser, Pencil, Trash2, Undo, Palette } from 'lucide-react';

const DrawingCanvasComponent = ({ roomCode, isDrawer, isKeyboardOpen }) => {
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
        isCursorInside
    } = useCanvas(roomCode, isDrawer);

    const [showPalette, setShowPalette] = useState(false);
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

    // Compute cursor ring diameter based on current canvas element width
    const displayRingDiameter = Math.max(4, Math.round(lineWidth * (canvasWidth / 800)));

    return (
        <div className="flex flex-col h-full w-full min-h-0 overflow-hidden select-none">
            {/* Fixed 4:3 Letterboxed Paper Area */}
            <div
                className="w-full flex-1 min-h-0 flex items-center justify-center p-1 md:p-3 overflow-hidden"
                style={{ containerType: 'size' }}
            >
                <div
                    className="relative bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex items-center justify-center"
                    style={{
                        aspectRatio: '4 / 3',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'min(100cqw, calc(100cqh * 4 / 3))',
                        height: 'min(100cqh, calc(100cqw * 3 / 4))'
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
                        className={`w-full h-full block touch-none select-none ${isDrawer ? 'cursor-none' : 'cursor-default'}`}
                        style={{ touchAction: 'none' }}
                    />

                    {/* Drawer Brush Size Ring Cursor */}
                    {isDrawer && isCursorInside && (
                        <div
                            className="pointer-events-none absolute rounded-full border border-gray-700/80 -translate-x-1/2 -translate-y-1/2 z-30 transition-none"
                            style={{
                                left: cursorPos.x,
                                top: cursorPos.y,
                                width: displayRingDiameter,
                                height: displayRingDiameter,
                                boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.9)',
                                backgroundColor: tool === 'eraser' ? 'rgba(255, 255, 255, 0.45)' : `${color}25`
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Toolbar outside the paper - never alters the 4:3 paper size */}
            {isDrawer && (
                <div className={`flex items-center justify-between gap-1 bg-white rounded-xl shadow-lg shrink-0 transition-all ${isKeyboardOpen ? 'p-1 mt-0.5' : 'p-2 mt-1 md:p-2.5 md:mt-2'}`}>
                    {/* Left Group: Tools + Size + Actions */}
                    <div className="flex items-center gap-1 md:gap-2 overflow-x-auto scrollbar-hide shrink-0 max-w-[calc(100%-100px)] md:max-w-full">
                        {/* Tools */}
                        <div className="flex gap-1 shrink-0 bg-gray-50 p-1 rounded-lg border border-gray-100">
                            <button
                                onClick={() => setTool('pencil')}
                                className={`p-1.5 md:p-2 rounded-md transition-colors ${tool === 'pencil' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'}`}
                                title="Pencil"
                            >
                                <Pencil size={isKeyboardOpen ? 18 : 20} />
                            </button>
                            <button
                                onClick={() => setTool('eraser')}
                                className={`p-1.5 md:p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'}`}
                                title="Eraser"
                            >
                                <Eraser size={isKeyboardOpen ? 18 : 20} />
                            </button>
                        </div>

                        <div className="h-6 w-px bg-gray-200 shrink-0"></div>

                        {/* Size Slider */}
                        <div className="flex items-center px-1">
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={lineWidth}
                                onChange={(e) => setLineWidth(parseInt(e.target.value, 10))}
                                className="w-16 md:w-32 accent-primary h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                title="Brush Size"
                            />
                        </div>

                        <div className="h-6 w-px bg-gray-200 shrink-0"></div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                            <button
                                onClick={undo}
                                className="p-1.5 md:p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo size={isKeyboardOpen ? 18 : 20} />
                            </button>
                            <button
                                onClick={clearCanvas}
                                className="p-1.5 md:p-2 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                                title="Clear Canvas"
                            >
                                <Trash2 size={isKeyboardOpen ? 18 : 20} />
                            </button>
                        </div>
                    </div>

                    {/* Right Group: Colors */}
                    <div className="flex items-center gap-1 relative px-0 md:px-1 ml-auto shrink-0">
                        {/* First 2 Colors on Mobile, 5 on Desktop */}
                        {['#000000', '#EF4444', '#22C55E', '#3B82F6', '#EAB308'].map((c, idx) => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-7 h-7 md:w-8 md:h-8 rounded-full shadow-sm shrink-0 transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105 ring-1 ring-black/10'} ${idx >= 2 ? 'hidden lg:block' : ''}`}
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}

                        {/* More Colors Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowPalette(!showPalette)}
                                className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full transition-all ${showPalette ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'}`}
                                title="More Colors"
                            >
                                <Palette size={18} />
                            </button>

                            {/* Color Popover */}
                            {showPalette && (
                                <div className="absolute bottom-full right-0 mb-3 p-3 bg-white rounded-xl shadow-2xl border border-gray-200 grid grid-cols-5 gap-2 z-[60] w-64 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="col-span-5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 text-center">Color Palette</div>
                                    {['#000000', '#EF4444', '#22C55E', '#3B82F6', '#EAB308', '#06B6D4', '#D946EF', '#FFFFFF', '#F97316', '#8B5CF6', '#78350F', '#0D9488', '#991B1B'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setColor(c);
                                                setShowPalette(false);
                                            }}
                                            className={`w-8 h-8 rounded-full shadow-sm shrink-0 transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105 ring-1 ring-black/10'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    {/* Custom Picker */}
                                    <div className="relative w-8 h-8 rounded-full shadow-sm ring-1 ring-black/10 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-green-500 to-blue-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 opacity-0 cursor-pointer"
                                            title="Custom Color"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const DrawingCanvas = React.memo(DrawingCanvasComponent);
