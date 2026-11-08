const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function analyzeBundle() {
    const distDir = path.resolve(__dirname, '../client/dist');
    const assetsDir = path.join(distDir, 'assets');

    if (!fs.existsSync(assetsDir)) {
        console.error('Dist directory does not exist. Run "npm run build" in client first.');
        process.exit(1);
    }

    const files = fs.readdirSync(assetsDir);
    const report = {
        totalRawBytes: 0,
        totalGzipBytes: 0,
        files: [],
        dependencies: []
    };

    let mainJsContent = '';

    files.forEach(file => {
        const filePath = path.join(assetsDir, file);
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath);
        const gzipped = zlib.gzipSync(content);

        report.totalRawBytes += stat.size;
        report.totalGzipBytes += gzipped.length;

        report.files.push({
            name: file,
            sizeRaw: stat.size,
            sizeRawKB: (stat.size / 1024).toFixed(1),
            sizeGzip: gzipped.length,
            sizeGzipKB: (gzipped.length / 1024).toFixed(1),
            type: file.endsWith('.js') ? 'js' : file.endsWith('.css') ? 'css' : 'other'
        });

        if (file.endsWith('.js')) {
            mainJsContent += content.toString('utf-8');
        }
    });

    // Detect major packages bundled in JS by looking for signature strings/keywords
    const signatures = [
        { name: 'framer-motion', pattern: /framer-motion|AnimatePresence|motion\./i },
        { name: 'lucide-react', pattern: /lucide-react|createLucideIcon/i },
        { name: 'socket.io-client', pattern: /socket\.io-client|io\.Manager|Engine\.IO/i },
        { name: 'canvas-confetti', pattern: /confetti|canvas-confetti/i },
        { name: 'qrcode', pattern: /QRCode|qrcode/i },
        { name: 'howler', pattern: /Howler|Howl\b/i },
        { name: 'react & react-dom', pattern: /react\.element|useLayoutEffect|createRoot/i },
        { name: 'react-router', pattern: /react-router|useNavigate|BrowserRouter/i }
    ];

    signatures.forEach(sig => {
        const found = sig.pattern.test(mainJsContent);
        report.dependencies.push({
            name: sig.name,
            bundledInMainChunk: found
        });
    });

    console.log(JSON.stringify(report, null, 2));
}

analyzeBundle();

