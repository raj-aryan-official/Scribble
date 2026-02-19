import React, { useEffect } from 'react';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

export const VoiceControls = ({ isMicOn, toggleMic, isDeafened, toggleDeafen, peersCount }) => {
    return (
        <div className="flex items-center gap-1 md:gap-2 bg-gray-100 p-1 md:p-2 rounded-lg shrink-0">
            <button
                onClick={toggleMic}
                className={`p-1 md:p-2 rounded-full transition-colors ${isMicOn ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
            >
                {isMicOn ? <Mic size={16} className="md:w-5 md:h-5" /> : <MicOff size={16} className="md:w-5 md:h-5" />}
            </button>

            <button
                onClick={toggleDeafen}
                className={`p-1 md:p-2 rounded-full transition-colors ${!isDeafened ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                    }`}
                title={isDeafened ? "Enable Audio" : "Disable Audio"}
            >
                {isDeafened ? <VolumeX size={16} className="md:w-5 md:h-5" /> : <Volume2 size={16} className="md:w-5 md:h-5" />}
            </button>

            {peersCount > 0 && <span className="text-xs text-gray-500 font-medium ml-1">{peersCount} active</span>}
        </div>
    );
};
