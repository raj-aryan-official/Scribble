import React from 'react';
import { Info, X } from 'lucide-react';

export const MidRoundBanner = ({ turnNumber = 1, onDismiss, className = '' }) => {
    return (
        <aside
            data-testid="mid-round-banner"
            aria-label="Mid-round join notice"
            className={`w-full bg-card border-2 border-ink shadow-hard-xs px-3 py-1.5 rounded-[8px] flex items-center justify-between gap-2 select-none ${className}`}
        >
            <div className="flex items-center gap-2 min-w-0">
                <Info className="w-4 h-4 text-cobalt shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-ink-soft truncate">
                    You joined mid-round. You'll draw in turn {turnNumber}.
                </span>
            </div>

            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss notice"
                    className="p-1 text-ink-soft hover:text-ink cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </aside>
    );
};

export default MidRoundBanner;

