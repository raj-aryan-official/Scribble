import React from 'react';

export const SoundHint = ({ onDismiss }) => {
    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="sound-hint-bubble"
            className="absolute top-full mt-2 right-0 z-toast bg-marigold text-ink border-2 border-ink shadow-hard rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 whitespace-nowrap text-xs font-bold select-none"
        >
            <span>Sound is on. Tap to mute.</span>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onDismiss?.();
                }}
                aria-label="Dismiss sound hint"
                className="text-ink hover:text-ink-soft cursor-pointer font-black text-sm p-0.5 leading-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cobalt rounded"
            >
                ✕
            </button>
        </div>
    );
};

export default SoundHint;

