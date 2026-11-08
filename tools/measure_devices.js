const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple static file server for client/dist
function startStaticServer() {
    const distPath = path.resolve(__dirname, '../client/dist');
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.json': 'application/json'
    };

    const server = http.createServer((req, res) => {
        let filePath = path.join(distPath, req.url.split('?')[0]);
        if (filePath.endsWith('/') || !path.extname(filePath)) {
            filePath = path.join(distPath, 'index.html');
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                fs.readFile(path.join(distPath, 'index.html'), (err2, fallback) => {
                    if (err2) {
                        res.writeHead(404);
                        res.end('Not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(fallback);
                    }
                });
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });

    return server;
}

async function measureDevices() {
    console.log('[MEASURE] Starting multi-device emulation with 4x CPU slowdown...');

    const server = startStaticServer();
    await new Promise(r => server.listen(0, r));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true
    });

    const devices = [
        { name: 'Mobile Small (360x640)', width: 360, height: 640, isMobile: true, dpr: 2 },
        { name: 'iPhone Modern (390x844)', width: 390, height: 844, isMobile: true, dpr: 3 },
        { name: 'Tablet (768x1024)', width: 768, height: 1024, isMobile: true, dpr: 2 },
        { name: 'Desktop (1440x900)', width: 1440, height: 900, isMobile: false, dpr: 1 }
    ];

    const results = [];

    for (const dev of devices) {
        const context = await browser.newContext({
            viewport: { width: dev.width, height: dev.height },
            deviceScaleFactor: dev.dpr,
            isMobile: dev.isMobile,
            hasTouch: dev.isMobile
        });

        const page = await context.newPage();

        // Attach CDP session to set 4x CPU slowdown
        const client = await page.context().newCDPSession(page);
        await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

        const t0 = Date.now();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        const loadDurationMs = Date.now() - t0;

        // Verify layout, viewport overflow, and touch targets
        const layoutMetrics = await page.evaluate(() => {
            const body = document.body;
            const docEl = document.documentElement;
            const scrollWidth = Math.max(body.scrollWidth, docEl.scrollWidth);
            const clientWidth = docEl.clientWidth;
            const hasHorizontalScroll = scrollWidth > clientWidth;

            // Check primary action buttons
            const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input'));
            let sub44pxButtons = 0;
            buttons.forEach(btn => {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    if (rect.width < 44 || rect.height < 44) {
                        sub44pxButtons++;
                    }
                }
            });

            return {
                viewportWidth: clientWidth,
                docScrollWidth: scrollWidth,
                hasHorizontalScroll,
                totalInteractiveElements: buttons.length,
                sub44pxButtons
            };
        });

        // Test interaction click delay under 4x CPU
        const interactT0 = Date.now();
        const primaryBtn = await page.$('button');
        if (primaryBtn) {
            await primaryBtn.click();
        }
        const interactDurationMs = Date.now() - interactT0;

        results.push({
            device: dev.name,
            viewport: `${dev.width}x${dev.height}`,
            cpuSlowdown: '4x',
            loadDurationMs,
            interactionDelayMs: interactDurationMs,
            hasHorizontalScroll: layoutMetrics.hasHorizontalScroll,
            sub44pxTargets: layoutMetrics.sub44pxButtons,
            layoutPass: !layoutMetrics.hasHorizontalScroll && layoutMetrics.sub44pxButtons === 0
        });

        await context.close();
    }

    console.log(JSON.stringify(results, null, 2));

    await browser.close();
    server.close();
}

measureDevices().catch(console.error);

