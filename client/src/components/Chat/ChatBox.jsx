import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS, GAME_STATES } from '../../../../shared/types';
import { Check } from 'lucide-react';

export const ChatBox = ({ roomCode, isCompact = false }) => {
    const { state, dispatch } = useGame();
    const socket = useSocket();
    const [message, setMessage] = useState('');
    const [closeHint, setCloseHint] = useState(false);
    const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState('');
    const messagesEndRef = useRef(null);
    const closeTimeoutRef = useRef(null);
    const lastAnnouncementTimeRef = useRef(0);

    const isDrawer = state.currentUser?.id === state.drawerId;
    const hasGuessed = Boolean(state.guessedPlayers?.includes(state.currentUser?.id));
    const isGuessedOrDrawer = isDrawer || hasGuessed;
    const inputLabel = isGuessedOrDrawer ? 'Chat with players who guessed' : 'Type your guess';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!socket) return;

        const handleMessage = (msg) => {
            dispatch({ type: 'ADD_MESSAGE', payload: msg });

            // Throttled screen reader announcement (at most once every 1200ms)
            const now = Date.now();
            if (now - lastAnnouncementTimeRef.current >= 1200) {
                lastAnnouncementTimeRef.current = now;
                const announcement = msg.type === 'correct'
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
        if (!isCompact) {
            scrollToBottom();
        }
    }, [state.messages, isCompact]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed) return;

        socket.emit(EVENTS.SEND_MESSAGE, { roomCode, text: trimmed });
        setMessage('');
    };

    return (
        <div className="flex flex-col h-full w-full select-text">
            {/* Screen reader live notification region */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {screenReaderAnnouncement}
            </div>

            {!isCompact && (
                <div
                    aria-live="polite"
                    aria-atomic="false"
                    className="flex-grow overflow-y-auto p-3 space-y-1.5 bg-gray-50 rounded-lg mb-2 min-h-0 text-sm"
                >
                    {state.messages.slice(-100).map((msg, idx) => {
                        if (msg.type === 'correct') {
                            const gainedDisplay = msg.gained ? ` +${msg.gained}` : '';
                            return (
                                <div
                                    key={idx}
                                    className="p-2 rounded-lg bg-green-50 border border-green-200 text-green-900 font-semibold flex items-center justify-between text-xs md:text-sm animate-in fade-in"
                                >
                                    <span>🎉 {msg.username} guessed it{gainedDisplay}</span>
                                    {msg.gained && (
                                        <span className="font-mono font-bold bg-green-200/80 text-green-800 px-2 py-0.5 rounded-full text-xs">
                                            +{msg.gained}
                                        </span>
                                    )}
                                </div>
                            );
                        }

                        if (msg.type === 'guessed') {
                            return (
                                <div
                                    key={idx}
                                    className="p-1.5 rounded-md bg-emerald-50/60 border-l-2 border-emerald-400 text-gray-800 text-xs md:text-sm"
                                >
                                    <span className="font-bold text-emerald-800 mr-1.5">
                                        {msg.username} <span className="text-[10px] text-emerald-600 font-normal">(guessed)</span>:
                                    </span>
                                    <span>{msg.text}</span>
                                </div>
                            );
                        }

                        if (msg.type === 'system') {
                            return (
                                <div key={idx} className="p-1 text-center text-xs text-gray-500 italic">
                                    {msg.text}
                                </div>
                            );
                        }

                        return (
                            <div key={idx} className="p-1.5 rounded-md bg-white shadow-2xs border border-gray-100 text-xs md:text-sm break-words">
                                <span className="font-bold text-gray-700 mr-1.5">{msg.username}:</span>
                                <span className="text-gray-900">{msg.text}</span>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            )}

            {/* Hint / Status area */}
            <div className="flex items-center justify-between gap-1 mb-1 px-1 min-h-[22px]">
                {closeHint && (
                    <div className="text-amber-700 bg-amber-100 border border-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse transition-opacity duration-300">
                        ⚠️ Close!
                    </div>
                )}
                {hasGuessed && (
                    <div className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300 shadow-2xs">
                        <Check size={12} className="stroke-[3]" />
                        <span>You got it!</span>
                    </div>
                )}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSubmit} className={`flex gap-1.5 ${isCompact ? 'p-1 bg-white border-t' : ''}`}>
                <input
                    type="text"
                    maxLength={100}
                    aria-label={inputLabel}
                    placeholder={inputLabel}
                    className={`flex-grow border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all ${
                        hasGuessed
                            ? 'bg-green-50/40 border-green-300 focus:ring-green-400'
                            : 'bg-white border-gray-200'
                    } ${isCompact ? 'p-1.5' : 'p-2'}`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button
                    type="submit"
                    className={`rounded-lg font-bold text-white transition-all shadow-sm active:scale-95 ${
                        hasGuessed ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-blue-600'
                    } ${isCompact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                    Send
                </button>
            </form>
        </div>
    );
};
