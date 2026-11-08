import { describe, it, expect } from 'vitest';
import { createPointBatcher, buildMidpointCurve, shouldAcceptPoint } from './canvasMath.js';
import {
    shouldInitiate,
    isPolitePeer,
    calculateRMS,
    calculateByteRMS,
    isSpeakingVolume
} from './voiceUtils.js';
import { getWordDifficulty } from './wordDifficulty.js';

describe('Client Pure Functions - Canvas Math', () => {
    it('createPointBatcher batches points and notifies subscriber', () => {
        const flushed = [];
        const batcher = createPointBatcher({
            onBatch: batch => flushed.push(batch),
            intervalMs: 16,
            maxPoints: 2000
        });

        batcher.addPoint(0.1, 0.1);
        batcher.addPoint(0.2, 0.2);
        batcher.flush();

        expect(flushed.length).toBe(1);
        expect(flushed[0].length).toBe(2);
        expect(flushed[0][0]).toEqual({ x: 0.1, y: 0.1 });
    });

    it('shouldAcceptPoint skips points closer than minDistance', () => {
        expect(shouldAcceptPoint({ x: 0.1, y: 0.1 }, { x: 0.1001, y: 0.1001 })).toBe(false);
        expect(shouldAcceptPoint({ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 })).toBe(true);
    });

    it('buildMidpointCurve generates quadratic bezier curve segments', () => {
        const points = [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.2 },
            { x: 0.3, y: 0.1 }
        ];
        const segments = buildMidpointCurve(points);
        expect(segments.length).toBe(4);
        expect(segments[0].type).toBe('move');
        expect(segments[1].type).toBe('line');
        expect(segments[2].type).toBe('quadratic');
        expect(segments[3].type).toBe('line');
    });
});

describe('Client Pure Functions - WebRTC & Voice Math', () => {
    it('shouldInitiate follows lexicographical order', () => {
        expect(shouldInitiate('alice', 'bob')).toBe(true);
        expect(shouldInitiate('bob', 'alice')).toBe(false);
    });

    it('isPolitePeer is the inverse of shouldInitiate', () => {
        expect(isPolitePeer('alice', 'bob')).toBe(false);
        expect(isPolitePeer('bob', 'alice')).toBe(true);
    });

    it('calculateRMS calculates root mean square correctly', () => {
        const silence = new Float32Array([0, 0, 0, 0]);
        expect(calculateRMS(silence)).toBe(0);

        const constant = new Float32Array([0.5, 0.5, 0.5, 0.5]);
        expect(calculateRMS(constant)).toBeCloseTo(0.5, 5);
    });

    it('calculateByteRMS calculates RMS from 0-255 domain', () => {
        const silence = new Uint8Array([128, 128, 128, 128]);
        expect(calculateByteRMS(silence)).toBe(0);
    });

    it('isSpeakingVolume thresholds correctly', () => {
        expect(isSpeakingVolume(0.005, 0.01)).toBe(false);
        expect(isSpeakingVolume(0.05, 0.01)).toBe(true);
    });
});

describe('Client Pure Functions - Word Difficulty', () => {
    it('categorizes known words into Easy, Medium, or Hard', () => {
        const apple = getWordDifficulty('apple');
        expect(apple.difficulty).toBe('Easy');
        expect(apple.level).toBe(1);

        const defaultRes = getWordDifficulty('unknownword123');
        expect(defaultRes.difficulty).toBe('Medium');
        expect(defaultRes.level).toBe(2);
    });

    it('handles null and invalid inputs gracefully', () => {
        expect(getWordDifficulty(null)).toEqual({ difficulty: 'Medium', level: 2 });
        expect(getWordDifficulty(123)).toEqual({ difficulty: 'Medium', level: 2 });
    });
});
