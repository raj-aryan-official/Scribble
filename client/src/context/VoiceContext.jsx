import React, { createContext, useContext } from 'react';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useGame } from './GameContext';

export const VoiceContext = createContext(null);

export const VoiceProvider = ({ children }) => {
    const { state } = useGame();
    // Only connect voice if we have a roomCode
    const voiceState = useVoiceChat(
        state?.roomCode || null,
        state?.currentUser?.username || null,
        state?.players?.length || 1
    );

    return (
        <VoiceContext.Provider value={voiceState}>
            {children}
        </VoiceContext.Provider>
    );
};

export const useVoice = () => {
    return useContext(VoiceContext);
};

export default VoiceContext;

