import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { Copy, Check, Share2, Home } from 'lucide-react';

const Lobby = () => {
    const { code } = useParams();
    const { state } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();

    useEffect(() => {
        if (state.gameState === 'DRAWING' || state.gameState === 'WORD_SELECTION') {
            navigate(`/game/${code}`);
        }
    }, [state.gameState, code, navigate]);

    const handleStartGame = () => {
        socket.emit('startGame', { roomCode: code });
    };

    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const handleCopyLink = () => {
        const link = `${window.location.origin}/?join=${code}`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const isHost = state.currentUser?.isHost;

    return (
        <div className="flex flex-col items-center h-full p-4 md:p-8 bg-background overflow-y-auto">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-2xl">
                <div className="flex flex-row justify-between items-center mb-6 gap-1 md:gap-4 overflow-x-hidden">
                    <div className="flex items-center gap-1 md:gap-3 shrink-0">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="p-1.5 md:p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition active:scale-95 shrink-0"
                            title="Back to Home"
                        >
                            <Home size={18} className="md:w-6 md:h-6" />
                        </button>
                        <h1 className="text-xl md:text-3xl font-heading text-primary truncate leading-none">Lobby</h1>
                    </div>

                    <div className="flex gap-1.5 md:gap-2 items-center shrink-0">
                        <div
                            className="bg-secondary text-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-xs md:text-lg flex items-center gap-1 md:gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-purple-600 shadow-sm whitespace-nowrap"
                            onClick={handleCopyCode}
                            title="Copy Room Code"
                        >
                            <span className="font-mono">{code}</span>
                            {copiedCode ? <Check size={14} className="md:w-[18px] md:h-[18px]" /> : <Copy size={14} className="md:w-[18px] md:h-[18px]" />}
                        </div>
                        <div
                            className="bg-accent text-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-xs md:text-lg flex items-center gap-1 md:gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-pink-600 shadow-sm"
                            onClick={handleCopyLink}
                            title="Copy Invite Link"
                        >
                            <Share2 size={14} className="md:w-[18px] md:h-[18px]" />
                            {copiedLink ? <Check size={14} className="md:w-[18px] md:h-[18px]" /> : null}
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-xl md:text-2xl mb-4 font-bold text-gray-700">Players ({state.players.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {state.players.map(p => (
                            <div key={p.id} className="flex items-center p-3 md:p-4 bg-gray-50 rounded-lg border shadow-sm">
                                <span className="text-2xl md:text-4xl mr-3 md:mr-4">{p.avatar}</span>
                                <span className="font-bold text-base md:text-xl text-gray-800 truncate">{p.username}</span>
                                {p.isHost && <span className="ml-auto text-yellow-500 text-base md:text-2xl">👑</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {isHost ? (
                    <button
                        onClick={handleStartGame}
                        className="w-full bg-accent text-white py-3 md:py-4 rounded-lg font-bold text-xl md:text-2xl hover:bg-red-500 transition shadow-lg active:scale-95 transform"
                    >
                        Start Game
                    </button>
                ) : (
                    <div className="text-center text-gray-500 animate-pulse text-base md:text-lg">
                        Waiting for host to start...
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lobby;
