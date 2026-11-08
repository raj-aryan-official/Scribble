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
import { RemoteAudio } from '../components/Chat/RemoteAudio';
import { ConfirmationModal } from '../components/UI/ConfirmationModal';

const Game = () => {
    const { code } = useParams();
    const { state } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();

    const {
        isMicOn,
        toggleMic,
        isDeafened,
        toggleDeafen,
        remoteStreams,
        peersCount,
        speakingPeers,
        isVoiceAllowed,
        voiceError,
        clearVoiceError,
        isAutoplayBlocked,
        setIsAutoplayBlocked,
        handleEnableSound
    } = useVoiceChat(code, state.currentUser?.username, state.players.length);

    // Modal State
    const [confirmModal, setConfirmModal] = React.useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDanger: false,
        confirmText: 'Confirm'
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    // Navigate to End Screen logic
    useEffect(() => {
        if (state.gameState === 'GAME_END') {
            navigate(`/end/${code}`);
        }
    }, [state.gameState, code, navigate]);

    // Keyboard detection
    const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);
    const [viewportHeight, setViewportHeight] = React.useState(window.visualViewport?.height || window.innerHeight);
    const [viewportOffsetTop, setViewportOffsetTop] = React.useState(window.visualViewport?.offsetTop || 0);

    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) {
                const currentHeight = window.visualViewport.height;
                const offsetTop = window.visualViewport.offsetTop;
                setViewportHeight(currentHeight);
                setViewportOffsetTop(offsetTop);
                // Keyboard is open when the visual viewport is significantly smaller
                const isSmall = currentHeight < (window.screen.height * 0.75);
                setIsKeyboardOpen(isSmall);
            }
        };

        window.visualViewport?.addEventListener('resize', handleResize);
        window.visualViewport?.addEventListener('scroll', handleResize);
        handleResize(); // Check initial

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    // Determine if current user is drawer
    const isDrawer = state.currentUser?.id === state.drawerId;

    // Derive isHost from the players list to handle host migration dynamically
    const me = state.players.find(p => p.id === state.currentUser?.id);
    const isHost = me?.isHost;

    const handleExit = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Leave Game?',
            message: 'Are you sure you want to exit? You will lose your current score.',
            confirmText: 'Leave',
            isDanger: true,
            onConfirm: () => {
                window.location.href = '/';
            }
        });
    };

    const handleEndGame = () => {
        setConfirmModal({
            isOpen: true,
            title: 'End Game?',
            message: 'Are you sure you want to end the game for everyone?',
            confirmText: 'End Game',
            isDanger: true,
            onConfirm: () => {
                socket.emit(EVENTS.END_GAME_EARLY, { roomCode: code });
            }
        });
    };

    return (
        <div className={`flex flex-col md:flex-row h-full bg-gray-100 overflow-hidden ${isKeyboardOpen ? 'pt-0' : 'pt-[72px] md:pt-0'}`}>
            {/* Managed Remote Audio Elements & Autoplay Prompt */}
            <RemoteAudio
                streams={remoteStreams}
                isDeafened={isDeafened}
                isAutoplayBlocked={isAutoplayBlocked}
                onAutoplayBlocked={setIsAutoplayBlocked}
                onEnableSound={handleEnableSound}
            />

            {/* Voice Error Notification Toast */}
            {voiceError && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 text-xs md:text-sm animate-fade-in border border-red-400">
                    <span>⚠️ {voiceError}</span>
                    <button
                        onClick={clearVoiceError}
                        className="text-white hover:text-gray-200 font-bold ml-2 cursor-pointer"
                        aria-label="Dismiss microphone error"
                    >
                        ✕
                    </button>
                </div>
            )}

            {!isKeyboardOpen && (
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
                    isVoiceAllowed={isVoiceAllowed}
                />
            )}

            {/* Main Game Area */}
            <div
                className="flex flex-col md:flex-row w-full overflow-hidden"
                style={isKeyboardOpen ? {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${viewportHeight}px`,
                    transform: `translateY(${viewportOffsetTop}px)`,
                    willChange: 'transform',
                } : { height: '100%', position: 'relative' }}
            >
                <div className={`w-full md:w-3/4 flex flex-col transition-all duration-200 ${isKeyboardOpen ? 'h-[60%] shrink-0' : 'h-[70%] md:h-full p-2 md:p-4'}`}>
                    {/* Header - Adaptive */}
                    <div className={`bg-white rounded-t-xl border-b flex justify-between items-center shadow-sm z-10 gap-2 shrink-0 ${isKeyboardOpen ? 'p-1 rounded-none border-t-0' : 'p-2'}`}>
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
                                <button onClick={handleExit} className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 text-red-500 transition-colors" title="Exit Game" aria-label="Exit Game">
                                    <LogOut size={20} />
                                </button>
                                <VoiceControls
                                    isMicOn={isMicOn}
                                    toggleMic={toggleMic}
                                    isDeafened={isDeafened}
                                    toggleDeafen={toggleDeafen}
                                    peersCount={peersCount}
                                    isVoiceAllowed={isVoiceAllowed}
                                />
                            </div>
                            {isHost && (
                                <div className="hidden md:block">
                                    <button onClick={handleEndGame} className="bg-[#D9443E] text-white px-4 py-1.5 rounded-3xl text-sm font-bold hover:bg-red-600 shadow-sm flex flex-col items-center justify-center leading-none min-h-[42px]" aria-label="End Game">
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
                                    {[...state.players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0)).map((p, idx) => (
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
                        {/* Canvas Area */}
                        <div className="w-full h-full flex flex-col min-h-0 bg-gray-50/50 overflow-hidden">
                            <DrawingCanvas roomCode={code} isDrawer={isDrawer} isKeyboardOpen={isKeyboardOpen} />
                        </div>
                    </div>
                </div>

                {/* Sidebar / Chat */}
                <div className={`w-full md:w-1/4 bg-white border-t md:border-t-0 md:border-l flex flex-col shadow-inner md:shadow-none z-20 transition-all duration-200 ${isKeyboardOpen ? 'h-auto shrink-0 border-t-2' : 'h-[30%] md:h-full p-2 md:p-4'}`}>
                    {/* Player List - Hidden when keyboard open */}
                    <div className={`hidden md:flex flex-col mb-4 max-h-[35%] shrink-0 overflow-hidden bg-gray-50 rounded-lg border border-gray-100 ${isKeyboardOpen ? '!hidden' : ''}`}>
                        <div className="p-2 border-b border-gray-100 bg-gray-100/50 flex justify-between items-center">
                            <h3 className="font-bold text-primary text-sm uppercase tracking-wide">Players</h3>
                            {peersCount > 0 && isVoiceAllowed && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">
                                    🎙️ Voice ({peersCount + (isMicOn ? 1 : 0)})
                                </span>
                            )}
                        </div>
                        <div className="overflow-y-auto p-2">
                            {state.players.map(p => {
                                const isSpeaking = Boolean(speakingPeers[p.id]);
                                return (
                                    <div
                                        key={p.id}
                                        className={`flex items-center text-sm mb-1 last:mb-0 p-1.5 rounded-md transition-all ${
                                            p.isDisconnected ? 'opacity-50 grayscale bg-gray-100' : ''
                                        } ${state.guessedPlayers.includes(p.id) ? 'bg-green-100 text-green-800 border-green-200' : 'hover:bg-gray-100'}`}
                                    >
                                        <span className={`text-lg transition-all rounded-full ${
                                            isSpeaking ? 'ring-2 ring-green-500 ring-offset-2 scale-110 shadow-sm' : ''
                                        }`}>
                                            {p.avatar}
                                        </span>
                                        <span className="ml-2 font-bold truncate max-w-[100px]">{p.username}</span>
                                        {isSpeaking && (
                                            <span className="ml-1 text-[10px] text-green-600 font-bold animate-pulse">●</span>
                                        )}
                                        {p.isDisconnected && (
                                            <span className="ml-1 text-[10px] bg-gray-200 text-gray-600 px-1 rounded">away</span>
                                        )}
                                        <span className="ml-auto font-mono text-gray-500 text-xs">{state.scores[p.id] || 0}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Mobile Player Summary - Hidden when keyboard open */}
                    <div className={`md:hidden flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide min-h-[50px] shrink-0 ${isKeyboardOpen ? '!hidden' : ''}`}>
                        {state.players.map(p => {
                            const isSpeaking = Boolean(speakingPeers[p.id]);
                            return (
                                <div
                                    key={p.id}
                                    className={`flex items-center rounded-full px-3 py-1 border shrink-0 transition-all ${
                                        p.isDisconnected
                                            ? 'opacity-50 grayscale bg-gray-100'
                                            : state.guessedPlayers.includes(p.id)
                                            ? 'bg-green-100 border-green-300'
                                            : 'bg-gray-50'
                                    } ${isSpeaking ? 'border-green-500 bg-green-50' : ''}`}
                                >
                                    <span className={`text-xl transition-all rounded-full ${
                                        isSpeaking ? 'ring-2 ring-green-500 ring-offset-1 scale-110' : ''
                                    }`}>
                                        {p.avatar}
                                    </span>
                                    <div className="flex flex-col ml-2 leading-none">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-bold truncate max-w-[80px]">{p.username}</span>
                                            {isSpeaking && <span className="text-[9px] text-green-600 font-bold">●</span>}
                                            {p.isDisconnected && <span className="text-[9px] bg-gray-200 text-gray-600 px-1 rounded">away</span>}
                                        </div>
                                        <span className="text-[10px] text-gray-500">{state.scores[p.id] || 0} pts</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex-grow min-h-0 flex flex-col relative">
                        <ChatBox roomCode={code} isCompact={isKeyboardOpen} />
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirmModal}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                isDanger={confirmModal.isDanger}
                confirmText={confirmModal.confirmText}
            />
        </div>
    );
};

export default Game;
