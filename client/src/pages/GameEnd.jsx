import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import confetti from 'canvas-confetti';

const GameEnd = () => {
    const navigate = useNavigate();
    const { state } = useGame();

    useEffect(() => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        return () => clearInterval(interval);
    }, []);

    const sortedPlayers = [...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0));

    return (
        <div className="h-full bg-primary flex flex-col items-center justify-center p-4 md:p-8 text-white overflow-y-auto">
            <h1 className="text-4xl md:text-6xl font-heading mb-6 md:mb-8 animate-bounce text-center">Game Over! <span className="block md:inline">🏆</span></h1>

            <div className="bg-white text-gray-800 rounded-xl shadow-2xl p-4 md:p-8 w-full max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-center border-b pb-4">Leaderboard</h2>
                <div className="space-y-3 md:space-y-4">
                    {sortedPlayers.map((p, idx) => (
                        <div key={p.id} className={`flex items-center p-3 md:p-4 rounded-lg transform transition ${idx === 0 ? 'bg-yellow-50 md:bg-yellow-100 scale-100 md:scale-105 border-2 border-yellow-400' : 'bg-gray-50'}`}>
                            <div className="text-xl md:text-3xl font-bold w-8 md:w-12 text-gray-400 shrink-0">#{idx + 1}</div>
                            <div className="text-2xl md:text-4xl mr-3 md:mr-4 shrink-0">{p.avatar}</div>
                            <div className="flex-grow font-bold text-base md:text-xl truncate min-w-0 pr-2">{p.username}</div>
                            <div className="text-lg md:text-2xl font-mono font-bold text-accent shrink-0 whitespace-nowrap">{state.scores[p.id] || 0} pts</div>
                            {idx === 0 && <span className="text-2xl md:text-4xl ml-1 md:ml-2 shrink-0">👑</span>}
                        </div>
                    ))}
                </div>

                <div className="mt-6 md:mt-8 flex flex-col md:flex-row justify-center gap-3 md:gap-4">
                    <button onClick={() => navigate('/')} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 md:px-8 md:py-3 rounded-full font-bold transition text-sm md:text-base">Exit</button>
                    <button onClick={() => navigate('/')} className="bg-accent hover:bg-red-500 text-white px-6 py-2 md:px-8 md:py-3 rounded-full font-bold transition text-sm md:text-base">Play Again</button>
                </div>
            </div>
        </div>
    );
};

export default GameEnd;
