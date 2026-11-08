import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { useSound } from '../hooks/useSound';
import { EVENTS } from '../../../shared/types.js';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Toast from '../components/ui/Toast';
import DrawingCard from '../components/Game/DrawingCard';

export const GameEnd = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const { state } = useGame();
    const socket = useSocket();
    const { play } = useSound();
    const shouldReduceMotion = useReducedMotion();

    const [toastMessage, setToastMessage] = useState('');
    const [toastVariant, setToastVariant] = useState('success');

    const isHost = Boolean(state.currentUser?.isHost);

    // Confetti burst in palette colors only (~2s duration, skipped when reduced motion is on)
    useEffect(() => {
        play('win');

        if (shouldReduceMotion) return;

        const duration = 2000;
        const animationEnd = Date.now() + duration;
        const paletteColors = ['#E4472B', '#F6B72C', '#2F4FD8', '#2E9E6B', '#1C1B18'];

        const frame = () => {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.7 },
                colors: paletteColors,
                disableForReducedMotion: true,
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.7 },
                colors: paletteColors,
                disableForReducedMotion: true,
            });

            if (Date.now() < animationEnd) {
                requestAnimationFrame(frame);
            }
        };

        requestAnimationFrame(frame);
    }, [shouldReduceMotion, play]);

    // Socket listener for room restart
    useEffect(() => {
        if (!socket) return;
        const handleRoomJoined = () => {
            navigate(`/lobby/${code}`);
        };
        socket.on(EVENTS.ROOM_JOINED, handleRoomJoined);
        return () => socket.off(EVENTS.ROOM_JOINED, handleRoomJoined);
    }, [socket, code, navigate]);

    const handlePlayAgain = () => {
        if (isHost && socket) {
            socket.emit(EVENTS.PLAY_AGAIN, { roomCode: code });
        }
        navigate(`/lobby/${code}`);
    };

    const sortedPlayers = [...state.players].sort(
        (a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0)
    );

    const first = sortedPlayers[0];
    const second = sortedPlayers[1];
    const third = sortedPlayers[2];

    const matchDrawings = state.matchDrawings || [];

    return (
        <div className="flex-1 w-full bg-paper flex flex-col items-center p-4 sm:p-6 md:p-8 overflow-y-auto select-none">
            <Toast
                isOpen={Boolean(toastMessage)}
                onClose={() => setToastMessage('')}
                message={toastMessage}
                variant={toastVariant}
            />

            <div className="w-full max-w-4xl flex flex-col items-center gap-8">
                {/* Header */}
                <div className="text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                        Match Complete
                    </span>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-heading text-ink tracking-tight mt-1">
                        Winner's Circle
                    </h1>
                </div>

                {/* Top Three Podium */}
                {sortedPlayers.length > 0 && (
                    <div className="w-full max-w-lg flex items-end justify-center gap-2 sm:gap-4 pt-8 pb-4">
                        {/* 2nd Place (Left, Cobalt block) */}
                        {second && (
                            <motion.div
                                initial={{ y: 80, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
                                className="flex-1 flex flex-col items-center"
                            >
                                <div className="mb-2 text-center">
                                    <Avatar avatarId={second.avatar} size="md" />
                                    <p className="font-bold text-xs sm:text-sm text-ink truncate max-w-[90px] mt-1">
                                        {second.username}
                                    </p>
                                    <p className="font-mono font-bold text-xs text-ink-soft">
                                        {state.scores[second.id] || 0} pts
                                    </p>
                                </div>
                                <div className="w-full h-24 sm:h-28 bg-cobalt border-2 border-ink shadow-hard rounded-t-[8px] flex flex-col items-center justify-center text-white">
                                    <span className="font-mono font-black text-2xl sm:text-3xl">2</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">2nd</span>
                                </div>
                            </motion.div>
                        )}

                        {/* 1st Place (Center, Tallest Marigold block + SVG Crown) */}
                        {first && (
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                className="flex-1 flex flex-col items-center z-10"
                            >
                                <div className="relative mb-2 text-center flex flex-col items-center">
                                    {/* Gold Crown SVG */}
                                    <svg
                                        viewBox="0 0 48 32"
                                        className="w-10 h-8 sm:w-12 sm:h-9 -mb-1 animate-bounce"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M 6 26 L 4 10 L 14 18 L 24 4 L 34 18 L 44 10 L 42 26 Z"
                                            fill="#F6B72C"
                                            stroke="#1C1B18"
                                            strokeWidth="2.5"
                                            strokeLinejoin="round"
                                        />
                                        <circle cx="24" cy="18" r="2.5" fill="#E4472B" stroke="#1C1B18" strokeWidth="1" />
                                    </svg>
                                    <Avatar avatarId={first.avatar} size="lg" />
                                    <p className="font-heading font-black text-sm sm:text-base text-ink truncate max-w-[110px] mt-1">
                                        {first.username}
                                    </p>
                                    <p className="font-mono font-black text-xs sm:text-sm text-tomato">
                                        {state.scores[first.id] || 0} pts
                                    </p>
                                </div>
                                <div className="w-full h-32 sm:h-36 bg-marigold border-2 border-ink shadow-hard-lg rounded-t-[8px] flex flex-col items-center justify-center text-ink">
                                    <span className="font-mono font-black text-3xl sm:text-4xl">1</span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-ink">Winner</span>
                                </div>
                            </motion.div>
                        )}

                        {/* 3rd Place (Right, Tomato block) */}
                        {third && (
                            <motion.div
                                initial={{ y: 80, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
                                className="flex-1 flex flex-col items-center"
                            >
                                <div className="mb-2 text-center">
                                    <Avatar avatarId={third.avatar} size="md" />
                                    <p className="font-bold text-xs sm:text-sm text-ink truncate max-w-[90px] mt-1">
                                        {third.username}
                                    </p>
                                    <p className="font-mono font-bold text-xs text-ink-soft">
                                        {state.scores[third.id] || 0} pts
                                    </p>
                                </div>
                                <div className="w-full h-16 sm:h-20 bg-tomato border-2 border-ink shadow-hard rounded-t-[8px] flex flex-col items-center justify-center text-white">
                                    <span className="font-mono font-black text-xl sm:text-2xl">3</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">3rd</span>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Drawing of the Match Section */}
                {matchDrawings.length > 0 && (
                    <div className="w-full flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black font-heading text-ink">
                                    Drawings of the Match
                                </h2>
                                <p className="text-xs text-ink-soft">
                                    Download or share artwork created during this game
                                </p>
                            </div>
                            <span className="font-mono font-bold text-xs bg-card border-2 border-ink px-2 py-0.5 rounded-[4px] text-ink">
                                {matchDrawings.length} {matchDrawings.length === 1 ? 'drawing' : 'drawings'}
                            </span>
                        </div>

                        {/* Swipeable Strip */}
                        <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-hide max-w-full">
                            {matchDrawings.map((drawing, idx) => (
                                <DrawingCard
                                    key={idx}
                                    drawing={drawing}
                                    onToast={(msg, variant) => {
                                        setToastMessage(msg);
                                        setToastVariant(variant);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Full Standings List Card */}
                <Card className="w-full p-4 sm:p-6 shadow-hard bg-card">
                    <h3 className="text-base sm:text-lg font-bold font-heading text-ink border-b-2 border-ink/10 pb-2 mb-3">
                        All Players Standings
                    </h3>

                    <div className="flex flex-col gap-2">
                        {sortedPlayers.map((player, idx) => (
                            <div
                                key={player.id}
                                className={`flex items-center justify-between p-2.5 rounded-[8px] border-2 border-ink ${
                                    idx === 0 ? 'bg-marigold' : 'bg-paper'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="font-mono font-black text-xs sm:text-sm w-6">
                                        #{idx + 1}
                                    </span>
                                    <Avatar avatarId={player.avatar} size="xs" />
                                    <span className="font-bold text-xs sm:text-sm truncate">
                                        {player.username}
                                    </span>
                                </div>
                                <span className="font-mono font-black text-xs sm:text-sm">
                                    {state.scores[player.id] || 0} pts
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={() => navigate('/')}
                            className="flex-1 uppercase font-bold"
                        >
                            Back to Home
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
