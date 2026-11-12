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
    compact = false,
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
                    className={`absolute inset-0 z-30 flex items-center justify-center ${compact ? 'p-2' : 'p-4'} pointer-events-none select-none`}
                    style={{ perspective: prefersReducedMotion ? undefined : 1000 }}
                    data-testid="turn-intro-card"
                >
                    <motion.div
                        className={`w-full ${compact ? 'max-w-[260px]' : 'max-w-xs sm:max-w-sm'}`}
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
                            className={`flex flex-col items-center justify-center w-full text-center shadow-hard-lg bg-card border-2 border-ink ${
                                compact ? 'p-3 gap-1.5' : 'p-6 sm:p-8 gap-3.5'
                            } ${
                                !prefersReducedMotion && isFlipped ? 'invisible' : ''
                            }`}
                            style={{
                                backfaceVisibility: prefersReducedMotion ? undefined : 'hidden',
                            }}
                        >
                            <span className={`font-black uppercase tracking-widest text-ink-soft bg-paper border border-ink/30 rounded-[6px] ${
                                compact ? 'text-[9px] px-2 py-0.5' : 'text-xs px-3 py-1'
                            }`}>
                                Round {round} of {totalRounds}
                            </span>

                            <div className={compact ? 'my-0' : 'relative my-1'}>
                                <Avatar avatarId={drawer?.avatar || 'avatar-1'} size={compact ? 'md' : 'xl'} />
                            </div>

                            <div>
                                <h2 className={`font-black font-heading text-ink leading-tight ${compact ? 'text-lg' : 'text-2xl sm:text-3xl'}`}>
                                    {drawer?.username || 'Artist'} is up
                                </h2>
                                <p className={`font-bold text-ink-soft ${compact ? 'text-[10px] mt-0.5' : 'text-xs mt-1'}`}>
                                    Get ready to guess!
                                </p>
                            </div>
                        </Card>

                        {/* Back / Flipped: Twist Info */}
                        {twist && (
                            <Card
                                data-testid="twist-card"
                                className={`flex flex-col items-center justify-center w-full text-center shadow-hard-lg bg-card border-2 border-ink absolute inset-0 ${
                                    compact ? 'p-3 gap-1.5' : 'p-6 sm:p-8 gap-3'
                                } ${
                                    !prefersReducedMotion && !isFlipped ? 'invisible' : ''
                                } ${prefersReducedMotion && !isFlipped ? 'hidden' : ''}`}
                                style={{
                                    backfaceVisibility: prefersReducedMotion ? undefined : 'hidden',
                                    transform: prefersReducedMotion ? undefined : 'rotateY(180deg)',
                                }}
                            >
                                <span className={`inline-flex items-center gap-1 font-black uppercase tracking-widest text-ink bg-marigold border border-ink rounded-[6px] shadow-hard-xs ${
                                    compact ? 'text-[9px] px-2 py-0.5' : 'text-xs px-3 py-1'
                                }`}>
                                    <Zap className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                                    Rule Twist
                                </span>

                                <div className={compact ? 'my-0' : 'my-1'}>
                                    <h2 data-testid="twist-name" className={`font-black font-heading text-ink leading-tight ${compact ? 'text-lg' : 'text-2xl sm:text-3xl'}`}>
                                        {twist.name}
                                    </h2>
                                    {twist.color && (
                                        <div className="flex items-center justify-center gap-2 mt-1">
                                            <span
                                                className={`rounded-full border-2 border-ink shadow-hard-xs inline-block ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}
                                                style={{ backgroundColor: twist.color }}
                                            />
                                            {!compact && (
                                                <span className="text-xs font-mono font-bold text-ink-soft">
                                                    {twist.color}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <p data-testid="twist-rule" className={`font-bold text-ink-soft ${compact ? 'text-[10px] max-w-[220px]' : 'text-xs sm:text-sm max-w-xs'}`}>
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
