import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare, X, Check, Sparkles } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';
import Button from '../ui/Button';

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
    const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState('');

    const messagesEndRef = useRef(null);
    const closeTimeoutRef = useRef(null);
    const lastAnnouncementTimeRef = useRef(0);

    const isDrawer = state.currentUser?.id === state.drawerId;
    const hasGuessed = Boolean(state.guessedPlayers?.includes(state.currentUser?.id));
    const isGuessedOrDrawer = isDrawer || hasGuessed;

    const inputPlaceholder = isDrawer
        ? 'You are drawing (chat only)...'
        : hasGuessed
        ? 'You guessed! Chat with winners...'
        : 'Type your guess here...';

    const inputLabel = isDrawer
        ? 'Chat with other players'
        : hasGuessed
        ? 'Chat with players who guessed'
        : 'Type your guess';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!socket) return;

        const handleMessage = (msg) => {
            dispatch({ type: 'ADD_MESSAGE', payload: msg });

            // Throttled screen reader announcement
            const now = Date.now();
            if (now - lastAnnouncementTimeRef.current >= 1200) {
                lastAnnouncementTimeRef.current = now;
                const announcement =
                    msg.type === 'correct'
                        ? `${msg.username} guessed the word!`
                        : `${msg.username}: ${msg.text}`;
                setScreenReaderAnnouncement(announcement);
            }
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

    useEffect(() => {
        scrollToBottom();
    }, [state.messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed) return;

        socket.emit(EVENTS.SEND_MESSAGE, { roomCode, text: trimmed });
        setMessage('');
    };

    const renderMessageStream = () => (
        <div
            tabIndex={0}
            role="region"
            aria-label="Chat messages"
            className="flex-1 overflow-y-auto p-3 space-y-2 bg-paper border-2 border-ink rounded-[8px] min-h-0 text-sm focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
        >
            {state.messages.slice(-100).map((msg, idx) => {
                if (msg.type === 'correct') {
                    const gainedText = msg.gained ? ` (+${msg.gained})` : '';
                    return (
                        <div
                            key={idx}
                            className="p-2 rounded-[6px] bg-leaf-deep text-white border-2 border-ink shadow-hard-sm flex items-center justify-between font-bold text-xs sm:text-sm select-none"
                        >
                            <span className="flex items-center gap-1.5">
                                <Check className="w-4 h-4 shrink-0 text-white" />
                                <span>{msg.username} guessed the word!</span>
                            </span>
                            {msg.gained && (
                                <span className="font-mono bg-paper text-ink px-2 py-0.5 rounded-[4px] border border-ink text-xs">
                                    {gainedText}
                                </span>
                            )}
                        </div>
                    );
                }

                if (msg.type === 'system') {
                    return (
                        <div
                            key={idx}
                            className="text-center text-xs font-bold text-ink-soft italic py-1"
                        >
                            {msg.text}
                        </div>
                    );
                }

                if (msg.type === 'guessed') {
                    return (
                        <div
                            key={idx}
                            className="p-1.5 rounded-[6px] bg-marigold/20 border border-ink text-ink text-xs sm:text-sm"
                        >
                            <span className="font-bold text-ink mr-1">
                                {msg.username}:
                            </span>
                            <span>{msg.text}</span>
                        </div>
                    );
                }

                return (
                    <div
                        key={idx}
                        className="text-xs sm:text-sm text-ink leading-relaxed"
                    >
                        <span className="font-bold text-ink mr-1">
                            {msg.username}:
                        </span>
                        <span>{msg.text}</span>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );

    // Mobile View: Pinned input + bottom sheet chat toggle
    if (isMobile) {
        return (
            <div className={`w-full select-none ${className}`}>
                {/* Screen reader live region */}
                <div className="sr-only" role="status" aria-live="polite">
                    {screenReaderAnnouncement}
                </div>

                {/* Close Hint Popover */}
                <AnimatePresence>
                    {closeHint && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="mb-2 p-2 bg-marigold text-ink border-2 border-ink rounded-[6px] shadow-hard-sm text-center font-bold text-xs flex items-center justify-center gap-1.5"
                        >
                            <Sparkles className="w-4 h-4 text-ink" />
                            <span>You're very close!</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Sheet Drawer for Chat */}
                <AnimatePresence>
                    {isBottomSheetOpen && (
                        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/60">
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                className="bg-card border-t-2 border-ink shadow-hard-lg rounded-t-[16px] h-[55dvh] flex flex-col p-4"
                            >
                                <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2 mb-2">
                                    <h3 className="font-heading font-black text-sm uppercase text-ink">
                                        Chat & Guesses
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

                                {renderMessageStream()}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Pinned Guess Input Bar */}
                <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2 w-full p-2 bg-card border-2 border-ink rounded-[12px] shadow-hard-sm"
                >
                    <button
                        type="button"
                        onClick={() => setIsBottomSheetOpen(true)}
                        aria-label="Open chat bottom sheet"
                        className="min-h-[44px] min-w-[44px] p-2 bg-paper border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer hover:bg-card active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <MessageSquare className="w-5 h-5" />
                    </button>

                    <label htmlFor="mobile-guess-input" className="sr-only">
                        {inputLabel}
                    </label>
                    <input
                        id="mobile-guess-input"
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={inputPlaceholder}
                        maxLength={100}
                        autoComplete="off"
                        className="flex-1 min-h-[44px] px-3 py-2 text-base font-body bg-paper text-ink placeholder:text-ink-soft/60 border-2 border-ink rounded-[6px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                    />

                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={!message.trim()}
                        aria-label="Submit guess"
                        className="min-h-[44px] px-4"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        );
    }

    // Desktop View: Right Column Card
    return (
        <aside
            aria-label="Chat and guesses"
            className={`w-full flex flex-col gap-3 p-3 bg-card border-2 border-ink shadow-hard rounded-[12px] overflow-hidden select-none h-full ${className}`}
        >
            {/* Screen reader live region */}
            <div className="sr-only" role="status" aria-live="polite">
                {screenReaderAnnouncement}
            </div>

            <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2 px-1">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-ink" />
                    <h3 className="font-heading font-black text-sm uppercase tracking-wider text-ink">
                        {isGuessedOrDrawer ? 'Winner Chat' : 'Guesses'}
                    </h3>
                </div>
                {isGuessedOrDrawer && (
                    <span className="text-[10px] font-bold bg-marigold px-2 py-0.5 rounded-[4px] border border-ink text-ink">
                        Guessed Room
                    </span>
                )}
            </div>

            {/* Close Hint Popover */}
            <AnimatePresence>
                {closeHint && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-2 bg-marigold text-ink border-2 border-ink rounded-[6px] shadow-hard-sm text-center font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                        <Sparkles className="w-4 h-4 text-ink" />
                        <span>You are very close!</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Message Stream */}
            {renderMessageStream()}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
                <label htmlFor="desktop-guess-input" className="sr-only">
                    {inputLabel}
                </label>
                <input
                    id="desktop-guess-input"
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={inputPlaceholder}
                    maxLength={100}
                    autoComplete="off"
                    className="flex-1 min-h-[44px] px-3 py-2 text-sm font-body bg-paper text-ink placeholder:text-ink-soft/60 border-2 border-ink rounded-[6px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                />

                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!message.trim()}
                    aria-label="Send message or guess"
                    className="min-h-[44px] px-3.5"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </aside>
    );
};

export default GuessPanel;
