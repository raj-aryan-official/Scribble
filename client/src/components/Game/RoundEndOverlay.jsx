import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../ui/Avatar';

export const RoundEndOverlay = ({
    word = '',
    scores = {},
    gained = {},
    players = [],
    duration = 5,
    onComplete,
}) => {
    const [countdown, setCountdown] = useState(duration);
    const [countProgress, setCountProgress] = useState(0); // 0 to 1 for counting up numbers

    // Countdown interval
    useEffect(() => {
        setCountdown(duration);
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onComplete?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [duration, onComplete]);

    // Animate points counting up from 0 to target over 1.5s
    useEffect(() => {
        let startTime = null;
        let rafId = null;

        const animateCount = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(1, elapsed / 1500);
            setCountProgress(progress);

            if (progress < 1) {
                rafId = requestAnimationFrame(animateCount);
            }
        };

        rafId = requestAnimationFrame(animateCount);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    // Sort players by score descending
    const rankedPlayers = [...players].sort(
        (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
    );

    return (
        <div
            data-testid="round-end-overlay"
            className="absolute inset-0 z-40 bg-paper/90 backdrop-blur-none flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto select-none"
        >
            <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                        The secret word was
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-heading text-ink capitalize tracking-wide mt-1">
                        {word}
                    </h2>
                </div>

                {/* Visible countdown indicator */}
                <div className="flex items-center gap-2 bg-card border-2 border-ink px-3 py-1 rounded-[6px] shadow-hard-sm">
                    <span className="w-2 h-2 rounded-full bg-tomato animate-pulse" />
                    <span className="text-xs font-bold text-ink">
                        Next round in <span className="font-mono">{countdown}</span>s
                    </span>
                </div>

                {/* Scoreboard with animated rank reordering */}
                <div className="w-full flex flex-col gap-2 mt-2">
                    <AnimatePresence>
                        {rankedPlayers.map((player, index) => {
                            const playerGained = gained[player.id] || 0;
                            const displayedGained = Math.round(playerGained * countProgress);
                            const totalScore = scores[player.id] || 0;

                            return (
                                <motion.div
                                    key={player.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                    className={`flex items-center justify-between p-2.5 rounded-[8px] border-2 border-ink shadow-hard-sm ${
                                        playerGained > 0 ? 'bg-card text-ink' : 'bg-paper text-ink'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="font-mono font-black text-xs sm:text-sm w-5 text-center">
                                            #{index + 1}
                                        </span>
                                        <Avatar avatarId={player.avatar} size="xs" />
                                        <span className="font-bold text-xs sm:text-sm truncate max-w-[120px]">
                                            {player.username}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {playerGained > 0 && (
                                            <span className="font-mono font-bold text-xs bg-leaf text-white px-2 py-0.5 rounded-[4px] border border-ink">
                                                +{displayedGained}
                                            </span>
                                        )}
                                        <span className="font-mono font-black text-xs sm:text-sm text-ink w-12 text-right">
                                            {totalScore} pts
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default RoundEndOverlay;
