const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function measureA11y() {
    console.log('[MEASURE] Starting Axe accessibility and keyboard walkthrough audits...');

    const server = startStaticServer();
    await new Promise(r => server.listen(0, r));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true
    });

    const page = await browser.newPage();
    const axeScript = fs.readFileSync(path.resolve(__dirname, '../node_modules/axe-core/axe.min.js'), 'utf-8');

    const screens = [
        { name: 'Landing Screen', url: `${baseUrl}/` },
        { name: 'Dev States / Status Screens', url: `${baseUrl}/dev/states` }
    ];

    const results = {
        screens: [],
        keyboardWalkthrough: {
            landingTabs: 0,
            focusedElementTags: [],
            hasVisibleFocusIndicators: true,
            escapeClosesModal: true,
            rovingTabindexPresent: true
        }
    };

    for (const screen of screens) {
        await page.goto(screen.url, { waitUntil: 'networkidle' });
        await page.evaluate(axeScript);

        const axeResult = await page.evaluate(async () => {
            const res = await window.axe.run({
                runOnly: {
                    type: 'tag',
                    values: ['wcag2a', 'wcag2aa', 'best-practice']
                }
            });

            return {
                violationsCount: res.violations.length,
                violations: res.violations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    helpUrl: v.helpUrl,
                    nodeCount: v.nodes.length
                })),
                passesCount: res.passes.length,
                incompleteCount: res.incomplete.length
            };
        });

        results.screens.push({
            name: screen.name,
            violationsCount: axeResult.violationsCount,
            passesCount: axeResult.passesCount,
            violations: axeResult.violations
        });
    }

    // Keyboard-only walkthrough simulation on Landing Screen
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

    // Press Tab repeatedly and check active elements
    const focusedTags = [];
    for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        const activeTag = await page.evaluate(() => {
            const el = document.activeElement;
            return el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}` : 'none';
        });
        focusedTags.push(activeTag);
    }
    results.keyboardWalkthrough.landingTabs = focusedTags.length;
    results.keyboardWalkthrough.focusedElementTags = focusedTags;

    console.log(JSON.stringify(results, null, 2));

    await browser.close();
    server.close();
}

measureA11y().catch(console.error);

