import React from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';
import { getWordDifficulty } from '../../utils/wordDifficulty';

export const WordChoice = ({ roomCode }) => {
    const { state } = useGame();
    const socket = useSocket();
    const [timeLeft, setTimeLeft] = React.useState(10);

    const isWordSelection = state.gameState === 'WORD_SELECTION';
    const isDrawer = state.currentUser?.id === state.drawerId;

    React.useEffect(() => {
        if (!isWordSelection || !isDrawer) return;

        setTimeLeft(10);
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isWordSelection, isDrawer]);

    const handleChoose = (word) => {
        socket.emit(EVENTS.CHOOSE_WORD, { roomCode, word });
    };

    if (!isWordSelection) return null;

    if (!isDrawer) return (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="text-white text-2xl font-bold animate-pulse">Drawer is choosing a word...</div>
        </div>
    );

    return (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 md:p-8 rounded-xl max-w-2xl w-full text-center shadow-2xl mx-4 animate-bounce-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-heading text-primary">Choose a Word!</h2>
                    <span className="text-xl font-bold text-red-500 border border-red-500 rounded-full w-10 h-10 flex items-center justify-center">
                        {timeLeft}
                    </span>
                </div>
                <div className="flex flex-wrap gap-3 md:gap-4 justify-center">
                    {state.wordChoices && state.wordChoices.map((item, idx) => {
                        const wordText = typeof item === 'string' ? item : (item?.word || '');
                        const meta = typeof item === 'object' && item?.level ? item : getWordDifficulty(wordText);
                        const level = meta?.level || 2;
                        const difficulty = meta?.difficulty || (level === 1 ? 'Easy' : level === 3 ? 'Hard' : 'Medium');

                        return (
                            <button
                                key={idx}
                                onClick={() => handleChoose(wordText)}
                                className="bg-secondary hover:bg-teal-600 text-white py-3 px-6 md:py-4 md:px-8 rounded-xl transition transform hover:scale-105 flex-grow md:flex-grow-0 basis-full md:basis-auto flex flex-col items-center justify-center shadow-md cursor-pointer group"
                            >
                                <span className="text-lg md:text-xl font-bold capitalize">{wordText}</span>
                                <div
                                    className="flex gap-1.5 justify-center mt-2 items-center"
                                    title={`Difficulty: ${difficulty}`}
                                >
                                    {[1, 2, 3].map(dot => (
                                        <span
                                            key={dot}
                                            className={`w-2.5 h-2.5 rounded-full transition-all ${
                                                dot <= level
                                                    ? (level === 1 ? 'bg-green-300' : level === 3 ? 'bg-red-400' : 'bg-yellow-300')
                                                    : 'bg-white/30'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
