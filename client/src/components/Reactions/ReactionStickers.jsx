import React from 'react';

export const REACTION_DEFINITIONS = [
    { kind: 'heart', label: 'Heart', emoji: '❤️', color: '#EF4444' },
    { kind: 'clap', label: 'Clap', emoji: '👏', color: '#F59E0B' },
    { kind: 'laugh', label: 'Laugh', emoji: '😂', color: '#EAB308' },
    { kind: 'wow', label: 'Surprise', emoji: '😮', color: '#3B82F6' },
    { kind: 'fire', label: 'Fire', emoji: '🔥', color: '#F97316' },
    { kind: 'thinking', label: 'Thinking', emoji: '🤔', color: '#8B5CF6' },
    { kind: 'sad', label: 'Sad', emoji: '😢', color: '#06B6D4' },
    { kind: 'party', label: 'Party', emoji: '🎉', color: '#EC4899' },
];

export const ReactionIcon = ({ kind, size = 24, className = '' }) => {
    switch (kind) {
        case 'heart':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        fill="#EF4444"
                        stroke="#111827"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                    />
                </svg>
            );
        case 'clap':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" fill="#FBBF24" stroke="#111827" strokeWidth="1.75" />
                    <path
                        d="M8 12.5L11 9.5M11.5 15.5L14.5 12.5M13 8.5L16 11.5"
                        stroke="#111827"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M8 16c1.5-2 3.5-3 6-3"
                        stroke="#111827"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                    />
                </svg>
            );
        case 'laugh':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" fill="#FDE047" stroke="#111827" strokeWidth="1.75" />
                    {/* Squinting eyes */}
                    <path d="M7 9l3 2-3 2M17 9l-3 2 3 2" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Big open smile */}
                    <path d="M7 14c1.2 3 8.8 3 10 0" fill="#111827" stroke="#111827" strokeWidth="1.5" />
                    <path d="M9 14.5c.8 1.5 5.2 1.5 6 0" fill="#EF4444" />
                </svg>
            );
        case 'wow':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" fill="#60A5FA" stroke="#111827" strokeWidth="1.75" />
                    <circle cx="8.5" cy="9.5" r="1.5" fill="#111827" />
                    <circle cx="15.5" cy="9.5" r="1.5" fill="#111827" />
                    <ellipse cx="12" cy="15.5" rx="2.5" ry="3.5" fill="#111827" />
                </svg>
            );
        case 'fire':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <path
                        d="M12 2c-.5 3-4 5-4 9a6 6 0 1012 0c0-4-3.5-6-4-9-.5 2-2 3-4 0z"
                        fill="#F97316"
                        stroke="#111827"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M12 11c-.3 1.5-2 2.5-2 4.5a3 3 0 006 0c0-2-1.7-3-2-4.5-.2 1-1 1.5-2 0z"
                        fill="#FDE047"
                    />
                </svg>
            );
        case 'thinking':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" fill="#C084FC" stroke="#111827" strokeWidth="1.75" />
                    {/* Looking up eyes */}
                    <circle cx="9" cy="8.5" r="1.5" fill="#111827" />
                    <circle cx="15" cy="8.5" r="1.5" fill="#111827" />
                    {/* Pensive mouth */}
                    <path d="M9 15.5c2-.5 4-.5 6 0" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
                    {/* Hand on chin */}
                    <path d="M7 19c2-1 4-1 6-2" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case 'sad':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" fill="#38BDF8" stroke="#111827" strokeWidth="1.75" />
                    <circle cx="8.5" cy="10" r="1.5" fill="#111827" />
                    <circle cx="15.5" cy="10" r="1.5" fill="#111827" />
                    {/* Tear */}
                    <path d="M16.5 13c0 1-.7 1.5-1 1.5s-1-.5-1-1.5c0-.8 1-2 1-2s1 1.2 1 2z" fill="#0284C7" />
                    {/* Frown */}
                    <path d="M8.5 16.5c1.5-1.5 5.5-1.5 7 0" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case 'party':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <path
                        d="M5 20l3.5-11 10.5 7.5L5 20z"
                        fill="#F43F5E"
                        stroke="#111827"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                    />
                    <path d="M6.5 15.5l7 5" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="18" cy="5" r="1.5" fill="#FBBF24" />
                    <circle cx="13" cy="4" r="1.2" fill="#38BDF8" />
                    <circle cx="21" cy="9" r="1.2" fill="#A855F7" />
                    <path d="M12 9l2-2M15 11l3-1M17 14l2-1" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            );
        case 'like':
        default:
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={className}
                    aria-hidden="true"
                >
                    <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        fill="#EF4444"
                        stroke="#111827"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                    />
                </svg>
            );
    }
};

