import React, { useState } from 'react';
import { Volume2, VolumeX, LogOut, OctagonAlert } from 'lucide-react';
import Button from '../ui/Button';
import ConfirmationModal from '../ui/ConfirmationModal';
import { VoiceControls } from '../Chat/VoiceControls';

export const TopBar = ({
    roomCode,
    currentRound = 1,
    totalRounds = 3,
    isHost = false,
    onExit,
    onEndGameEarly,
    isMuted = false,
    toggleMute,
    voiceState = {},
    className = '',
}) => {
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);

    const handleConfirmExit = () => {
        setShowExitConfirm(false);
        onExit?.();
    };

    const handleConfirmEndGame = () => {
        setShowEndGameConfirm(false);
        onEndGameEarly?.();
    };

    return (
        <header
            aria-label="Game navigation bar"
            className={`w-full flex items-center justify-between gap-2 p-2 sm:p-3 bg-card border-2 border-ink shadow-hard rounded-[12px] select-none ${className}`}
        >
            {/* Left: Room Code & Round Counter */}
            <div className="flex items-center gap-2 sm:gap-3">
                <div
                    className="flex items-center gap-1.5 bg-paper border-2 border-ink shadow-hard-sm px-2.5 py-1 rounded-[6px]"
                    title="Room Code"
                >
                    <span className="text-[10px] font-bold uppercase text-ink-soft">Room</span>
                    <span className="font-mono font-black text-sm sm:text-base text-ink tracking-wider">
                        {roomCode}
                    </span>
                </div>

                <div
                    className="flex items-center gap-1.5 bg-paper border-2 border-ink shadow-hard-sm px-2.5 py-1 rounded-[6px]"
                    title="Current Round"
                >
                    <span className="text-[10px] font-bold uppercase text-ink-soft">Round</span>
                    <span className="font-mono font-black text-xs sm:text-sm text-ink">
                        {currentRound}/{totalRounds}
                    </span>
                </div>
            </div>

            {/* Right: Sound, Voice, Host End Game, Leave Game */}
            <div className="flex items-center gap-1 sm:gap-2">
                {/* Sound Mute Toggle */}
                <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute game sounds' : 'Mute game sounds'}
                    title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                    className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                >
                    {isMuted ? (
                        <VolumeX className="w-5 h-5 text-tomato" />
                    ) : (
                        <Volume2 className="w-5 h-5 text-ink" />
                    )}
                </button>

                {/* WebRTC Voice Controls */}
                <VoiceControls
                    isMicOn={voiceState.isMicOn}
                    toggleMic={voiceState.toggleMic}
                    isDeafened={voiceState.isDeafened}
                    toggleDeafen={voiceState.toggleDeafen}
                    peersCount={voiceState.peersCount}
                    isVoiceAllowed={voiceState.isVoiceAllowed}
                    voiceError={voiceState.voiceError}
                    onClearVoiceError={voiceState.clearVoiceError}
                />

                {/* Host End Game Button */}
                {isHost && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowEndGameConfirm(true)}
                        aria-label="End game for all players"
                        className="hidden sm:inline-flex min-h-[44px] px-3 text-xs font-bold uppercase text-tomato hover:bg-tomato/10"
                    >
                        <OctagonAlert className="w-4 h-4 mr-1 text-tomato" />
                        End Game
                    </Button>
                )}

                {/* Exit Button */}
                <button
                    type="button"
                    onClick={() => setShowExitConfirm(true)}
                    aria-label="Leave game room"
                    title="Leave game"
                    className="min-w-[44px] min-h-[44px] p-2 bg-paper hover:bg-tomato/10 text-tomato border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Leave Game Confirmation Modal */}
            <ConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={handleConfirmExit}
                title="Leave Game?"
                message="Are you sure you want to exit? You will lose your current score and seat in this room."
                confirmText="Leave Room"
                cancelText="Stay"
                isDanger={true}
            />

            {/* End Game Early Confirmation Modal */}
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
        </header>
    );
};

export default TopBar;

