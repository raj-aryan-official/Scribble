import React from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { MAX_VOICE_PLAYERS } from '../../utils/voiceUtils';

export const VoiceControls = ({
    isMicOn,
    toggleMic,
    isDeafened,
    toggleDeafen,
    peersCount = 0,
    isVoiceAllowed = true,
}) => {
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
        <div className="flex items-center gap-1.5 bg-paper border-2 border-ink shadow-hard-sm p-1 rounded-[8px] shrink-0 select-none">
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
        </div>
    );
};

export default VoiceControls;
