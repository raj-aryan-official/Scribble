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
        const link = `${window.location.origin}/join/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const isHost = state.currentUser?.isHost;

    return (
        <div className="flex flex-col items-center h-full p-4 md:p-8 bg-background overflow-y-auto">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-2xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="flex items-center gap-3 self-start md:self-auto">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition active:scale-95"
                            title="Back to Home"
                        >
                            <Home size={24} />
                        </button>
                        <h1 className="text-4xl md:text-3xl font-heading text-primary">Lobby</h1>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto justify-center md:justify-end">
                        <div
                            className="bg-secondary text-white px-4 py-2 rounded-lg font-bold text-lg md:text-base flex items-center gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-purple-600 shadow-sm"
                            onClick={handleCopyCode}
                            title="Copy Room Code"
                        >
                            <span>{code}</span>
                            {copiedCode ? <Check size={18} /> : <Copy size={18} />}
                        </div>
                        <div
                            className="bg-accent text-white px-4 py-2 rounded-lg font-bold text-lg md:text-base flex items-center gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-pink-600 shadow-sm"
                            onClick={handleCopyLink}
                            title="Copy Invite Link"
                        >
                            <Share2 size={18} />
                            <span className="hidden md:inline">Link</span>
                            {copiedLink ? <Check size={18} /> : null}
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-2xl md:text-xl mb-4 font-bold text-gray-700">Players ({state.players.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {state.players.map(p => (
                            <div key={p.id} className="flex items-center p-4 md:p-3 bg-gray-50 rounded-lg border shadow-sm">
                                <span className="text-4xl md:text-2xl mr-4 md:mr-3">{p.avatar}</span>
                                <span className="font-bold text-xl md:text-base text-gray-800 truncate">{p.username}</span>
                                {p.isHost && <span className="ml-auto text-yellow-500 text-2xl md:text-base">👑</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {isHost ? (
                    <button
                        onClick={handleStartGame}
                        className="w-full bg-accent text-white py-4 md:py-3 rounded-lg font-bold text-2xl md:text-xl hover:bg-red-500 transition shadow-lg active:scale-95 transform"
                    >
                        Start Game
                    </button>
                ) : (
                    <div className="text-center text-gray-500 animate-pulse text-lg md:text-base">
                        Waiting for host to start...
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lobby;
