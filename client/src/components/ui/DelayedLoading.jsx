import React, { useState, useEffect } from 'react';
import Wordmark from '../Landing/Wordmark';
import Spinner from './Spinner';

/**
 * DelayedLoading
 * Shows the Scribble wordmark and pencil Spinner ONLY if the app or screen
 * takes > 300 ms to be ready. Prevents jarring flash-of-loading on fast loads.
 */
export const DelayedLoading = ({
    delay = 300,
    label = 'Loading Scribble...',
    className = '',
}) => {
    const [shouldDisplay, setShouldDisplay] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldDisplay(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    if (!shouldDisplay) {
        return null;
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={`min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-paper select-none ${className}`}
        >
            <div className="flex flex-col items-center gap-6 text-center max-w-sm">
                <Wordmark />
                <Spinner size="lg" label={label} />
                <p className="text-sm font-bold text-ink-soft animate-pulse">
                    {label}
                </p>
            </div>
        </div>
    );
};

export default DelayedLoading;
