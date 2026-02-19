import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DrawingCanvas } from '../components/Canvas/DrawingCanvas';
import { LogOut } from 'lucide-react';
import { ChatBox } from '../components/Chat/ChatBox';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { EVENTS } from '../../../shared/types';
import MobileNavBar from '../components/Game/MobileNavBar';

import { WordChoice } from '../components/Game/WordChoice';
import { VoiceControls } from '../components/Chat/VoiceControls';

const Game = () => {
    const { code } = useParams();
    const { state } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();
    const { isMicOn, toggleMic, isDeafened, toggleDeafen, peers } = useVoiceChat(code, state.currentUser?.username);

    // Navigate to End Screen logic
    useEffect(() => {
        if (state.gameState === 'GAME_END') {
            navigate(`/end/${code}`);
        }
    }, [state.gameState, code, navigate]);

    // Keyboard detection
    const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) {
                // If visual viewport is significantly smaller than window innerHeight, keyboard is likely open
                // Or just if height is very small (< 450px) which is typical for phones with keyboard
                const isSmall = window.visualViewport.height < 450;
                setIsKeyboardOpen(isSmall);
            }
        };

        window.visualViewport?.addEventListener('resize', handleResize);
        handleResize(); // Check initial

        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, []);

    // Determine if current user is drawer
    const isDrawer = state.currentUser?.id === state.drawerId;

    // Derive isHost from the players list to handle host migration dynamically
    const me = state.players.find(p => p.id === state.currentUser?.id);
    const isHost = me?.isHost;

    const handleExit = () => {
        if (confirm('Are you sure you want to exit?')) {
            window.location.href = '/'; // Hard reload to clear socket state
        }
    };

    const handleEndGame = () => {
        if (confirm('End game for everyone?')) {
            socket.emit(EVENTS.END_GAME_EARLY, { roomCode: code });
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-gray-100 overflow-hidden pt-[72px] md:pt-0">


            {/* Round End Overlay */}


            {/* Hidden Audio Elements for Peers - Rendered once at top level */}
            <div className="hidden">
                {peers.map(peerId => (
                    <audio
                        key={peerId}
                        id={`audio-${peerId}`}
                        autoPlay
                        playsInline
                        muted={isDeafened}
                    />
                ))}
            </div>

            <MobileNavBar
                roomCode={code}
                isMicOn={isMicOn}
                toggleMic={toggleMic}
                isDeafened={isDeafened}
                toggleDeafen={toggleDeafen}
                onExit={handleExit}
                onEndGame={handleEndGame}
                isHost={isHost}
                currentRound={state.currentRound}
                totalRounds={state.totalRounds}
            />

            {/* Main Game Area */}
            {/* Unified Layout to prevent Unmounting/Focus Loss */}
            <div
                className="flex flex-col md:flex-row w-full overflow-hidden"
                style={{ height: isKeyboardOpen ? viewportHeight : '100%', position: isKeyboardOpen ? 'fixed' : 'relative' }}
            >
                <div className={`w-full md:w-3/4 flex flex-col transition-all duration-200 ${isKeyboardOpen ? 'h-[60%] shrink-0' : 'h-[60%] md:h-full p-2 md:p-4'}`}>
                    {/* Header - Adaptive */}
                    <div className={`bg-white rounded-t-xl border-b flex justify-between items-center shadow-sm z-10 gap-2 shrink-0 ${isKeyboardOpen ? 'p-1 rounded-none border-t-0' : 'p-2'}`}>
                        {/* Header Content (Room, Round, Word/Hint, Timer) - Same as before */}
                        <div className="hidden md:flex flex-col shrink-0">
                            <span className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Room</span>
                            <h2 className="font-heading text-sm md:text-xl text-primary font-bold leading-none">{code}</h2>
                            <div className="mt-1 flex items-center gap-1">
                                <span className="text-[10px] md:text-xs text-secondary font-bold uppercase">Round</span>
                                <span className="font-bold text-sm text-gray-700">{state.currentRound} / {state.totalRounds}</span>
                            </div>
                        </div>

                        <div className="flex-grow text-left md:text-center px-1 overflow-hidden min-w-0 flex flex-col justify-center">
                            <div className="text-[10px] md:text-sm text-gray-500 font-bold mb-0.5 md:mb-1 truncate">
                                {isDrawer ? "You are drawing!" : `${state.players.find(p => p.id === state.drawerId)?.username || 'Someone'} is drawing...`}
                            </div>
                            {state.wordToGuess ? (
                                <div className={`font-mono font-bold text-accent break-words leading-tight ${isKeyboardOpen ? 'text-sm tracking-wide' : 'text-sm md:text-2xl tracking-wide md:tracking-widest'}`}>
                                    {state.wordToGuess}
                                </div>
                            ) : state.wordHint ? (
                                <div className={`font-mono font-bold text-gray-800 break-words leading-tight ${isKeyboardOpen ? 'text-sm tracking-wide' : 'text-sm md:text-2xl tracking-widest'}`}>
                                    {state.wordHint}
                                </div>
                            ) : (
                                <div className="text-gray-400 italic text-xs md:text-base">Waiting...</div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 md:gap-4 shrink-0">
                            <div className="hidden md:flex items-center gap-2">
                                <button onClick={handleExit} className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 text-red-500 transition-colors" title="Exit Game">
                                    <LogOut size={20} />
                                </button>
                                <VoiceControls isMicOn={isMicOn} toggleMic={toggleMic} isDeafened={isDeafened} toggleDeafen={toggleDeafen} peersCount={peers.length} />
                            </div>
                            {isHost && (
                                <div className="hidden md:block">
                                    <button onClick={handleEndGame} className="bg-[#D9443E] text-white px-4 py-1.5 rounded-3xl text-sm font-bold hover:bg-red-600 shadow-sm flex flex-col items-center justify-center leading-none min-h-[42px]">
                                        <span>End</span><span>Game</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className={`font-bold rounded-full whitespace-nowrap ${state.timer <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-primary'} ${isKeyboardOpen ? 'text-xs px-2 py-0.5' : 'text-lg md:text-xl px-3 py-1'}`}>
                            ⏱ {state.timer}s
                        </div>
                    </div>

                    {/* Standard Canvas Area */}
                    <div className={`flex-grow bg-white shadow-md overflow-hidden relative min-h-0 ${isKeyboardOpen ? 'rounded-none' : 'rounded-b-xl'}`}>
                        {/* Round End Overlay */}
                        {state.gameState === 'ROUND_END' && (
                            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 text-white flex-col p-4 animate-fade-in">
                                <h2 className="text-3xl md:text-4xl mb-2 font-heading text-primary bg-white px-6 py-2 rounded-full shadow-lg">Round Over!</h2>
                                <p className="text-xl md:text-2xl mb-4">The word was: <span className="text-accent font-bold bg-white px-3 py-1 rounded ml-2">{state.wordToGuess}</span></p>
                                <div className="bg-white/10 rounded-xl p-4 w-full max-w-sm overflow-y-auto max-h-[50%] mb-4 scrollbar-thin scrollbar-thumb-white scrollbar-track-transparent">
                                    <h3 className="text-lg font-bold mb-3 border-b border-white/20 pb-2">Scores</h3>
                                    {state.players.sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0)).map((p, idx) => (
                                        <div key={p.id} className="flex items-center justify-between mb-2 last:mb-0">
                                            <div className="flex items-center">
                                                <span className="w-6 text-center text-gray-400 font-mono text-sm">{idx + 1}.</span>
                                                <span className="ml-2 font-bold truncate max-w-[150px]">{p.username}</span>
                                            </div>
                                            <span className="font-bold text-accent bg-white px-2 py-0.5 rounded text-sm">{state.scores[p.id] || 0} pts</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="animate-pulse font-bold text-gray-300 text-sm">Next round starting soon...</p>
                            </div>
                        )}

                        <WordChoice roomCode={code} />
                        {/* Canvas Container that enforces Aspect Ratio */}
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <div className="w-full max-h-full aspect-video bg-white shadow-sm border border-gray-200 overflow-hidden">
                                <DrawingCanvas roomCode={code} isDrawer={isDrawer} isKeyboardOpen={isKeyboardOpen} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar / Chat */}
                <div className={`w-full md:w-1/4 bg-white border-t md:border-t-0 md:border-l flex flex-col shadow-inner md:shadow-none z-20 transition-all duration-200 ${isKeyboardOpen ? 'h-[40%] flex-grow border-t-2' : 'h-[40%] md:h-full p-2 md:p-4'}`}>
                    {/* Player List - Hidden when keyboard open */}
                    <div className={`hidden md:block mb-4 h-1/4 overflow-y-auto bg-gray-50 p-2 rounded ${isKeyboardOpen ? '!hidden' : ''}`}>
                        <h3 className="font-bold mb-2 text-primary">Players</h3>
                        {state.players.map(p => (
                            <div key={p.id} className={`flex items-center text-sm mb-1 p-1 rounded ${state.guessedPlayers.includes(p.id) ? 'bg-green-100 border border-green-300' : ''}`}>
                                <span>{p.avatar}</span>
                                <span className="ml-2 font-bold truncate max-w-[100px]">{p.username}</span>
                                <span className="ml-auto text-gray-500">{state.scores[p.id] || 0} pts</span>
                            </div>
                        ))}
                    </div>
                    {/* Mobile Player Summary - Hidden when keyboard open */}
                    <div className={`md:hidden flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide min-h-[50px] shrink-0 ${isKeyboardOpen ? '!hidden' : ''}`}>
                        {state.players.map(p => (
                            <div key={p.id} className={`flex items-center rounded-full px-3 py-1 border shrink-0 ${state.guessedPlayers.includes(p.id) ? 'bg-green-100 border-green-300' : 'bg-gray-50'}`}>
                                <span className="text-xl">{p.avatar}</span>
                                <div className="flex flex-col ml-2 leading-none">
                                    <span className="text-xs font-bold truncate max-w-[80px]">{p.username}</span>
                                    <span className="text-[10px] text-gray-500">{state.scores[p.id] || 0} pts</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex-grow min-h-0 flex flex-col justify-end">
                        {/* ChatBox stays mounted! */}
                        <ChatBox roomCode={code} isCompact={isKeyboardOpen} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Game;
