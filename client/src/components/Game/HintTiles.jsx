import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

export const HintTiles = ({
    word = '',
    hint = '',
    isDrawer = false,
    guessedCount = 0,
    totalGuessers = 0,
    className = '',
}) => {
    const shouldReduceMotion = useReducedMotion();

    // Drawer sees the full secret word in a marigold chip + N of M guessed counter
    if (isDrawer && word) {
        return (
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 ${className}`}>
                <div
                    data-testid="drawer-word-chip"
                    className="inline-flex items-center gap-2 bg-marigold text-ink border-2 border-ink shadow-hard-sm px-4 py-1.5 rounded-[6px] font-mono font-black text-lg sm:text-xl md:text-2xl uppercase tracking-wider select-none"
                >
                    <span className="text-xs uppercase font-bold text-ink-soft tracking-widest mr-1">
                        Draw:
                    </span>
                    <span>{word}</span>
                </div>

                {totalGuessers > 0 && (
                    <motion.div
                        key={guessedCount}
                        initial={!shouldReduceMotion ? { scale: 1.25 } : { opacity: 0.8 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        data-testid="drawer-guessed-counter"
                        className="inline-flex items-center gap-1.5 bg-paper border-2 border-ink shadow-hard-sm px-3 py-1 rounded-[6px] text-xs sm:text-sm font-black text-ink select-none"
                    >
                        <Check className="w-3.5 h-3.5 text-leaf-deep stroke-[3]" />
                        <span>
                            {guessedCount} of {totalGuessers} guessed
                        </span>
                    </motion.div>
                )}
            </div>
        );
    }

    // Parse hint string into tokens
    // Server formats hints as e.g. "c _ t" or "c _ t   _ _" (spaces between letters, triple spaces between words)
    const tokens = [];
    if (hint) {
        // Normalize double/triple spaces to a special marker
        const words = hint.split(/\s{2,}/);
        words.forEach((w, wordIdx) => {
            if (wordIdx > 0) {
                tokens.push({ type: 'gap' });
            }
            const letters = w.split(' ').filter(Boolean);
            letters.forEach((char) => {
                tokens.push({
                    type: 'letter',
                    char: char === '_' ? '' : char.toUpperCase(),
                    isRevealed: char !== '_',
                });
            });
        });
    }

    if (tokens.length === 0) {
        return (
            <div className={`flex items-center justify-center italic text-xs sm:text-sm text-ink-soft ${className}`}>
                Waiting for word...
            </div>
        );
    }

    return (
        <div
            data-testid="hint-tiles-container"
            className={`flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 py-1 select-none ${className}`}
            aria-label="Secret word hint"
        >
            {tokens.map((token, index) => {
                if (token.type === 'gap') {
                    return (
                        <div
                            key={`gap-${index}`}
                            data-testid="hint-gap"
                            className="w-3 sm:w-4 md:w-5 h-8 flex-shrink-0"
                            aria-hidden="true"
                        />
                    );
                }

                return (
                    <motion.div
                        key={`tile-${index}-${token.char}`}
                        data-testid="hint-tile"
                        data-revealed={token.isRevealed}
                        data-letter={token.char}
                        initial={
                            token.isRevealed && !shouldReduceMotion
                                ? { rotateX: 90, opacity: 0 }
                                : false
                        }
                        animate={{ rotateX: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                        className={`w-7 h-9 sm:w-8 sm:h-10 md:w-10 md:h-12 bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center font-mono font-black text-base sm:text-lg md:text-xl text-ink ${
                            token.isRevealed ? 'bg-card text-ink' : 'bg-paper'
                        }`}
                    >
                        {token.isRevealed ? (
                            token.char
                        ) : (
                            <span className="w-3 h-0.5 bg-ink-soft rounded-full mt-3 opacity-60" />
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
};

export default HintTiles;

