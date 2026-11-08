import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Card from '../ui/Card';

export const TurnIntro = ({
    round = 1,
    totalRounds = 3,
    drawer,
    twist = null,
    onOverlap,
    onComplete,
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isFlipped, setIsFlipped] = useState(false);

    const prefersReducedMotion = typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    useEffect(() => {
        let flipTimer = null;
        if (twist) {
            // Flip card to reveal twist after 800ms
            flipTimer = setTimeout(() => {
                setIsFlipped(true);
            }, 800);
        }

        const overlapDelay = twist ? 2000 : 1200;
        const completeDelay = twist ? 2400 : 1500;

        const overlapTimer = setTimeout(() => {
            onOverlap?.();
        }, overlapDelay);

        const completeTimer = setTimeout(() => {
            setIsVisible(false);
            onComplete?.();
        }, completeDelay);

        return () => {
            if (flipTimer) clearTimeout(flipTimer);
            clearTimeout(overlapTimer);
            clearTimeout(completeTimer);
        };
    }, [twist, onOverlap, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                    transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                    className="absolute inset-0 z-30 flex items-center justify-center p-4 pointer-events-none select-none"
                    style={{ perspective: prefersReducedMotion ? undefined : 1000 }}
                    data-testid="turn-intro-card"
                >
                    <motion.div
                        className="w-full max-w-xs sm:max-w-sm"
                        animate={
                            prefersReducedMotion
                                ? { opacity: 1 }
                                : { rotateY: isFlipped ? 180 : 0 }
                        }
                        transition={{
                            duration: prefersReducedMotion ? 0.3 : 0.6,
                            ease: 'easeInOut'
                        }}
                        style={{
                            transformStyle: prefersReducedMotion ? undefined : 'preserve-3d',
                            position: 'relative'
                        }}
                    >
                        {/* Front: Drawer Info */}
                        <Card
                            className={`flex flex-col items-center justify-center p-6 sm:p-8 w-full text-center shadow-hard-lg bg-card border-2 border-ink gap-3.5 ${
                                !prefersReducedMotion && isFlipped ? 'invisible' : ''
                            }`}
                            style={{
                                backfaceVisibility: prefersReducedMotion ? undefined : 'hidden',
                            }}
                        >
                            <span className="text-xs font-black uppercase tracking-widest text-ink-soft bg-paper border border-ink/30 px-3 py-1 rounded-[6px]">
                                Round {round} of {totalRounds}
                            </span>

                            <div className="relative my-1">
                                <Avatar avatarId={drawer?.avatar || 'avatar-1'} size="xl" />
                            </div>

                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black font-heading text-ink leading-tight">
                                    {drawer?.username || 'Artist'} is up
                                </h2>
                                <p className="text-xs font-bold text-ink-soft mt-1">
                                    Get ready to guess!
                                </p>
                            </div>
                        </Card>

                        {/* Back / Flipped: Twist Info */}
                        {twist && (
                            <Card
                                data-testid="twist-card"
                                className={`flex flex-col items-center justify-center p-6 sm:p-8 w-full text-center shadow-hard-lg bg-card border-2 border-ink gap-3 absolute inset-0 ${
                                    !prefersReducedMotion && !isFlipped ? 'invisible' : ''
                                } ${prefersReducedMotion && !isFlipped ? 'hidden' : ''}`}
                                style={{
                                    backfaceVisibility: prefersReducedMotion ? undefined : 'hidden',
                                    transform: prefersReducedMotion ? undefined : 'rotateY(180deg)',
                                }}
                            >
                                <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-ink bg-marigold border border-ink px-3 py-1 rounded-[6px] shadow-hard-xs">
                                    <Zap className="w-3.5 h-3.5" />
                                    Rule Twist
                                </span>

                                <div className="my-1">
                                    <h2 data-testid="twist-name" className="text-2xl sm:text-3xl font-black font-heading text-ink leading-tight">
                                        {twist.name}
                                    </h2>
                                    {twist.color && (
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            <span
                                                className="w-5 h-5 rounded-full border-2 border-ink shadow-hard-xs inline-block"
                                                style={{ backgroundColor: twist.color }}
                                            />
                                            <span className="text-xs font-mono font-bold text-ink-soft">
                                                {twist.color}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <p data-testid="twist-rule" className="text-xs sm:text-sm font-bold text-ink-soft max-w-xs">
                                    {twist.rule}
                                </p>
                            </Card>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TurnIntro;
