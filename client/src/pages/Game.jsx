import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useCanvas } from '../hooks/useCanvas';
import { useSound } from '../hooks/useSound';
import { EVENTS } from '../../../shared/types';

import TopBar from '../components/Game/TopBar';
import PlayerList from '../components/Game/PlayerList';
import HintTiles from '../components/Game/HintTiles';
import TimerBar from '../components/Game/TimerBar';
import ToolTray from '../components/Game/ToolTray';
import GuessPanel from '../components/Game/GuessPanel';
import WordChoice from '../components/Game/WordChoice';
import RoundEndOverlay from '../components/Game/RoundEndOverlay';
import EdgeState, { mapErrorToEdgeState } from '../components/Game/EdgeState';
import { RemoteAudio } from '../components/Chat/RemoteAudio';

export const Game = () => {
    const { code } = useParams();
    const { state, dispatch } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();
    const { isMuted, toggleMute, play } = useSound();

    const [canvasWidth, setCanvasWidth] = useState(800);
    const lastTickSecondRef = useRef(null);

    // Current player roles
    const myId = state.currentUser?.id;
    const isDrawer = Boolean(myId && myId === state.drawerId);
    const me = state.players.find((p) => p.id === myId);
    const isHost = Boolean(me?.isHost);

    // Canvas management
    const {
        canvasRef,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onPointerEnter,
        onPointerLeave,
        setColor,
        setLineWidth,
        setTool,
        clearCanvas,
        undo,
        color,
        lineWidth,
        tool,
        cursorPos,
        isCursorInside,
    } = useCanvas(code, isDrawer);

    // WebRTC Voice chat
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
        isAutoplayBlocked,
        setIsAutoplayBlocked,
        handleEnableSound,
    } = useVoiceChat(code, state.currentUser?.username, state.players.length);

    // Measure canvas element width for cursor ring scaling
    useEffect(() => {
        const updateWidth = () => {
            if (canvasRef.current?.clientWidth) {
                setCanvasWidth(canvasRef.current.clientWidth);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [canvasRef]);

    // Navigate to End Screen on game finish
    useEffect(() => {
        if (state.gameState === 'GAME_END') {
            navigate(`/end/${code}`);
        }
    }, [state.gameState, code, navigate]);

    // Sound effects for game events
    useEffect(() => {
        if (!socket) return;

        const handleCorrectGuess = (payload) => {
            play('correct');
            dispatch({ type: 'CORRECT_GUESS', payload });
        };

        const handleRoundEnded = (payload) => {
            play('roundEnd');
            dispatch({ type: 'ROUND_ENDED', payload });
        };

        socket.on(EVENTS.CORRECT_GUESS, handleCorrectGuess);
        socket.on(EVENTS.ROUND_ENDED, handleRoundEnded);

        return () => {
            socket.off(EVENTS.CORRECT_GUESS, handleCorrectGuess);
            socket.off(EVENTS.ROUND_ENDED, handleRoundEnded);
        };
    }, [socket, play, dispatch]);

    // Tick sound for the last 5 seconds of the drawing round
    useEffect(() => {
        if (state.gameState !== 'DRAWING') return;

        const currentSeconds = state.timer;
        if (
            currentSeconds > 0 &&
            currentSeconds <= 5 &&
            lastTickSecondRef.current !== currentSeconds
        ) {
            lastTickSecondRef.current = currentSeconds;
            play('tick');
        }
    }, [state.timer, state.gameState, play]);

    const handleExit = () => {
        window.location.href = '/';
    };

    const handleEndGameEarly = () => {
        if (socket && isHost) {
            socket.emit(EVENTS.END_GAME_EARLY, { roomCode: code });
        }
    };

    // Edge state check (kicked, disconnected, room not found, mic denied)
    const edgeStateType = mapErrorToEdgeState(state.error || (voiceError ? 'mic' : null));
    if (edgeStateType && edgeStateType !== 'RECONNECTING') {
        return (
            <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-paper">
                <EdgeState
                    type={edgeStateType}
                    onAction={handleExit}
                    actionText="Back to Home"
                />
            </div>
        );
    }

    const displayRingDiameter = Math.max(4, Math.round(lineWidth * (canvasWidth / 800)));
    const totalDrawTime = state.settings?.drawTime || 60;

    return (
        <div className="h-[100dvh] w-full bg-paper flex flex-col overflow-hidden select-none p-2 sm:p-3 md:p-4 gap-2 sm:gap-3">
            {/* Managed Remote Audio Elements & Autoplay Prompt */}
            <RemoteAudio
                streams={remoteStreams}
                isDeafened={isDeafened}
                isAutoplayBlocked={isAutoplayBlocked}
                onAutoplayBlocked={setIsAutoplayBlocked}
                onEnableSound={handleEnableSound}
            />

            {/* Overlays */}
            <WordChoice roomCode={code} />

            {/* Top Navigation Bar */}
            <TopBar
                roomCode={code}
                currentRound={state.currentRound}
                totalRounds={state.totalRounds}
                isHost={isHost}
                onExit={handleExit}
                onEndGameEarly={handleEndGameEarly}
                isMuted={isMuted}
                toggleMute={toggleMute}
                voiceState={{
                    isMicOn,
                    toggleMic,
                    isDeafened,
                    toggleDeafen,
                    peersCount,
                    isVoiceAllowed,
                }}
            />

            {/* Main In-Game Area */}
            <div className="flex-1 w-full min-h-0 flex flex-col md:flex-row gap-2 sm:gap-3 overflow-hidden">
                {/* Desktop Left Column: Ranked Player Scoreboard */}
                <div className="hidden md:flex w-56 lg:w-64 h-full shrink-0">
                    <PlayerList
                        players={state.players}
                        scores={state.scores}
                        drawerId={state.drawerId}
                        guessedPlayerIds={state.guessedPlayers}
                        speakingPeers={speakingPeers}
                        variant="desktop"
                    />
                </div>

                {/* Phone Top Strip: Player Avatars & Score Chips */}
                <div className="flex md:hidden w-full shrink-0">
                    <PlayerList
                        players={state.players}
                        scores={state.scores}
                        drawerId={state.drawerId}
                        guessedPlayerIds={state.guessedPlayers}
                        speakingPeers={speakingPeers}
                        variant="mobile"
                    />
                </div>

                {/* Center Column: Hint Tiles + 4:3 Paper Canvas + Tool Tray */}
                <main className="flex-1 min-h-0 flex flex-col items-center justify-between gap-2 overflow-hidden">
                    {/* Word Hint Tiles Header */}
                    <div className="w-full shrink-0">
                        <HintTiles
                            word={state.wordToGuess}
                            hint={state.wordHint}
                            isDrawer={isDrawer}
                        />
                    </div>

                    {/* Fixed 4:3 Letterboxed Paper Canvas */}
                    <div
                        className="w-full flex-1 min-h-0 flex items-center justify-center p-0.5 overflow-hidden"
                        style={{ containerType: 'size' }}
                    >
                        <div
                            className="relative bg-card rounded-[12px] border-2 border-ink shadow-hard overflow-hidden flex flex-col items-center justify-center"
                            style={{
                                aspectRatio: '4 / 3',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                width: 'min(100cqw, calc(100cqh * 4 / 3))',
                                height: 'min(100cqh, calc(100cqw * 3 / 4))',
                            }}
                        >
                            {/* Draining Ink Timer Bar Across Top of Paper */}
                            <TimerBar
                                roundEndsAt={state.roundEndsAt}
                                totalTime={totalDrawTime}
                                timeLeft={state.timer}
                            />

                            {/* Canvas Element */}
                            <div className="relative flex-1 w-full h-full min-h-0">
                                <canvas
                                    ref={canvasRef}
                                    onPointerDown={onPointerDown}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={onPointerUp}
                                    onPointerCancel={onPointerCancel}
                                    onPointerEnter={onPointerEnter}
                                    onPointerLeave={onPointerLeave}
                                    className={`w-full h-full block touch-none select-none ${
                                        isDrawer ? 'cursor-none' : 'cursor-default'
                                    }`}
                                    style={{ touchAction: 'none' }}
                                />

                                {/* Drawer Brush Size Ring Cursor */}
                                {isDrawer && isCursorInside && (
                                    <div
                                        className="pointer-events-none absolute rounded-full border-2 border-ink -translate-x-1/2 -translate-y-1/2 z-30 transition-none"
                                        style={{
                                            left: cursorPos.x,
                                            top: cursorPos.y,
                                            width: displayRingDiameter,
                                            height: displayRingDiameter,
                                            backgroundColor:
                                                tool === 'eraser'
                                                    ? 'rgba(251, 246, 234, 0.7)'
                                                    : `${color}33`,
                                        }}
                                    />
                                )}

                                {/* Round End Overlay (Dims the paper, shows secret word & point counts) */}
                                {state.gameState === 'ROUND_END' && (
                                    <RoundEndOverlay
                                        word={state.wordToGuess}
                                        scores={state.scores}
                                        gained={state.roundGained || {}}
                                        players={state.players}
                                        duration={5}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Drawer Tool Tray (below the 4:3 paper) */}
                    {isDrawer && (
                        <div className="w-full shrink-0">
                            <ToolTray
                                tool={tool}
                                setTool={setTool}
                                lineWidth={lineWidth}
                                setLineWidth={setLineWidth}
                                color={color}
                                setColor={setColor}
                                undo={undo}
                                clearCanvas={clearCanvas}
                            />
                        </div>
                    )}

                    {/* Mobile Pinned Guess Input with Bottom Sheet for Chat */}
                    <div className="flex md:hidden w-full shrink-0 mt-auto">
                        <GuessPanel roomCode={code} isMobile={true} />
                    </div>
                </main>

                {/* Desktop Right Column: Chat & Guess Panel */}
                <div className="hidden md:flex w-72 lg:w-80 h-full shrink-0">
                    <GuessPanel roomCode={code} isMobile={false} />
                </div>
            </div>
        </div>
    );
};

export default Game;
