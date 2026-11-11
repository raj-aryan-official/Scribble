import React, { useRef } from 'react';

export const extractRoomCode = (text) => {
    if (!text || typeof text !== 'string') return '';
    const trimmed = text.trim();

    // Check if it's a URL or contains /join/ or /lobby/ or /game/
    const urlMatch = trimmed.match(/(?:join|lobby|game)\/([A-Za-z0-9]{6})(?:[/?#]|$)/i);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1].toUpperCase();
    }

    // Exact 6-char code
    const exactMatch = trimmed.match(/^[A-Za-z0-9]{6}$/);
    if (exactMatch) {
        return exactMatch[0].toUpperCase();
    }

    // Trailing 6 alphanumeric characters
    const trailingMatch = trimmed.match(/([A-Za-z0-9]{6})$/i);
    if (trailingMatch && trailingMatch[1]) {
        return trailingMatch[1].toUpperCase();
    }

    // Fallback: strip non-alphanumeric, take up to 6
    const clean = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.slice(0, 6);
};

export const RoomCodeInput = ({
    value = '',
    onChange,
    onComplete,
    onEnter,
    disabled = false,
    error = '',
    className = '',
}) => {
    const inputRefs = useRef([]);

    const handleChange = (e, index) => {
        const raw = e.target.value;
        const char = raw.slice(-1).toUpperCase();
        if (char && !/[A-Z0-9]/.test(char)) return;

        const currentChars = (value || '').toUpperCase().padEnd(6, ' ').split('');
        currentChars[index] = char || ' ';
        const nextValue = currentChars.join('').trimEnd();
        onChange?.(nextValue);

        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        if (nextValue.length === 6 && onComplete) {
            onComplete(nextValue);
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            const hasChar = Boolean(value[index] && value[index] !== ' ');
            if (hasChar) {
                const currentChars = (value || '').padEnd(6, ' ').split('');
                currentChars[index] = ' ';
                onChange?.(currentChars.join('').trimEnd());
            } else if (index > 0) {
                // Current box is already empty, move to previous and clear it
                e.preventDefault();
                inputRefs.current[index - 1]?.focus();
                const currentChars = (value || '').padEnd(6, ' ').split('');
                currentChars[index - 1] = ' ';
                onChange?.(currentChars.join('').trimEnd());
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            e.preventDefault();
            inputRefs.current[index + 1]?.focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const rawText = e.clipboardData.getData('text');
        const extracted = extractRoomCode(rawText);
        if (extracted) {
            onChange?.(extracted);
            const nextFocus = Math.min(extracted.length, 5);
            inputRefs.current[nextFocus]?.focus();
            if (extracted.length === 6 && onComplete) {
                onComplete(extracted);
            }
        }
    };

    return (
        <fieldset
            aria-label="Room code, 6 characters"
            className={`flex flex-col gap-1 w-full min-w-0 ${className}`}
        >
            <legend className="text-xs font-bold uppercase tracking-wider text-ink select-none mb-1">
                Room Code
            </legend>

            <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const char = value[idx] || '';
                    return (
                        <input
                            key={idx}
                            ref={(el) => (inputRefs.current[idx] = el)}
                            type="text"
                            inputMode="text"
                            maxLength={1}
                            value={char}
                            disabled={disabled}
                            onChange={(e) => handleChange(e, idx)}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            onPaste={handlePaste}
                            aria-label={`Character ${idx + 1} of 6`}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? 'room-code-error' : undefined}
                            className={`flex-1 min-w-0 max-w-[48px] h-12 text-center font-mono text-lg sm:text-xl font-black uppercase bg-card text-ink border-2 ${
                                error ? 'border-tomato ring-1 ring-tomato' : 'border-ink'
                            } rounded-[6px] shadow-hard-sm focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-1 select-all disabled:opacity-50 disabled:cursor-not-allowed`}
                        />
                    );
                })}
            </div>

            {error && (
                <p
                    id="room-code-error"
                    role="alert"
                    className="text-xs font-bold text-tomato mt-1 flex items-center gap-1"
                >
                    <span>•</span> {error}
                </p>
            )}
        </fieldset>
    );
};

export default RoomCodeInput;
