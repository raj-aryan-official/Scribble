import React, { useEffect, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { Eraser, Pencil, Trash2, Undo, Palette } from 'lucide-react';

export const DrawingCanvas = ({ roomCode, isDrawer, isKeyboardOpen }) => {
    const {
        canvasRef, initCanvas, onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
        onTouchStart, onTouchMove, onTouchEnd,
        setColor, setLineWidth, setTool, clearCanvas, undo, redraw,
        color, lineWidth, tool
    } = useCanvas(roomCode, isDrawer);

    const [showPalette, setShowPalette] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            initCanvas();
            redraw();
        };

        handleResize(); // Init on mount
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [initCanvas, redraw]);

    return (
        <div className="flex flex-col h-full">
            <div className="relative flex-grow bg-white rounded-xl shadow-inner border overflow-hidden cursor-crosshair">
                <canvas
                    ref={canvasRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    className="absolute inset-0 w-full h-full touch-none"
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {/* Tools Section - Visible even with keyboard, but compact */}
            {/* Tools Section - Improved Layout */}
            {isDrawer && (
                <div className={`flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl shadow-lg shrink-0 transition-all ${isKeyboardOpen ? 'p-1 mt-1' : 'p-2 mt-2 md:p-3 md:mt-3'}`}>

                    {/* Left Group: Tools + Size + Actions */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0 max-w-full">
                        {/* Tools */}
                        <div className="flex gap-1 shrink-0 bg-gray-50 p-1 rounded-lg border border-gray-100">
                            <button onClick={() => setTool('pencil')} className={`p-1.5 md:p-2 rounded-md transition-colors ${tool === 'pencil' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'}`} title="Pencil">
                                <Pencil size={isKeyboardOpen ? 18 : 20} />
                            </button>
                            <button onClick={() => setTool('eraser')} className={`p-1.5 md:p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'}`} title="Eraser">
                                <Eraser size={isKeyboardOpen ? 18 : 20} />
                            </button>
                        </div>

                        <div className="h-6 w-px bg-gray-200 shrink-0"></div>

                        {/* Size Slider */}
                        <div className="flex items-center px-1">
                            <input
                                type="range"
                                min="1" max="20"
                                value={lineWidth}
                                onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                className="w-20 md:w-32 accent-primary h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                title="Brush Size"
                            />
                        </div>

                        <div className="h-6 w-px bg-gray-200 shrink-0"></div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                            <button onClick={undo} className="p-1.5 md:p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors" title="Undo">
                                <Undo size={isKeyboardOpen ? 18 : 20} />
                            </button>
                            <button onClick={clearCanvas} className="p-1.5 md:p-2 rounded-md hover:bg-red-50 text-red-500 transition-colors" title="Clear Canvas">
                                <Trash2 size={isKeyboardOpen ? 18 : 20} />
                            </button>
                        </div>
                    </div>

                    {/* Right Group: Colors - Compact with Popover */}
                    <div className="flex items-center gap-1.5 relative px-1 ml-auto">
                        {/* First 5 Primary Colors */}
                        {['#000000', '#EF4444', '#22C55E', '#3B82F6', '#EAB308'].map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-7 h-7 md:w-8 md:h-8 rounded-full shadow-sm shrink-0 transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105 ring-1 ring-black/10'}`}
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
                                    {/* Custom Picker in Popover */}
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
