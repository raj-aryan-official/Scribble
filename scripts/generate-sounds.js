const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function createWavBuffer(samples) {
    const numSamples = samples.length;
    const subChunk2Size = numSamples * 2;
    const buffer = Buffer.alloc(44 + subChunk2Size);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + subChunk2Size, 4);
    buffer.write('WAVE', 8);

    // "fmt " sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
    buffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
    buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate
    buffer.writeUInt16LE(2, 32);  // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample

    // "data" sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(subChunk2Size, 40);

    for (let i = 0; i < numSamples; i++) {
        // Clamp to -1.0 to 1.0
        const s = Math.max(-1, Math.min(1, samples[i]));
        const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
        buffer.writeInt16LE(int16, 44 + i * 2);
    }

    return buffer;
}

// 1. Pencil Tap (~75ms): brief wood/pencil impact
function genPencilTap() {
    const duration = 0.075;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 60);
        const noise = (Math.random() * 2 - 1) * 0.3;
        const tone = Math.sin(2 * Math.PI * 750 * t);
        samples[i] = (tone * 0.7 + noise) * env * 0.8;
    }
    return samples;
}

// 2. Join Pop (~120ms): upward frequency sweep
function genJoinPop() {
    const duration = 0.12;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        const t = i / duration;
        const freq = 320 + 480 * Math.pow(t, 0.7);
        const phase = 2 * Math.PI * (320 * (i / SAMPLE_RATE) + (240 * (i * i) / (SAMPLE_RATE * duration * SAMPLE_RATE)));
        const env = Math.sin(t * Math.PI) * Math.exp(-t * 2);
        samples[i] = Math.sin(phase) * env * 0.75;
    }
    return samples;
}

// 3. Tick (~50ms): crisp clock tick
function genTick() {
    const duration = 0.05;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 90);
        const tone1 = Math.sin(2 * Math.PI * 1200 * t);
        const tone2 = Math.sin(2 * Math.PI * 2400 * t) * 0.4;
        samples[i] = (tone1 + tone2) * env * 0.6;
    }
    return samples;
}

// 4. Correct Guess (~320ms): cheerful bright chime arpeggio
function genCorrectGuess() {
    const duration = 0.32;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(numSamples);
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const noteLen = 0.07;
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        let val = 0;
        notes.forEach((freq, idx) => {
            const start = idx * 0.05;
            if (t >= start) {
                const noteT = t - start;
                const env = Math.exp(-noteT * 10);
                val += Math.sin(2 * Math.PI * freq * noteT) * env;
                // Add sparkle harmonic
                val += Math.sin(2 * Math.PI * freq * 2 * noteT) * env * 0.25;
            }
        });
        samples[i] = val * 0.35;
    }
    return samples;
}

// 5. Round End (~450ms): warm 2-tone chime
function genRoundEnd() {
    const duration = 0.45;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(numSamples);
    const notes = [
        { freq: 440, start: 0, decay: 7 },
        { freq: 587.33, start: 0.12, decay: 6 }
    ];
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        let val = 0;
        notes.forEach(({ freq, start, decay }) => {
            if (t >= start) {
                const noteT = t - start;
                const env = Math.exp(-noteT * decay);
                val += Math.sin(2 * Math.PI * freq * noteT) * env * 0.5;
            }
        });
        samples[i] = val * 0.6;
    }
    return samples;
}

// 6. Win (~650ms): celebratory fanfare
function genWin() {
    const duration = 0.65;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(numSamples);
    const chord = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        let val = 0;
        // Initial fanfare hit + sustained chord
        chord.forEach((freq, idx) => {
            const delay = idx * 0.04;
            if (t >= delay) {
                const noteT = t - delay;
                const env = Math.exp(-noteT * 3.5);
                val += Math.sin(2 * Math.PI * freq * noteT) * env * 0.25;
            }
        });
        samples[i] = val * 0.7;
    }
    return samples;
}

const soundsDir = path.join(__dirname, '..', 'client', 'public', 'sounds');
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
}

const soundMap = {
    'pencil-tap.wav': genPencilTap(),
    'join-pop.wav': genJoinPop(),
    'tick.wav': genTick(),
    'correct-guess.wav': genCorrectGuess(),
    'round-end.wav': genRoundEnd(),
    'win.wav': genWin(),
};

for (const [filename, samples] of Object.entries(soundMap)) {
    const buffer = createWavBuffer(samples);
    const filePath = path.join(soundsDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`Generated ${filename} (${buffer.length} bytes)`);
}
console.log('All 6 self-hosted sound files successfully generated!');

