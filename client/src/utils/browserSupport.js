/**
 * Detects browser support for required core Scribble features:
 * - HTML Canvas 2D
 * - Pointer Events (for multi-touch & stylus drawing)
 * - WebRTC (for voice chat signaling and peer connection)
 */
export const checkBrowserSupport = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { isSupported: true, missing: [] };
    }

    const missing = [];

    // 1. Canvas 2D
    const canvas = document.createElement('canvas');
    const hasCanvas = Boolean(canvas && canvas.getContext && canvas.getContext('2d'));
    if (!hasCanvas) {
        missing.push('HTML Canvas 2D (required for drawing and viewing strokes)');
    }

    // 2. Pointer Events
    const hasPointerEvents = 'PointerEvent' in window;
    if (!hasPointerEvents) {
        missing.push('Pointer Events (required for drawing pens and multi-touch)');
    }

    // 3. WebRTC RTCPeerConnection
    const hasWebRTC = Boolean(window.RTCPeerConnection || window.webkitRTCPeerConnection);
    if (!hasWebRTC) {
        missing.push('WebRTC (required for peer connection & voice chat)');
    }

    return {
        isSupported: missing.length === 0,
        missing,
    };
};

