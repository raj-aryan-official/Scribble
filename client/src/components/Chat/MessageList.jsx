import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowDown } from 'lucide-react';
import { isOnlyEmoji } from '../../utils/shortcodes';

export const MessageList = ({
    messages = [],
    isDrawer = false,
    currentUserId,
    className = '',
}) => {
    const containerRef = useRef(null);
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const [hasNewMessages, setHasNewMessages] = useState(false);
    const [liveAnnouncement, setLiveAnnouncement] = useState('');
    const lastAnnouncementTimeRef = useRef(0);

    // Filter messages for drawer (only sees guessed channel, correct guesses, system)
    const displayedMessages = messages.slice(-100).filter((msg) => {
        if (isDrawer) {
            return msg.type === 'guessed' || msg.type === 'correct' || msg.type === 'system';
        }
        return true;
    });

    const prevMessageCountRef = useRef(displayedMessages.length);

    // Scroll to bottom helper
    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
        setIsScrolledUp(false);
        setHasNewMessages(false);
    };

    // Detect user scroll position
    const handleScroll = () => {
        const el = containerRef.current;
        if (!el) return;

        // If user is more than 40px away from bottom, mark as scrolled up
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const up = distanceFromBottom > 40;
        setIsScrolledUp(up);

        if (!up) {
            setHasNewMessages(false);
        }
    };

    // Auto-scroll on new message unless user scrolled up
    useEffect(() => {
        const count = displayedMessages.length;
        if (count > prevMessageCountRef.current) {
            const latestMsg = displayedMessages[displayedMessages.length - 1];

            // Throttled accessibility announcements:
            // "guesses are not announced at all except your own result"
            const isMyMsg = latestMsg.playerId === currentUserId || latestMsg.userId === currentUserId;
            const isCorrect = latestMsg.type === 'correct';
            const isSystem = latestMsg.type === 'system';

            // Only announce your own correct guess or system notifications
            if ((isMyMsg && isCorrect) || isSystem) {
                const now = Date.now();
                if (now - lastAnnouncementTimeRef.current >= 800) {
                    lastAnnouncementTimeRef.current = now;
                    const announcement = isCorrect
                        ? `You guessed the word! +${latestMsg.gained || 320} points`
                        : latestMsg.text;
                    setLiveAnnouncement(announcement);
                }
            }

            if (isScrolledUp) {
                setHasNewMessages(true);
            } else {
                // Keep scrolled to bottom
                scrollToBottom();
            }
        }
        prevMessageCountRef.current = count;
    }, [displayedMessages, isScrolledUp, currentUserId]);

    return (
        <div className={`relative flex-1 min-h-0 flex flex-col ${className}`}>
            {/* Screen reader live region */}
            <div className="sr-only" role="status" aria-live="polite">
                {liveAnnouncement}
            </div>

            {/* Scrollable message container */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                tabIndex={0}
                role="region"
                aria-label="Chat messages"
                className="flex-1 overflow-y-auto p-3 space-y-2 bg-paper border-2 border-ink rounded-[8px] min-h-0 text-sm focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
            >
                {displayedMessages.map((msg, idx) => {
                    const msgKey = msg.id || `msg-${idx}`;
                    // Correct Guess Message: leaf tint with ink text + check icon
                    if (msg.type === 'correct') {
                        const gainedText = msg.gained ? ` (+${msg.gained})` : '';
                        return (
                            <div
                                key={msgKey}
                                data-testid="correct-message-item"
                                className="p-2 rounded-[6px] bg-leaf/20 text-ink border border-leaf/40 flex items-center justify-between font-bold text-xs sm:text-sm select-none"
                            >
                                <span className="flex items-center gap-1.5">
                                    <Check className="w-4 h-4 text-leaf-deep stroke-[3] shrink-0" />
                                    <span>{msg.username} guessed the word!</span>
                                </span>
                                {msg.gained && (
                                    <span className="font-mono text-xs font-bold text-ink">
                                        {gainedText}
                                    </span>
                                )}
                            </div>
                        );
                    }

                    // System message: centered italic
                    if (msg.type === 'system') {
                        return (
                            <div
                                key={msgKey}
                                data-testid="system-message-item"
                                className="text-center text-xs font-bold text-ink-soft italic py-1 select-none"
                            >
                                {msg.text}
                            </div>
                        );
                    }

                    // Guessed channel message (winners chat)
                    if (msg.type === 'guessed') {
                        const emojiOnly = isOnlyEmoji(msg.text);
                        return (
                            <div
                                key={msgKey}
                                data-testid="guessed-channel-message-item"
                                className="p-1.5 rounded-[6px] bg-marigold/20 border border-ink text-xs sm:text-sm"
                            >
                                <span className="font-bold text-ink mr-1.5">
                                    {msg.username}:
                                </span>
                                <span className={emojiOnly ? 'text-2xl sm:text-3xl inline-block leading-tight my-0.5' : 'text-ink-soft'}>
                                    {msg.text}
                                </span>
                            </div>
                        );
                    }

                    // Standard wrong guess or lobby/spectator chat line:
                    // Name in ink, text in ink-soft (larger if only emojis)
                    const emojiOnly = isOnlyEmoji(msg.text);
                    return (
                        <div
                            key={msgKey}
                            data-testid="chat-message-item"
                            className="text-xs sm:text-sm leading-relaxed"
                        >
                            <span className="font-bold text-ink mr-1.5">
                                {msg.username}:
                            </span>
                            <span className={emojiOnly ? 'text-2xl sm:text-3xl inline-block leading-tight my-0.5' : 'text-ink-soft'}>
                                {msg.text}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* "New messages" floating pill when user scrolled up */}
            <AnimatePresence>
                {isScrolledUp && hasNewMessages && (
                    <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        onClick={scrollToBottom}
                        data-testid="new-messages-pill"
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-marigold text-ink border-2 border-ink shadow-hard-sm px-3.5 py-1.5 rounded-full font-heading font-black text-xs cursor-pointer flex items-center gap-1.5 z-10 hover:bg-marigold/90 active:translate-y-0.5 select-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                    >
                        <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>New messages</span>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MessageList;

