import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useCanvas } from '../hooks/useCanvas';
import { useSound } from '../hooks/useSound';
import { useSettings } from '../context/SettingsContext';
import { EVENTS } from '../../../shared/types';
import { EyeOff, Zap } from 'lucide-react';

import PlayerList from '../components/Game/PlayerList';
import GameBar from '../components/Game/GameBar';
import TimerBar from '../components/Game/TimerBar';
import ToolTray from '../components/Canvas/ToolTray';
import PaperStage from '../components/Canvas/PaperStage';
import GuessPanel from '../components/Game/GuessPanel';
import WordChoice from '../components/Game/WordChoice';
import RoundEndOverlay from '../components/Game/RoundEndOverlay';
import TurnWaitOverlay from '../components/Game/TurnWaitOverlay';
import PausedOverlay from '../components/Game/PausedOverlay';
import GameStartCountdown from '../components/Game/GameStartCountdown';
import TurnIntro from '../components/Game/TurnIntro';
import ScoringCoachmark from '../components/Game/ScoringCoachmark';
import AutoPickedBanner from '../components/Game/AutoPickedBanner';
import MidRoundBanner from '../components/Game/MidRoundBanner';
import EdgeState, { mapErrorToEdgeState } from '../components/Game/EdgeState';
import { RemoteAudio } from '../components/Chat/RemoteAudio';
import { audioManager } from '../audio/manager';
import { Heart } from 'lucide-react';
import FloatingReactions from '../components/Reactions/FloatingReactions';
import ReactionBar from '../components/Reactions/ReactionBar';

export const Game = () => {
    const { code } = useParams();
    const { state, dispatch } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();
    const { play } = useSound();
    const { settings } = useSettings();

    const [canvasWidth, setCanvasWidth] = useState(800);
    const lastTickSecondRef = useRef(null);

    const [showCountdown, setShowCountdown] = useState(() => {
        return Boolean(state.startsAt && Date.now() < state.startsAt);
    });
    const [showTurnIntro, setShowTurnIntro] = useState(false);
    const [cardsReady, setCardsReady] = useState(false);
    const lastDrawerTurnRef = useRef(null);

    // Current player roles
    const myId = state.currentUser?.id;
    const isDrawer = Boolean(myId && myId === state.drawerId);
    const isHost = Boolean(state.currentUser?.isHost);
    const drawer = state.players.find((p) => p.id === state.drawerId);

    const handleSkipRoundEnd = useCallback(() => {
        if (isHost && socket) {
            socket.emit(EVENTS.SKIP_ROUND_END, { roomCode: code });
        }
    }, [isHost, socket, code]);

    const [localReaction, setLocalReaction] = useState(null);
    const [localLike, setLocalLike] = useState(false);

    // Reset local reaction/like on new turn
    useEffect(() => {
        setLocalReaction(null);
        setLocalLike(false);
    }, [state.turnId]);

    const handleReact = useCallback((kind) => {
        if (!socket || !code || isDrawer) return;
        socket.emit(EVENTS.REACT, {
            roomCode: code,
            turnId: state.turnId,
            kind
        });
        setLocalReaction({ kind, ts: Date.now() });
    }, [socket, code, isDrawer, state.turnId]);

    const handleLike = useCallback(() => {
        if (!socket || !code || isDrawer || state.hasLiked) return;
        socket.emit(EVENTS.LIKE_DRAWING, {
            roomCode: code,
            turnId: state.turnId
        });
        dispatch({ type: 'SET_LOCAL_LIKED' });
        setLocalLike(true);
    }, [socket, code, isDrawer, state.hasLiked, state.turnId, dispatch]);

    // Sync countdown when startsAt is set
    useEffect(() => {
        if (state.startsAt && Date.now() < state.startsAt) {
            setShowCountdown(true);
            setShowTurnIntro(false);
            setCardsReady(false);
        }
    }, [state.startsAt]);

    // Turn intro trigger on new turn
    useEffect(() => {
        if (state.gameState !== 'WORD_SELECTION') {
            setShowTurnIntro(false);
            setCardsReady(false);
            return;
        }

        const turnKey = `${state.currentRound}-${state.drawerId}`;
        if (lastDrawerTurnRef.current !== turnKey) {
            lastDrawerTurnRef.current = turnKey;

            // If countdown is active, wait until startsAt
            if (state.startsAt && Date.now() < state.startsAt) {
                const waitMs = state.startsAt - Date.now();
                const timer = setTimeout(() => {
                    setShowCountdown(false);
                    setShowTurnIntro(true);
                    setCardsReady(false);
                }, waitMs);
                return () => clearTimeout(timer);
            } else {
                setShowCountdown(false);
                setShowTurnIntro(true);
                setCardsReady(false);
            }
        }
    }, [state.gameState, state.currentRound, state.drawerId, state.startsAt]);

    // Canvas management
    const {
        canvasRef,
        getStrokes,
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
        strokeCount,
        inkRemaining,
    } = useCanvas(code, isDrawer, state.currentTwist);

    const [showBlindfold, setShowBlindfold] = useState(false);
    useEffect(() => {
        if (!isDrawer || state.currentTwist?.id !== 'blindfold' || state.gameState !== 'DRAWING') {
            setShowBlindfold(false);
            return;
        }
        const timer = setTimeout(() => {
            setShowBlindfold(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, [isDrawer, state.currentTwist?.id, state.gameState]);

    // Prevent accidental pull-to-refresh on mobile while on Game page
    useEffect(() => {
        if (typeof document !== 'undefined' && document.body) {
            document.body.style.overscrollBehaviorY = 'contain';
            return () => {
                document.body.style.overscrollBehaviorY = 'auto';
            };
        }
    }, []);

    // Warn drawer before leaving while actively drawing
    useEffect(() => {
        if (!isDrawer || state.gameState !== 'DRAWING') return;

        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = 'Leave drawing? Your progress will be lost.';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDrawer, state.gameState]);

    // WebRTC Voice chat
    const voiceChat = useVoiceChat(code, state.currentUser?.username, state.players.length);
    const {
        isDeafened,
        remoteStreams,
        speakingPeers,
        isAutoplayBlocked,
        setIsAutoplayBlocked,
        handleEnableSound,
    } = voiceChat;

    // Audio ducking: lower other sound volumes while someone speaks on voice
    useEffect(() => {
        const someoneSpeaking = Object.values(speakingPeers || {}).some(Boolean);
        audioManager.setDucking(someoneSpeaking);
        return () => {
            audioManager.setDucking(false);
        };
    }, [speakingPeers]);

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
            if (payload.playerId === state.currentUser?.id) {
                play('correct');
            } else {
                play('joinPop');
            }
            dispatch({ type: 'CORRECT_GUESS', payload });
        };

        const handleRoundEnded = (payload) => {
            dispatch({ type: 'ROUND_ENDED', payload });
        };

        socket.on(EVENTS.CORRECT_GUESS, handleCorrectGuess);
        socket.on(EVENTS.ROUND_ENDED, handleRoundEnded);

        return () => {
            socket.off(EVENTS.CORRECT_GUESS, handleCorrectGuess);
            socket.off(EVENTS.ROUND_ENDED, handleRoundEnded);
        };
    }, [socket, play, dispatch, state.currentUser?.id]);

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

    // Edge state check (kicked, room not found, closed, host ended, not enough players)
    const edgeStateType = mapErrorToEdgeState(state.error);
    if (edgeStateType && edgeStateType !== 'RECONNECTING') {
        const handleSeeScores = () => {
            const roomCodeStr = state.roomCode || code;
            window.location.href = `/end/${roomCodeStr}`;
        };
        const handleBackToLobby = () => {
            const roomCodeStr = state.roomCode || code;
            window.location.href = `/lobby/${roomCodeStr}`;
        };

        let onAction = handleExit;
        if (edgeStateType === 'HOST_ENDED') onAction = handleSeeScores;
        if (edgeStateType === 'NOT_ENOUGH_PLAYERS') onAction = handleBackToLobby;

        return (
            <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-paper">
                <EdgeState
                    type={edgeStateType}
                    onAction={onAction}
                    onSecondaryAction={handleExit}
                />
            </div>
        );
    }

    const displayRingDiameter = Math.max(4, Math.round(lineWidth * (canvasWidth / 800)));
    const totalDrawTime = state.settings?.drawTime || 60;
    const myPlayerIndex = state.players.findIndex((p) => p.id === myId);
    const myTurnNumber = myPlayerIndex >= 0 ? myPlayerIndex + 1 : state.players.length;

    return (
        <div className="game-viewport-container w-full bg-paper grid grid-rows-[auto_minmax(0,1fr)] select-none overflow-x-hidden overflow-y-hidden min-h-0">
            <h1 tabIndex={-1} className="sr-only">
                Round {state.currentRound || 1} of {state.totalRounds || state.settings?.rounds || 3}
            </h1>

            {/* Rebuilt Game Navigation & Controls Bar */}
            <GameBar
                roomCode={code}
                voiceState={voiceChat}
                onExit={handleExit}
                onEndGameEarly={() => {
                    if (socket && code) {
                        socket.emit(EVENTS.END_GAME_EARLY, { roomCode: code });
                    }
                }}
            />

            {/* Managed Remote Audio Elements & Autoplay Prompt */}
            <RemoteAudio
                streams={remoteStreams}
                isDeafened={isDeafened}
                isAutoplayBlocked={isAutoplayBlocked}
                onAutoplayBlocked={setIsAutoplayBlocked}
                onEnableSound={handleEnableSound}
            />

            {/* Main In-Game Area: Responsive flex layout for Portrait, Landscape, and Desktop */}
            <div
                data-testid="game-main-area"
                data-layout={settings.leftHandedLayout ? 'left-handed' : 'right-handed'}
                className="flex-1 w-full min-h-0 flex flex-col md:flex-row landscape:flex-row gap-1 sm:gap-2 lg:gap-2 p-0 sm:p-2 lg:p-2 overflow-hidden"
            >
                {/* Desktop Left Column: Ranked Player Scoreboard */}
                <div className="hidden 2xl:flex w-52 2xl:w-56 h-full shrink-0">
                    <PlayerList
                        players={state.players}
                        scores={state.scores}
                        drawerId={state.drawerId}
                        guessedPlayerIds={state.guessedPlayers}
                        speakingPeers={speakingPeers}
                        turnInfo={state.turnInfo}
                        variant="desktop"
                    />
                </div>

                {/* Vertical tool rail: desktop and short-landscape phones (saves height for the paper) */}
                {isDrawer && (
                    <div className="hidden lg:flex landscape:flex h-full shrink-0">
                        <ToolTray
                            orientation="vertical"
                            tool={tool}
                            setTool={setTool}
                            lineWidth={lineWidth}
                            setLineWidth={setLineWidth}
                            color={color}
                            setColor={setColor}
                            undo={undo}
                            clearCanvas={clearCanvas}
                            twist={state.currentTwist}
                        />
                    </div>
                )}

                {/* Center Main Area: Paper Canvas, Hint Tiles, Tool Tray */}
                <main className="flex-1 w-full min-w-0 min-h-0 flex flex-col items-center justify-between gap-1 sm:gap-2 overflow-hidden landscape:h-full">
                    {/* Joined mid-round quiet banner */}
                    {state.joinedMidRound && (
                        <div className="w-full shrink-0">
                            <MidRoundBanner
                                turnNumber={myTurnNumber}
                                onDismiss={() => dispatch({ type: 'DISMISS_MID_ROUND' })}
                            />
                        </div>
                    )}

                    {/* First Game Scoring Coachmark */}
                    <div className="w-full shrink-0 landscape:hidden">
                        <ScoringCoachmark />
                    </div>

                    {/* 3. Measured 4:3 paper: the largest rectangle that fits the stage */}
                    <PaperStage className="flex-1 min-h-0" paperClassName="rounded-[12px]">
                        {/* Draining Ink Timer Bar Across Top of Paper */}
                        <TimerBar
                            className="absolute inset-x-0 top-0 z-elevated"
                            roundEndsAt={state.roundEndsAt}
                            totalTime={totalDrawTime}
                            timeLeft={state.timer}
                        />

                        {/* Limited Ink Bar for Drawer */}
                        {isDrawer && state.currentTwist?.id === 'limited-ink' && (
                            <div
                                data-testid="ink-bar"
                                className="absolute inset-x-0 top-2 z-elevated w-full flex items-center gap-2 px-3 py-1 bg-paper border-b-2 border-ink shadow-hard-xs select-none"
                            >
                                <span className="text-[11px] font-black uppercase tracking-wider text-ink shrink-0 flex items-center gap-1">
                                    <Zap className="w-3.5 h-3.5 text-cobalt" />
                                    Ink: {Math.max(0, Math.round(((inkRemaining ?? 1200) / 1200) * 100))}%
                                </span>
                                <div className="flex-1 h-2 bg-card border border-ink/40 rounded-full overflow-hidden p-0.5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-150 ${
                                            (inkRemaining ?? 1200) <= 300 ? 'bg-tomato' : 'bg-cobalt'
                                        }`}
                                        style={{
                                            width: `${Math.max(0, Math.min(100, ((inkRemaining ?? 1200) / 1200) * 100))}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Canvas and overlays fill the paper exactly */}
                        <div className="absolute inset-0 z-0 overflow-hidden">
                                <canvas
                                    ref={canvasRef}
                                    data-testid="canvas-element"
                                    role="img"
                                    aria-label={
                                        isDrawer
                                            ? 'Drawing paper. Sketch your secret word.'
                                            : `Drawing in progress by ${drawer?.username || 'Maya'}`
                                    }
                                    onPointerDown={onPointerDown}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={onPointerUp}
                                    onPointerCancel={onPointerCancel}
                                    onPointerEnter={onPointerEnter}
                                    onPointerLeave={onPointerLeave}
                                    className={`w-full h-full block touch-none select-none canvas-paper ${
                                        isDrawer ? 'cursor-none' : 'cursor-default'
                                    }`}
                                    style={{
                                        touchAction: 'none',
                                        transform: (isDrawer && state.currentTwist?.id === 'upside-down') ? 'rotate(180deg)' : undefined
                                    }}
                                />

                                {/* Paper Grid Overlay */}
                                {settings.paperGrid && (
                                    <div
                                        data-testid="paper-grid"
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-0 z-0 opacity-15"
                                        style={{
                                            backgroundImage:
                                                'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                                            backgroundSize: '24px 24px',
                                        }}
                                    />
                                )}

                                {/* Faint Start Drawing Prompt (fades out on first stroke) */}
                                {isDrawer && strokeCount === 0 && state.gameState === 'DRAWING' && (
                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center select-none transition-opacity duration-300"
                                        data-testid="empty-canvas-prompt"
                                    >
                                        <span className="text-sm sm:text-base font-bold font-heading text-ink-soft italic tracking-wide">
                                            Start drawing. No letters or numbers!
                                        </span>
                                    </div>
                                )}

                                {/* Blindfold Overlay for Drawer */}
                                {isDrawer && showBlindfold && state.currentTwist?.id === 'blindfold' && (
                                    <div
                                        data-testid="blindfold-overlay"
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-0 bg-ink/95 z-20 flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn"
                                    >
                                        <EyeOff className="w-12 h-12 text-marigold mb-2" />
                                        <h3 className="text-xl font-heading font-black text-paper">Blindfold Active!</h3>
                                        <p className="text-xs font-bold text-paper/80 mt-1 max-w-xs">
                                            Keep drawing from memory! Your strokes are streaming to the guessers.
                                        </p>
                                    </div>
                                )}

                                {/* Game Start Countdown ('3, 2, 1' large numerals on paper) */}
                                {showCountdown && (
                                    <GameStartCountdown
                                        startsAt={state.startsAt}
                                        onComplete={() => {
                                            setShowCountdown(false);
                                            setShowTurnIntro(true);
                                        }}
                                    />
                                )}

                                {/* Turn Intro Card ('Round 1 of 3', 'Maya is up') */}
                                {showTurnIntro && !showCountdown && (
                                    <TurnIntro
                                        round={state.currentRound || 1}
                                        totalRounds={state.totalRounds || state.settings?.rounds || 3}
                                        drawer={drawer}
                                        twist={state.currentTwist}
                                        onOverlap={() => setCardsReady(true)}
                                        onComplete={() => setShowTurnIntro(false)}
                                    />
                                )}

                                {/* Word Choice (Drawer 3 cards or Spectator tip/bob) */}
                                {state.gameState === 'WORD_SELECTION' && !showCountdown && (
                                    <WordChoice
                                        roomCode={code}
                                        cardsReady={cardsReady || !showTurnIntro}
                                    />
                                )}

                                {/* Auto-Picked Notice ('Picked for you: GUITAR') */}
                                {state.autoPickedWord && isDrawer && (
                                    <AutoPickedBanner
                                        word={state.autoPickedWord}
                                        onDismiss={() => dispatch({ type: 'CLEAR_AUTO_PICKED' })}
                                    />
                                )}

                                {/* Drawer Brush Size Ring Cursor */}
                                {isDrawer && isCursorInside && !showBlindfold && (
                                    <div
                                        className="pointer-events-none absolute rounded-full border-2 border-ink -translate-x-1/2 -translate-y-1/2 z-cursor transition-none"
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

                                {/* Floating Reactions Overlay */}
                                <FloatingReactions
                                    incomingBatch={state.incomingReactionBatch}
                                    localReaction={localReaction}
                                    localLike={localLike}
                                />

                                {/* Drawer Live Likes Counter */}
                                {isDrawer && state.gameState === 'DRAWING' && (
                                    <div
                                        data-testid="drawer-likes-counter"
                                        className="absolute top-2.5 right-2.5 z-30 pointer-events-none flex items-center gap-1.5 bg-paper/95 border-2 border-ink shadow-hard-xs rounded-full px-2.5 py-1 font-heading font-black text-xs text-ink select-none"
                                    >
                                        <Heart className="w-3.5 h-3.5 fill-tomato text-tomato animate-pulse" />
                                        <span>Likes {state.likesCount || 0}</span>
                                    </div>
                                )}

                                {/* Round End Overlay (Dims the paper, shows secret word & point counts) */}
                                {state.gameState === 'ROUND_END' && (
                                    <RoundEndOverlay
                                        word={state.wordToGuess}
                                        scores={state.scores}
                                        gained={state.roundGained || {}}
                                        gains={state.roundEndData?.gains}
                                        fastestGuesserId={state.roundEndData?.fastestGuesserId}
                                        drawerBonus={state.roundEndData?.drawerBonus || 0}
                                        drawerId={state.drawerId}
                                        nextDrawerId={state.roundEndData?.nextDrawerId}
                                        nextDrawerName={state.roundEndData?.nextDrawerName}
                                        nextDrawerAvatar={state.roundEndData?.nextDrawerAvatar}
                                        strokes={state.roundEndData?.strokes?.length ? state.roundEndData.strokes : (getStrokes?.() || [])}
                                        players={state.players}
                                        duration={5}
                                        isHost={isHost}
                                        reason={state.roundEndData?.reason}
                                        departedDrawerName={state.roundEndData?.drawerName}
                                        likesCount={state.roundEndData?.likesCount ?? state.likesCount ?? 0}
                                        topReaction={state.roundEndData?.topReaction ?? state.topReaction}
                                        onSkip={handleSkipRoundEnd}
                                    />
                                )}

                                {/* TURN_WAIT Phase ('Waiting for Maya to reconnect (6s)') */}
                                {(state.gameState === 'TURN_WAIT' || state.turnWait) && (
                                    <TurnWaitOverlay
                                        waitingFor={state.turnWait?.waitingFor || drawer?.username || 'Player'}
                                        endsAt={state.turnWait?.endsAt}
                                    />
                                )}

                                {/* PAUSED Phase ('Waiting for players to return.') */}
                                {(state.gameState === 'PAUSED' || state.isPaused) && (
                                    <PausedOverlay
                                        endsAt={state.pausedData?.endsAt}
                                        timeout={state.pausedData?.timeout || 60}
                                        players={state.players}
                                        scores={state.scores}
                                        isHost={isHost}
                                        onEndGame={() => {
                                            if (socket && code) {
                                                socket.emit(EVENTS.END_GAME_EARLY, { roomCode: code });
                                            }
                                        }}
                                    />
                                )}
                        </div>
                    </PaperStage>

                    {/* 4. Player Strip, 56 px (Portrait phones and tablets only) */}
                    <div className="flex lg:hidden landscape:hidden w-full h-[56px] min-h-[56px] max-h-[56px] shrink-0">
                        <PlayerList
                            players={state.players}
                            scores={state.scores}
                            drawerId={state.drawerId}
                            guessedPlayerIds={state.guessedPlayers}
                            speakingPeers={speakingPeers}
                            turnInfo={state.turnInfo}
                            variant="mobile"
                        />
                    </div>

                    {/* 5. Bottom Area (Portrait phones and tablets: Drawer ToolTray or Guesser ReactionBar + GuessPanel) */}
                    <div className="flex lg:hidden landscape:hidden w-full shrink-0 flex-col gap-1.5">
                        {isDrawer ? (
                            <ToolTray
                                tool={tool}
                                setTool={setTool}
                                lineWidth={lineWidth}
                                setLineWidth={setLineWidth}
                                color={color}
                                setColor={setColor}
                                undo={undo}
                                clearCanvas={clearCanvas}
                                twist={state.currentTwist}
                            />
                        ) : (
                            <>
                                {state.gameState === 'DRAWING' && (
                                    <ReactionBar
                                        onReact={handleReact}
                                        onLike={handleLike}
                                        hasLiked={state.hasLiked}
                                        disabled={state.gameState !== 'DRAWING'}
                                    />
                                )}
                                <GuessPanel roomCode={code} isMobile={true} />
                            </>
                        )}
                    </div>

                </main>

                {/* Right Column: Chat (and controller bar for guessers) */}
                <div className="hidden lg:flex landscape:flex w-[260px] xl:w-80 h-full shrink-0 min-w-0 flex-col gap-2">
                    {/* On phones and tablets, show a compact player strip above chat */}
                    <div className="flex 2xl:hidden w-full h-[56px] shrink-0">
                        <PlayerList
                            players={state.players}
                            scores={state.scores}
                            drawerId={state.drawerId}
                            guessedPlayerIds={state.guessedPlayers}
                            speakingPeers={speakingPeers}
                            variant="mobile"
                        />
                    </div>
                    {!isDrawer && state.gameState === 'DRAWING' && (
                        <div className="shrink-0">
                            <ReactionBar
                                onReact={handleReact}
                                onLike={handleLike}
                                hasLiked={state.hasLiked}
                                disabled={state.gameState !== 'DRAWING'}
                            />
                        </div>
                    )}
                    <div className="flex-1 min-h-0">
                        <GuessPanel roomCode={code} isMobile={false} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Game;
