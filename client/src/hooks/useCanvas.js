import { useRef, useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { EVENTS } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export const useCanvas = (roomCode, isDrawer) => {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(5);
    const [tool, setTool] = useState('pencil'); // pencil, eraser
    const socket = useSocket();

    const strokes = useRef([]); // Local mirror of strokes
    const currentStroke = useRef([]);

    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctxRef.current = ctx;
    }, []);

    const drawLine = ({ points, color, size, tool }) => {
        const ctx = ctxRef.current;
        if (!ctx || points.length < 2) return;

        ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
        ctx.lineWidth = size;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();
    };

    // Replay all strokes (for clear/undo/init)
    const redraw = () => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio); // Clear with correct scale

        strokes.current.forEach(stroke => drawLine(stroke));
    };

    useEffect(() => {
        if (!socket) return;

        socket.on('STROKE_HISTORY', (history) => {
            strokes.current = history;
            redraw();
        });

        socket.on(EVENTS.STROKE_RECEIVED, (stroke) => {
            strokes.current.push(stroke);
            drawLine(stroke);
        });

        socket.on(EVENTS.CANVAS_CLEARED, () => {
            strokes.current = [];
            redraw();
        });

        socket.on(EVENTS.STROKE_UNDONE, ({ strokeId }) => {
            strokes.current = strokes.current.filter(s => s.id !== strokeId);
            redraw();
        });

        return () => {
            socket.off(EVENTS.STROKE_RECEIVED);
            socket.off(EVENTS.CANVAS_CLEARED);
            socket.off(EVENTS.STROKE_UNDONE);
        };
    }, [socket]);

    const getPoint = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        // Check if touch event
        if (e.touches && e.touches.length > 0) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            // For touchend
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.changedTouches[0].clientX - rect.left,
                y: e.changedTouches[0].clientY - rect.top
            };
        }

        // Mouse event
        return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    };

    const startDrawing = (e) => {
        if (!isDrawer) return;
        setIsDrawing(true);
        const { x, y } = getPoint(e);
        currentStroke.current = [{ x, y }];
    };

    const draw = (e) => {
        if (!isDrawing || !isDrawer) return;
        // Prevent scrolling on touch
        if (e.type.startsWith('touch')) {
            // e.preventDefault(); // Passive listener issue might prevent this, stick to CSS touch-action: none
        }

        const { x, y } = getPoint(e);
        const newPoint = { x, y };
        currentStroke.current.push(newPoint);

        const points = currentStroke.current;
        if (points.length >= 2) {
            const lastPoint = points[points.length - 2];
            drawLine({
                points: [lastPoint, newPoint],
                color,
                size: lineWidth,
                tool
            });
        }
    };

    const endDrawing = (e) => {
        if (!isDrawing || !isDrawer) return;
        setIsDrawing(false);

        if (currentStroke.current.length > 0) {
            const stroke = {
                id: uuidv4(),
                tool,
                color,
                size: lineWidth,
                points: currentStroke.current
            };

            strokes.current.push(stroke);
            socket.emit(EVENTS.DRAW_STROKE, { roomCode, stroke });
        }
        currentStroke.current = [];
    };

    // Unified Handlers
    const onMouseDown = startDrawing;
    const onMouseMove = draw;
    const onMouseUp = endDrawing;

    // Touch Handlers
    const onTouchStart = startDrawing;
    const onTouchMove = draw;
    const onTouchEnd = endDrawing;

    const clearCanvas = () => {
        socket.emit(EVENTS.CLEAR_CANVAS, { roomCode });
    };

    const undo = () => {
        socket.emit(EVENTS.UNDO_STROKE, { roomCode });
    };

    return {
        canvasRef,
        initCanvas,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave: onMouseUp,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        setColor,
        setLineWidth,
        setTool,
        clearCanvas,
        undo,
        color,
        lineWidth,
        tool
    };
};
