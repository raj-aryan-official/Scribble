import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, Sparkles, Smile } from 'lucide-react';
import Button from '../ui/Button';
import { EmojiPicker } from './EmojiPicker';
import { replaceShortcodes } from '../../utils/shortcodes';

export const GuessInput = ({
    message = '',
    setMessage,
    onSubmit,
    isMobile = false,
    isDrawer = false,
    hasGuessed = false,
    gainedPoints = 0,
    closeHint = false,
    rateLimitWarning = false,
    idPrefix = 'desktop',
    className = '',
}) => {
    const inputRef = useRef(null);
    const [isSending, setIsSending] = useState(false);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const cooldownRef = useRef(null);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearTimeout(cooldownRef.current);
        };
    }, []);

    // Handle emoji selection from picker
    const handleEmojiSelect = (emoji) => {
        setMessage((prev) => (prev ? `${prev} ${emoji}` : emoji));
        setIsEmojiOpen(false);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 10);
    };

    // Text input change with shortcode replacement
    const handleInputChange = (e) => {
        const val = e.target.value;
        setMessage(replaceShortcodes(val));
    };

    // Keep focus after submission and prevent double submit
    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (e.nativeEvent?.isComposing) return;
        if (isSending) return;

        const converted = replaceShortcodes(message.trim());
        if (!converted) return;

        // Clear input BEFORE emitting
        setMessage('');
        setIsEmojiOpen(false);

        // Disable sending for 250 ms after a send
        setIsSending(true);
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
        cooldownRef.current = setTimeout(() => {
            setIsSending(false);
        }, 250);

        onSubmit?.(converted);

        // Maintain focus on the input so keyboard flow is seamless
        setTimeout(() => {
            inputRef.current?.focus();
        }, 10);
    };

    const handleKeyDown = (e) => {
        // Ignore Enter while event.nativeEvent.isComposing is true (IME composition)
        if (e.key === 'Enter' && e.nativeEvent?.isComposing) {
            e.preventDefault();
        }
    };

    // Autofocus on desktop only on mount
    useEffect(() => {
        if (!isMobile && !hasGuessed && !isDrawer) {
            inputRef.current?.focus();
        }
    }, [isMobile, hasGuessed, isDrawer]);

    // If player guessed correctly, the input collapses into a leaf-green chip
    if (hasGuessed) {
        return (
            <div className={`w-full flex flex-col gap-2 ${className}`}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    data-testid="correct-guess-chip"
                    className="w-full flex items-center justify-between p-2.5 bg-leaf text-white border-2 border-ink shadow-hard-sm rounded-[8px] font-bold text-sm select-none"
                >
                    <span className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-white stroke-[3] shrink-0" />
                        <span>You got it! +{gainedPoints || 320}</span>
                    </span>
                    <span className="text-[11px] font-mono uppercase bg-paper text-ink px-2 py-0.5 rounded-[4px] border border-ink font-bold">
                        Guessed
                    </span>
                </motion.div>

                {/* Chatting with winners input */}
                <form onSubmit={handleFormSubmit} className="flex items-center gap-2 relative">
                    <EmojiPicker
                        isOpen={isEmojiOpen}
                        onClose={() => setIsEmojiOpen(false)}
                        onSelect={handleEmojiSelect}
                    />
                    <label htmlFor={`${idPrefix}-winner-chat`} className="sr-only">
                        Chatting with players who've guessed
                    </label>
                    <input
                        ref={inputRef}
                        id={`${idPrefix}-winner-chat`}
                        type="text"
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Chat with players who've guessed..."
                        maxLength={100}
                        autoComplete="off"
                        className="flex-1 min-h-[44px] px-3 py-2 text-sm font-body bg-paper text-ink placeholder:text-ink-soft/60 border-2 border-ink rounded-[6px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setIsEmojiOpen(prev => !prev)}
                        aria-label="Choose emoji"
                        data-testid="emoji-picker-btn"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[6px] border-2 border-ink bg-paper hover:bg-neutral-100 active:scale-95 transition-all text-ink focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none shrink-0"
                    >
                        <Smile className="w-5 h-5 text-ink" />
                    </button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={!message.trim() || isSending}
                        aria-label="Send message"
                        className="min-h-[44px] px-3.5"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        );
    }

    // Drawer mode: chat with guessed players only
    if (isDrawer) {
        return (
            <form onSubmit={handleFormSubmit} className={`flex items-center gap-2 relative ${className}`}>
                <EmojiPicker
                    isOpen={isEmojiOpen}
                    onClose={() => setIsEmojiOpen(false)}
                    onSelect={handleEmojiSelect}
                />
                <label htmlFor={`${idPrefix}-drawer-chat`} className="sr-only">
                    Chatting with players who've guessed
                </label>
                <input
                    ref={inputRef}
                    id={`${idPrefix}-drawer-chat`}
                    type="text"
                    value={message}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Chat with players who've guessed..."
                    maxLength={100}
                    autoComplete="off"
                    className="flex-1 min-h-[44px] px-3 py-2 text-sm font-body bg-paper text-ink placeholder:text-ink-soft/60 border-2 border-ink rounded-[6px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                />
                <button
                    type="button"
                    onClick={() => setIsEmojiOpen(prev => !prev)}
                    aria-label="Choose emoji"
                    data-testid="emoji-picker-btn"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[6px] border-2 border-ink bg-paper hover:bg-neutral-100 active:scale-95 transition-all text-ink focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none shrink-0"
                >
                    <Smile className="w-5 h-5 text-ink" />
                </button>
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!message.trim() || isSending}
                    aria-label="Send message"
                    className="min-h-[44px] px-3.5"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        );
    }

    // Guesser active guess input
    return (
        <div className={`w-full flex flex-col ${className}`}>
            <form
                onSubmit={handleFormSubmit}
                className="flex items-center gap-2 w-full relative"
            >
                <EmojiPicker
                    isOpen={isEmojiOpen}
                    onClose={() => setIsEmojiOpen(false)}
                    onSelect={handleEmojiSelect}
                />
                <label htmlFor={`${idPrefix}-guess-input`} className="sr-only">
                    Type your guess
                </label>
                <div className="relative flex-1 flex items-center">
                    <input
                        ref={inputRef}
                        id={`${idPrefix}-guess-input`}
                        type="text"
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your guess"
                        maxLength={100}
                        autoFocus={!isMobile}
                        autoComplete="off"
                        className="w-full min-h-[44px] pl-3 pr-16 py-2 text-base sm:text-sm font-body bg-paper text-ink placeholder:text-ink-soft/60 border-2 border-ink rounded-[6px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                    />

                    {/* Character counter appears from 80 of 100 */}
                    {message.length >= 80 && (
                        <span
                            data-testid="char-counter"
                            className="absolute right-2.5 text-[11px] font-mono font-bold text-ink-soft bg-paper/90 px-1 rounded select-none pointer-events-none"
                        >
                            {message.length}/100
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setIsEmojiOpen(prev => !prev)}
                    aria-label="Choose emoji"
                    data-testid="emoji-picker-btn"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[6px] border-2 border-ink bg-paper hover:bg-neutral-100 active:scale-95 transition-all text-ink focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none shrink-0"
                >
                    <Smile className="w-5 h-5 text-ink" />
                </button>

                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!message.trim() || isSending}
                    aria-label="Submit guess"
                    className="min-h-[44px] px-3.5 sm:px-4"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>

            {/* Close Guess Feedback: Marigold pill 'Close!' under input for 2 s */}
            <AnimatePresence>
                {closeHint && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="mt-1.5 self-start inline-flex items-center gap-1.5 bg-marigold text-ink font-heading font-black text-xs px-3 py-1 rounded-full border-2 border-ink shadow-hard-xs select-none"
                        data-testid="close-guess-pill"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-ink shrink-0" />
                        <span>Close!</span>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Rate Limit Warning: Helper text under input for 2 s */}
            <AnimatePresence>
                {rateLimitWarning && (
                    <motion.p
                        role="alert"
                        data-testid="rate-limit-helper"
                        initial={{ opacity: 0, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                        className="text-xs text-tomato font-bold mt-1 select-none"
                    >
                        Slow down a little.
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GuessInput;

