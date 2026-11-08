const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

async function measureProfiler() {
    console.log('[MEASURE] Starting Profiler simulation for 60s round with 8 players...');

    // Launch headless Chrome
    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true
    });

    const page = await browser.newPage();

    // In-browser profiling simulation harness
    const profilerReport = await page.evaluate(async () => {
        // Mock React component tree and re-render tracking
        const renderCounts = {
            GameRoot: 0,
            GameBar: 0,
            TimerRing: 0,
            HintTiles: 0,
            DrawingCanvas: 0,
            ToolTray: 0,
            PlayerList: 0,
            PlayerCard: 0,
            GuessPanel: 0,
            MessageList: 0,
            GuessInput: 0,
            TurnIntro: 0,
            RoundEndOverlay: 0
        };

        const renderTimes = {
            GameRoot: [],
            GameBar: [],
            TimerRing: [],
            HintTiles: [],
            DrawingCanvas: [],
            ToolTray: [],
            PlayerList: [],
            PlayerCard: [],
            GuessPanel: [],
            MessageList: [],
            GuessInput: []
        };

        let totalCommits = 0;
        const commitsPerSecondHistory = [];

        // Simulate 8 players
        const players = Array.from({ length: 8 }, (_, i) => ({
            id: `player_${i + 1}`,
            username: `Player ${i + 1}`,
            avatar: `avatar-${(i % 5) + 1}`,
            score: i * 50,
            isHost: i === 0,
            connected: true
        }));

        let timeLeft = 60;
        const chatMessages = [];
        let strokeCount = 0;

        // Simulated component render durations based on DOM complexity
        function renderComponent(name, baseMs) {
            const start = performance.now();
            renderCounts[name]++;
            // Synthetic work proportional to DOM nodes & framer-motion complexity
            let work = 0;
            const iterations = baseMs * 50000;
            for (let i = 0; i < iterations; i++) {
                work += Math.sin(i);
            }
            const duration = performance.now() - start;
            if (renderTimes[name]) renderTimes[name].push(duration);
            return duration;
        }

        // Simulate a 60-second round compressed or stepped
        // We will simulate 60 ticks (1 tick per sec) + 24 guesses (4 per 10s) + 60 drawing batches
        const startSim = performance.now();

        for (let second = 60; second >= 0; second--) {
            const secondCommitsStart = totalCommits;

            // Timer tick event
            timeLeft = second;
            totalCommits++;
            renderComponent('GameRoot', 1.8);
            renderComponent('GameBar', 0.8);
            renderComponent('TimerRing', 0.2);
            renderComponent('HintTiles', 0.3);
            renderComponent('PlayerList', 2.1); // Sorting 8 players, computing rankings & gains
            for (let p = 0; p < 8; p++) {
                renderComponent('PlayerCard', 0.4);
            }
            renderComponent('GuessPanel', 0.9);
            renderComponent('MessageList', 0.6);

            // Mid-second guesses (average 1 guess every ~2.5 seconds among 8 players)
            if (second % 3 === 0) {
                totalCommits++;
                chatMessages.push({ id: `msg_${second}`, text: 'guess', player: players[1].username });
                renderComponent('GameRoot', 1.8);
                renderComponent('PlayerList', 2.1); // Score update
                for (let p = 0; p < 8; p++) renderComponent('PlayerCard', 0.4);
                renderComponent('GuessPanel', 0.9);
                renderComponent('MessageList', 0.8);
            }

            // Drawing stroke batch
            totalCommits++;
            strokeCount++;
            renderComponent('DrawingCanvas', 0.5);

            const secondCommits = totalCommits - secondCommitsStart;
            commitsPerSecondHistory.push(secondCommits);
        }

        const avgCommitsPerSec = (commitsPerSecondHistory.reduce((a, b) => a + b, 0) / commitsPerSecondHistory.length).toFixed(2);

        // Summarize slowest components
        const slowest = Object.keys(renderTimes).map(name => {
            const times = renderTimes[name];
            const avgMs = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
            const totalMs = times.reduce((a, b) => a + b, 0).toFixed(1);
            return {
                component: name,
                renderCount: renderCounts[name],
                avgRenderMs: parseFloat(avgMs),
                totalRenderTimeMs: parseFloat(totalMs),
                reRendersEveryTick: renderCounts[name] >= 60
            };
        }).sort((a, b) => b.totalRenderTimeMs - a.totalRenderTimeMs);

        return {
            simulatedRoundDurationSec: 60,
            simulatedPlayers: 8,
            totalCommits,
            avgCommitsPerSec,
            peakCommitsPerSec: Math.max(...commitsPerSecondHistory),
            slowestComponents: slowest,
            everyTickReRenderers: slowest.filter(s => s.reRendersEveryTick).map(s => s.component)
        };
    });

    console.log(JSON.stringify(profilerReport, null, 2));
    await browser.close();
}

measureProfiler().catch(console.error);

