const { chromium } = require('playwright');
const path = require('path');

async function measureCanvas() {
    console.log('[MEASURE] Launching headless browser for Canvas benchmark...');
    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2 // standard retina
    });

    const page = await context.newPage();

    // Load canvas benchmark in page context with exact algorithm from useCanvas & canvasMath
    const results = await page.evaluate(async () => {
        // Base constants
        const BASE_WIDTH = 1600;
        const BASE_HEIGHT = 1200;
        const dpr = window.devicePixelRatio || 1;
        const targetWidth = Math.round(BASE_WIDTH * dpr);
        const targetHeight = Math.round(BASE_HEIGHT * dpr);

        const memoryDpr1 = BASE_WIDTH * BASE_HEIGHT * 4 * 2; // main + offscreen
        const memoryDpr2 = targetWidth * targetHeight * 4 * 2;

        // Create main and offscreen canvases
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const offscreen = document.createElement('canvas');
        offscreen.width = targetWidth;
        offscreen.height = targetHeight;
        const offCtx = offscreen.getContext('2d');

        // Midpoint curve algorithm matching client/src/utils/canvasMath.js
        function buildMidpointCurve(points) {
            if (!points || points.length === 0) return [];
            if (points.length === 1) return [{ type: 'dot', x: points[0].x, y: points[0].y }];
            if (points.length === 2) {
                return [
                    { type: 'move', x: points[0].x, y: points[0].y },
                    { type: 'line', x: points[1].x, y: points[1].y }
                ];
            }
            const cmds = [{ type: 'move', x: points[0].x, y: points[0].y }];
            for (let i = 1; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];
                const midX = (current.x + next.x) / 2;
                const midY = (current.y + next.y) / 2;
                cmds.push({ type: 'quadratic', cpX: current.x, cpY: current.y, x: midX, y: midY });
            }
            const last = points[points.length - 1];
            cmds.push({ type: 'line', x: last.x, y: last.y });
            return cmds;
        }

        function renderCommands(targetCtx, commands, backingWidth, backingHeight, size, tool, color) {
            if (!commands || commands.length === 0) return;
            targetCtx.save();
            const strokeWidth = Math.max(1, size * (backingWidth / 800));
            targetCtx.lineWidth = strokeWidth;
            targetCtx.lineCap = 'round';
            targetCtx.lineJoin = 'round';
            if (tool === 'eraser') {
                targetCtx.globalCompositeOperation = 'destination-out';
                targetCtx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                targetCtx.globalCompositeOperation = 'source-over';
                targetCtx.strokeStyle = color;
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
        }

        function blit() {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(offscreen, 0, 0);
        }

        // Generate 200 random curved strokes across the canvas
        const strokeList = [];
        for (let s = 0; s < 200; s++) {
            const startX = 0.1 + Math.random() * 0.8;
            const startY = 0.1 + Math.random() * 0.8;
            const points = [{ x: startX, y: startY }];
            const numPoints = 15 + Math.floor(Math.random() * 15); // 15-30 points
            let currX = startX;
            let currY = startY;
            for (let p = 1; p < numPoints; p++) {
                currX += (Math.random() - 0.5) * 0.05;
                currY += (Math.random() - 0.5) * 0.05;
                points.push({ x: Math.max(0.01, Math.min(0.99, currX)), y: Math.max(0.01, Math.min(0.99, currY)) });
            }
            strokeList.push({
                points,
                size: 6,
                tool: s % 10 === 0 ? 'eraser' : 'pencil',
                color: '#1C1B18'
            });
        }

        // Measure incremental drawing of 200 strokes (animation frame loop)
        const frameTimes = [];
        let strokeIndex = 0;

        await new Promise((resolve) => {
            let lastTimestamp = performance.now();
            function step(timestamp) {
                const delta = timestamp - lastTimestamp;
                lastTimestamp = timestamp;
                frameTimes.push(delta);

                if (strokeIndex < strokeList.length) {
                    const stroke = strokeList[strokeIndex++];
                    const cmds = buildMidpointCurve(stroke.points);
                    renderCommands(offCtx, cmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
                    blit();
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(step);
        });

        // Calculate average FPS while drawing 200 strokes
        const validFrames = frameTimes.slice(1); // skip initial warmup frame
        const avgFrameTimeMs = validFrames.reduce((a, b) => a + b, 0) / validFrames.length;
        const fps = Math.round(1000 / avgFrameTimeMs);

        // Measure repaint after resize (full redraw of 200 strokes)
        const resizeRepaintTimes = [];
        for (let r = 0; r < 10; r++) {
            const t0 = performance.now();
            offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
            for (const stroke of strokeList) {
                const cmds = buildMidpointCurve(stroke.points);
                renderCommands(offCtx, cmds, offscreen.width, offscreen.height, stroke.size, stroke.tool, stroke.color);
            }
            blit();
            const t1 = performance.now();
            resizeRepaintTimes.push(t1 - t0);
        }

        const avgResizeRepaintMs = (resizeRepaintTimes.reduce((a, b) => a + b, 0) / resizeRepaintTimes.length).toFixed(2);

        return {
            fps,
            avgFrameTimeMs: avgFrameTimeMs.toFixed(2),
            avgResizeRepaintMs,
            targetDimensions: `${targetWidth}x${targetHeight}`,
            devicePixelRatio: dpr,
            memoryBytesDpr1: memoryDpr1,
            memoryMBDpr1: (memoryDpr1 / (1024 * 1024)).toFixed(2),
            memoryBytesDpr2: memoryDpr2,
            memoryMBDpr2: (memoryDpr2 / (1024 * 1024)).toFixed(2)
        };
    });

    console.log(JSON.stringify(results, null, 2));
    await browser.close();
}

measureCanvas().catch(console.error);

