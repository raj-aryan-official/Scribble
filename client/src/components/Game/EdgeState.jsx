import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

export const EDGE_STATES = {
    RECONNECTING: {
        title: 'Reconnecting',
        sentence: 'Connecting back to the ink room.',
        icon: (
            <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="24" stroke="#1C1B18" strokeWidth="2.5" strokeDasharray="6 6" />
                <path d="M 24 32 C 24 28, 28 24, 32 24 C 36 24, 40 28, 40 32" stroke="#2F4FD8" strokeWidth="3" strokeLinecap="round" />
                <circle cx="32" cy="32" r="4" fill="#E4472B" stroke="#1C1B18" strokeWidth="1.5" />
            </svg>
        ),
    },
    ROOM_NOT_FOUND: {
        title: 'Room Not Found',
        sentence: 'This room does not exist on our paper.',
        icon: (
            <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="14" y="12" width="36" height="42" rx="4" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="2.5" />
                <line x1="22" y1="22" x2="38" y2="22" stroke="#1C1B18" strokeWidth="2" strokeLinecap="round" />
                <line x1="22" y1="30" x2="34" y2="30" stroke="#1C1B18" strokeWidth="2" strokeLinecap="round" />
                <circle cx="38" cy="40" r="8" fill="#F6B72C" stroke="#1C1B18" strokeWidth="2" />
                <line x1="44" y1="46" x2="52" y2="54" stroke="#1C1B18" strokeWidth="3" strokeLinecap="round" />
            </svg>
        ),
    },
    ROOM_FULL: {
        title: 'Room Full',
        sentence: 'This room is already at full capacity.',
        icon: (
            <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="16" y="24" width="32" height="26" rx="4" fill="#F6B72C" stroke="#1C1B18" strokeWidth="2.5" />
                <path d="M 24 24 L 24 18 C 24 13.5, 40 13.5, 40 18 L 40 24" stroke="#1C1B18" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <circle cx="32" cy="35" r="3" fill="#1C1B18" />
                <line x1="32" y1="38" x2="32" y2="43" stroke="#1C1B18" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
    },
    KICKED: {
        title: 'Removed from Room',
        sentence: 'You were removed from this room by the host.',
        icon: (
            <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="12" y="10" width="28" height="44" rx="4" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="2.5" />
                <circle cx="34" cy="32" r="2.5" fill="#1C1B18" />
                <path d="M 32 32 L 52 32" stroke="#E4472B" strokeWidth="3" strokeLinecap="round" />
                <path d="M 46 26 L 52 32 L 46 38" stroke="#E4472B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    MIC_DENIED: {
        title: 'Microphone Denied',
        sentence: 'Microphone access was denied in your browser settings.',
        icon: (
            <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="25" y="14" width="14" height="22" rx="7" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="2.5" />
                <path d="M 18 28 C 18 37, 46 37, 46 28" stroke="#1C1B18" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <line x1="32" y1="41" x2="32" y2="50" stroke="#1C1B18" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="24" y1="50" x2="40" y2="50" stroke="#1C1B18" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="14" y1="14" x2="50" y2="50" stroke="#E4472B" strokeWidth="3" strokeLinecap="round" />
            </svg>
        ),
    },
    GAME_ENDED_BY_HOST: {
        title: 'Game Ended',
        sentence: 'The host ended the game for everyone.',
        icon: (
            <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 16 16 L 48 16 L 44 48 L 20 48 Z" fill="#F6B72C" stroke="#1C1B18" strokeWidth="2.5" strokeLinejoin="round" />
                <line x1="12" y1="16" x2="52" y2="16" stroke="#1C1B18" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="26" y1="28" x2="38" y2="40" stroke="#E4472B" strokeWidth="3" strokeLinecap="round" />
                <line x1="38" y1="28" x2="26" y2="40" stroke="#E4472B" strokeWidth="3" strokeLinecap="round" />
            </svg>
        ),
    },
};

export const mapErrorToEdgeState = (errorString) => {
    if (!errorString || typeof errorString !== 'string') return null;
    const lower = errorString.toLowerCase();
    if (lower.includes('not found')) return 'ROOM_NOT_FOUND';
    if (lower.includes('full')) return 'ROOM_FULL';
    if (lower.includes('kicked')) return 'KICKED';
    if (lower.includes('mic') || lower.includes('audio') || lower.includes('permission')) return 'MIC_DENIED';
    if (lower.includes('ended') || lower.includes('not enough players')) return 'GAME_ENDED_BY_HOST';
    if (lower.includes('reconnect') || lower.includes('disconnect')) return 'RECONNECTING';
    return null;
};

export const EdgeState = ({
    type = 'ROOM_NOT_FOUND',
    onAction,
    actionText = 'Back to Home',
    className = '',
}) => {
    const config = EDGE_STATES[type] || EDGE_STATES.ROOM_NOT_FOUND;

    return (
        <div
            data-testid="edge-state"
            className={`flex flex-col items-center justify-center p-6 text-center select-none ${className}`}
        >
            <Card className="flex flex-col items-center justify-center p-8 max-w-sm w-full text-center shadow-hard-lg bg-card gap-4">
                <div className="w-20 h-20 rounded-full border-2 border-ink bg-paper flex items-center justify-center shadow-hard-sm">
                    {config.icon}
                </div>

                <div className="flex flex-col gap-1">
                    <h2 className="text-xl sm:text-2xl font-black font-heading text-ink">
                        {config.title}
                    </h2>
                    <p className="text-sm text-ink-soft">
                        {config.sentence}
                    </p>
                </div>

                {onAction && (
                    <Button
                        variant="primary"
                        size="md"
                        onClick={onAction}
                        className="w-full mt-2 uppercase font-bold"
                    >
                        {actionText}
                    </Button>
                )}
            </Card>
        </div>
    );
};

export default EdgeState;
