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
        <div className="h-full bg-primary flex flex-col items-center justify-center p-8 text-white overflow-y-auto">
            <h1 className="text-6xl font-heading mb-8 animate-bounce">Game Over! 🏆</h1>

            <div className="bg-white text-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-2xl">
                <h2 className="text-3xl font-bold mb-6 text-center border-b pb-4">Leaderboard</h2>
                <div className="space-y-4">
                    {sortedPlayers.map((p, idx) => (
                        <div key={p.id} className={`flex items-center p-4 rounded-lg transform transition ${idx === 0 ? 'bg-yellow-100 scale-105 border-2 border-yellow-400' : 'bg-gray-50'}`}>
                            <div className="text-3xl font-bold w-12 text-gray-400">#{idx + 1}</div>
                            <div className="text-4xl mr-4">{p.avatar}</div>
                            <div className="flex-grow font-bold text-xl">{p.username}</div>
                            <div className="text-2xl font-mono font-bold text-accent">{state.scores[p.id] || 0} pts</div>
                            {idx === 0 && <span className="text-4xl ml-2">👑</span>}
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex justify-center gap-4">
                    <button onClick={() => navigate('/')} className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-full font-bold transition">Exit</button>
                    <button onClick={() => navigate('/')} className="bg-accent hover:bg-red-500 text-white px-8 py-3 rounded-full font-bold transition">Play Again</button>
                </div>
            </div>
        </div>
    );
};

export default GameEnd;
