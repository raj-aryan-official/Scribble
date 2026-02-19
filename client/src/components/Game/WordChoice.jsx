import React from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';

export const WordChoice = ({ roomCode }) => {
    const { state } = useGame();
    const socket = useSocket();

    if (state.gameState !== 'WORD_SELECTION') return null;

    // Only show if current user is drawer
    const isDrawer = state.currentUser?.id === state.drawerId;

    // For MVP, we pass choices via state
    if (!isDrawer) return (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="text-white text-2xl font-bold animate-pulse">Drawer is choosing a word...</div>
        </div>
    );

    const [timeLeft, setTimeLeft] = React.useState(10);

    React.useEffect(() => {
        if (!isDrawer) return;

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
    }, [isDrawer]);

    const handleChoose = (word) => {
        socket.emit(EVENTS.CHOOSE_WORD, { roomCode, word });
    };

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
                    {state.wordChoices && state.wordChoices.map((word, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleChoose(word)}
                            className="bg-secondary hover:bg-teal-600 text-white text-lg md:text-xl py-3 px-6 md:py-4 md:px-8 rounded-lg transition transform hover:scale-105 flex-grow md:flex-grow-0 basis-full md:basis-auto"
                        >
                            {word}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
