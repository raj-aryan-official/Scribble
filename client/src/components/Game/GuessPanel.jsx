import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';
import Button from '../ui/Button';
import GuessInput from '../Chat/GuessInput';
import MessageList from '../Chat/MessageList';

export const GuessPanel = ({
    roomCode,
    isMobile = false,
    className = '',
}) => {
    const { state, dispatch } = useGame();
    const socket = useSocket();

    const [message, setMessage] = useState('');
    const [closeHint, setCloseHint] = useState(false);
    const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

    const closeTimeoutRef = useRef(null);

    const myId = state.currentUser?.id;
    const isDrawer = Boolean(myId && myId === state.drawerId);
    const hasGuessed = Boolean(myId && state.guessedPlayers?.includes(myId));
    const isGuessedOrDrawer = isDrawer || hasGuessed;

    useEffect(() => {
        if (!socket) return;

        const handleMessage = (msg) => {
            dispatch({ type: 'ADD_MESSAGE', payload: msg });
        };

        const handleCloseGuess = () => {
            setCloseHint(true);
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = setTimeout(() => {
                setCloseHint(false);
            }, 2000);
        };

        socket.on(EVENTS.MESSAGE_RECEIVED, handleMessage);
        socket.on(EVENTS.CLOSE_GUESS, handleCloseGuess);

        return () => {
            socket.off(EVENTS.MESSAGE_RECEIVED, handleMessage);
            socket.off(EVENTS.CLOSE_GUESS, handleCloseGuess);
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        };
    }, [socket, dispatch]);

    const handleSubmit = (textToSend) => {
        const trimmed = (textToSend || message).trim();
        if (!trimmed || !socket) return;

        socket.emit(EVENTS.SEND_MESSAGE, { roomCode, text: trimmed });
    };

    const headerTitle = isGuessedOrDrawer
        ? "Chatting with players who've guessed"
        : 'Guesses';

    // Mobile View: Pinned input directly under the paper with bottom sheet for chat messages
    if (isMobile) {
        return (
            <div className={`w-full select-none ${className}`}>
                {/* Bottom Sheet Drawer for Chat Messages */}
                <AnimatePresence>
                    {isBottomSheetOpen && (
                        <div className="fixed inset-0 z-sheet flex flex-col justify-end bg-ink/60">
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                className="bg-card border-t-2 border-ink shadow-hard-lg rounded-t-[16px] h-[55dvh] flex flex-col p-4"
                            >
                                <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2 mb-2">
                                    <h3 className="font-heading font-black text-sm uppercase text-ink">
                                        {headerTitle}
                                    </h3>
                                    <Button
                                        variant="quiet"
                                        size="sm"
                                        onClick={() => setIsBottomSheetOpen(false)}
                                        aria-label="Close chat sheet"
                                        className="p-1 min-h-[36px] w-[36px]"
                                    >
                                        <X className="w-5 h-5 text-ink" />
                                    </Button>
                                </div>

                                <MessageList
                                    messages={state.messages}
                                    isDrawer={isDrawer}
                                    currentUserId={myId}
                                />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Mobile Pinned Guess Input Bar */}
                <div className="flex items-center gap-2 w-full p-2 bg-card border-2 border-ink rounded-[12px] shadow-hard-sm">
                    <button
                        type="button"
                        onClick={() => setIsBottomSheetOpen(true)}
                        aria-label="Open chat messages"
                        title="Open chat"
                        className="min-h-[44px] min-w-[44px] p-2 bg-paper border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer hover:bg-card active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                    >
                        <MessageSquare className="w-5 h-5" />
                    </button>

                    <GuessInput
                        message={message}
                        setMessage={setMessage}
                        onSubmit={handleSubmit}
                        isMobile={true}
                        isDrawer={isDrawer}
                        hasGuessed={hasGuessed}
                        gainedPoints={state.myGainedPoints}
                        closeHint={closeHint}
                        idPrefix="mobile"
                        className="flex-1 min-w-0"
                    />
                </div>
            </div>
        );
    }

    // Desktop View: Right Column Card
    return (
        <aside
            aria-label="Chat and guesses"
            className={`w-full flex flex-col gap-3 p-3 bg-card border-2 border-ink shadow-hard rounded-[12px] overflow-hidden select-none h-full ${className}`}
        >
            {/* Header: Panel label changes to 'Chatting with players who've guessed' */}
            <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2 px-1 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="w-4 h-4 text-ink shrink-0" />
                    <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider text-ink truncate">
                        {headerTitle}
                    </h3>
                </div>
                {isDrawer ? (
                    <span className="text-[10px] font-bold bg-marigold px-2 py-0.5 rounded-[4px] border border-ink text-ink shrink-0">
                        Drawer Chat
                    </span>
                ) : hasGuessed ? (
                    <span className="text-[10px] font-bold bg-leaf text-white px-2 py-0.5 rounded-[4px] border border-ink shrink-0">
                        Guessed
                    </span>
                ) : null}
            </div>

            {/* Desktop: Guess input is prominent at the TOP of the right column */}
            <div className="w-full shrink-0">
                <GuessInput
                    message={message}
                    setMessage={setMessage}
                    onSubmit={handleSubmit}
                    isMobile={false}
                    isDrawer={isDrawer}
                    hasGuessed={hasGuessed}
                    gainedPoints={state.myGainedPoints}
                    closeHint={closeHint}
                    idPrefix="desktop"
                />
            </div>

            {/* Scrollable Message List */}
            <MessageList
                messages={state.messages}
                isDrawer={isDrawer}
                currentUserId={myId}
                className="flex-1 min-h-0"
            />
        </aside>
    );
};

export default GuessPanel;
