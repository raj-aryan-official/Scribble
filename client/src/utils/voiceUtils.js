/**
 * Pure functions and constants for WebRTC voice chat signaling, initiator rules,
 * audio RMS calculations, and speaking state detection (ESM for client).
 */

export const MAX_VOICE_PLAYERS = 6;
export const DEFAULT_SPEAKING_THRESHOLD = 0.025;
export const SPEAKING_HOLD_MS = 200;

export const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
];

/**
 * Initiator Rule:
 * The player with the lexicographically smaller socket id initiates the connection (creates offer).
 * Guarantees that between any pair of players, exactly one initiates, avoiding double-offer glare.
 */
export function shouldInitiate(localSocketId, remoteSocketId) {
    if (!localSocketId || !remoteSocketId) return false;
    return localSocketId < remoteSocketId;
}

/**
 * Perfect Negotiation Rule:
 * The player with the lexicographically larger socket id is the polite peer.
 * When an offer collision occurs, the polite peer yields and rolls back local description.
 */
export function isPolitePeer(localSocketId, remoteSocketId) {
    if (!localSocketId || !remoteSocketId) return false;
    return localSocketId > remoteSocketId;
}

/**
 * Parse ICE servers from JSON env string or return defaults.
 */
export function getIceServers(rawConfig) {
    const configToParse = rawConfig !== undefined ? rawConfig : (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ICE_SERVERS : undefined);
    if (configToParse) {
        try {
            const parsed = typeof configToParse === 'string' ? JSON.parse(configToParse) : configToParse;
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse VITE_ICE_SERVERS, falling back to default STUN servers', e);
        }
    }
    return DEFAULT_ICE_SERVERS;
}

/**
 * Root Mean Square (RMS) calculation for Float32Array audio samples (-1.0 to 1.0).
 */
export function calculateRMS(samples) {
    if (!samples || samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        const val = samples[i];
        sum += val * val;
    }
    return Math.sqrt(sum / samples.length);
}

/**
 * Root Mean Square (RMS) calculation for Uint8Array audio samples (0 to 255 centered at 128).
 */
export function calculateByteRMS(bytes) {
    if (!bytes || bytes.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < bytes.length; i++) {
        const val = (bytes[i] - 128) / 128;
        sum += val * val;
    }
    return Math.sqrt(sum / bytes.length);
}

/**
 * Determines whether current volume exceeds speaking threshold.
 */
export function isSpeakingVolume(rms, threshold = DEFAULT_SPEAKING_THRESHOLD) {
    return typeof rms === 'number' && !isNaN(rms) && rms >= threshold;
}

/**
 * State machine for speaking detection with 200 ms smoothing hold.
 * When volume drops below threshold, isSpeaking remains true until 200 ms have elapsed
 * without volume exceeding threshold.
 */
export function updateSpeakingState({
    currentRMS = 0,
    threshold = DEFAULT_SPEAKING_THRESHOLD,
    now = Date.now(),
    lastSpokeAt = 0,
    holdDurationMs = SPEAKING_HOLD_MS
} = {}) {
    const isLoud = isSpeakingVolume(currentRMS, threshold);
    if (isLoud) {
        return {
            isSpeaking: true,
            lastSpokeAt: now
        };
    }
    if (lastSpokeAt > 0 && (now - lastSpokeAt) < holdDurationMs) {
        return {
            isSpeaking: true,
            lastSpokeAt
        };
    }
    return {
        isSpeaking: false,
        lastSpokeAt
    };
}

/**
 * Friendly error messages for getUserMedia failures.
 */
export function getMediaErrorMessage(err) {
    if (!err) return 'Could not access microphone.';
    const name = err.name || err.toString();
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return 'Microphone permission was denied. Please allow microphone access in your browser settings.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return 'No microphone device was found. Please connect a microphone.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'Microphone is already in use by another application.';
    }
    if (name === 'OverconstrainedError') {
        return 'No microphone meeting the requested audio constraints was found.';
    }
    if (name === 'SecurityError') {
        return 'Microphone access is restricted by browser security (HTTPS required).';
    }
    return err.message || 'Could not access microphone.';
}

