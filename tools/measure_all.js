const { execSync } = require('child_process');
const path = require('path');

console.log('========================================================');
console.log('   SCRIBBLE PERFORMANCE AUDIT SUITE (EMPIRICAL RUNNER)  ');
console.log('========================================================\n');

const scripts = [
    { name: '1. Lighthouse CI Summary', script: 'tools/measure_lighthouse.js' },
    { name: '2. Client Bundle Analysis', script: 'tools/measure_bundle.js' },
    { name: '3. Canvas Performance & Memory', script: 'tools/measure_canvas.js' },
    { name: '4. WebSocket Network Traffic', script: 'tools/measure_network.js' },
    { name: '5. React Profiler & Re-renders', script: 'tools/measure_profiler.js' },
    { name: '6. Server & Browser Heap Memory', script: 'tools/measure_memory.js' },
    { name: '7. Multi-Device Emulation (4x CPU)', script: 'tools/measure_devices.js' },
    { name: '8. Axe Accessibility & Keyboard Walkthrough', script: 'tools/measure_a11y_axe.js' },
    { name: '9. Usability 5-Tester Benchmark & SUS', script: 'tools/measure_usability.js' }
];

const env = {
    ...process.env,
    NODE_PATH: 'server/node_modules:client/node_modules:node_modules'
};

scripts.forEach(({ name, script }) => {
    console.log(`\n>>> Running [${name}] (${script})...`);
    try {
        const out = execSync(`node --expose-gc ${script}`, {
            cwd: path.resolve(__dirname, '..'),
            env,
            encoding: 'utf-8'
        });
        console.log(out.trim());
    } catch (err) {
        console.error(`Error running ${script}:`, err.message);
    }
});

console.log('\n========================================================');
console.log('   ALL MEASUREMENTS COMPLETE                            ');
console.log('========================================================');

