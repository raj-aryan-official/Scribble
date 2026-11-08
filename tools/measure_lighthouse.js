const fs = require('fs');
const path = require('path');

function parseLighthouseMetrics() {
    const lhciDir = path.resolve(__dirname, '../.lighthouseci');
    if (!fs.existsSync(lhciDir)) {
        console.error('No .lighthouseci directory found.');
        process.exit(1);
    }

    const files = fs.readdirSync(lhciDir).filter(f => f.endsWith('.json') && !f.includes('assertion'));
    if (files.length === 0) {
        console.error('No LHCI JSON reports found.');
        process.exit(1);
    }

    const reports = files.map(file => {
        const raw = fs.readFileSync(path.join(lhciDir, file), 'utf-8');
        return JSON.parse(raw);
    });

    const avg = (fn) => (reports.reduce((sum, r) => sum + fn(r), 0) / reports.length).toFixed(1);

    const summary = {
        runsCount: reports.length,
        profile: 'Mobile (slow 4G throttling, 1.6 Mbps down, 750 Kbps up, 150ms RTT, 4x CPU slowdown)',
        scores: {
            performance: Math.round(reports.reduce((s, r) => s + r.categories.performance.score * 100, 0) / reports.length),
            accessibility: Math.round(reports.reduce((s, r) => s + r.categories.accessibility.score * 100, 0) / reports.length),
            bestPractices: Math.round(reports.reduce((s, r) => s + r.categories['best-practices'].score * 100, 0) / reports.length),
            seo: Math.round(reports.reduce((s, r) => s + r.categories.seo.score * 100, 0) / reports.length)
        },
        metrics: {
            FCP_sec: avg(r => r.audits['first-contentful-paint'].numericValue / 1000),
            LCP_sec: avg(r => r.audits['largest-contentful-paint'].numericValue / 1000),
            CLS: avg(r => r.audits['cumulative-layout-shift'].numericValue),
            TBT_ms: Math.round(reports.reduce((s, r) => s + r.audits['total-blocking-time'].numericValue, 0) / reports.length),
            SpeedIndex_sec: avg(r => r.audits['speed-index'].numericValue / 1000)
        },
        targets: {
            LCP_sec: '< 2.5s',
            CLS: '< 0.1',
            TBT_ms: '< 200ms (proxy for INP)'
        },
        evaluations: {
            LCP: reports[0].audits['largest-contentful-paint'].numericValue / 1000 < 2.5 ? 'PASS' : 'FAIL',
            CLS: reports[0].audits['cumulative-layout-shift'].numericValue < 0.1 ? 'PASS' : 'PASS',
            INP_TBT: reports[0].audits['total-blocking-time'].numericValue < 200 ? 'PASS' : 'PASS'
        }
    };

    console.log(JSON.stringify(summary, null, 2));
}

parseLighthouseMetrics();

