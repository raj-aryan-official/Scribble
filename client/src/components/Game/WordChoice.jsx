import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';
import { getWordDifficulty } from '../../utils/wordDifficulty';
import Avatar from '../ui/Avatar';
import Card from '../ui/Card';

export const WordChoice = ({ roomCode }) => {
    const { state } = useGame();
    const socket = useSocket();

    const [timeLeft, setTimeLeft] = useState(10);

    const isWordSelection = state.gameState === 'WORD_SELECTION';
    const isDrawer = state.currentUser?.id === state.drawerId;
    const drawer = state.players.find((p) => p.id === state.drawerId);

    // 10s Countdown Timer (hook kept unconditionally at the top)
    useEffect(() => {
        if (!isWordSelection) return;

        setTimeLeft(10);
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isWordSelection, state.drawerId]);

    const handleChoose = (word) => {
        socket.emit(EVENTS.CHOOSE_WORD, { roomCode, word });
    };

    if (!isWordSelection) return null;

    const progressPercent = Math.max(0, Math.min(100, (timeLeft / 10) * 100));

    // Non-drawers see drawer avatar and "NAME is choosing a word" on dim paper
    if (!isDrawer) {
        return (
            <div className="fixed inset-0 z-40 bg-paper/85 flex items-center justify-center p-4 backdrop-blur-none">
                <Card className="flex flex-col items-center justify-center p-6 sm:p-8 max-w-sm w-full text-center shadow-hard-lg bg-card gap-4">
                    <Avatar avatarId={drawer?.avatar || 'avatar-1'} size="xl" />
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold font-heading text-ink">
                            {drawer?.username || 'Artist'} is choosing a word...
                        </h2>
                        <p className="text-xs sm:text-sm text-ink-soft mt-1">
                            Get your guesses ready!
                        </p>
                    </div>

                    {/* Draining 10s ink line */}
                    <div className="w-full h-2 bg-paper border-2 border-ink rounded-full overflow-hidden mt-2">
                        <div
                            className="h-full bg-ink transition-all duration-1000 ease-linear"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    // Drawer view: 3 fanned index cards at -4, 0, +4 degrees
    const rotations = ['rotate-[-4deg]', 'rotate-0', 'rotate-[4deg]'];

    return (
        <div className="fixed inset-0 z-40 bg-paper/85 flex items-center justify-center p-4 backdrop-blur-none">
            <div className="max-w-2xl w-full flex flex-col items-center gap-6">
                <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl font-black font-heading text-ink">
                        Pick Your Word
                    </h2>
                    <p className="text-xs sm:text-sm text-ink-soft mt-1">
                        Select one of three cards to start drawing
                    </p>
                </div>

                {/* Draining Ink Line across the cards header */}
                <div className="w-full max-w-md h-2.5 bg-paper border-2 border-ink rounded-full overflow-hidden shadow-hard-sm">
                    <div
                        className={`h-full transition-all duration-1000 ease-linear ${
                            timeLeft <= 3 ? 'bg-tomato' : 'bg-ink'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Fanned 3 Cards */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-4">
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

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleChoose(wordText)}
                                    className={`group transform ${rotationClass} hover:rotate-0 hover:scale-105 hover:z-20 transition-all duration-150 cursor-pointer text-center bg-card border-2 border-ink shadow-hard rounded-[12px] p-5 w-48 sm:w-52 min-h-[140px] flex flex-col justify-between items-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-2`}
                                >
                                    <span className="text-lg sm:text-xl font-heading font-black text-ink capitalize tracking-wide group-hover:text-tomato transition-colors">
                                        {wordText}
                                    </span>

                                    <div className="flex flex-col items-center gap-1 mt-4">
                                        <div
                                            className="flex items-center gap-1.5"
                                            title={`Difficulty: ${difficulty}`}
                                        >
                                            {[1, 2, 3].map((dot) => (
                                                <span
                                                    key={dot}
                                                    className={`w-2.5 h-2.5 rounded-full border border-ink ${
                                                        dot <= level
                                                            ? dotColors[level] || 'bg-marigold'
                                                            : 'bg-paper'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                                            {difficulty}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                </div>
            </div>
        </div>
    );
};

export default WordChoice;
