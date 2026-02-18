import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DrawingCanvas } from '../components/Canvas/DrawingCanvas';
import { ChatBox } from '../components/Chat/ChatBox';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/types';

import { WordChoice } from '../components/Game/WordChoice';
import { VoiceControls } from '../components/Chat/VoiceControls';

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

            <div className="w-full md:w-3/4 flex flex-col h-[60%] md:h-full p-2 md:p-4">
                <div className="bg-white p-2 rounded-t-xl border-b flex justify-between items-center shadow-sm z-10 gap-2">
                    <div className="flex flex-col shrink-0">
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase font-bold hidden md:block">Room</span>
                        <h2 className="font-heading text-sm md:text-xl text-primary font-bold">{code}</h2>
                    </div>

                    <div className="flex-grow text-center px-1 overflow-hidden min-w-0 flex flex-col justify-center">
                        {state.wordToGuess && isDrawer ? (
                            <div className="text-sm md:text-2xl font-mono tracking-wide md:tracking-widest font-bold text-accent break-words leading-tight">
                                {state.wordToGuess}
                            </div>
                        ) : state.wordHint ? (
                            <div className="text-sm md:text-2xl font-mono tracking-widest font-bold text-gray-800 break-words leading-tight">
                                {state.wordHint}
                            </div>
                        ) : (
                            <div className="text-gray-400 italic text-xs md:text-base">Waiting...</div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <VoiceControls roomCode={code} username={state.currentUser?.username} />

                        {state.currentUser?.isHost && (
                            <button
                                onClick={() => {
                                    if (confirm('End game for everyone?')) {
                                        socket.emit(EVENTS.END_GAME_EARLY, { roomCode: code });
                                    }
                                }}
                                className="bg-[#D9443E] text-white px-4 py-1.5 rounded-3xl text-sm font-bold hover:bg-red-600 shadow-sm flex flex-col items-center justify-center leading-none min-h-[42px]"
                            >
                                <span>End</span>
                                <span>Game</span>
                            </button>
                        )}
                    </div>

                    <div className={`font-bold text-lg md:text-xl px-3 py-1 rounded-full whitespace-nowrap ${state.timer <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-primary'}`}>
                        ⏱ {state.timer}s
                    </div>
                </div>
                <div className="flex-grow bg-white rounded-b-xl shadow-md overflow-hidden relative">
                    <DrawingCanvas roomCode={code} isDrawer={isDrawer} />
                </div>
            </div>

            <div className="w-full md:w-1/4 h-[40%] md:h-full p-2 md:p-4 bg-white border-t md:border-t-0 md:border-l flex flex-col shadow-inner md:shadow-none z-20">
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
                {/* Mobile Player Summary */}
                <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide min-h-[50px] shrink-0">
                    {state.players.map(p => (
                        <div key={p.id} className="flex items-center bg-gray-50 rounded-full px-3 py-1 border shrink-0">
                            <span className="text-xl">{p.avatar}</span>
                            <div className="flex flex-col ml-2 leading-none">
                                <span className="text-xs font-bold truncate max-w-[80px]">{p.username}</span>
                                <span className="text-[10px] text-gray-500">{state.scores[p.id] || 0} pts</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex-grow min-h-0 flex flex-col">
                    <ChatBox roomCode={code} />
                </div>
            </div>
        </div>
    );
};

export default Game;
