import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../ui/Avatar';
import Card from '../ui/Card';

export const TurnIntro = ({
    round = 1,
    totalRounds = 3,
    drawer,
    onOverlap, // called at 1200ms (1.5s - 300ms) to begin showing cards
    onComplete, // called at 1500ms when intro card finishes
}) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Trigger overlap after 1200ms (overlap by 300ms)
        const overlapTimer = setTimeout(() => {
            onOverlap?.();
        }, 1200);

        // Complete after 1500ms
        const completeTimer = setTimeout(() => {
            setIsVisible(false);
            onComplete?.();
        }, 1500);

        return () => {
            clearTimeout(overlapTimer);
            clearTimeout(completeTimer);
        };
    }, [onOverlap, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                    transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                    className="absolute inset-0 z-30 flex items-center justify-center p-4 pointer-events-none select-none"
                    data-testid="turn-intro-card"
                >
                    <Card className="flex flex-col items-center justify-center p-6 sm:p-8 max-w-xs sm:max-w-sm w-full text-center shadow-hard-lg bg-card border-2 border-ink gap-3.5">
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
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TurnIntro;

