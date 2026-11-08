import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Loader2 } from 'lucide-react';

export const TurnWaitOverlay = ({ waitingFor = 'Maya', endsAt = null }) => {
    const [secondsLeft, setSecondsLeft] = useState(() => {
        if (!endsAt) return 8;
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

    return (
        <div
            data-testid="turn-wait-overlay"
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-[2px]"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-card border-2 border-ink shadow-hard rounded-[12px] p-5 sm:p-6 text-center flex flex-col items-center gap-3 select-none"
            >
                <div className="w-12 h-12 rounded-full bg-marigold/20 border-2 border-ink flex items-center justify-center text-ink shadow-hard-sm">
                    <WifiOff className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                </div>

                <div className="flex flex-col gap-1">
                    <h2
                        data-testid="turn-wait-heading"
                        className="font-heading font-black text-base sm:text-lg text-ink"
                    >
                        Waiting for {waitingFor} to reconnect ({secondsLeft}s)
                    </h2>
                    <p className="text-xs sm:text-sm text-ink-soft font-medium leading-relaxed">
                        Holding the turn. If they can't make it back, the round will advance with no penalty.
                    </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono font-bold text-ink-soft bg-paper px-3 py-1 rounded-full border border-ink/20">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-ink" aria-hidden="true" />
                    <span>Resuming automatically...</span>
                </div>
            </motion.div>
        </div>
    );
};

export default TurnWaitOverlay;

