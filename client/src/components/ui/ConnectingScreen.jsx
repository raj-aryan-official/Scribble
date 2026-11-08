import React from 'react';
import Wordmark from '../Landing/Wordmark';
import Spinner from './Spinner';

/**
 * ConnectingScreen
 * Shown during initial application connection if connection takes longer than 300 ms.
 * Renders the Scribble wordmark with the pencil Spinner.
 */
export const ConnectingScreen = ({ className = '' }) => {
    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="connecting-screen"
            className={`min-h-[100dvh] w-full flex flex-col items-center justify-center bg-paper p-6 text-ink select-none ${className}`}
        >
            <div className="flex flex-col items-center gap-8 max-w-sm w-full text-center">
                <Wordmark />
                <div className="flex flex-col items-center gap-3">
                    <Spinner size="lg" label="Connecting to Scribble..." />
                    <span className="text-xs font-bold text-ink-soft uppercase tracking-wider font-mono">
                        Connecting...
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ConnectingScreen;

