import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'scribble_scoring_coachmark_dismissed';

const isDismissedInStorage = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        }
        return false;
    } catch {
        return false;
    }
};

export const ScoringCoachmark = () => {
    const [isVisible, setIsVisible] = useState(() => !isDismissedInStorage());

    const handleDismiss = () => {
        setIsVisible(false);
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch {
            // Ignore storage errors
        }
    };

    if (!isVisible) return null;

    return (
        <div
            className="w-full bg-paper border-2 border-ink shadow-hard-sm rounded-[8px] p-2 sm:p-2.5 flex items-center justify-between gap-3 text-xs font-bold text-ink transition-all animate-in fade-in slide-in-from-top-2 duration-200"
            role="status"
            data-testid="scoring-coachmark"
        >
            <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-marigold border border-ink flex items-center justify-center text-ink shrink-0">
                    <Sparkles className="w-3 h-3 fill-ink" />
                </span>
                <p className="truncate sm:text-clip">
                    Speed counts: faster guesses earn more points, and the artist scores when players guess right.
                </p>
            </div>

            <button
                type="button"
                onClick={handleDismiss}
                className="shrink-0 text-xs font-black uppercase text-ink-soft hover:text-ink px-2 py-0.5 rounded-[4px] hover:bg-card border border-transparent hover:border-ink transition-all cursor-pointer flex items-center gap-1"
                aria-label="Dismiss scoring hint"
            >
                <span>Got it</span>
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export default ScoringCoachmark;
