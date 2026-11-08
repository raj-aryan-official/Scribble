import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../../hooks/useSocket';
import StatusScreen from './StatusScreen';
import lostSvg from '../../assets/states/lost.svg';

export const ReconnectBanner = () => {
    const socket = useSocket();
    const [isConnected, setIsConnected] = useState(socket ? socket.connected : true);
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true
    );
    const [attemptCount, setAttemptCount] = useState(1);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [showBackOnline, setShowBackOnline] = useState(false);
    const [wasDisconnected, setWasDisconnected] = useState(false);

    const timeoutTimerRef = useRef(null);
    const backOnlineTimerRef = useRef(null);

    // Online / Offline window listeners
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (socket && !socket.connected) {
                socket.connect();
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [socket]);

    // Socket connection event listeners & 60s timeout escalation
    useEffect(() => {
        if (!socket) return;

        const onConnect = () => {
            setIsConnected(true);
            setIsTimedOut(false);
            setAttemptCount(1);
            if (timeoutTimerRef.current) {
                clearTimeout(timeoutTimerRef.current);
                timeoutTimerRef.current = null;
            }

            if (wasDisconnected) {
                setShowBackOnline(true);
                if (backOnlineTimerRef.current) clearTimeout(backOnlineTimerRef.current);
                backOnlineTimerRef.current = setTimeout(() => {
                    setShowBackOnline(false);
                    setWasDisconnected(false);
                }, 2500);
            }
        };

        const onDisconnect = () => {
            setIsConnected(false);
            setWasDisconnected(true);
            setShowBackOnline(false);

            // Start 60-second escalation timer to full screen 'We lost you.'
            if (!timeoutTimerRef.current) {
                timeoutTimerRef.current = setTimeout(() => {
                    setIsTimedOut(true);
                }, 60000);
            }
        };

        const onReconnectAttempt = (attempt) => {
            setAttemptCount(attempt || ((prev) => prev + 1));
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        if (socket.io) {
            socket.io.on('reconnect_attempt', onReconnectAttempt);
        }

        setIsConnected(socket.connected);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            if (socket.io) {
                socket.io.off('reconnect_attempt', onReconnectAttempt);
            }
            if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
            if (backOnlineTimerRef.current) clearTimeout(backOnlineTimerRef.current);
        };
    }, [socket, wasDisconnected]);

    const handleRetry = useCallback(() => {
        if (socket) {
            socket.connect();
        }
    }, [socket]);

    // 1. Full-screen escalation after 60s of disconnected state: 'We lost you.'
    if (isTimedOut && !isConnected) {
        return (
            <StatusScreen
                role="alert"
                illustration={lostSvg}
                title="We lost you."
                sentence="We couldn't restore connection to the game session."
                primaryAction={{
                    label: 'Try again',
                    onClick: () => {
                        setIsTimedOut(false);
                        // Restart 60s timer
                        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
                        timeoutTimerRef.current = setTimeout(() => {
                            setIsTimedOut(true);
                        }, 60000);
                        handleRetry();
                    },
                }}
                secondaryAction={{
                    label: 'Back to start',
                    onClick: () => {
                        window.location.href = '/';
                    },
                }}
            />
        );
    }

    return (
        <AnimatePresence>
            {/* Offline state (navigator.onLine === false) */}
            {!isOnline && (
                <motion.aside
                    key="offline-banner"
                    role="alert"
                    aria-live="assertive"
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="bg-tomato text-white px-4 py-2 text-sm flex items-center justify-center gap-2 border-b-2 border-ink shadow-hard-sm z-toast fixed top-0 left-0 right-0 font-bold"
                >
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    <span>You're offline.</span>
                </motion.aside>
            )}

            {/* Reconnecting state (online but socket disconnected) */}
            {isOnline && !isConnected && (
                <motion.aside
                    key="reconnecting-banner"
                    role="status"
                    aria-live="polite"
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="bg-marigold text-ink px-4 py-2 text-sm flex items-center justify-between border-b-2 border-ink shadow-hard-sm z-toast fixed top-0 left-0 right-0 font-bold select-none"
                >
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-ink animate-pulse" />
                        <span>
                            Reconnecting...
                            {attemptCount > 1 ? ` (attempt ${attemptCount})` : ''}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleRetry}
                        aria-label="Retry connection"
                        className="bg-card text-ink text-xs font-bold px-3 py-1 rounded-[6px] border-2 border-ink shadow-hard-sm hover:bg-paper active:translate-x-[1px] active:translate-y-[1px] transition-transform cursor-pointer"
                    >
                        Retry
                    </button>
                </motion.aside>
            )}

            {/* Back online Toast */}
            {showBackOnline && (
                <motion.aside
                    key="back-online-toast"
                    role="status"
                    aria-live="polite"
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="bg-leaf text-white px-4 py-2 text-sm flex items-center justify-center gap-2 border-b-2 border-ink shadow-hard-sm z-toast fixed top-0 left-0 right-0 font-bold select-none"
                >
                    <span>Back online</span>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

export default ReconnectBanner;

