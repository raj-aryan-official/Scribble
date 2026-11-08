import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const AutoPickedBanner = ({ word, onDismiss }) => {
    useEffect(() => {
        if (!word) return;

        const timer = setTimeout(() => {
            onDismiss?.();
        }, 1500);

        return () => clearTimeout(timer);
    }, [word, onDismiss]);

    if (!word) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', damping: 20, stiffness: 350 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[90%] text-center pointer-events-none select-none"
                data-testid="auto-picked-banner"
            >
                <div className="bg-card border-2 border-ink shadow-hard rounded-[12px] p-3.5 sm:p-4 flex flex-col items-center gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-tomato">
                        Time Expired
                    </span>
                    <h3 className="text-lg sm:text-xl font-heading font-black text-ink">
                        Picked for you:{' '}
                        <span className="text-tomato uppercase underline decoration-2 underline-offset-2">
                            {word.toUpperCase()}
                        </span>
                    </h3>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AutoPickedBanner;

