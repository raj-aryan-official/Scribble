import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';
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
    const [keyboardOffset, setKeyboardOffset] = useState(0);

    const closeTimeoutRef = useRef(null);

    const myId = state.currentUser?.id;
    const isDrawer = Boolean(myId && myId === state.drawerId);
    const hasGuessed = Boolean(myId && state.guessedPlayers?.includes(myId));
    const isGuessedOrDrawer = isDrawer || hasGuessed;

    // Use visualViewport only to lift the sheet and bottom input above the keyboard
    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) return;

        const handleViewportChange = () => {
            const vv = window.visualViewport;
            const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            setKeyboardOffset(offset);
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
        return () => {
            window.visualViewport?.removeEventListener('resize', handleViewportChange);
            window.visualViewport?.removeEventListener('scroll', handleViewportChange);
        };
    }, []);

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

    // Filter messages for drawer (only sees guessed channel, correct guesses, system)
    const filteredMessages = state.messages.filter((msg) => {
        if (isDrawer) {
            return msg.type === 'guessed' || msg.type === 'correct' || msg.type === 'system';
        }
        return true;
    });
    const lastMsg = filteredMessages[filteredMessages.length - 1];

    // Mobile View: Collapsed single-line chat with grab handle + half-height bottom sheet on drag/tap + pinned guess input
    if (isMobile) {
        return (
            <div
                className={`w-full max-w-full select-none flex flex-col transition-transform duration-100 overflow-x-hidden ${className}`}
                style={{
                    transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
                }}
            >
                {/* Collapsed Chat Strip: Shows only the last message line with a grab handle */}
                <div
                    onClick={() => setIsBottomSheetOpen(true)}
                    role="button"
                    tabIndex={0}
                    aria-label="Open chat bottom sheet"
                    data-testid="chat-bottom-sheet-collapsed"
                    className="w-full flex flex-col items-center bg-card border-2 border-b-0 border-ink rounded-t-[12px] pt-1 pb-1.5 px-3 shadow-hard-sm cursor-pointer select-none active:bg-paper"
                >
                    {/* Grab handle */}
                    <div className="w-10 h-1 bg-ink/30 rounded-full mb-1" />
                    {/* Last message line */}
                    <div className="w-full flex items-center justify-between text-xs min-h-[22px]">
                        <div className="flex items-center gap-1.5 truncate max-w-[85%]">
                            <MessageSquare className="w-3.5 h-3.5 text-ink shrink-0" />
                            {lastMsg ? (
                                <span className="truncate">
                                    <strong className="text-ink mr-1">{lastMsg.username}:</strong>
                                    <span className="text-ink-soft">{lastMsg.text}</span>
                                </span>
                            ) : (
                                <span className="text-ink-soft italic">No messages yet. Drag up to view chat.</span>
                            )}
                        </div>
                        <span className="text-[10px] font-bold uppercase text-ink-soft shrink-0">Chat</span>
                    </div>
                </div>

                {/* Pinned Guess Input Row: pinned to bottom, respecting safe-area inset */}
                <div className="w-full p-2 bg-card border-2 border-ink rounded-b-[12px] shadow-hard-sm pb-[calc(env(safe-area-inset-bottom,0px)+6px)]">
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
                        className="w-full"
                    />
                </div>

                {/* Bottom Sheet Drawer for Chat: Snaps to half height (50dvh) with framer-motion drag */}
                <AnimatePresence>
                    {isBottomSheetOpen && (
                        <>
                            {/* Backdrop: tapping outside closes it */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsBottomSheetOpen(false)}
                                className="fixed inset-0 z-sheet bg-ink/60 select-none"
                                data-testid="chat-backdrop"
                            />

                            {/* Half-height bottom sheet with drag down to close */}
                            <motion.div
                                drag="y"
                                dragConstraints={{ top: 0, bottom: 0 }}
                                dragElastic={{ top: 0.05, bottom: 0.5 }}
                                onDragEnd={(e, info) => {
                                    if (info.offset.y > 60 || info.velocity.y > 200) {
                                        setIsBottomSheetOpen(false);
                                    }
                                }}
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                                className="fixed left-0 right-0 z-sheet bg-card border-t-2 border-ink shadow-hard-lg rounded-t-[16px] h-[50dvh] flex flex-col p-3 overflow-hidden select-none"
                                style={{
                                    bottom: `${keyboardOffset}px`,
                                }}
                                data-testid="chat-bottom-sheet-expanded"
                            >
                                {/* Grab handle */}
                                <div
                                    className="w-12 h-1.5 bg-ink/30 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing shrink-0"
                                    title="Drag down to close"
                                />

                                <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2 mb-2 shrink-0">
                                    <h3 className="font-heading font-black text-sm uppercase text-ink">
                                        {headerTitle}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsBottomSheetOpen(false)}
                                        aria-label="Close chat sheet"
                                        className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center text-ink cursor-pointer hover:bg-paper rounded-[6px]"
                                    >
                                        <X className="w-5 h-5 text-ink" />
                                    </button>
                                </div>

                                <MessageList
                                    messages={state.messages}
                                    isDrawer={isDrawer}
                                    currentUserId={myId}
                                    className="flex-1 min-h-0"
                                />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
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
