import React, { useState } from 'react';
import { Volume2, VolumeX, Mic, MicOff, MoreVertical, HelpCircle, LogOut, OctagonAlert, Settings } from 'lucide-react';
import { useSound } from '../../hooks/useSound';
import { useVoice } from '../../context/VoiceContext';
import { useGame } from '../../context/GameContext';
import { useSettings } from '../../context/SettingsContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';
import Tooltip from '../ui/Tooltip';
import Modal from '../ui/Modal';
import ConfirmationModal from '../ui/ConfirmationModal';
import Button from '../ui/Button';
import SoundHint from '../Settings/SoundHint';

export const AppHeader = ({
    roomCode = '',
    onLeave,
    voiceState,
    className = '',
}) => {
    const { isMuted, toggleMute } = useSound();
    const { soundHintDismissed, dismissSoundHint, openSettings } = useSettings();
    const gameContext = useGame();
    const state = gameContext?.state || {};
    const socket = useSocket();
    const contextVoice = useVoice?.() || null;
    const activeVoice = voiceState !== undefined ? voiceState : contextVoice;
    const [copied, setCopied] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showHowToPlay, setShowHowToPlay] = useState(false);
    const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);

    const activeRoomCode = roomCode || state?.roomCode || '';
    const isHost = Boolean(state?.currentUser?.isHost);
    const isInGame = state?.gameState === 'DRAWING' || state?.gameState === 'WORD_SELECTION' || state?.gameState === 'ROUND_END';

    const handleCopyCode = async () => {
        if (!activeRoomCode) return;
        try {
            await navigator.clipboard.writeText(activeRoomCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Ignore clipboard errors
        }
    };

    const handleConfirmLeave = () => {
        setShowLeaveConfirm(false);
        try {
            sessionStorage.removeItem('scribble_room_code');
            localStorage.removeItem('scribble_rejoin');
        } catch {
            // Ignore session storage errors
        }
        if (onLeave) {
            onLeave();
        } else {
            window.location.href = '/';
        }
    };

    const handleConfirmEndGame = () => {
        setShowEndGameConfirm(false);
        if (socket && activeRoomCode) {
            socket.emit(EVENTS.END_GAME_EARLY, { roomCode: activeRoomCode });
        }
    };

    return (
        <header
            aria-label="Application header"
            className={`h-[48px] md:h-[56px] w-full px-3 md:px-6 bg-card border-b-2 border-ink shadow-hard-sm z-bar flex items-center justify-between select-none shrink-0 ${className}`}
        >
            {/* Left: Small Wordmark (hidden on mobile when in game to make room for room code, 'Round 2 of 3', sound, menu) */}
            <Tooltip content="Leave this game">
                <button
                    type="button"
                    onClick={() => setShowLeaveConfirm(true)}
                    aria-label="Leave game"
                    className={`${isInGame ? 'hidden sm:flex' : 'hidden md:flex'} items-center gap-1.5 cursor-pointer transform -rotate-1 hover:rotate-0 transition-transform focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded-[4px] p-1 -ml-1`}
                >
                    <span className="font-heading font-black text-xl md:text-2xl tracking-tighter text-tomato stroke-ink">
                        SCRIBBLE
                    </span>
                </button>
            </Tooltip>

            {/* Centre: Room Code Chip & Optional Round Counter */}
            <div className="flex items-center gap-2">
                {activeRoomCode && (
                    <Tooltip content={copied ? 'Copied to clipboard!' : 'Click to copy room code'}>
                        <button
                            type="button"
                            onClick={handleCopyCode}
                            aria-label={`Room code ${activeRoomCode}, click to copy`}
                            className="inline-flex items-center gap-1.5 bg-paper hover:bg-card border-2 border-ink px-2.5 sm:px-3 py-1 rounded-[6px] shadow-hard-sm cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                        >
                            <span className="text-[10px] font-bold uppercase text-ink-soft">Room</span>
                            <span className="font-mono font-black text-xs sm:text-base text-ink tracking-wider">
                                {copied ? 'Copied' : activeRoomCode}
                            </span>
                        </button>
                    </Tooltip>
                )}

                {isInGame && state?.currentRound > 0 && (
                    <div
                        className="inline-flex items-center gap-1 bg-paper border-2 border-ink shadow-hard-sm px-2 sm:px-2.5 py-1 rounded-[6px]"
                        title="Current Round"
                        data-testid="header-round-counter"
                    >
                        <span className="font-heading font-black text-xs sm:text-sm text-ink whitespace-nowrap">
                            Round {state.currentRound || 1} of {state.totalRounds || state.settings?.rounds || 3}
                        </span>
                    </div>
                )}
            </div>

            {/* Right: Sound Toggle, Settings, Voice Button, Menu */}
            <div className="flex items-center gap-1 md:gap-2">
                {/* Sound Toggle */}
                <div className="relative inline-flex">
                    <Tooltip content={isMuted ? 'Unmute sounds (M)' : 'Mute sounds (M)'}>
                        <button
                            type="button"
                            onClick={() => {
                                dismissSoundHint?.();
                                toggleMute();
                            }}
                            aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                            aria-pressed={isMuted}
                            className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                        >
                            {isMuted ? (
                                <VolumeX className="w-5 h-5 text-tomato" />
                            ) : (
                                <Volume2 className="w-5 h-5 text-ink" />
                            )}
                        </button>
                    </Tooltip>
                    {!soundHintDismissed && !isMuted && (
                        <SoundHint onDismiss={dismissSoundHint} />
                    )}
                </div>

                {/* Settings Button (desktop; phones use the menu) */}
                <div className="hidden sm:block">
                    <Tooltip content="Settings">
                        <button
                            type="button"
                            onClick={openSettings}
                            aria-label="Settings"
                            className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </Tooltip>
                </div>

                {/* Voice Button (when activeVoice provided) */}
                {activeVoice && (
                    <Tooltip content={activeVoice.isMicOn ? 'Mute microphone' : 'Unmute microphone'}>
                        <button
                            type="button"
                            onClick={activeVoice.isVoiceAllowed ? activeVoice.toggleMic : undefined}
                            disabled={!activeVoice.isVoiceAllowed}
                            aria-label={activeVoice.isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                            aria-pressed={activeVoice.isMicOn}
                            className={`min-w-[44px] min-h-[44px] p-2 border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                                !activeVoice.isVoiceAllowed
                                    ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                                    : activeVoice.isMicOn
                                    ? 'bg-leaf text-white'
                                    : 'bg-paper text-ink hover:bg-card'
                            }`}
                        >
                            {activeVoice.isMicOn ? (
                                <Mic className="w-5 h-5" />
                            ) : (
                                <MicOff className="w-5 h-5" />
                            )}
                        </button>
                    </Tooltip>
                )}

                {/* Menu Dropdown Button */}
                <div className="relative">
                    <Tooltip content="Menu">
                        <button
                            type="button"
                            onClick={() => setShowMenu((prev) => !prev)}
                            aria-label="Open game menu"
                            aria-expanded={showMenu}
                            className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </Tooltip>

                    {showMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-bar"
                                onClick={() => setShowMenu(false)}
                            />
                            <div
                                role="menu"
                                aria-label="Game menu options"
                                className="absolute right-0 top-full mt-2 w-48 bg-card border-2 border-ink shadow-hard-lg rounded-[8px] p-1.5 z-sheet flex flex-col gap-1 select-none"
                            >
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setShowMenu(false);
                                        setShowHowToPlay(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-ink hover:bg-paper rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                                >
                                    <HelpCircle className="w-4 h-4 text-cobalt" />
                                    <span>How to play</span>
                                </button>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setShowMenu(false);
                                        openSettings();
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-ink hover:bg-paper rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                                >
                                    <Settings className="w-4 h-4 text-cobalt" />
                                    <span>Settings</span>
                                </button>

                                {isHost && isInGame && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setShowMenu(false);
                                            setShowEndGameConfirm(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-tomato hover:bg-tomato/10 rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                                    >
                                        <OctagonAlert className="w-4 h-4 text-tomato" />
                                        <span>End game early</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setShowMenu(false);
                                        setShowLeaveConfirm(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-tomato hover:bg-tomato/10 rounded-[4px] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Leave</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Leave Confirm Modal */}
            <ConfirmationModal
                isOpen={showLeaveConfirm}
                onClose={() => setShowLeaveConfirm(false)}
                onConfirm={handleConfirmLeave}
                title="Leave this game?"
                message="Leave this game? You can rejoin for 60 seconds."
                confirmText="Leave"
                cancelText="Stay"
                isDanger={true}
            />

            {/* End Game Early Modal */}
            <ConfirmationModal
                isOpen={showEndGameConfirm}
                onClose={() => setShowEndGameConfirm(false)}
                onConfirm={handleConfirmEndGame}
                title="End Game Early?"
                message="As the host, this will immediately end the match for everyone and show the final leaderboard."
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

export default AppHeader;
