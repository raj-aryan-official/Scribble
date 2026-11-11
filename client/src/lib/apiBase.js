const PRODUCTION_API_URL = 'https://scribble-server-1a4x.onrender.com';

export function getApiBaseUrl() {
    const configured = import.meta.env.VITE_API_URL;
    if (configured) return configured.replace(/\/$/, '');
    if (typeof window === 'undefined') return 'http://localhost:3000';

    const { hostname, port, protocol, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000';
    if (port === '5173') return `${protocol}//${hostname}:3000`;
    if (origin === PRODUCTION_API_URL) return origin;
    return PRODUCTION_API_URL;
}
