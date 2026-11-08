import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useSound } from '../../hooks/useSound';

export const HintTiles = ({
    word = '',
    hint = '',
    isDrawer = false,
    guessedCount = 0,
    totalGuessers = 0,
    compact = false,
    className = '',
}) => {
    const shouldReduceMotion = useReducedMotion();
    const { play } = useSound();
    const [liveAnnouncement, setLiveAnnouncement] = useState('');
    const prevTokensRef = useRef([]);

    // Parse hint string into words and tokens
    // Server formats hints as e.g. "_ _ _" or "c _ t" or "c _ t   _ _" (spaces between letters, >=2 spaces between words)
    const { tokens, wordLengths } = useMemo(() => {
        const tokensArr = [];
        const lengthsArr = [];
        if (hint) {
            const rawWords = hint.split(/\s{2,}/);
            let letterNum = 0;
            rawWords.forEach((w, wordIdx) => {
                if (wordIdx > 0) {
                    tokensArr.push({ type: 'gap' });
                }
                const letters = w.split(' ').filter(Boolean);
                lengthsArr.push(letters.length);
                letters.forEach((char) => {
                    letterNum += 1;
                    const isRevealed = char !== '_';
                    tokensArr.push({
                        type: 'letter',
                        letterNumber: letterNum,
                        char: isRevealed ? char.toUpperCase() : '',
                        isRevealed,
                    });
                });
            });
        }
        return { tokens: tokensArr, wordLengths: lengthsArr };
    }, [hint]);

    const lengthDisplay = wordLengths.filter((len) => len > 0).join(', ');

    // Track newly revealed letters to play a soft tick and announce for screen readers
    useEffect(() => {
        if (!tokens.length) {
            prevTokensRef.current = [];
            return;
        }

        const prev = prevTokensRef.current;
        if (prev.length > 0) {
            // Find newly revealed letter
            const newlyRevealed = tokens.find((token, idx) => {
                const prevToken = prev[idx];
                return token.type === 'letter' && token.isRevealed && (!prevToken || !prevToken.isRevealed);
            });

            if (newlyRevealed) {
                play('tick');
                setLiveAnnouncement(`Hint: letter ${newlyRevealed.letterNumber} is ${newlyRevealed.char}`);
            }
        }

        prevTokensRef.current = tokens;
    }, [tokens, play]);

    // Drawer sees the full secret word in a marigold chip + N of M guessed counter
    if (isDrawer && word) {
        return (
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 ${className}`}>
                <div
                    data-testid="drawer-word-chip"
                    className="inline-flex items-center gap-2 bg-marigold text-ink border-2 border-ink shadow-hard-sm px-4 py-1.5 rounded-[6px] font-heading font-black text-lg sm:text-xl md:text-2xl uppercase tracking-wider select-none"
                >
                    <span className="text-xs uppercase font-bold text-ink tracking-widest mr-1">
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
            className={`flex items-center justify-center flex-wrap gap-2 py-1 select-none ${className}`}
            aria-label="Secret word hint"
        >
            {/* Screen reader live announcement for revealed hints */}
            <div className="sr-only" role="status" aria-live="polite">
                {liveAnnouncement}
            </div>

            {/* Hint letter tiles */}
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                {tokens.map((token, index) => {
                    if (token.type === 'gap') {
                        return (
                            <div
                                key={`gap-${index}`}
                                data-testid="hint-gap"
                                className={`${compact ? 'w-2 sm:w-3 h-6' : 'w-3 sm:w-4 md:w-5 h-8'} flex-shrink-0`}
                                aria-hidden="true"
                            />
                        );
                    }

                    return (
                        <motion.div
                            key={`tile-${index}-${token.char}`}
                            data-testid="hint-tile"
                            data-revealed={token.isRevealed}
                            data-letter={token.isRevealed ? token.char : ''}
                            initial={
                                token.isRevealed && !shouldReduceMotion
                                    ? { rotateX: 90, opacity: 0 }
                                    : false
                            }
                            animate={{ rotateX: 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                            className={`${
                                compact
                                    ? 'w-6 h-7 sm:w-7 sm:h-8 text-xs sm:text-sm'
                                    : 'w-7 h-9 sm:w-8 sm:h-10 md:w-10 md:h-12 text-base sm:text-lg md:text-xl'
                            } border-2 border-ink rounded-[6px] shadow-hard-xs flex items-center justify-center font-mono font-black text-ink transition-colors ${
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

            {/* Word length indicator (e.g. '5' or '3, 5') */}
            {lengthDisplay && (
                <span
                    data-testid="hint-length"
                    aria-label={`Word length: ${lengthDisplay}`}
                    title={`Word length: ${lengthDisplay}`}
                    className={`font-mono font-bold ${
                        compact ? 'text-[11px] px-1.5 py-0.5' : 'text-xs sm:text-sm px-2 py-1'
                    } bg-card border-2 border-ink rounded-[6px] shadow-hard-xs text-ink shrink-0`}
                >
                    {lengthDisplay}
                </span>
            )}
        </div>
    );
};

export default HintTiles;
