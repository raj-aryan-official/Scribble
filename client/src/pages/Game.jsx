import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DrawingCanvas } from '../components/Canvas/DrawingCanvas';
import { ChatBox } from '../components/Chat/ChatBox';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/types';

import { WordChoice } from '../components/Game/WordChoice';

const Game = () => {
    const { code } = useParams();
    const { state } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();

    // Navigate to End Screen logic
    useEffect(() => {
        if (state.gameState === 'GAME_END') {
            navigate(`/end/${code}`);
        }
    }, [state.gameState, code, navigate]);

    // Determine if current user is drawer
    const isDrawer = state.currentUser?.id === state.drawerId;

    return (
        <div className="flex flex-col md:flex-row h-full bg-gray-100 overflow-hidden">
            <WordChoice roomCode={code} />

            {/* Round End Overlay */}
            {state.gameState === 'ROUND_END' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 text-white flex-col">
                    <h2 className="text-4xl mb-4">Round Over!</h2>
                    <p className="text-2xl mb-2">The word was: <span className="text-accent font-bold">{state.wordToGuess}</span></p>
                    <p className="animate-pulse">Next round starting soon...</p>
                </div>
            )}

            <div className="w-full md:w-3/4 flex flex-col h-[65%] md:h-full p-2 md:p-4">
                <div className="bg-white p-2 rounded-t-xl border-b flex justify-between items-center shadow-sm z-10 gap-2">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase font-bold">Room</span>
                        <h2 className="font-heading text-xl text-primary font-bold">{code}</h2>
                    </div>

                    <div className="flex-grow text-center px-1 overflow-hidden">
                        {state.wordToGuess && isDrawer ? (
                            <div className="text-lg md:text-2xl font-mono tracking-widest font-bold text-accent truncate">
                                {state.wordToGuess}
                            </div>
                        ) : state.wordHint ? (
                            <div className="text-xl md:text-2xl font-mono tracking-widest font-bold text-gray-800">
                                {state.wordHint}
                            </div>
                        ) : (
                            <div className="text-gray-400 italic text-sm md:text-base">Waiting...</div>
                        )}
                    </div>

                    {state.currentUser?.isHost && (
                        <button
                            onClick={() => {
                                if (confirm('End game for everyone?')) {
                                    socket.emit(EVENTS.END_GAME_EARLY, { roomCode: code });
                                }
                            }}
                            className="mr-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold hover:bg-red-600 hidden md:block"
                        >
                            End Game
                        </button>
                    )}

                    <div className={`font-bold text-lg md:text-xl px-3 py-1 rounded-full whitespace-nowrap ${state.timer <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-primary'}`}>
                        ⏱ {state.timer}s
                    </div>
                </div>
                <div className="flex-grow bg-white rounded-b-xl shadow-md overflow-hidden relative">
                    <DrawingCanvas roomCode={code} isDrawer={isDrawer} />
                </div>
            </div>

            <div className="w-full md:w-1/4 h-[35%] md:h-full p-2 md:p-4 bg-white border-t md:border-t-0 md:border-l flex flex-col shadow-inner md:shadow-none z-20">
                <div className="hidden md:block mb-4 h-1/4 overflow-y-auto bg-gray-50 p-2 rounded">
                    <h3 className="font-bold mb-2 text-primary">Players</h3>
                    {state.players.map(p => (
                        <div key={p.id} className="flex items-center text-sm mb-1">
                            <span>{p.avatar}</span>
                            <span className="ml-2 font-bold truncate max-w-[100px]">{p.username}</span>
                            <span className="ml-auto text-gray-500">{state.scores[p.id] || 0} pts</span>
                        </div>
                    ))}
                </div>
                {/* Mobile Player Summary (Top Bar equivalent or small pill) - optional MVP optimization */}
                <div className="flex-grow min-h-0">
                    <ChatBox roomCode={code} />
                </div>
            </div>
        </div>
    );
};

export default Game;
