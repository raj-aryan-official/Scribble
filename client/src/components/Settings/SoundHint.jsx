import React, { useEffect } from 'react';

const BUBBLE_CLASSES =
    'absolute top-full mt-2 right-0 z-toast bg-marigold text-ink border-2 border-ink shadow-hard rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 whitespace-nowrap text-xs font-bold select-none max-w-[calc(100vw-2rem)]';
const INLINE_CLASSES =
    'w-full bg-marigold text-ink border-2 border-ink shadow-hard rounded-[8px] px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-bold select-none';

export const SoundHint = ({ onDismiss, autoHideMs = 6000, inline = false }) => {
    useEffect(() => {
        if (!autoHideMs) return undefined;
        const timer = setTimeout(() => onDismiss?.(), autoHideMs);
        return () => clearTimeout(timer);
    }, [autoHideMs, onDismiss]);

    return (
        <div
            role="status"
            aria-live="polite"
            data-testid={inline ? 'sound-hint-inline' : 'sound-hint-bubble'}
            className={inline ? INLINE_CLASSES : BUBBLE_CLASSES}
        >
            <span>Sound is on. Tap to mute.</span>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onDismiss?.();
                }}
                aria-label="Dismiss sound hint"
                className="text-ink hover:text-ink-soft cursor-pointer font-black text-sm p-0.5 leading-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cobalt rounded shrink-0"
            >
                ✕
            </button>
        </div>
    );
};

export default SoundHint;
