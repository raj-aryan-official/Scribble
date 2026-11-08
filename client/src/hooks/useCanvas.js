import { useRef, useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { EVENTS } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import {
    createPointBatcher,
    buildMidpointCurve,
    MIN_POINT_DISTANCE,
    MAX_POINTS_PER_STROKE,
    HIGH_POINT_THRESHOLD
} from '../utils/canvasMath';
import { PRESET_COLORS } from '../components/Canvas/ColorSwatches';

// Backing store dimensions for fixed 4:3 aspect ratio
const BASE_WIDTH = 1600;
const BASE_HEIGHT = 1200;

export const useCanvas = (roomCode, isDrawer, twist = null) => {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const offscreenCanvasRef = useRef(null);
    const offscreenCtxRef = useRef(null);
    const socket = useSocket();

    const [color, setColorState] = useState('#1C1B18');
    const [lineWidth, setLineWidthState] = useState(6);
    const [tool, setToolState] = useState('pencil'); // 'pencil' | 'eraser'
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [isCursorInside, setIsCursorInside] = useState(false);
    const [strokeCount, setStrokeCount] = useState(0);
    const [inkRemaining, setInkRemaining] = useState(1200);

    // Palm rejection refs
    const isPenActiveRef = useRef(false);
    const penTimerRef = useRef(null);

    // Keep active settings in refs to avoid stale closures in event handlers
    const isDrawerRef = useRef(isDrawer);
    const roomCodeRef = useRef(roomCode);
    const colorRef = useRef(color);
    const lineWidthRef = useRef(lineWidth);
    const toolRef = useRef(tool);
    const twistRef = useRef(twist);
    const inkRemainingRef = useRef(1200);

    useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);
    useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);
    useEffect(() => { toolRef.current = tool; }, [tool]);
    useEffect(() => { twistRef.current = twist; }, [twist]);

    // Apply rule twist overrides
    useEffect(() => {
        if (twist?.id === 'one-colour' && twist.color) {
            setColorState(twist.color);
            colorRef.current = twist.color;
        }
    }, [twist?.id, twist?.color]);

    useEffect(() => {
        if (twist?.id === 'thin-line') {
            setLineWidthState(2);
            lineWidthRef.current = 2;
        }
    }, [twist?.id]);

    useEffect(() => {
        if (twist?.id === 'no-undo-eraser') {
            if (toolRef.current === 'eraser') {
                setToolState('pencil');
                toolRef.current = 'pencil';
            }
        }
    }, [twist?.id]);

    useEffect(() => {
        if (twist?.id === 'limited-ink') {
            const initialInk = twist.remainingInk || twist.totalInk || 1200;
            setInkRemaining(initialInk);
            inkRemainingRef.current = initialInk;
        }
    }, [twist]);

    // Stroke stores
    const strokesRef = useRef([]); // Completed strokes
    const inProgressStrokesRef = useRef(new Map()); // id -> in-progress stroke
    const isDrawingRef = useRef(false);
    const currentStrokeIdRef = useRef(null);
    const batcherRef = useRef(null);

    const setColor = useCallback((newColor) => {
        setColorState(newColor);
        colorRef.current = newColor;
    }, []);

    const setLineWidth = useCallback((newWidth) => {
        setLineWidthState(newWidth);
        lineWidthRef.current = newWidth;
    }, []);

    const setTool = useCallback((newTool) => {
        setToolState(newTool);
        toolRef.current = newTool;
    }, []);

    // Stroke width helper relative to fixed 4:3 coordinate space
    const getStrokeWidth = useCallback((size, backingWidth) => {
        return Math.max(1, size * (backingWidth / 800));
    }, []);

    // Render path commands onto a target 2D context
    const renderCommands = useCallback((targetCtx, commands, backingWidth, backingHeight, size, strokeTool, strokeColor) => {
        if (!commands || commands.length === 0) return;
        targetCtx.save();
        const strokeWidth = getStrokeWidth(size, backingWidth);
        targetCtx.lineWidth = strokeWidth;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';

        if (strokeTool === 'eraser') {
            targetCtx.globalCompositeOperation = 'destination-out';
            targetCtx.strokeStyle = 'rgba(0,0,0,1)';
            targetCtx.fillStyle = 'rgba(0,0,0,1)';
        } else {
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = strokeColor;
            targetCtx.fillStyle = strokeColor;
        }

        targetCtx.beginPath();
        for (const cmd of commands) {
            if (cmd.type === 'dot') {
                const radius = Math.max(1, strokeWidth / 2);
                targetCtx.arc(cmd.x * backingWidth, cmd.y * backingHeight, radius, 0, Math.PI * 2);
                targetCtx.fill();
                targetCtx.restore();
                return;
            } else if (cmd.type === 'move') {
                targetCtx.moveTo(cmd.x * backingWidth, cmd.y * backingHeight);
            } else if (cmd.type === 'line') {
                targetCtx.lineTo(cmd.x * backingWidth, cmd.y * backingHeight);
            } else if (cmd.type === 'quadratic') {
                targetCtx.quadraticCurveTo(
                    cmd.cpX * backingWidth,
                    cmd.cpY * backingHeight,
                    cmd.x * backingWidth,
                    cmd.y * backingHeight
                );
            }
        }
        targetCtx.stroke();
        targetCtx.restore();
    }, [getStrokeWidth]);

    // Blit offscreen buffer over a white paper background onto visible canvas
    const blitToMainCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        const offscreen = offscreenCanvasRef.current;
        if (!canvas || !ctx || !offscreen) return;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreen, 0, 0);
    }, []);

    // Initialize or resize canvas backing store
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return false;

        const dpr = window.devicePixelRatio || 1;
        const targetWidth = Math.round(BASE_WIDTH * dpr);
        const targetHeight = Math.round(BASE_HEIGHT * dpr);

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            let offscreen = offscreenCanvasRef.current;
            if (!offscreen) {
                offscreen = document.createElement('canvas');
                offscreenCanvasRef.current = offscreen;
            }
            offscreen.width = targetWidth;
            offscreen.height = targetHeight;

            const ctx = canvas.getContext('2d');
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctxRef.current = ctx;

            const offCtx = offscreen.getContext('2d');
            offCtx.lineCap = 'round';
            offCtx.lineJoin = 'round';
            offscreenCtxRef.current = offCtx;

            return true;
        }

        if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
        if (!offscreenCanvasRef.current) {
            const offscreen = document.createElement('canvas');
            offscreen.width = targetWidth;
            offscreen.height = targetHeight;
            offscreenCanvasRef.current = offscreen;
            offscreenCtxRef.current = offscreen.getContext('2d');
        }

        return false;
    }, []);

    // Full redraw of all committed and in-progress strokes
    const redraw = useCallback(() => {
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreenCtxRef.current;
        if (!offscreen || !offCtx) return;

        // Clear offscreen layer
        offCtx.clearRect(0, 0, offscreen.width, offscreen.height);

        // Draw finished strokes
        for (const stroke of strokesRef.current) {
            const cmds = buildMidpointCurve(stroke.points);
            renderCommands(offCtx, cmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
        }

        // Draw any in-progress strokes
        for (const stroke of inProgressStrokesRef.current.values()) {
            const cmds = buildMidpointCurve(stroke.points);
            renderCommands(offCtx, cmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
        }

        blitToMainCanvas();
    }, [renderCommands, blitToMainCanvas]);

    // Draw an incremental point segment to the offscreen canvas
    const drawIncrementalPoint = useCallback((stroke, newPoint) => {
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreenCtxRef.current;
        if (!offscreen || !offCtx || !stroke) return;

        const points = stroke.points;
        const prevPoint = points[points.length - 1];
        points.push(newPoint);

        const currentCount = points.length;
        const cmds = [];

        if (currentCount === 2) {
            // First segment: line from P0 to midpoint M1
            const m1 = {
                x: (prevPoint.x + newPoint.x) / 2,
                y: (prevPoint.y + newPoint.y) / 2
            };
            cmds.push({ type: 'move', x: prevPoint.x, y: prevPoint.y });
            cmds.push({ type: 'line', x: m1.x, y: m1.y });
            stroke.lastMidpoint = m1;
        } else if (currentCount > HIGH_POINT_THRESHOLD) {
            // High point count guardrail: plain line
            cmds.push({ type: 'move', x: prevPoint.x, y: prevPoint.y });
            cmds.push({ type: 'line', x: newPoint.x, y: newPoint.y });
            stroke.lastMidpoint = null;
        } else if (stroke.lastMidpoint) {
            // Midpoint quadratic curve segment
            const nextMid = {
                x: (prevPoint.x + newPoint.x) / 2,
                y: (prevPoint.y + newPoint.y) / 2
            };
            cmds.push({ type: 'move', x: stroke.lastMidpoint.x, y: stroke.lastMidpoint.y });
            cmds.push({
                type: 'quadratic',
                cpX: prevPoint.x,
                cpY: prevPoint.y,
                x: nextMid.x,
                y: nextMid.y
            });
            stroke.lastMidpoint = nextMid;
        } else {
            cmds.push({ type: 'move', x: prevPoint.x, y: prevPoint.y });
            cmds.push({ type: 'line', x: newPoint.x, y: newPoint.y });
        }

        renderCommands(offCtx, cmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
        if (twistRef.current?.id === 'mirror') {
            const mirrorCmds = cmds.map(cmd => {
                const res = { ...cmd };
                if (typeof cmd.x === 'number') res.x = 1 - cmd.x;
                if (typeof cmd.cpX === 'number') res.cpX = 1 - cmd.cpX;
                return res;
            });
            renderCommands(offCtx, mirrorCmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
        }
        blitToMainCanvas();
    }, [renderCommands, blitToMainCanvas]);

    // Finalize an in-progress stroke
    const finishStroke = useCallback((id) => {
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreenCtxRef.current;
        const stroke = inProgressStrokesRef.current.get(id);
        if (!stroke) return;

        // Draw segment from last midpoint to the final point
        if (offscreen && offCtx && stroke.lastMidpoint && stroke.points.length >= 2) {
            const last = stroke.points[stroke.points.length - 1];
            const cmds = [
                { type: 'move', x: stroke.lastMidpoint.x, y: stroke.lastMidpoint.y },
                { type: 'line', x: last.x, y: last.y }
            ];
            renderCommands(offCtx, cmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
            if (twistRef.current?.id === 'mirror') {
                const mirrorCmds = [
                    { type: 'move', x: 1 - stroke.lastMidpoint.x, y: stroke.lastMidpoint.y },
                    { type: 'line', x: 1 - last.x, y: last.y }
                ];
                renderCommands(offCtx, mirrorCmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
            }
            blitToMainCanvas();
        }

        inProgressStrokesRef.current.delete(id);
        strokesRef.current.push(stroke);
        setStrokeCount(strokesRef.current.length);
    }, [renderCommands, blitToMainCanvas]);

    // Coordinate conversion: screen CSS coords to normalized 0-1 4:3 sheet coordinates
    const getNormalizedPoint = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        let y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        if (twistRef.current?.id === 'upside-down' && isDrawerRef.current) {
            x = Math.max(0, Math.min(1, 1 - x));
            y = Math.max(0, Math.min(1, 1 - y));
        }

        if (twistRef.current?.id === 'wobbly-pen' && isDrawerRef.current) {
            const jitterX = (Math.random() - 0.5) * 0.016;
            const jitterY = (Math.random() - 0.5) * 0.016;
            x = Math.max(0, Math.min(1, x + jitterX));
            y = Math.max(0, Math.min(1, y + jitterY));
        }

        return { x, y };
    }, []);

    // Pointer events implementation
    const onPointerDown = useCallback((e) => {
        if (!isDrawerRef.current) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        // Palm rejection: if pen is active, ignore simultaneous touch input
        if (e.pointerType === 'pen') {
            if (penTimerRef.current) clearTimeout(penTimerRef.current);
            isPenActiveRef.current = true;
        } else if (e.pointerType === 'touch' && isPenActiveRef.current) {
            return;
        }

        if (twistRef.current?.id === 'limited-ink') {
            if (toolRef.current !== 'eraser' && inkRemainingRef.current <= 0) {
                return;
            }
        }

        e.preventDefault();

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {}

        isDrawingRef.current = true;
        const { x, y } = getNormalizedPoint(e);

        // Pen pressure sensitivity support
        let size = lineWidthRef.current;
        if (e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0) {
            size = Math.max(1, Math.round(size * e.pressure * 2));
        }

        const id = uuidv4();
        currentStrokeIdRef.current = id;

        const stroke = {
            id,
            tool: toolRef.current,
            color: colorRef.current,
            size,
            points: [{ x, y }],
            lastMidpoint: null
        };

        if (twistRef.current?.id === 'limited-ink' && isDrawerRef.current && stroke.tool !== 'eraser') {
            stroke.inkCost = 5;
            inkRemainingRef.current = Math.max(0, inkRemainingRef.current - 5);
            setInkRemaining(inkRemainingRef.current);
        }

        inProgressStrokesRef.current.set(id, stroke);
        setStrokeCount((prev) => prev + 1);

        // Draw initial dot to offscreen canvas
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreenCtxRef.current;
        if (offscreen && offCtx) {
            renderCommands(offCtx, [{ type: 'dot', x, y }], offscreen.width, offscreen.height, size, stroke.tool, stroke.color);
            if (twistRef.current?.id === 'mirror') {
                renderCommands(offCtx, [{ type: 'dot', x: 1 - x, y }], offscreen.width, offscreen.height, size, stroke.tool, stroke.color);
            }
            blitToMainCanvas();
        }

        // Emit STROKE_START
        if (socket) {
            socket.emit(EVENTS.STROKE_START, {
                roomCode: roomCodeRef.current,
                id,
                tool: stroke.tool,
                color: stroke.color,
                size: stroke.size,
                x,
                y
            });
        }

        // Initialize point batcher for this stroke
        batcherRef.current = createPointBatcher({
            onBatch: (batchedPoints) => {
                if (socket && batchedPoints.length > 0) {
                    socket.emit(EVENTS.STROKE_POINTS, {
                        roomCode: roomCodeRef.current,
                        id,
                        points: batchedPoints
                    });
                }
            }
        });
    }, [getNormalizedPoint, renderCommands, blitToMainCanvas, socket]);

    const onPointerMove = useCallback((e) => {
        // Palm rejection: ignore simultaneous touch when pen is active
        if (e.pointerType === 'touch' && isPenActiveRef.current) return;

        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            setCursorPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }

        if (!isDrawingRef.current || !isDrawerRef.current) return;
        e.preventDefault();

        const strokeId = currentStrokeIdRef.current;
        const stroke = inProgressStrokesRef.current.get(strokeId);
        if (!stroke || !batcherRef.current) return;

        // Use getCoalescedEvents when available for high-precision pointer tracking
        const events = (typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null) || [e];
        for (const ev of events) {
            const { x, y } = getNormalizedPoint(ev);
            if (twistRef.current?.id === 'limited-ink' && isDrawerRef.current && stroke.tool !== 'eraser') {
                const lastPt = stroke.points[stroke.points.length - 1];
                if (lastPt) {
                    const dx = x - lastPt.x;
                    const dy = y - lastPt.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const cost = Math.max(1, Math.round(dist * 1000));
                    if (inkRemainingRef.current < cost) {
                        isDrawingRef.current = false;
                        finishStroke(strokeId);
                        return;
                    }
                    inkRemainingRef.current -= cost;
                    stroke.inkCost = (stroke.inkCost || 0) + cost;
                    setInkRemaining(inkRemainingRef.current);
                }
            }
            const accepted = batcherRef.current.addPoint(x, y);
            if (accepted) {
                drawIncrementalPoint(stroke, { x, y });
            }
        }
    }, [getNormalizedPoint, drawIncrementalPoint, finishStroke]);

    const onPointerUp = useCallback((e) => {
        if (e.pointerType === 'pen') {
            if (penTimerRef.current) clearTimeout(penTimerRef.current);
            penTimerRef.current = setTimeout(() => {
                isPenActiveRef.current = false;
            }, 300);
        }

        if (!isDrawingRef.current || !isDrawerRef.current) return;
        isDrawingRef.current = false;

        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (_) {}

        const strokeId = currentStrokeIdRef.current;
        if (strokeId) {
            if (batcherRef.current) {
                batcherRef.current.flush();
                batcherRef.current.reset();
            }
            finishStroke(strokeId);

            if (socket) {
                socket.emit(EVENTS.STROKE_END, {
                    roomCode: roomCodeRef.current,
                    id: strokeId
                });
            }
            currentStrokeIdRef.current = null;
        }
    }, [finishStroke, socket]);

    const onPointerCancel = onPointerUp;

    const onPointerEnter = useCallback(() => {
        setIsCursorInside(true);
    }, []);

    const onPointerLeave = useCallback(() => {
        setIsCursorInside(false);
    }, []);

    // Actions
    const clearCanvas = useCallback(() => {
        if (twistRef.current?.id === 'no-undo-eraser') return;
        if (socket) {
            socket.emit(EVENTS.CLEAR_CANVAS, { roomCode: roomCodeRef.current });
        }
    }, [socket]);

    const undo = useCallback(() => {
        if (twistRef.current?.id === 'no-undo-eraser') return;
        if (socket) {
            socket.emit(EVENTS.UNDO_STROKE, { roomCode: roomCodeRef.current });
        }
    }, [socket]);

    // Keyboard shortcuts for drawer: P (pencil), E (eraser), [ / ] (size), 1-9 (colors), Ctrl/Cmd+Z (undo)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isDrawer) return;

            // Ignore when typing inside input or textarea
            const target = e.target;
            if (
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable)
            ) {
                return;
            }

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // Undo: Ctrl/Cmd + Z
            if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (twistRef.current?.id !== 'no-undo-eraser') {
                    undo();
                }
                return;
            }

            if (isCtrlOrCmd) return;

            // Tool toggle: P (pencil), E (eraser)
            if (e.key.toLowerCase() === 'p') {
                e.preventDefault();
                setTool('pencil');
                return;
            }
            if (e.key.toLowerCase() === 'e') {
                e.preventDefault();
                if (twistRef.current?.id !== 'no-undo-eraser') {
                    setTool('eraser');
                }
                return;
            }

            // Size: [ (decrease), ] (increase)
            if (e.key === '[') {
                e.preventDefault();
                if (twistRef.current?.id !== 'thin-line') {
                    setLineWidth((prev) => Math.max(2, prev - 2));
                }
                return;
            }
            if (e.key === ']') {
                e.preventDefault();
                if (twistRef.current?.id !== 'thin-line') {
                    setLineWidth((prev) => Math.min(40, prev + 2));
                }
                return;
            }

            // Colors: 1 through 9
            if (e.key >= '1' && e.key <= '9') {
                if (twistRef.current?.id !== 'one-colour') {
                    const colorIndex = parseInt(e.key, 10) - 1;
                    const swatch = PRESET_COLORS[colorIndex];
                    if (swatch) {
                        e.preventDefault();
                        setColor(swatch.hex);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDrawer, undo, setTool, setLineWidth, setColor]);

    // ResizeObserver debounced to one animation frame
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        initCanvas();
        redraw();

        let rafId = null;
        const ro = new ResizeObserver(() => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const changed = initCanvas();
                if (changed) {
                    redraw();
                }
            });
        });

        ro.observe(canvas);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            ro.disconnect();
        };
    }, [initCanvas, redraw]);

    // Socket listeners for real-time strokes, history, snapshots, undo, clear
    useEffect(() => {
        if (!socket) return;

        const handleStrokeStart = (data) => {
            if (!data || !data.id) return;
            if (inProgressStrokesRef.current.has(data.id)) return;

            const stroke = {
                id: data.id,
                tool: data.tool || 'pencil',
                color: data.color || '#000000',
                size: data.size || 5,
                points: [{ x: data.x, y: data.y }],
                lastMidpoint: null
            };
            inProgressStrokesRef.current.set(data.id, stroke);

            const offscreen = offscreenCanvasRef.current;
            const offCtx = offscreenCtxRef.current;
            if (offscreen && offCtx) {
                renderCommands(offCtx, [{ type: 'dot', x: data.x, y: data.y }], offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
                blitToMainCanvas();
            }
        };

        const handleStrokePoints = (data) => {
            if (!data || !data.id || !Array.isArray(data.points)) return;
            const stroke = inProgressStrokesRef.current.get(data.id);
            if (!stroke) return;

            for (const pt of data.points) {
                drawIncrementalPoint(stroke, pt);
            }
        };

        const handleStrokeEnd = (data) => {
            if (!data || !data.id) return;
            finishStroke(data.id);
        };

        const handleLegacyStroke = (stroke) => {
            if (!stroke || !stroke.id) return;
            const exists = strokesRef.current.some(s => s.id === stroke.id);
            if (!exists) {
                strokesRef.current.push(stroke);
                setStrokeCount(strokesRef.current.length);
                const offscreen = offscreenCanvasRef.current;
                const offCtx = offscreenCtxRef.current;
                if (offscreen && offCtx) {
                    const cmds = buildMidpointCurve(stroke.points);
                    renderCommands(offCtx, cmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
                    blitToMainCanvas();
                }
            }
        };

        const handleHistory = (history) => {
            if (Array.isArray(history)) {
                strokesRef.current = history;
                inProgressStrokesRef.current.clear();
                setStrokeCount(history.length);
                redraw();
            }
        };

        const handleSnapshot = (snapshot) => {
            if (snapshot?.strokes && Array.isArray(snapshot.strokes)) {
                strokesRef.current = snapshot.strokes;
                inProgressStrokesRef.current.clear();
                setStrokeCount(snapshot.strokes.length);
                redraw();
            }
        };

        const handleCleared = () => {
            strokesRef.current = [];
            inProgressStrokesRef.current.clear();
            setStrokeCount(0);
            redraw();
        };

        const handleUndone = ({ strokeId }) => {
            let removed = null;
            if (strokeId) {
                removed = strokesRef.current.find(s => s.id === strokeId);
                strokesRef.current = strokesRef.current.filter(s => s.id !== strokeId);
            } else if (strokesRef.current.length > 0) {
                removed = strokesRef.current.pop();
            }
            if (removed?.inkCost && twistRef.current?.id === 'limited-ink') {
                inkRemainingRef.current = Math.min(1200, inkRemainingRef.current + removed.inkCost);
                setInkRemaining(inkRemainingRef.current);
            }
            setStrokeCount(strokesRef.current.length);
            redraw();
        };

        socket.on(EVENTS.STROKE_START, handleStrokeStart);
        socket.on(EVENTS.STROKE_POINTS, handleStrokePoints);
        socket.on(EVENTS.STROKE_END, handleStrokeEnd);
        socket.on(EVENTS.STROKE_RECEIVED, handleLegacyStroke);
        socket.on(EVENTS.STROKE_HISTORY, handleHistory);
        socket.on(EVENTS.STATE_SNAPSHOT, handleSnapshot);
        socket.on(EVENTS.CANVAS_CLEARED, handleCleared);
        socket.on(EVENTS.STROKE_UNDONE, handleUndone);

        return () => {
            socket.off(EVENTS.STROKE_START, handleStrokeStart);
            socket.off(EVENTS.STROKE_POINTS, handleStrokePoints);
            socket.off(EVENTS.STROKE_END, handleStrokeEnd);
            socket.off(EVENTS.STROKE_RECEIVED, handleLegacyStroke);
            socket.off(EVENTS.STROKE_HISTORY, handleHistory);
            socket.off(EVENTS.STATE_SNAPSHOT, handleSnapshot);
            socket.off(EVENTS.CANVAS_CLEARED, handleCleared);
            socket.off(EVENTS.STROKE_UNDONE, handleUndone);
        };
    }, [socket, renderCommands, blitToMainCanvas, drawIncrementalPoint, finishStroke, redraw]);

    const getStrokes = useCallback(() => strokesRef.current || [], []);

    return {
        canvasRef,
        initCanvas,
        redraw,
        getStrokes,
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
        setInkRemaining
    };
};
