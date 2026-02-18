import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';

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

    const isHost = state.currentUser?.isHost;

    return (
        <div className="flex flex-col items-center h-full p-8 bg-background overflow-y-auto">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-heading text-primary">Lobby</h1>
                    <div className="bg-secondary text-white px-4 py-2 rounded-lg font-bold">
                        Code: {code}
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-xl mb-4 font-bold text-gray-700">Players ({state.players.length})</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {state.players.map(p => (
                            <div key={p.id} className="flex items-center p-3 bg-gray-50 rounded-lg border">
                                <span className="text-2xl mr-3">{p.avatar}</span>
                                <span className="font-bold text-gray-800">{p.username}</span>
                                {p.isHost && <span className="ml-auto text-yellow-500">👑</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {isHost ? (
                    <button
                        onClick={handleStartGame}
                        className="w-full bg-accent text-white py-3 rounded-lg font-bold text-xl hover:bg-red-500 transition shadow-lg"
                    >
                        Start Game
                    </button>
                ) : (
                    <div className="text-center text-gray-500 animate-pulse">
                        Waiting for host to start...
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lobby;
