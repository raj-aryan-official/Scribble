import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

    return (
        <AnimatePresence>
            {!isConnected && (
                <motion.div
                    role="status"
                    aria-live="polite"
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="bg-marigold text-ink px-4 py-2 text-sm flex items-center justify-between border-b-2 border-ink shadow-hard-sm z-toast fixed top-0 left-0 right-0 font-bold"
                >
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-ink animate-pulse" />
                        <span>Reconnecting...</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="bg-card text-ink text-xs font-bold px-3 py-1 rounded-[6px] border-2 border-ink shadow-hard-sm hover:bg-paper active:translate-x-[1px] active:translate-y-[1px] transition-transform cursor-pointer"
                    >
                        Retry
                    </button>
                </motion.div>
            )}

            {showBackOnline && (
                <motion.div
                    role="status"
                    aria-live="polite"
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="bg-leaf text-white px-4 py-2 text-sm flex items-center justify-center gap-2 border-b-2 border-ink shadow-hard-sm z-toast fixed top-0 left-0 right-0 font-bold"
                >
                    <span>✓ Back online</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConnectionBanner;
