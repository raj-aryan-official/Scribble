import React from 'react';
import GuessPanel from '../Game/GuessPanel';

export const ChatBox = ({ roomCode, isCompact = false }) => {
    return <GuessPanel roomCode={roomCode} isMobile={isCompact} />;
};

export default ChatBox;
