import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, AlertCircle, X } from 'lucide-react';
import { MAX_VOICE_PLAYERS } from '../../utils/voiceUtils';
import Button from '../ui/Button';

export const VoiceControls = ({
    isMicOn,
    toggleMic,
    isDeafened,
    toggleDeafen,
    peersCount = 0,
    isVoiceAllowed = true,
    voiceError = null,
    onClearVoiceError,
}) => {
    const [showErrorPopover, setShowErrorPopover] = useState(Boolean(voiceError));

    useEffect(() => {
        if (voiceError) {
            setShowErrorPopover(true);
        }
    }, [voiceError]);

    const handleDismiss = () => {
        setShowErrorPopover(false);
        onClearVoiceError?.();
    };

    const handleTryAgain = () => {
        setShowErrorPopover(false);
        onClearVoiceError?.();
        toggleMic?.();
    };

    const disabledTooltip = `Voice chat is limited to rooms of up to ${MAX_VOICE_PLAYERS} players`;
    const micTitle = !isVoiceAllowed
        ? disabledTooltip
        : isMicOn
        ? 'Mute microphone'
        : 'Unmute microphone';
    const speakerTitle = !isVoiceAllowed
        ? disabledTooltip
        : isDeafened
        ? 'Enable audio'
        : 'Disable audio';

    return (
        <div className="relative inline-flex items-center gap-1.5 bg-paper border-2 border-ink shadow-hard-sm p-1 rounded-[8px] shrink-0 select-none">
            <button
                type="button"
                onClick={isVoiceAllowed ? toggleMic : undefined}
                disabled={!isVoiceAllowed}
                aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                aria-pressed={isMicOn}
                title={micTitle}
                className={`min-w-[40px] min-h-[40px] p-2 rounded-[6px] border-2 border-ink transition-transform cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                    !isVoiceAllowed
                        ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                        : isMicOn
                        ? 'bg-leaf text-white shadow-hard-sm'
                        : 'bg-card text-ink hover:bg-paper'
                }`}
            >
                {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button
                type="button"
                onClick={isVoiceAllowed ? toggleDeafen : undefined}
                disabled={!isVoiceAllowed}
                aria-label={isDeafened ? 'Enable audio' : 'Disable audio'}
                aria-pressed={!isDeafened}
                title={speakerTitle}
                className={`min-w-[40px] min-h-[40px] p-2 rounded-[6px] border-2 border-ink transition-transform cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${
                    !isVoiceAllowed
                        ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft'
                        : !isDeafened
                        ? 'bg-cobalt text-white shadow-hard-sm'
                        : 'bg-tomato text-white shadow-hard-sm'
                }`}
            >
                {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {isVoiceAllowed && peersCount > 0 && (
                <span className="text-xs text-ink-soft font-bold px-1 font-mono">
                    {peersCount}p
                </span>
            )}
            {!isVoiceAllowed && (
                <span className="text-[10px] text-tomato font-bold px-1" title={disabledTooltip}>
                    max {MAX_VOICE_PLAYERS}p
                </span>
            )}

            {/* Mic denied or missing: inline popover with browser-specific fix lines */}
            {showErrorPopover && (
                <div
                    role="alert"
                    aria-live="polite"
                    data-testid="voice-error-popover"
                    className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-card border-2 border-ink shadow-hard-lg rounded-[10px] p-3.5 z-popover select-none text-left"
                >
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-tomato font-bold text-xs sm:text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Microphone access needed</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleDismiss}
                            aria-label="Dismiss error"
                            className="text-ink-soft hover:text-ink p-0.5 rounded cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <p className="text-xs text-ink-soft mb-2.5 leading-snug">
                        {voiceError || 'Microphone access is blocked or unavailable.'} To allow it in your browser:
                    </p>

                    <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed mb-3 bg-paper p-2 rounded-[6px] border border-ink/40">
                        <div>
                            <strong className="text-ink">Chrome:</strong>{' '}
                            <span className="text-ink-soft">
                                Click the lock icon in the address bar and set Microphone to Allow.
                            </span>
                        </div>
                        <div>
                            <strong className="text-ink">Safari:</strong>{' '}
                            <span className="text-ink-soft">
                                Go to Settings &gt; Websites &gt; Microphone and set to Allow.
                            </span>
                        </div>
                        <div>
                            <strong className="text-ink">Firefox:</strong>{' '}
                            <span className="text-ink-soft">
                                Click the microphone icon in the address bar and clear the Blocked permission.
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleTryAgain}
                            className="flex-1 font-bold uppercase text-xs min-h-[36px]"
                        >
                            Try again
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleDismiss}
                            className="font-bold uppercase text-xs min-h-[36px] px-3"
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceControls;
