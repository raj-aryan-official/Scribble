import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/types.js';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

export const GameEnd = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const { state } = useGame();
    const socket = useSocket();

    const isHost = state.currentUser?.isHost;

    const handlePlayAgain = () => {
        if (isHost && socket) {
            socket.emit(EVENTS.PLAY_AGAIN, { roomCode: code });
        }
        navigate(`/lobby/${code}`);
    };

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
        <div className="flex-1 w-full bg-paper flex flex-col items-center justify-center p-4 md:p-8 text-ink overflow-y-auto">
            <div className="w-full max-w-xl flex flex-col items-center">
                <div className="text-6xl md:text-7xl mb-3 select-none">🏆</div>
                <h1 className="text-4xl md:text-5xl font-black font-heading mb-6 text-ink text-center">
                    Game Over!
                </h1>

                <Card className="w-full p-6 md:p-8 shadow-hard-lg bg-card">
                    <h2 className="text-xl md:text-2xl font-bold font-heading mb-6 text-center border-b-2 border-ink pb-3 text-ink uppercase tracking-wider">
                        Final Leaderboard
                    </h2>
                    <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                        {sortedPlayers.map((p, idx) => {
                            const isWinner = idx === 0;
                            return (
                                <div
                                    key={p.id}
                                    className={`flex items-center p-3 rounded-[8px] border-2 border-ink transition-transform ${
                                        isWinner
                                            ? 'bg-marigold shadow-hard-sm'
                                            : 'bg-paper'
                                    }`}
                                >
                                    <div className="text-lg md:text-xl font-black font-mono w-8 shrink-0 text-ink">
                                        #{idx + 1}
                                    </div>
                                    <div className="mr-3 shrink-0">
                                        <Avatar avatarId={p.avatar} size="sm" />
                                    </div>
                                    <div className="flex-grow flex flex-col min-w-0">
                                        <span className="font-bold text-base md:text-lg truncate text-ink">
                                            {p.username}
                                        </span>
                                        {isWinner && (
                                            <span className="text-[11px] font-black uppercase text-tomato tracking-wider">
                                                Winner
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-lg md:text-xl font-mono font-black text-ink shrink-0 whitespace-nowrap">
                                        {state.scores[p.id] || 0} pts
                                    </div>
                                    {isWinner && (
                                        <span className="text-xl ml-2 shrink-0 select-none">👑</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={() => navigate('/')}
                            className="flex-1 uppercase font-bold"
                        >
                            Exit to Home
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handlePlayAgain}
                            className="flex-1 uppercase font-bold"
                        >
                            {isHost ? 'Play Again' : 'Return to Lobby'}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default GameEnd;
