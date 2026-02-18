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

    const handleChoose = (word) => {
        socket.emit(EVENTS.CHOOSE_WORD, { roomCode, word });
    };

    return (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl max-w-2xl w-full text-center">
                <h2 className="text-3xl mb-6 font-heading text-primary">Choose a Word!</h2>
                <div className="flex gap-4 justify-center">
                    {state.wordChoices.map((word, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleChoose(word)}
                            className="bg-secondary hover:bg-teal-600 text-white text-xl py-4 px-8 rounded-lg transition transform hover:scale-105"
                        >
                            {word}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
