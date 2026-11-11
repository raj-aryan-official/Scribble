import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    LogOut,
    MoreVertical,
    HelpCircle,
    OctagonAlert,
    Settings,
    Zap,
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useSound } from '../../hooks/useSound';
import { useSocket } from '../../hooks/useSocket';
import { useVoice } from '../../context/VoiceContext';
import { useSettings } from '../../context/SettingsContext';
import { EVENTS } from '../../../../shared/types';
import Tooltip from '../ui/Tooltip';
import ConfirmationModal from '../ui/ConfirmationModal';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import HintTiles from './HintTiles';

/**
 * TimerRing: Circular draining timer SVG with tabular numbers
 * - Size: 40px (desktop) or 36px (phone)
 * - Tabular numbers inside
 * - Drains smoothly based on timeLeft / totalTime
 * - Turns tomato in the last 10 seconds
 */
const TimerRing = ({ timeLeft = 0, totalTime = 60, className = '' }) => {
    const size = 40;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeTotal = totalTime > 0 ? totalTime : 60;
    const fraction = Math.max(0, Math.min(1, timeLeft / safeTotal));
    const strokeDashoffset = circumference * (1 - fraction);
    const isTomato = timeLeft <= 10;

    return (
        <div
            role="timer"
            aria-label={`${timeLeft} seconds remaining`}
            className={`relative inline-flex items-center justify-center select-none shrink-0 w-9 h-9 md:w-10 md:h-10 ${
                isTomato ? 'text-tomato' : 'text-ink'
            } ${className}`}
        >
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full h-full transform -rotate-90 block"
                aria-hidden="true"
            >
                {/* Background track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="opacity-15"
                />
                {/* Draining progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                />
            </svg>
            <span
                className={`absolute font-mono font-black tabular-nums leading-none text-xs md:text-sm ${
                    isTomato ? 'text-tomato' : 'text-ink'
                }`}
            >
                {timeLeft}
            </span>
        </div>
    );
};

export const GameBar = ({
    roomCode: propRoomCode,
    currentRound: propCurrentRound,
    totalRounds: propTotalRounds,
    turnInRound: propTurnInRound,
    turnsInRound: propTurnsInRound,
    isDrawer: propIsDrawer,
    drawerName: propDrawerName,
    wordToGuess: propWordToGuess,
    wordHint: propWordHint,
    hasGuessed: propHasGuessed,
    waitingForName: propWaitingForName,
    timer: propTimer,
    totalDrawTime: propTotalDrawTime,
    isHost: propIsHost,
    onExit: propOnExit,
    onEndGameEarly: propOnEndGameEarly,
    voiceState: propVoiceState,
    actingHostName: propActingHostName,
    originalHostName: propOriginalHostName,
    twist: propTwist,
    initialShowExitModal = false,
    initialShowEndGameModal = false,
    className = '',
}) => {
    const gameContext = useGame();
    const state = gameContext?.state || {};
    const socket = useSocket();
    const { isMuted, toggleMute } = useSound();
    const { openSettings } = useSettings();
    const contextVoice = useVoice?.() || null;
    const activeVoice = propVoiceState !== undefined ? propVoiceState : contextVoice;

    // Local UI states
    const [copied, setCopied] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showExitModal, setShowExitModal] = useState(initialShowExitModal);
    const [showEndGameModal, setShowEndGameModal] = useState(initialShowEndGameModal);
    const [showHowToPlay, setShowHowToPlay] = useState(false);
    const [timerAnnouncement, setTimerAnnouncement] = useState('');
    const lastAnnouncedRef = useRef(null);

    // Resolve props with fallback to GameContext state
    const roomCode = propRoomCode || state.roomCode || '';
    const currentRound = propCurrentRound ?? state.currentRound ?? 1;
    const totalRounds = propTotalRounds ?? state.totalRounds ?? state.settings?.rounds ?? 3;
    const turnInfo = state.turnInfo || {};
    const turnInRound = propTurnInRound ?? turnInfo.turnInRound ?? (state.turnInRound || 1);
    const turnsInRound = propTurnsInRound ?? turnInfo.turnsInRound ?? (state.turnsInRound || state.players?.length || 1);
    const myId = state.currentUser?.id;
    const isDrawer = propIsDrawer ?? Boolean(myId && myId === state.drawerId);
    const isHost = propIsHost ?? Boolean(state.currentUser?.isHost);
    const drawer = state.players?.find((p) => p.id === state.drawerId);
    const drawerName = propDrawerName || drawer?.username || 'Maya';
    const wordToGuess = propWordToGuess ?? state.wordToGuess ?? '';
    const wordHint = propWordHint ?? state.wordHint ?? '';
    const hasGuessed = propHasGuessed ?? Boolean(myId && state.guessedPlayers?.includes(myId));
    const waitingForName = propWaitingForName || state.turnWait?.waitingFor || drawerName;
    const timer = propTimer ?? state.timer ?? 0;
    const totalDrawTime = propTotalDrawTime ?? state.settings?.drawTime ?? 60;
    const gameState = state.gameState || 'DRAWING';
    const actingHostName = propActingHostName !== undefined ? propActingHostName : state.publicRoom?.actingHostName;
    const originalHostName = propOriginalHostName !== undefined ? propOriginalHostName : state.publicRoom?.originalHostName;
    const twist = propTwist !== undefined ? propTwist : state.currentTwist;

    // Throttled timer screen reader announcements: every 15s and at 10, 5, 0
    useEffect(() => {
        if (gameState !== 'DRAWING') {
            lastAnnouncedRef.current = null;
            return;
        }
        const t = Number(timer);
        if (
            (t > 0 && t % 15 === 0) ||
            t === 10 ||
            t === 5 ||
            t === 0
        ) {
            if (lastAnnouncedRef.current !== t) {
                lastAnnouncedRef.current = t;
                setTimerAnnouncement(t === 0 ? "Time's up" : `${t} seconds remaining`);
            }
        }
    }, [timer, gameState]);

    // Copy room code to clipboard
    const handleCopyCode = async () => {
        if (!roomCode) return;
        try {
            await navigator.clipboard.writeText(roomCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Ignore clipboard errors
        }
    };

    // Close menu on Escape
    useEffect(() => {
        if (!showMenu) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setShowMenu(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showMenu]);

    // Handle Confirm Exit
    const handleConfirmExit = useCallback(() => {
        setShowExitModal(false);
        try {
            sessionStorage.removeItem('scribble_room_code');
            localStorage.removeItem('scribble_rejoin');
        } catch {
            // Ignore storage errors
        }
        if (propOnExit) {
            propOnExit();
        } else {
            window.location.href = '/';
        }
    }, [propOnExit]);

    // Handle Confirm End Game Early
    const handleConfirmEndGame = useCallback(() => {
        setShowEndGameModal(false);
        if (propOnEndGameEarly) {
            propOnEndGameEarly();
        } else if (socket && roomCode) {
            socket.emit(EVENTS.END_GAME_EARLY, { roomCode });
        }
    }, [propOnEndGameEarly, socket, roomCode]);

    // Audio / Voice state calculations
    const isVoiceAllowed = activeVoice ? activeVoice.isVoiceAllowed : false;
    const isMicOn = Boolean(activeVoice?.isMicOn);
    const isDeafened = Boolean(activeVoice?.isDeafened);
    const isSpeakerOn = !isDeafened && !isMuted;

    const handleToggleSpeaker = () => {
        if (activeVoice?.toggleDeafen) {
            activeVoice.toggleDeafen();
        }
        if (toggleMute) {
            toggleMute();
        }
    };

    // Copy by State for Center Status Line
    let statusText = '';
    if (gameState === 'PAUSED') {
        statusText = 'Waiting for players to return';
    } else if (gameState === 'TURN_WAIT' || state.turnWait) {
        statusText = `Waiting for ${waitingForName} to reconnect`;
    } else if (gameState === 'WORD_SELECTION') {
        const isRandomMode = (state.wordChoiceMode === 'random' || state.settings?.wordChoice === 'random');
        if (isRandomMode) {
            statusText = isDrawer ? `Your word: ${(wordToGuess || '').toUpperCase()}` : `${drawerName} is getting a word`;
        } else {
            statusText = isDrawer ? 'You are choosing a word' : `${drawerName} is choosing a word`;
        }
    } else if (isDrawer) {
        statusText = drawer?.teamName ? `You are drawing for ${drawer.teamName}!` : 'You are drawing!';
    } else if (hasGuessed) {
        statusText = 'You got it!';
    } else if (gameState === 'DRAWING') {
        if (drawer?.teamName) {
            statusText = `${drawerName} is drawing for ${drawer.teamName}`;
        } else if (state.settings?.mode === 'relay') {
            statusText = `${drawerName} is drawing (Relay)`;
        } else {
            statusText = `${drawerName} is drawing`;
        }
    } else if (gameState === 'ROUND_END') {
        statusText = 'Round ended';
    }

    // Determine if phone Row 2 has anything to show
    const showRow2 = Boolean(
        statusText || (isDrawer && wordToGuess) || (!isDrawer && wordHint)
    );

    return (
        <header
            aria-label="Game navigation bar"
            className={`sticky top-0 z-bar w-full bg-card border-b-2 border-ink shadow-hard-sm select-none ${className}`}
        >
            {/* Screen reader live announcement for timer */}
            <div className="sr-only" role="status" aria-live="polite">
                {timerAnnouncement}
            </div>

            {/*
              Grid container on phone (<768px):
                Row 1 (48px): Left: Room | Centre: Timer | Right: Voice + Menu
                Row 2 (40px): Status + Word / Hint tiles
              Flex container on desktop (>=768px):
                72px tall, 1 row, 3 clusters:
                1. Left: ROOM label, code (20px), Round/Turn
                2. Centre: Status line above Word chip / Hint tiles
                3. Right: 40px timer, Voice group, divider, Exit, End Game (host only)
            */}
            <div className="game-bar-inner grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[48px_auto] md:flex md:h-[72px] md:items-center md:justify-between px-3 md:px-6 w-full mx-auto">
                {/*
                  Cluster 1: Left
                  DOM Order: 1
                  Desktop: label ROOM (small, ink-soft), code at 20px (display face), Round 1 of 3 · Turn 2 of 5
                  Phone: col 1 row 1, code over Round 1/3 · Turn 2/5
                */}
                <div className="game-bar-room col-start-1 row-start-1 self-center justify-self-start flex flex-col justify-center min-w-0">
                    <Tooltip content={copied ? 'Copied to clipboard!' : 'Click to copy room code'}>
                        <button
                            type="button"
                            onClick={handleCopyCode}
                            aria-label={`Room code ${roomCode}, click to copy`}
                            className="flex flex-col text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded-[4px] cursor-pointer"
                        >
                            {/* Desktop only: ROOM label in ink-soft */}
                            <span className="hidden md:inline-block text-[11px] font-bold uppercase text-ink-soft leading-none mb-0.5">
                                ROOM
                            </span>
                            {/* Room Code in display face: 20px on desktop */}
                            <span className="font-heading font-black text-base md:text-[20px] text-ink tracking-wider leading-tight truncate max-w-[40vw] md:max-w-none">
                                {copied ? 'Copied' : roomCode}
                            </span>
                        </button>
                    </Tooltip>
                    {/* Round & Turn Info */}
                    <div className="game-bar-round text-ink-soft whitespace-nowrap leading-tight mt-0.5">
                        {/* Desktop: Round 1 of 3 · Turn 2 of 5 */}
                        <span className="hidden md:inline-block text-xs font-semibold">
                            Round {currentRound} of {totalRounds} · Turn {turnInRound} of {turnsInRound}
                        </span>
                        {/* Phone: Round 1/3 · Turn 2/5 */}
                        <span className="inline-block md:hidden text-[10px] font-semibold">
                            Round {currentRound}/{totalRounds} · Turn {turnInRound}/{turnsInRound}
                        </span>
                    </div>

                    {/* Twist Badge on phone left cluster */}
                    {twist && (
                        <div className="game-bar-twist md:hidden mt-0.5">
                            <span
                                data-testid="twist-badge-mobile"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-marigold text-ink border border-ink shadow-hard-xs"
                            >
                                <Zap className="w-2.5 h-2.5" />
                                {twist.badge || twist.name}
                            </span>
                        </div>
                    )}

                    {/* Acting Host Chip */}
                    {actingHostName && originalHostName && (
                        <div className="mt-0.5">
                            <span
                                data-testid="acting-host-chip"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-paper border border-ink/30 text-[9px] md:text-[11px] font-bold text-ink-soft select-none"
                            >
                                {`${actingHostName} is hosting while ${originalHostName} is away`}
                            </span>
                        </div>
                    )}
                </div>

                {/*
                  Cluster 2: Centre (Status line and Word area)
                  DOM Order: 2
                  Desktop: Center cluster, status line above word area
                  Phone: Row 2 (40px) spanning all 3 columns
                */}
                <div
                    className={`game-bar-word ${
                        showRow2 ? 'flex' : 'hidden md:flex'
                    } col-span-3 row-start-2 self-center w-full md:w-auto md:flex-1 md:flex-col md:items-center md:justify-center border-t border-ink/10 md:border-t-0 py-1 md:py-0 min-h-[40px] md:min-h-0 overflow-hidden ${
                        isDrawer
                            ? 'flex-row justify-between px-3 md:px-0'
                            : 'flex-row justify-center px-2 md:px-0'
                    }`}
                >
                    {/* Status line: on desktop always visible above; on phone visible for drawer on left, hidden on phone for guesser (hint tiles take whole row) */}
                    <div
                        className={`game-bar-status ${
                            isDrawer ? 'flex' : 'hidden md:flex'
                        } h-5 min-h-[20px] items-center justify-center font-bold text-xs sm:text-sm text-ink-soft select-none overflow-hidden gap-1.5`}
                    >
                        <span
                            className={`truncate ${
                                hasGuessed
                                    ? 'text-leaf-deep font-black'
                                    : isDrawer
                                    ? 'text-ink font-black'
                                    : 'text-ink-soft'
                            }`}
                        >
                            {statusText}
                        </span>
                        {drawer?.teamName && (
                            <span
                                data-testid="gamebar-team-badge"
                                className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-black uppercase text-white border border-ink shadow-hard-xs shrink-0"
                                style={{ backgroundColor: drawer.teamColor || '#EF4444' }}
                            >
                                {drawer.teamName}
                            </span>
                        )}
                        {state.settings?.mode === 'relay' && gameState === 'DRAWING' && (
                            <span
                                data-testid="relay-segment-indicator"
                                className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-black uppercase bg-marigold text-ink border border-ink shadow-hard-xs shrink-0"
                            >
                                Relay #{(state.currentRelaySegment ?? 0) + 1}
                            </span>
                        )}
                        {twist && (
                            <Tooltip content={twist.rule || twist.name}>
                                <span
                                    data-testid="twist-badge"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-marigold text-ink border border-ink shadow-hard-xs shrink-0 select-none cursor-help"
                                >
                                    <Zap className="w-2.5 h-2.5" />
                                    {twist.badge || twist.name}
                                </span>
                            </Tooltip>
                        )}
                    </div>

                    {/* Word chip for drawer OR Hint tiles for guesser (rendered ONCE) */}
                    <div className="flex items-center justify-center min-h-[28px] max-w-full">
                        {isDrawer && wordToGuess ? (
                            <div
                                data-testid="drawer-word-chip"
                                className="inline-flex items-center gap-1.5 bg-marigold text-ink border-2 border-ink shadow-hard-xs px-2.5 sm:px-3 py-0.5 rounded-[6px] font-heading font-black text-xs sm:text-base md:text-lg uppercase tracking-wider select-none shrink-0"
                            >
                                <span className="hidden md:inline text-[10px] uppercase font-bold text-ink/70 tracking-widest mr-0.5">
                                    Draw:
                                </span>
                                <span>{wordToGuess}</span>
                            </div>
                        ) : (
                            <HintTiles
                                word=""
                                hint={wordHint}
                                isDrawer={false}
                                guessedCount={state.guessedPlayers?.length || 0}
                                totalGuessers={Math.max(0, (state.players?.length || 1) - 1)}
                                compact={true}
                            />
                        )}
                    </div>
                </div>

                {/*
                  Cluster 3: Right Controls Container
                  DOM Order: 3 (Timer) -> 4 (Voice) -> 5 (Exit) -> 6 (End Game)
                  Desktop: Flex container on the right
                  Phone: Unpacked via CSS Grid (Timer in col 2, Voice+Menu in col 3)
                */}
                <div className="game-bar-controls contents md:flex md:items-center md:justify-end md:gap-3 lg:gap-4 shrink-0">
                    {/*
                      1. Timer Ring
                      Desktop: 40px ring (md:w-10 md:h-10)
                      Phone: 36px ring in col 2 row 1 (w-9 h-9)
                    */}
                    <div className="game-bar-timer col-start-2 row-start-1 self-center justify-self-center flex items-center justify-center">
                        <TimerRing timeLeft={timer} totalTime={totalDrawTime} />
                    </div>

                    {/*
                      Voice Group & Danger / Menu Controls
                      Phone: Placed in col 3 row 1
                      Desktop: Arranged in flex row with 16px separation from danger buttons
                    */}
                    <div className="col-start-3 row-start-1 self-center justify-self-end flex items-center gap-1.5 md:gap-3 lg:gap-4">
                        {/*
                          2. Voice Group: Mic and Speaker toggles (40px) with aria-pressed
                          - Mic off: tomato tint, slashed icon
                          - Mic on: leaf tint
                          - Speaker on: cobalt tint
                          - Speaker off: ink-soft with a slash
                        */}
                        <div className="flex items-center gap-1 sm:gap-1.5">
                            {/* Mic Toggle Button */}
                            <Tooltip content={isMicOn ? 'Mute microphone' : 'Unmute microphone'}>
                                <button
                                    type="button"
                                    onClick={isVoiceAllowed ? activeVoice?.toggleMic : undefined}
                                    disabled={!isVoiceAllowed}
                                    aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                                    aria-pressed={isMicOn}
                                    className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-[6px] border-2 border-ink shadow-hard-xs flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none active:translate-x-[1px] active:translate-y-[1px] ${
                                        !isVoiceAllowed
                                            ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                                            : isMicOn
                                            ? 'bg-leaf/20 text-leaf-deep hover:bg-leaf/30 cursor-pointer'
                                            : 'bg-tomato/15 text-tomato hover:bg-tomato/25 cursor-pointer'
                                    }`}
                                >
                                    {isMicOn ? (
                                        <Mic size={20} strokeWidth={2} />
                                    ) : (
                                        <MicOff size={20} strokeWidth={2} />
                                    )}
                                </button>
                            </Tooltip>

                            {/* Speaker Toggle Button */}
                            <div className="relative inline-flex">
                                <Tooltip content={isSpeakerOn ? 'Mute audio (M)' : 'Unmute audio (M)'}>
                                    <button
                                        type="button"
                                        onClick={handleToggleSpeaker}
                                        aria-label={isSpeakerOn ? 'Mute audio' : 'Unmute audio'}
                                        aria-pressed={!isSpeakerOn}
                                        className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-[6px] border-2 border-ink shadow-hard-xs flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none active:translate-x-[1px] active:translate-y-[1px] ${
                                            isSpeakerOn
                                                ? 'bg-cobalt/15 text-cobalt hover:bg-cobalt/25'
                                                : 'bg-paper text-ink-soft hover:bg-card'
                                        }`}
                                    >
                                        {isSpeakerOn ? (
                                            <Volume2 size={20} strokeWidth={2} />
                                        ) : (
                                            <VolumeX size={20} strokeWidth={2} />
                                        )}
                                    </button>
                                </Tooltip>
                            </div>

                            {/* Settings Gear Button (desktop; phones use the menu) */}
                            <div className="game-bar-desktop-only hidden md:inline-flex">
                                <Tooltip content="Settings">
                                    <button
                                        type="button"
                                        onClick={openSettings}
                                        aria-label="Settings"
                                        className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-[6px] border-2 border-ink shadow-hard-xs bg-paper hover:bg-card text-ink flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none active:translate-x-[1px] active:translate-y-[1px]"
                                    >
                                        <Settings size={20} strokeWidth={2} />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>

                        {/* 3. 1 px Divider (Desktop only, keeping at least 16px between voice and danger buttons) */}
                        <div
                            className="game-bar-desktop-only hidden md:block w-[1px] h-8 bg-ink/20 shrink-0"
                            aria-hidden="true"
                        />

                        {/* 4. Exit Button (Desktop only: icon + Tooltip 'Leave game', 'Exit' from 1024px) */}
                        <div className="game-bar-desktop-only hidden md:inline-flex items-center">
                            <Tooltip content="Leave game">
                                <button
                                    type="button"
                                    onClick={() => setShowExitModal(true)}
                                    aria-label="Leave game"
                                    className="min-h-[40px] px-2.5 py-1.5 border-2 border-ink rounded-[6px] shadow-hard-xs bg-paper hover:bg-tomato/10 text-tomato flex items-center gap-1.5 cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                                >
                                    <LogOut size={20} strokeWidth={2} />
                                    <span className="hidden lg:inline font-bold text-sm text-ink">
                                        Exit
                                    </span>
                                </button>
                            </Tooltip>
                        </div>

                        {/* 5. End Game Button (Host only, desktop: outlined tomato-deep button, not filled) */}
                        {isHost && (
                            <div className="game-bar-desktop-only hidden md:inline-flex items-center">
                                <button
                                    type="button"
                                    onClick={() => setShowEndGameModal(true)}
                                    aria-label="End game for everyone"
                                    className="min-h-[40px] px-3 border-2 border-tomato-deep text-tomato-deep bg-transparent hover:bg-tomato/10 rounded-[6px] shadow-hard-xs font-bold text-xs uppercase cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                                >
                                    End Game
                                </button>
                            </div>
                        )}

                        {/* Phone Kebab Menu Button & Popover (hidden on desktop) */}
                        <div className="game-bar-menu relative inline-flex md:hidden">
                            <button
                                type="button"
                                onClick={() => setShowMenu((prev) => !prev)}
                                aria-label="Open game menu"
                                aria-expanded={showMenu}
                                className="w-10 h-10 min-w-[40px] min-h-[40px] border-2 border-ink rounded-[6px] shadow-hard-xs bg-paper hover:bg-card flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                            >
                                <MoreVertical size={20} strokeWidth={2} />
                            </button>

                            {/* Menu Popover */}
                            {showMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-bar"
                                        onClick={() => setShowMenu(false)}
                                    />
                                    <div
                                        role="menu"
                                        aria-label="Game menu options"
                                        className="absolute right-0 top-full mt-2 w-52 bg-card border-2 border-ink shadow-hard-lg rounded-[8px] p-1.5 z-sheet flex flex-col gap-1 select-none"
                                    >
                                        {/* 1. How to play */}
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                setShowMenu(false);
                                                setShowHowToPlay(true);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-ink hover:bg-paper rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none min-h-[44px]"
                                        >
                                            <HelpCircle size={20} strokeWidth={2} className="text-cobalt shrink-0" />
                                            <span>How to play</span>
                                        </button>

                                        {/* 1b. Settings */}
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                setShowMenu(false);
                                                openSettings();
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-ink hover:bg-paper rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none min-h-[44px]"
                                        >
                                            <Settings size={20} strokeWidth={2} className="text-cobalt shrink-0" />
                                            <span>Settings</span>
                                        </button>

                                        {/* 2. Leave game */}
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                setShowMenu(false);
                                                setShowExitModal(true);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-tomato hover:bg-tomato/10 rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none min-h-[44px]"
                                        >
                                            <LogOut size={20} strokeWidth={2} className="shrink-0" />
                                            <span>Leave game</span>
                                        </button>

                                        {/* 3. For the host only: End game for everyone in red text, last, after a divider */}
                                        {isHost && (
                                            <>
                                                <hr className="border-ink/20 my-1" />
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setShowMenu(false);
                                                        setShowEndGameModal(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-tomato hover:bg-tomato/10 rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none min-h-[44px]"
                                                >
                                                    <OctagonAlert size={20} strokeWidth={2} className="text-tomato shrink-0" />
                                                    <span>End game for everyone</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exit Confirmation Modal */}
            <ConfirmationModal
                isOpen={showExitModal}
                onClose={() => setShowExitModal(false)}
                onConfirm={handleConfirmExit}
                title="Leave this game?"
                message="Leave this game? You can rejoin from the start page."
                confirmText="Leave"
                cancelText="Stay"
                isDanger={true}
            />

            {/* End Game Confirmation Modal */}
            <ConfirmationModal
                isOpen={showEndGameModal}
                onClose={() => setShowEndGameModal(false)}
                onConfirm={handleConfirmEndGame}
                title="End the game for everyone?"
                message="End the game for everyone? Scores will be shown."
                confirmText="End Game"
                cancelText="Cancel"
                isDanger={true}
            />

            {/* How to Play Modal */}
            <Modal
                isOpen={showHowToPlay}
                onClose={() => setShowHowToPlay(false)}
                title="How to Play Scribble"
                className="max-w-md"
            >
                <div className="flex flex-col gap-4 text-ink text-sm py-2">
                    <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-marigold border-2 border-ink flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-hard-sm">
                            1
                        </span>
                        <div>
                            <p className="font-bold">Pick & Draw</p>
                            <p className="text-ink-soft text-xs mt-0.5">
                                On your turn, choose one of three words and sketch it on the 4:3 paper using pencil, eraser, and spot colors.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-cobalt text-white border-2 border-ink flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-hard-sm">
                            2
                        </span>
                        <div>
                            <p className="font-bold">Guess & Score</p>
                            <p className="text-ink-soft text-xs mt-0.5">
                                When others draw, type your guesses in the chat box. Guessing earlier awards more points!
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-leaf text-white border-2 border-ink flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-hard-sm">
                            3
                        </span>
                        <div>
                            <p className="font-bold">Voice & Rejoining</p>
                            <p className="text-ink-soft text-xs mt-0.5">
                                Talk with players using opt-in voice chat. If you disconnect, your seat and score are reserved for 60 seconds.
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => setShowHowToPlay(false)}
                        className="w-full mt-2 font-bold uppercase"
                    >
                        Got it!
                    </Button>
                </div>
            </Modal>
        </header>
    );
};

export default GameBar;
