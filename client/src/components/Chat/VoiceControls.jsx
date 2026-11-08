import React from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { MAX_VOICE_PLAYERS } from '../../utils/voiceUtils';

export const VoiceControls = ({
    isMicOn,
    toggleMic,
    isDeafened,
    toggleDeafen,
    peersCount = 0,
    isVoiceAllowed = true
}) => {
    const disabledTooltip = `Voice chat is limited to rooms of up to ${MAX_VOICE_PLAYERS} players`;
    const micTitle = !isVoiceAllowed
        ? disabledTooltip
        : isMicOn
        ? "Mute microphone"
        : "Unmute microphone";
    const speakerTitle = !isVoiceAllowed
        ? disabledTooltip
        : isDeafened
        ? "Enable audio"
        : "Disable audio";

    return (
        <div className="flex items-center gap-1 md:gap-2 bg-gray-100 p-1 md:p-2 rounded-lg shrink-0">
            <button
                onClick={isVoiceAllowed ? toggleMic : undefined}
                disabled={!isVoiceAllowed}
                aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
                aria-pressed={isMicOn}
                title={micTitle}
                className={`p-1 md:p-2 rounded-full transition-colors ${
                    !isVoiceAllowed
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                        : isMicOn
                        ? 'bg-green-100 text-green-600 hover:bg-green-200 cursor-pointer'
                        : 'bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer'
                }`}
            >
                {isMicOn ? <Mic size={16} className="md:w-5 md:h-5" /> : <MicOff size={16} className="md:w-5 md:h-5" />}
            </button>

            <button
                onClick={isVoiceAllowed ? toggleDeafen : undefined}
                disabled={!isVoiceAllowed}
                aria-label={isDeafened ? "Enable audio" : "Disable audio"}
                aria-pressed={!isDeafened}
                title={speakerTitle}
                className={`p-1 md:p-2 rounded-full transition-colors ${
                    !isVoiceAllowed
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                        : !isDeafened
                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer'
                        : 'bg-gray-300 text-gray-600 hover:bg-gray-400 cursor-pointer'
                }`}
            >
                {isDeafened ? <VolumeX size={16} className="md:w-5 md:h-5" /> : <Volume2 size={16} className="md:w-5 md:h-5" />}
            </button>

            {isVoiceAllowed && peersCount > 0 && (
                <span className="text-xs text-gray-500 font-medium ml-1">
                    {peersCount} active
                </span>
            )}
            {!isVoiceAllowed && (
                <span className="text-[10px] text-gray-400 font-medium ml-1" title={disabledTooltip}>
                    max {MAX_VOICE_PLAYERS}p
                </span>
            )}
        </div>
    );
};
