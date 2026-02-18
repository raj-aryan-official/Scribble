import React, { useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { Eraser, Pencil, Trash2, Undo } from 'lucide-react';

export const DrawingCanvas = ({ roomCode, isDrawer }) => {
    const {
        canvasRef, initCanvas, onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
        onTouchStart, onTouchMove, onTouchEnd,
        setColor, setLineWidth, setTool, clearCanvas, undo, redraw,
        color, lineWidth, tool
    } = useCanvas(roomCode, isDrawer);

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

            {isDrawer && (
                <div className="mt-2 md:mt-4 flex flex-col gap-2 md:gap-4 p-2 md:p-4 bg-white rounded-xl shadow-lg">
                    <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        <div className="flex gap-2 shrink-0">
                            <button onClick={() => setTool('pencil')} className={`p-2 rounded ${tool === 'pencil' ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                                <Pencil size={20} />
                            </button>
                            <button onClick={() => setTool('eraser')} className={`p-2 rounded ${tool === 'eraser' ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                                <Eraser size={20} />
                            </button>
                        </div>

                        <div className="h-8 w-px bg-gray-300 shrink-0"></div>

                        <div className="flex gap-2 shrink-0 items-center">
                            <input
                                type="range"
                                min="1" max="20"
                                value={lineWidth}
                                onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                className="w-24 md:w-32"
                            />
                        </div>

                        <div className="h-8 w-px bg-gray-300 shrink-0"></div>

                        <div className="flex gap-2 shrink-0">
                            <button onClick={undo} className="p-2 rounded hover:bg-gray-100"><Undo size={20} /></button>
                            <button onClick={clearCanvas} className="p-2 rounded hover:bg-red-100 text-red-500"><Trash2 size={20} /></button>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#FFFFFF', '#FFA500', '#800080', '#A52A2A', '#008080', '#800000'].map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-8 h-8 rounded-full border-2 shrink-0 ${color === c ? 'border-primary scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-8 h-8 rounded-full overflow-hidden shrink-0"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
