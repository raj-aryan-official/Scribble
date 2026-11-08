import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';

export const ConnectionBanner = () => {
    const socket = useSocket();
    const [isConnected, setIsConnected] = useState(socket ? socket.connected : true);
    const [showBackOnline, setShowBackOnline] = useState(false);
    const [wasDisconnected, setWasDisconnected] = useState(false);

    useEffect(() => {
        if (!socket) return;

        const onConnect = () => {
            setIsConnected(true);
            if (wasDisconnected) {
                setShowBackOnline(true);
                const timer = setTimeout(() => {
                    setShowBackOnline(false);
                    setWasDisconnected(false);
                }, 3000);
                return () => clearTimeout(timer);
            }
        };

        const onDisconnect = () => {
            setIsConnected(false);
            setWasDisconnected(true);
            setShowBackOnline(false);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        setIsConnected(socket.connected);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, [socket, wasDisconnected]);

    const handleRetry = () => {
        if (socket) {
            socket.connect();
        }
    };

    if (!isConnected) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="bg-amber-600 text-white px-4 py-2 text-sm flex items-center justify-between shadow-md z-50 fixed top-0 left-0 right-0"
            >
                <div className="flex items-center gap-2 font-medium">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    <span>Reconnecting...</span>
                </div>
                <button
                    onClick={handleRetry}
                    className="bg-white text-amber-900 text-xs font-bold px-3 py-1 rounded shadow hover:bg-amber-50 active:scale-95 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (showBackOnline) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="bg-green-600 text-white px-4 py-2 text-sm flex items-center justify-center gap-2 shadow-md z-50 fixed top-0 left-0 right-0 animate-in fade-in slide-in-from-top duration-300"
            >
                <span>✓ Back online</span>
            </div>
        );
    }

    return null;
};

export default ConnectionBanner;

