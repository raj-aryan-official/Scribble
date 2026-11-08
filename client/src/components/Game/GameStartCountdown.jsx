import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '../../hooks/useSound';

export const GameStartCountdown = ({ startsAt, onComplete }) => {
    const { play } = useSound();
    const [now, setNow] = useState(Date.now());
    const lastNumberRef = useRef(null);
    const announcedRef = useRef(false);

    // High frequency sync tick
    useEffect(() => {
        const interval = setInterval(() => {
            const current = Date.now();
            setNow(current);
            if (startsAt && current >= startsAt) {
                clearInterval(interval);
                onComplete?.();
            }
        }, 50);

        return () => clearInterval(interval);
    }, [startsAt, onComplete]);

    const remainingMs = startsAt ? startsAt - now : 0;
    const numeral = Math.max(1, Math.min(3, Math.ceil(remainingMs / 1000)));

    // Sound effect on number change
    useEffect(() => {
        if (numeral !== lastNumberRef.current && numeral >= 1 && numeral <= 3) {
            lastNumberRef.current = numeral;
            play('tick');
        }
    }, [numeral, play]);

    // Check prefers-reduced-motion
    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Accessibility announcement once
    const announcement = !announcedRef.current ? 'Game starts in 3' : '';
    useEffect(() => {
        announcedRef.current = true;
    }, []);

    if (remainingMs <= 0) return null;

    return (
        <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none select-none bg-paper/30 backdrop-blur-[1px]"
            data-testid="game-start-countdown"
        >
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {announcement}
            </div>

            <div className="flex flex-col items-center justify-center">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-ink-soft mb-2">
                    Get Ready
                </span>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={numeral}
                        initial={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { scale: 1.8, opacity: 0 }
                        }
                        animate={
                            prefersReducedMotion
                                ? { opacity: 1 }
                                : { scale: 1, opacity: 1 }
                        }
                        exit={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { scale: 0.8, opacity: 0 }
                        }
                        transition={{
                            duration: 0.25,
                            ease: prefersReducedMotion ? 'linear' : [0.16, 1, 0.3, 1],
                        }}
                        className="text-8xl sm:text-9xl font-black font-heading text-ink drop-shadow-[4px_4px_0px_#F6B72C]"
                    >
                        {numeral}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default GameStartCountdown;

