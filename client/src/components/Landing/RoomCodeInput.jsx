import React, { useRef } from 'react';

export const RoomCodeInput = ({
    value = '',
    onChange,
    onComplete,
    disabled = false,
    className = '',
}) => {
    const inputRefs = useRef([]);

    const handleChange = (e, index) => {
        const char = e.target.value.slice(-1).toUpperCase();
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
            if (!value[index] || value[index] === ' ') {
                if (index > 0) {
                    inputRefs.current[index - 1]?.focus();
                }
            } else {
                const currentChars = (value || '').padEnd(6, ' ').split('');
                currentChars[index] = ' ';
                onChange?.(currentChars.join('').trimEnd());
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            e.preventDefault();
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (pasted) {
            onChange?.(pasted);
            const nextFocus = Math.min(pasted.length, 5);
            inputRefs.current[nextFocus]?.focus();
            if (pasted.length === 6 && onComplete) {
                onComplete(pasted);
            }
        }
    };

    return (
        <fieldset className={`flex flex-col gap-1.5 w-full ${className}`}>
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
                            aria-label={`Room code character ${idx + 1} of 6`}
                            className="flex-1 min-w-0 max-w-[48px] h-12 text-center font-mono text-lg sm:text-xl font-black uppercase bg-card text-ink border-2 border-ink rounded-[6px] shadow-hard-sm focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-1 select-all"
                        />
                    );
                })}
            </div>
        </fieldset>
    );
};

export default RoomCodeInput;
