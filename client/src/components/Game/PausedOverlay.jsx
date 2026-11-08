import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pause } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

export const PausedOverlay = ({
    endsAt = null,
    timeout = 60,
    players = [],
    scores = {},
    isHost = false,
    onEndGame,
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

    // Shrinking countdown ring
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const fraction = totalDuration > 0 ? Math.max(0, Math.min(1, secondsLeft / totalDuration)) : 0;
    const strokeDashoffset = circumference * (1 - fraction);

    // Sorted players by score
    const rankedPlayers = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

    return (
        <div
            data-testid="paused-overlay"
            role="status"
            aria-live="polite"
            className={`absolute inset-0 z-40 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-[2px] select-none ${className}`}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-card border-2 border-ink shadow-hard-lg rounded-[12px] p-5 sm:p-6 flex flex-col items-center gap-4 text-center max-h-[90vh] overflow-y-auto"
            >
                {/* Header Icon + Countdown */}
                <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                        <circle
                            cx="22"
                            cy="22"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            className="text-ink/10"
                        />
                        <circle
                            cx="22"
                            cy="22"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="text-tomato transition-all duration-200"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-ink">
                        <Pause className="w-5 h-5 fill-ink" aria-hidden="true" />
                    </div>
                </div>

                {/* Title & Countdown copy */}
                <div className="flex flex-col gap-1">
                    <h2
                        data-testid="paused-overlay-heading"
                        className="font-heading font-black text-lg sm:text-xl text-ink"
                    >
                        Waiting for players to return.
                    </h2>
                    <p className="text-xs sm:text-sm font-medium text-ink-soft">
                        Not enough players connected. Resuming in <span className="font-mono font-bold text-ink">{secondsLeft}s</span> or when players rejoin.
                    </p>
                </div>

                {/* Current Running Scores Underneath */}
                <div className="w-full flex flex-col gap-1.5 bg-paper p-3 rounded-[8px] border border-ink/20 text-left">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-1">
                        Current Running Scores
                    </span>
                    <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-1">
                        {rankedPlayers.map((p, idx) => {
                            const isAway = p.isDisconnected || p.status === 'away';
                            const score = scores[p.id] || 0;
                            return (
                                <div
                                    key={p.id}
                                    className={`flex items-center justify-between py-1 px-2 rounded-[6px] border ${
                                        isAway ? 'bg-card border-dashed border-ink/40 text-ink' : 'bg-card border-ink/30 text-ink'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono font-black text-xs text-ink w-4">
                                            #{idx + 1}
                                        </span>
                                        <Avatar avatarId={p.avatar} size="xs" />
                                        <span className="font-bold text-xs text-ink truncate">
                                            {p.username}
                                        </span>
                                        {isAway && (
                                            <span className="text-[10px] font-bold text-tomato-deep uppercase">
                                                Away
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-mono font-black text-xs text-ink">
                                        {score}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Host Action: End game */}
                {isHost && onEndGame && (
                    <div className="w-full pt-1">
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={onEndGame}
                            data-testid="paused-end-game-btn"
                            className="w-full font-bold uppercase text-tomato-deep border-tomato hover:bg-tomato/10 min-h-[44px]"
                        >
                            End game
                        </Button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default PausedOverlay;
