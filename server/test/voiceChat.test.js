const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    MAX_VOICE_PLAYERS,
    DEFAULT_SPEAKING_THRESHOLD,
    SPEAKING_HOLD_MS,
    DEFAULT_ICE_SERVERS,
    shouldInitiate,
    isPolitePeer,
    getIceServers,
    calculateRMS,
    calculateByteRMS,
    isSpeakingVolume,
    updateSpeakingState,
    getMediaErrorMessage
} = require('../../shared/voiceMath.cjs');

describe('WebRTC Initiator & Polite Peer Rules', () => {
    test('shouldInitiate: player with lexicographically smaller socket ID initiates', () => {
        const idA = 'alice_socket_100';
        const idB = 'bob_socket_200';

        // idA < idB lexicographically
        assert.equal(shouldInitiate(idA, idB), true, 'idA is smaller, so idA initiates');
        assert.equal(shouldInitiate(idB, idA), false, 'idB is larger, so idB does NOT initiate');

        // Edge cases
        assert.equal(shouldInitiate(null, idB), false);
        assert.equal(shouldInitiate(idA, null), false);
        assert.equal(shouldInitiate('same_id', 'same_id'), false);
    });

    test('initiator rule is mutually exclusive between any pair of players (no double offers)', () => {
        const sockets = ['sock_omega', 'sock_alpha', 'sock_beta', 'sock_gamma'];

        for (let i = 0; i < sockets.length; i++) {
            for (let j = 0; j < sockets.length; j++) {
                if (i === j) continue;
                const aInitiates = shouldInitiate(sockets[i], sockets[j]);
                const bInitiates = shouldInitiate(sockets[j], sockets[i]);

                // Exactly one must be true
                assert.ok((aInitiates && !bInitiates) || (!aInitiates && bInitiates),
                    `Pair (${sockets[i]}, ${sockets[j]}) must have exactly one initiator`);
            }
        }
    });

    test('isPolitePeer: polite peer is the one with the larger socket ID', () => {
        const idA = 'alice_socket_100';
        const idB = 'bob_socket_200';

        assert.equal(isPolitePeer(idA, idB), false, 'Smaller ID is impolite');
        assert.equal(isPolitePeer(idB, idA), true, 'Larger ID is polite');

        // Exactly one polite peer per pair
        assert.ok(isPolitePeer(idA, idB) !== isPolitePeer(idB, idA));
    });
});

describe('Speaking Detection & RMS Threshold Calculations', () => {
    test('calculateRMS: computes correct RMS for silent, constant, and sinusoidal buffers', () => {
        // Silence (all zeros)
        const silence = new Float32Array(512).fill(0);
        assert.equal(calculateRMS(silence), 0);

        // Empty or null
        assert.equal(calculateRMS(null), 0);
        assert.equal(calculateRMS([]), 0);

        // Constant amplitude = 0.5 -> RMS = 0.5
        const constantHalf = new Float32Array(100).fill(0.5);
        assert.ok(Math.abs(calculateRMS(constantHalf) - 0.5) < 1e-6);

        // Square wave of amplitude 0.2 (+0.2 and -0.2) -> RMS = 0.2
        const squareWave = new Float32Array(100).map((_, idx) => (idx % 2 === 0 ? 0.2 : -0.2));
        assert.ok(Math.abs(calculateRMS(squareWave) - 0.2) < 1e-6);
    });

    test('calculateByteRMS: computes correct RMS from 0-255 byte domain where 128 is silence', () => {
        // Silence (all 128)
        const silenceBytes = new Uint8Array(256).fill(128);
        assert.equal(calculateByteRMS(silenceBytes), 0);

        // Maximum deflection: alternating 0 and 256 -> (0-128)/128 = -1, (256-128)/128 = 1 -> RMS = 1.0
        const maxDeflection = new Uint8Array(256).map((_, idx) => (idx % 2 === 0 ? 0 : 255));
        const rms = calculateByteRMS(maxDeflection);
        assert.ok(rms > 0.95 && rms <= 1.0);
    });

    test('isSpeakingVolume: threshold evaluation', () => {
        const threshold = 0.025;
        assert.equal(isSpeakingVolume(0.01, threshold), false, 'Below threshold');
        assert.equal(isSpeakingVolume(0.024, threshold), false, 'Just below threshold');
        assert.equal(isSpeakingVolume(0.025, threshold), true, 'Exactly threshold');
        assert.equal(isSpeakingVolume(0.15, threshold), true, 'Well above threshold');
        assert.equal(isSpeakingVolume(NaN, threshold), false, 'NaN should be false');
    });

    test('updateSpeakingState: speaking state machine with 200 ms smoothing hold', () => {
        const threshold = 0.025;
        const holdMs = 200;
        let t = 1000;

        // Initial silence
        let state = updateSpeakingState({ currentRMS: 0.005, threshold, now: t, lastSpokeAt: 0, holdDurationMs: holdMs });
        assert.equal(state.isSpeaking, false);
        assert.equal(state.lastSpokeAt, 0);

        // Speech starts at t = 1100
        t = 1100;
        state = updateSpeakingState({ currentRMS: 0.08, threshold, now: t, lastSpokeAt: state.lastSpokeAt, holdDurationMs: holdMs });
        assert.equal(state.isSpeaking, true);
        assert.equal(state.lastSpokeAt, 1100);

        // Volume drops at t = 1150 (< 200 ms since speech): remains speaking (held)
        t = 1150;
        state = updateSpeakingState({ currentRMS: 0.005, threshold, now: t, lastSpokeAt: state.lastSpokeAt, holdDurationMs: holdMs });
        assert.equal(state.isSpeaking, true, 'Should hold speaking state during pauses < 200ms');
        assert.equal(state.lastSpokeAt, 1100);

        // Still silence at t = 1290 (190 ms elapsed, still < 200 ms): remains speaking
        t = 1290;
        state = updateSpeakingState({ currentRMS: 0.005, threshold, now: t, lastSpokeAt: state.lastSpokeAt, holdDurationMs: holdMs });
        assert.equal(state.isSpeaking, true, 'Should still hold at 190ms');

        // At t = 1301 (201 ms elapsed): transitions to NOT speaking
        t = 1301;
        state = updateSpeakingState({ currentRMS: 0.005, threshold, now: t, lastSpokeAt: state.lastSpokeAt, holdDurationMs: holdMs });
        assert.equal(state.isSpeaking, false, 'Should stop speaking after 200ms hold expired');
    });
});

describe('ICE Server Config & Limits', () => {
    test('MAX_VOICE_PLAYERS is 6', () => {
        assert.equal(MAX_VOICE_PLAYERS, 6);
    });

    test('getIceServers parses JSON or returns default STUN servers', () => {
        // Defaults
        const defaults = getIceServers();
        assert.deepEqual(defaults, DEFAULT_ICE_SERVERS);

        // Custom valid JSON string with TURN
        const customTurn = JSON.stringify([
            { urls: 'stun:stun.custom.com:3478' },
            { urls: 'turn:turn.custom.com:3478', username: 'usr', credential: 'pwd' }
        ]);
        const parsed = getIceServers(customTurn);
        assert.equal(parsed.length, 2);
        assert.equal(parsed[1].username, 'usr');

        // Invalid JSON string falls back safely
        const fallback = getIceServers('invalid-json{{{');
        assert.deepEqual(fallback, DEFAULT_ICE_SERVERS);
    });

    test('getMediaErrorMessage returns specific messages for common getUserMedia errors', () => {
        assert.match(getMediaErrorMessage({ name: 'NotAllowedError' }), /denied/i);
        assert.match(getMediaErrorMessage({ name: 'PermissionDeniedError' }), /denied/i);
        assert.match(getMediaErrorMessage({ name: 'NotFoundError' }), /found/i);
        assert.match(getMediaErrorMessage({ name: 'NotReadableError' }), /in use/i);
        assert.match(getMediaErrorMessage({ name: 'SecurityError' }), /HTTPS/i);
    });
});

