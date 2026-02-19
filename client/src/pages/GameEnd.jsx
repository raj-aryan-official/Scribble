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
        <div className="h-full bg-gradient-to-b from-primary to-blue-900 flex flex-col items-center justify-center p-4 md:p-8 text-white overflow-y-auto">
            <div className="animate-in zoom-in duration-500 w-full max-w-2xl flex flex-col items-center">
                <div className="text-6xl md:text-8xl mb-4 animate-bounce">🏆</div>
                <h1 className="text-4xl md:text-6xl font-heading mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-sm text-center">
                    Game Over!
                </h1>

                <div className="bg-white/95 backdrop-blur-sm text-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full border-4 border-yellow-400/30">
                    <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center border-b pb-4 text-primary uppercase tracking-wider">Leaderboard</h2>
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
                        {sortedPlayers.map((p, idx) => (
                            <div key={p.id} className={`flex items-center p-3 md:p-4 rounded-xl transform transition-all ${idx === 0 ? 'bg-yellow-50 scale-[1.02] border-2 border-yellow-400 shadow-lg' : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'}`}>
                                <div className={`text-xl md:text-2xl font-black w-10 md:w-12 shrink-0 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                                    #{idx + 1}
                                </div>
                                <div className="text-3xl md:text-4xl mr-3 md:mr-4 shrink-0">{p.avatar}</div>
                                <div className="flex-grow flex flex-col min-w-0">
                                    <span className={`font-bold text-base md:text-xl truncate ${idx === 0 ? 'text-primary' : 'text-gray-700'}`}>{p.username}</span>
                                    {idx === 0 && <span className="text-xs text-yellow-600 font-bold uppercase tracking-wide">Winner</span>}
                                </div>
                                <div className="text-xl md:text-2xl font-mono font-bold text-accent shrink-0 whitespace-nowrap">{state.scores[p.id] || 0} pts</div>
                                {idx === 0 && <span className="text-2xl md:text-3xl ml-2 shrink-0 animate-pulse">👑</span>}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-8 py-3 rounded-xl font-bold transition-all shadow-sm hover:shadow active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span>Exit to Home</span>
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-accent hover:bg-red-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span>Play Again</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameEnd;
