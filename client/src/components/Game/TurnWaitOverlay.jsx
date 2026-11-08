import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Loader2 } from 'lucide-react';

export const TurnWaitOverlay = ({
    waitingFor = 'Maya',
    endsAt = null,
    timeout = 8,
    isSkipped = false,
    className = '',
}) => {
    const totalDuration = timeout;
    const [secondsLeft, setSecondsLeft] = useState(() => {
        if (!endsAt) return totalDuration;
        return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    });

    useEffect(() => {
        if (!endsAt) return;
        const updateSeconds = () => {
            const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
            setSecondsLeft(left);
        };
        updateSeconds();
        const interval = setInterval(updateSeconds, 250);
        return () => clearInterval(interval);
    }, [endsAt]);

    // Shrinking countdown ring (32px diameter, r=13)
    const radius = 13;
    const circumference = 2 * Math.PI * radius;
    const fraction = totalDuration > 0 ? Math.max(0, Math.min(1, secondsLeft / totalDuration)) : 0;
    const strokeDashoffset = circumference * (1 - fraction);

    return (
        <div
            data-testid="turn-wait-overlay"
            role="status"
            aria-live="polite"
            className={`absolute inset-0 z-30 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-[2px] ${className}`}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-card border-2 border-ink shadow-hard rounded-[12px] p-5 sm:p-6 text-center flex flex-col items-center gap-3 select-none"
            >
                {/* Shrinking Ring or Offline Icon */}
                <div className="relative w-11 h-11 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
                        <circle
                            cx="16"
                            cy="16"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="text-ink/10"
                        />
                        <circle
                            cx="16"
                            cy="16"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="text-marigold transition-all duration-200"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-ink">
                        <WifiOff className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <h2
                        data-testid="turn-wait-heading"
                        className="font-heading font-black text-base sm:text-lg text-ink"
                    >
                        {isSkipped
                            ? `${waitingFor} didn't come back. Skipping their turn.`
                            : `Waiting for ${waitingFor} to reconnect (${secondsLeft}s)`}
                    </h2>
                    <p className="text-xs sm:text-sm text-ink-soft font-medium leading-relaxed">
                        {isSkipped
                            ? 'Moving to the next drawer with no penalty.'
                            : `Holding the turn (${secondsLeft}s). If they can't make it back, the round will advance.`}
                    </p>
                </div>

                {!isSkipped && (
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-ink-soft bg-paper px-3 py-1 rounded-full border border-ink/20">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-ink" aria-hidden="true" />
                        <span>Resuming automatically...</span>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default TurnWaitOverlay;
