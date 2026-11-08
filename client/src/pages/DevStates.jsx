import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import StatusScreen from '../components/ui/StatusScreen';
import ConnectingScreen from '../components/ui/ConnectingScreen';
import VoiceControls from '../components/Chat/VoiceControls';
import GuessInput from '../components/Chat/GuessInput';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Spot illustrations
import lostSvg from '../assets/states/lost.svg';
import closedSvg from '../assets/states/closed.svg';
import fullSvg from '../assets/states/full.svg';
import kickedSvg from '../assets/states/kicked.svg';
import hostEndedSvg from '../assets/states/host-ended.svg';
import everyoneLeftSvg from '../assets/states/everyone-left.svg';
import unsupportedSvg from '../assets/states/unsupported.svg';
import errorSvg from '../assets/states/error.svg';

/**
 * DevStates Showcase Page (/dev/states)
 * Renders every failure and calm edge state on one page for design & responsive validation.
 * Hidden in production builds via import.meta.env.DEV check.
 * Verified responsive down to 360px viewport width.
 */
export const DevStates = () => {
    const [activeTab, setActiveTab] = useState('all');
    const [mockMicDenied, setMockMicDenied] = useState(true);
    const [mockRateLimit, setMockRateLimit] = useState(true);
    const [mockGuessText, setMockGuessText] = useState('elephant');

    // Hidden in production
    if (!import.meta.env.DEV) {
        return <Navigate to="/" replace />;
    }

    const states = [
        {
            id: 'connecting',
            name: '1. Connecting (First Load > 300 ms)',
            description: 'The Scribble wordmark with the animated pencil Spinner, shown only after 300 ms.',
            render: () => (
                <div className="border-2 border-ink bg-paper rounded-[12px] p-6 shadow-hard overflow-hidden">
                    <ConnectingScreen className="min-h-[260px] py-4" />
                </div>
            ),
        },
        {
            id: 'reconnecting-banner',
            name: '2. Reconnecting Banner (Non-blocking at top)',
            description: 'Non-blocking banner at top: Reconnecting... with attempt count and Retry button.',
            render: () => (
                <div className="flex flex-col gap-2">
                    <div className="bg-marigold text-ink px-4 py-2.5 text-sm flex items-center justify-between border-2 border-ink shadow-hard-sm rounded-[8px] font-bold">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-ink animate-pulse" />
                            <span>Reconnecting... (attempt 2)</span>
                        </div>
                        <button
                            type="button"
                            className="bg-card text-ink text-xs font-bold px-3 py-1 rounded-[6px] border-2 border-ink shadow-hard-sm hover:bg-paper cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            ),
        },
        {
            id: 'offline-banner',
            name: '3. Offline Banner (navigator.onLine === false)',
            description: "Shown when the user's internet drops.",
            render: () => (
                <div className="bg-tomato text-white px-4 py-2.5 text-sm flex items-center justify-center gap-2 border-2 border-ink shadow-hard-sm rounded-[8px] font-bold">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    <span>You're offline.</span>
                </div>
            ),
        },
        {
            id: 'back-online',
            name: '4. Back Online Toast',
            description: 'Non-blocking toast displayed for 2.5s when socket restores connection.',
            render: () => (
                <div className="bg-leaf text-white px-4 py-2 text-sm flex items-center justify-center gap-2 border-2 border-ink shadow-hard-sm rounded-[8px] font-bold max-w-xs mx-auto">
                    <span>Back online</span>
                </div>
            ),
        },
        {
            id: 'lost',
            name: '5. We lost you (>60s Reconnect Failure)',
            description: 'Full-screen escalation after 60s of disconnected state: We lost you.',
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={lostSvg}
                    title="We lost you."
                    sentence="The connection could not be restored."
                    primaryAction={{ label: 'Try again', onClick: () => {} }}
                    secondaryAction={{ label: 'Back to start', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
        {
            id: 'closed',
            name: '6. Room Not Found or Closed',
            description: 'Calm screen when a room code is invalid or the room has shut down.',
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={closedSvg}
                    title="This room has closed."
                    sentence="We could not find an active game for this code."
                    primaryAction={{ label: 'Start a new room', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
        {
            id: 'full',
            name: '7. Room Full',
            description: 'Shown when room player capacity has been reached.',
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={fullSvg}
                    title="That room is full."
                    sentence="This room has reached maximum player capacity."
                    primaryAction={{ label: 'Start your own room', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
        {
            id: 'kicked',
            name: '8. Kicked by Host',
            description: 'Calm notification when a player is removed by the room host.',
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={kickedSvg}
                    title="The host removed you from the room."
                    sentence="You are no longer in this game session."
                    primaryAction={{ label: 'Back to start', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
        {
            id: 'host-ended',
            name: '9. Host Ended the Game',
            description: 'The host ended the match early: offers seeing final scores or returning to start.',
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={hostEndedSvg}
                    title="The host ended the game."
                    sentence="The match has concluded early for all players."
                    primaryAction={{ label: 'See the scores', onClick: () => {} }}
                    secondaryAction={{ label: 'Back to start', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
        {
            id: 'everyone-left',
            name: '10. Not Enough Players',
            description: 'All other players left mid-game so the session cannot continue.',
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={everyoneLeftSvg}
                    title="Everyone else left, so the game ended."
                    sentence="Scribble requires at least 2 players to draw and guess."
                    primaryAction={{ label: 'Back to lobby', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
        {
            id: 'drawer-left',
            name: '11. Drawer Left (Inline Notice During Play)',
            description: 'Non-blocking inline notice during active round when current drawer disconnects.',
            render: () => (
                <div
                    role="status"
                    aria-live="polite"
                    className="w-full bg-marigold text-ink font-bold px-4 py-3 rounded-[8px] border-2 border-ink shadow-hard text-sm text-center"
                >
                    Maya left. Skipping to the next drawer.
                </div>
            ),
        },
        {
            id: 'mic-denied',
            name: '12. Mic Denied or Missing (Voice Popover)',
            description: 'Inline message in voice popover with browser-specific fix lines (Chrome, Safari, Firefox). Voice failing never blocks the game.',
            render: () => (
                <div className="flex flex-col items-center gap-4 bg-paper p-4 rounded-[12px] border-2 border-ink">
                    <div className="text-xs text-ink-soft text-center font-bold">
                        Click the mic icon to preview the popover:
                    </div>
                    <VoiceControls
                        isMicOn={false}
                        toggleMic={() => setMockMicDenied((prev) => !prev)}
                        isDeafened={false}
                        toggleDeafen={() => {}}
                        peersCount={2}
                        isVoiceAllowed={true}
                        voiceError={
                            mockMicDenied
                                ? 'Permission to use microphone was denied.'
                                : null
                        }
                        onClearVoiceError={() => setMockMicDenied(false)}
                    />
                </div>
            ),
        },
        {
            id: 'chat-rate-limit',
            name: '13. Chat Rate Limit',
            description: "Helper text under guess input for 2 s: 'Slow down a little.'",
            render: () => (
                <div className="bg-card p-4 rounded-[12px] border-2 border-ink shadow-hard w-full max-w-sm mx-auto">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-ink uppercase">Guess Input</span>
                        <button
                            type="button"
                            onClick={() => setMockRateLimit((prev) => !prev)}
                            className="text-[11px] font-bold text-cobalt hover:underline cursor-pointer"
                        >
                            Toggle Warning ({mockRateLimit ? 'Visible' : 'Hidden'})
                        </button>
                    </div>
                    <GuessInput
                        message={mockGuessText}
                        setMessage={setMockGuessText}
                        onSubmit={() => {}}
                        rateLimitWarning={mockRateLimit}
                        idPrefix="dev-rate-limit"
                    />
                </div>
            ),
        },
        {
            id: 'unsupported-browser',
            name: '14. Unsupported Browser',
            description: 'Full screen listing what to update when Canvas, WebRTC, or Pointer Events are missing.',
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={unsupportedSvg}
                    title="Unsupported browser"
                    sentence="Scribble requires modern browser features for real-time drawing and audio:"
                    primaryAction={{ label: 'Reload', onClick: () => {} }}
                    className="min-h-0 p-0"
                >
                    <div className="bg-paper border border-ink/30 rounded-[6px] p-2.5 text-left text-xs flex flex-col gap-1.5 my-2">
                        <div className="flex items-center gap-2">
                            <span className="text-tomato font-bold">✕</span>
                            <span>Pointer Events (drawing pens &amp; touch)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-tomato font-bold">✕</span>
                            <span>WebRTC (voice chat &amp; signaling)</span>
                        </div>
                    </div>
                </StatusScreen>
            ),
        },
        {
            id: '404-error',
            name: '15. 404 Route & React ErrorBoundary Fallback',
            description: "Both use StatusScreen with 'Something went wrong' and 'Reload'.",
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={errorSvg}
                    title="Something went wrong"
                    sentence="An unexpected error occurred while rendering the page."
                    primaryAction={{ label: 'Reload', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
    ];

    const filteredStates =
        activeTab === 'all'
            ? states
            : states.filter((s) => s.id === activeTab);

    return (
        <div className="min-h-screen bg-paper text-ink p-3 sm:p-6 md:p-8 select-none">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-ink pb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black font-heading text-ink">
                        Scribble Failure &amp; Edge States Showcase
                    </h1>
                    <p className="text-xs sm:text-sm text-ink-soft mt-1">
                        Dev-only route (<code className="font-mono bg-card px-1.5 py-0.5 rounded border border-ink/30">/dev/states</code>). All states follow copy rules: plain words, no blame, no error codes, one clear action.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => (window.location.href = '/')}
                    className="shrink-0 font-bold uppercase text-xs"
                >
                    Back to Game
                </Button>
            </div>

            {/* Filter Pills */}
            <div className="max-w-4xl mx-auto mb-8 flex flex-wrap gap-1.5">
                <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1 text-xs font-bold rounded-full border-2 border-ink cursor-pointer transition-all ${
                        activeTab === 'all'
                            ? 'bg-ink text-white shadow-hard-xs'
                            : 'bg-card text-ink hover:bg-paper'
                    }`}
                >
                    Show All ({states.length})
                </button>
                {states.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveTab(s.id)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-full border-2 border-ink cursor-pointer transition-all ${
                            activeTab === s.id
                                ? 'bg-cobalt text-white shadow-hard-xs'
                                : 'bg-card text-ink hover:bg-paper'
                        }`}
                    >
                        {s.name.split('.')[0]}
                    </button>
                ))}
            </div>

            {/* Showcase Grid (min 360px testable) */}
            <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-16">
                {filteredStates.map((s) => (
                    <section
                        key={s.id}
                        data-testid={`state-section-${s.id}`}
                        className="bg-card border-2 border-ink rounded-[12px] shadow-hard p-4 sm:p-6 flex flex-col gap-3"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-ink/20 pb-2">
                            <h2 className="text-base sm:text-lg font-bold font-heading text-ink">
                                {s.name}
                            </h2>
                            <span className="text-xs text-ink-soft">
                                {s.description}
                            </span>
                        </div>

                        <div className="w-full flex justify-center py-2">
                            <div className="w-full max-w-sm">
                                {s.render()}
                            </div>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default DevStates;
