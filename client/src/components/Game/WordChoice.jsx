import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { useSettings } from '../../context/SettingsContext';
import { EVENTS } from '../../../../shared/types';
import { getWordDifficulty } from '../../utils/wordDifficulty';
import Avatar from '../ui/Avatar';
import Card from '../ui/Card';
import Button from '../ui/Button';

const TIPS = [
    'Tip: guess early for more points',
    'Tip: close guesses give you a friendly hint',
    'Tip: simpler shapes are easier to recognize',
    'Tip: look at the word length blanks for clues',
    'Tip: artists score points when anyone guesses right',
];

export const WordChoice = ({ roomCode, cardsReady = true }) => {
    const { state } = useGame();
    const socket = useSocket();
    const { settings } = useSettings();

    const [now, setNow] = useState(Date.now());
    const defaultIndex = typeof state.defaultChoice === 'number' ? state.defaultChoice : 0;
    const [focusedIndex, setFocusedIndex] = useState(defaultIndex);
    const [pickedWord, setPickedWord] = useState(null);
    const cardRefs = useRef([]);
    const hasPulsedRef = useRef(false);

    const isWordSelection = state.gameState === 'WORD_SELECTION';
    const isDrawer = Boolean(state.currentUser?.id && state.currentUser.id === state.drawerId);
    const drawer = state.players.find((p) => p.id === state.drawerId);
    const isRandomMode = state.wordChoiceMode === 'random' || state.settings?.wordChoice === 'random';

    // Synchronize focusedIndex with defaultChoice whenever defaultChoice changes
    useEffect(() => {
        if (typeof state.defaultChoice === 'number') {
            setFocusedIndex(state.defaultChoice);
        }
    }, [state.defaultChoice]);

    // Pick one deterministic tip per turn
    const currentTip = useMemo(() => {
        const seed = `${state.currentRound || 1}-${state.drawerId || ''}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
        }
        const index = Math.abs(hash) % TIPS.length;
        return TIPS[index];
    }, [state.drawerId, state.currentRound]);

    // Timer sync tick (50ms interval for sub-100ms accuracy)
    useEffect(() => {
        if (!isWordSelection) {
            setPickedWord(null);
            hasPulsedRef.current = false;
            return;
        }

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 50);

        return () => clearInterval(interval);
    }, [isWordSelection, state.drawerId]);

    // Calculate remaining time from server selectionEndsAt
    const selectionEndsAt = state.selectionEndsAt;
    const totalDuration = isRandomMode ? 3000 : 10000;
    const remainingMs = selectionEndsAt ? Math.max(0, selectionEndsAt - now) : totalDuration;
    const progressPercent = Math.max(0, Math.min(100, (remainingMs / totalDuration) * 100));
    const isLast3Seconds = remainingMs > 0 && remainingMs <= 3000;

    // Pulse cards once in last 3 seconds
    const shouldPulse = isLast3Seconds && !hasPulsedRef.current;
    useEffect(() => {
        if (isLast3Seconds) {
            hasPulsedRef.current = true;
        }
    }, [isLast3Seconds]);

    // Reset pulse ref on new turn
    useEffect(() => {
        hasPulsedRef.current = false;
    }, [state.drawerId, state.currentRound]);

    const handlePick = useCallback((index) => {
        if (!state.wordChoices || !state.wordChoices[index] || pickedWord) return;
        const choice = state.wordChoices[index];
        const wordText = typeof choice === 'string' ? choice : choice.word;
        setPickedWord({ word: wordText, index });

        // Slide up into word chip and emit after 300ms
        setTimeout(() => {
            const turnId = state.turnId || state.turnInfo?.turnId;
            socket.emit(EVENTS.CHOOSE_WORD, { roomCode, word: wordText, turnId });
        }, 300);
    }, [state.wordChoices, pickedWord, socket, roomCode, state.turnId, state.turnInfo?.turnId]);

    // Surprise me button: pick random word immediately
    const handleSurpriseMe = useCallback(() => {
        if (!state.wordChoices || state.wordChoices.length === 0 || pickedWord) return;
        const randomIndex = Math.floor(Math.random() * state.wordChoices.length);
        handlePick(randomIndex);
    }, [state.wordChoices, pickedWord, handlePick]);

    // Per-player setting: "Always pick randomly for me"
    // On player's turn as drawer in pick mode, auto-confirm default card after 1s
    useEffect(() => {
        if (!isWordSelection || !isDrawer || pickedWord || isRandomMode) return;
        if (settings?.alwaysPickRandomly && state.wordChoices && state.wordChoices.length > 0) {
            const timer = setTimeout(() => {
                const targetIdx = (typeof state.defaultChoice === 'number' && state.defaultChoice < state.wordChoices.length)
                    ? state.defaultChoice
                    : 0;
                handlePick(targetIdx);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isWordSelection, isDrawer, pickedWord, isRandomMode, settings?.alwaysPickRandomly, state.wordChoices, state.defaultChoice, handlePick]);

    // Keyboard controls for drawer: 1, 2, 3, ArrowLeft, ArrowRight, Enter, Space
    useEffect(() => {
        if (!isWordSelection || !isDrawer || pickedWord || isRandomMode) return;

        const handleKeyDown = (e) => {
            if (!state.wordChoices || state.wordChoices.length === 0) return;

            // Direct number selection: 1, 2, 3
            if (e.key === '1' && state.wordChoices[0]) {
                e.preventDefault();
                handlePick(0);
                return;
            }
            if (e.key === '2' && state.wordChoices[1]) {
                e.preventDefault();
                handlePick(1);
                return;
            }
            if (e.key === '3' && state.wordChoices[2]) {
                e.preventDefault();
                handlePick(2);
                return;
            }

            // Arrow keys: move focus
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setFocusedIndex((prev) => {
                    const next = Math.max(0, prev - 1);
                    cardRefs.current[next]?.focus();
                    return next;
                });
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setFocusedIndex((prev) => {
                    const next = Math.min(state.wordChoices.length - 1, prev + 1);
                    cardRefs.current[next]?.focus();
                    return next;
                });
                return;
            }

            // Enter key or Space key confirms focused card
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handlePick(focusedIndex);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isWordSelection, isDrawer, pickedWord, isRandomMode, state.wordChoices, focusedIndex, handlePick]);

    if (!isWordSelection) return null;

    // RANDOM MODE VIEW (No choice screen, 3s preview)
    if (isRandomMode) {
        if (!isDrawer) {
            // Spectator view in random mode
            return (
                <div
                    className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none select-none"
                    data-testid="word-choice-spectator"
                >
                    <div aria-live="polite" aria-atomic="true" className="sr-only">
                        {drawer?.username || 'Maya'} is getting a word
                    </div>
                    <Card className="flex flex-col items-center justify-center p-6 sm:p-8 max-w-sm w-full text-center shadow-hard bg-card border-2 border-ink gap-4 pointer-events-auto">
                        <div className="relative inline-flex items-center justify-center">
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                className="relative"
                            >
                                <Avatar avatarId={drawer?.avatar || 'avatar-1'} size="xl" />
                            </motion.div>
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black font-heading text-ink">
                                {drawer?.username || 'Maya'} is getting a word
                            </h2>
                            <p className="text-xs sm:text-sm font-bold text-ink-soft mt-1">
                                Round starting soon...
                            </p>
                        </div>
                        {/* Draining 3s ink line */}
                        <div className="w-full h-2.5 bg-paper border-2 border-ink rounded-full overflow-hidden shadow-hard-sm mt-1">
                            <div
                                className="h-full bg-ink transition-all duration-75 ease-linear"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </Card>
                </div>
            );
        }

        // Drawer view in random mode
        const displayWord = (state.wordToGuess || '').toUpperCase();
        return (
            <div
                className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none select-none"
                data-testid="word-choice-random-drawer"
            >
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                    Your word: {displayWord}
                </div>
                <Card className="flex flex-col items-center justify-center p-6 sm:p-8 max-w-md w-full text-center shadow-hard bg-card border-2 border-ink gap-4 pointer-events-auto">
                    <span className="text-xs font-black uppercase tracking-widest text-ink-soft bg-paper border border-ink/30 px-3 py-1 rounded-[6px]">
                        Random Word Mode
                    </span>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black font-heading text-ink">
                            Your word: <span className="text-tomato underline decoration-2 underline-offset-4">{displayWord}</span>
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-ink-soft mt-1">
                            Get ready to draw! Round begins in 3s
                        </p>
                    </div>
                    {/* Draining 3s ink line */}
                    <div className="w-full h-2.5 bg-paper border-2 border-ink rounded-full overflow-hidden shadow-hard-sm mt-1">
                        <div
                            className="h-full bg-tomato transition-all duration-75 ease-linear"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    // PICK MODE: SPECTATOR VIEW (Everyone Else) - No black overlay!
    if (!isDrawer) {
        return (
            <div
                className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none select-none"
                data-testid="word-choice-spectator"
            >
                {/* Live region for accessibility */}
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {drawer?.username || 'Artist'} is choosing a word
                </div>

                <Card className="flex flex-col items-center justify-center p-6 sm:p-8 max-w-sm w-full text-center shadow-hard bg-card border-2 border-ink gap-4 pointer-events-auto">
                    {/* Drawer Avatar with gentle idle bob holding an SVG pencil */}
                    <div className="relative inline-flex items-center justify-center">
                        <motion.div
                            animate={{ y: [0, -6, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                            className="relative"
                        >
                            <Avatar avatarId={drawer?.avatar || 'avatar-1'} size="xl" />
                            {/* Stylized pencil in avatar corner */}
                            <svg
                                viewBox="0 0 32 32"
                                className="absolute -bottom-1 -right-2 w-8 h-8 select-none"
                                aria-hidden="true"
                            >
                                <path d="M8 24 L22 10 L26 14 L12 28 Z" fill="#F6B72C" stroke="#1C1B18" strokeWidth="1.5" />
                                <path d="M6 26 L8 24 L12 28 L7 29 Z" fill="#F3ECDD" stroke="#1C1B18" strokeWidth="1.5" />
                                <path d="M5 28 L7 29 L5 30 Z" fill="#1C1B18" />
                                <path d="M22 10 L25 7 C26 6 28 6 29 7 L30 8 C31 9 31 11 30 12 L26 14 Z" fill="#E4472B" stroke="#1C1B18" strokeWidth="1.5" />
                            </svg>
                        </motion.div>
                    </div>

                    <div>
                        <h2 className="text-xl sm:text-2xl font-black font-heading text-ink">
                            {drawer?.username || 'Artist'} is choosing a word
                        </h2>
                        <div className="mt-2 inline-block bg-paper border border-ink/30 px-3 py-1 rounded-[6px] text-xs font-bold text-ink-soft">
                            {currentTip}
                        </div>
                    </div>

                    {/* Draining 10s ink line */}
                    <div className="w-full h-2.5 bg-paper border-2 border-ink rounded-full overflow-hidden shadow-hard-sm mt-1">
                        <div
                            className={`h-full transition-all duration-75 ease-linear ${
                                isLast3Seconds ? 'bg-tomato' : 'bg-ink'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    // PICK MODE: DRAWER VIEW (3 fanned index cards at -4, 0, 4 degrees)
    const rotations = ['rotate-[-4deg]', 'rotate-0', 'rotate-[4deg]'];

    return (
        <div
            className={`absolute inset-0 z-20 flex items-center justify-center p-4 transition-opacity duration-300 ${
                cardsReady ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            data-testid="word-choice-drawer"
        >
            <div className="max-w-2xl w-full flex flex-col items-center gap-4 sm:gap-6">
                <div className="text-center">
                    <span className="text-xs font-black uppercase tracking-widest text-ink-soft bg-paper border border-ink/30 px-3 py-1 rounded-[6px]">
                        Your Turn to Draw
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black font-heading text-ink mt-2">
                        Pick Your Word
                    </h2>
                    <p className="text-xs sm:text-sm font-bold text-ink-soft mt-0.5">
                        Choose a card or press 1, 2, or 3
                    </p>
                </div>

                {/* Draining Ink Line driven by server timestamp */}
                <div className="w-full max-w-md h-2.5 bg-paper border-2 border-ink rounded-full overflow-hidden shadow-hard-sm">
                    <div
                        className={`h-full transition-all duration-75 ease-linear ${
                            isLast3Seconds ? 'bg-tomato' : 'bg-ink'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Fanned 3 Cards with Role Group */}
                <div
                    role="group"
                    aria-label="Choose a word"
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-2"
                >
                    <AnimatePresence>
                        {state.wordChoices &&
                            state.wordChoices.map((item, idx) => {
                                const wordText = typeof item === 'string' ? item : item?.word || '';
                                const meta =
                                    typeof item === 'object' && item?.level
                                        ? item
                                        : getWordDifficulty(wordText);
                                const level = meta?.level || 2;
                                const difficulty =
                                    meta?.difficulty || (level === 1 ? 'Easy' : level === 3 ? 'Hard' : 'Medium');

                                const dotColors = {
                                    1: 'bg-leaf',
                                    2: 'bg-marigold',
                                    3: 'bg-tomato',
                                };

                                const rotationClass = rotations[idx] || 'rotate-0';
                                const isPicked = pickedWord?.index === idx;
                                const isUnpicked = pickedWord !== null && !isPicked;
                                const isDefault = typeof state.defaultChoice === 'number' && idx === state.defaultChoice;
                                const isFocused = focusedIndex === idx;

                                return (
                                    <motion.button
                                        key={wordText + idx}
                                        data-testid={`word-choice-card-${idx}`}
                                        ref={(el) => (cardRefs.current[idx] = el)}
                                        type="button"
                                        onClick={() => handlePick(idx)}
                                        tabIndex={0}
                                        aria-label={`${wordText}, ${difficulty} difficulty`}
                                        animate={
                                            isPicked
                                                ? { y: -80, opacity: 0, scale: 1.05 }
                                                : isUnpicked
                                                ? { opacity: 0, scale: 0.85 }
                                                : shouldPulse
                                                ? { scale: [1, 1.05, 1] }
                                                : { scale: 1, opacity: 1 }
                                        }
                                        transition={{ duration: 0.3 }}
                                        className={`group transform ${rotationClass} hover:rotate-0 hover:-translate-y-2 hover:shadow-hard-lg focus-visible:rotate-0 focus-visible:-translate-y-2 focus-visible:shadow-hard-lg focus-visible:outline-none transition-all duration-150 cursor-pointer text-center bg-card border-2 border-ink shadow-hard rounded-[12px] p-5 w-48 sm:w-52 min-h-[140px] flex flex-col justify-between items-center select-none ${
                                            isDefault ? 'ring-2 ring-cobalt' : ''
                                        } ${
                                            isFocused ? 'ring-2 ring-cobalt ring-offset-2' : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-black uppercase text-ink-soft bg-paper border border-ink/20 px-1.5 py-0.5 rounded-[4px]">
                                                    Key {idx + 1}
                                                </span>
                                                {isDefault && (
                                                    <span
                                                        data-testid="default-choice-tag"
                                                        className="text-[10px] font-black uppercase text-cobalt bg-cobalt/10 border border-cobalt/30 px-1.5 py-0.5 rounded-[4px]"
                                                    >
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className="flex items-center gap-1"
                                                title={`Difficulty: ${difficulty}`}
                                            >
                                                {[1, 2, 3].map((dot) => (
                                                    <span
                                                        key={dot}
                                                        className={`w-2 h-2 rounded-full border border-ink ${
                                                            dot <= level
                                                                ? dotColors[level] || 'bg-marigold'
                                                                : 'bg-paper'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <span
                                            data-testid="card-word"
                                            className="text-xl sm:text-2xl font-heading font-black text-ink capitalize tracking-wide group-hover:text-tomato transition-colors my-2"
                                        >
                                            {wordText}
                                        </span>

                                        <span className="text-[11px] font-black uppercase tracking-wider text-ink-soft">
                                            {difficulty}
                                        </span>
                                    </motion.button>
                                );
                            })}
                    </AnimatePresence>
                </div>

                {/* Surprise me button */}
                <Button
                    type="button"
                    variant="paper"
                    size="sm"
                    data-testid="surprise-me-button"
                    onClick={handleSurpriseMe}
                    className="flex items-center gap-2 mt-2 text-xs font-bold shadow-hard-sm"
                >
                    <Dices className="w-4 h-4 text-ink" />
                    <span>Surprise me</span>
                </Button>
            </div>
        </div>
    );
};

export default WordChoice;
