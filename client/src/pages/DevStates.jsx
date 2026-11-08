import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import StatusScreen from '../components/ui/StatusScreen';
import ConnectingScreen from '../components/ui/ConnectingScreen';
import VoiceControls from '../components/Chat/VoiceControls';
import GuessInput from '../components/Chat/GuessInput';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Toast from '../components/ui/Toast';
import TurnWaitOverlay from '../components/Game/TurnWaitOverlay';
import PausedOverlay from '../components/Game/PausedOverlay';
import SeatClaimModal from '../components/Game/SeatClaimModal';
import MidRoundBanner from '../components/Game/MidRoundBanner';
import PlayerList from '../components/Game/PlayerList';
import { Sparkles, AlertTriangle } from 'lucide-react';

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
                <div className="bg-leaf-deep text-white px-4 py-2 text-sm flex items-center justify-center gap-2 border-2 border-ink shadow-hard-sm rounded-[8px] font-bold max-w-xs mx-auto">
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
        {
            id: 'turn-wait',
            name: '16. TURN_WAIT Banner & Skip',
            description: "Banner over paper: 'Waiting for Maya to reconnect...' with shrinking ring, and skipped state.",
            render: () => (
                <div className="flex flex-col gap-4">
                    <div className="relative w-full h-[200px] bg-paper border-2 border-ink rounded-[8px] overflow-hidden flex items-center justify-center">
                        <TurnWaitOverlay
                            waitingFor="Maya"
                            endsAt={Date.now() + 8000}
                            timeout={8}
                            className="relative inset-0"
                        />
                    </div>
                    <div className="relative w-full h-[180px] bg-paper border-2 border-ink rounded-[8px] overflow-hidden flex items-center justify-center">
                        <TurnWaitOverlay
                            waitingFor="Maya"
                            isSkipped={true}
                            className="relative inset-0"
                        />
                    </div>
                </div>
            ),
        },
        {
            id: 'acting-host',
            name: '17. Acting Host Chip & Return Toast',
            description: "Bar chip 'Raj is hosting while Maya is away' and Toast 'Maya is the host again'.",
            render: () => (
                <div className="flex flex-col gap-4 items-center justify-center py-2">
                    <div className="p-3 bg-paper border-2 border-ink rounded-[8px] shadow-hard-sm w-full flex items-center justify-center">
                        <span
                            data-testid="dev-acting-host-chip"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border-2 border-ink text-xs font-bold text-ink shadow-hard-xs"
                        >
                            Raj is hosting while Maya is away
                        </span>
                    </div>
                    <div className="p-3 bg-paper border-2 border-ink rounded-[8px] shadow-hard-sm w-full flex items-center justify-center">
                        <div className="flex items-center gap-2 px-4 py-2 bg-card border-2 border-ink rounded-[8px] shadow-hard text-xs font-bold text-ink">
                            <span className="w-2 h-2 rounded-full bg-leaf" />
                            <span>Maya is the host again</span>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'superseded',
            name: '18. Superseded Tab (E6)',
            description: "StatusScreen: 'You're playing in another tab.' with 'Take over here' and 'Leave'.",
            render: () => (
                <StatusScreen
                    role="alert"
                    illustration={lostSvg}
                    title="You're playing in another tab."
                    sentence="This session was opened in another window or tab."
                    primaryAction={{ label: 'Take over here', onClick: () => {} }}
                    secondaryAction={{ label: 'Leave', onClick: () => {} }}
                    className="min-h-0 p-0"
                />
            ),
        },
        {
            id: 'seat-claim-joiner',
            name: '19. Seat Claim Flow (Joiner)',
            description: "Prompt, waiting, accepted, and declined states when reclaiming an away player's seat.",
            render: () => (
                <div className="flex flex-col gap-4">
                    {/* Prompt */}
                    <div className="p-4 bg-paper border-2 border-ink rounded-[8px] shadow-hard-sm flex flex-col gap-3 text-center">
                        <div className="w-10 h-10 rounded-full bg-marigold/20 border-2 border-ink flex items-center justify-center mx-auto text-ink">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <h3 className="font-heading font-black text-sm text-ink">
                            Maya is away. Ask to take back that seat?
                        </h3>
                        <div className="flex flex-col gap-1.5 pt-1">
                            <Button variant="primary" size="sm" className="font-bold uppercase">
                                Ask the host
                            </Button>
                            <Button variant="secondary" size="sm" className="font-bold uppercase">
                                Join as a new player
                            </Button>
                        </div>
                    </div>

                    {/* Waiting */}
                    <div className="p-4 bg-paper border-2 border-ink rounded-[8px] shadow-hard-sm flex flex-col items-center gap-2 text-center">
                        <Spinner size="md" label="Waiting for host..." />
                        <h3 className="font-heading font-bold text-sm text-ink">
                            Waiting for the host...
                        </h3>
                    </div>

                    {/* Accepted & Declined */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
                        <div className="p-2.5 bg-paper border-2 border-leaf rounded-[8px] text-leaf-deep flex flex-col items-center gap-1">
                            <span>✓</span>
                            <span>The host let you back in</span>
                        </div>
                        <div className="p-2.5 bg-paper border-2 border-tomato rounded-[8px] text-tomato-deep flex flex-col items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-tomato" />
                            <span>The host said no</span>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'seat-claim-host',
            name: '20. Seat Claim Modal (Host View)',
            description: "Host modal: 'Maya wants to take back their seat' with Accept, Decline, and 20s countdown.",
            render: () => (
                <div className="p-4 bg-paper border-2 border-ink rounded-[8px] shadow-hard-sm flex flex-col gap-3">
                    <h3 className="font-heading font-black text-base text-ink text-center">
                        Maya wants to take back their seat
                    </h3>
                    <div className="flex items-center gap-2 justify-center text-xs text-ink-soft">
                        <span className="font-mono font-bold text-marigold bg-ink px-2 py-0.5 rounded-full">
                            18s
                        </span>
                        <span>They disconnected earlier and want to resume.</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button variant="primary" size="sm" className="font-bold uppercase">
                            Accept
                        </Button>
                        <Button variant="secondary" size="sm" className="font-bold uppercase">
                            Decline
                        </Button>
                    </div>
                </div>
            ),
        },
        {
            id: 'paused-game',
            name: '21. Paused Game Overlay (E15)',
            description: "Overlay: 'Waiting for players to return.' with countdown, current running scores, and 'End game'.",
            render: () => (
                <div className="relative w-full min-h-[340px] bg-paper border-2 border-ink rounded-[8px] overflow-hidden flex items-center justify-center">
                    <PausedOverlay
                        timeout={60}
                        endsAt={Date.now() + 45000}
                        players={[
                            { id: 'p1', username: 'Maya', avatar: 'avatar-1', status: 'connected' },
                            { id: 'p2', username: 'Raj', avatar: 'avatar-2', status: 'away', isDisconnected: true },
                        ]}
                        scores={{ p1: 420, p2: 310 }}
                        isHost={true}
                        onEndGame={() => {}}
                        className="relative inset-0"
                    />
                </div>
            ),
        },
        {
            id: 'player-list-labels',
            name: '22. Player List Labels',
            description: "'Away', 'Draws next', 'Draws in 3', 'Missed turn', 'Make-up turn', and quiet 'joined late' tag.",
            render: () => (
                <div className="flex flex-col gap-4">
                    <PlayerList
                        players={[
                            { id: 'p1', username: 'Maya', avatar: 'avatar-1', status: 'connected', missedDraws: [1] },
                            { id: 'p2', username: 'Raj', avatar: 'avatar-2', status: 'away', isDisconnected: true },
                            { id: 'p3', username: 'Alex', avatar: 'avatar-3', status: 'connected', isMakeUpTurn: true },
                            { id: 'p4', username: 'Jordan', avatar: 'avatar-4', status: 'connected', joinedMidRound: true },
                        ]}
                        scores={{ p1: 450, p2: 300, p3: 200, p4: 100 }}
                        drawerId="p1"
                        guessedPlayerIds={['p3']}
                        turnInfo={{ queue: ['p3', 'p4'], round: 1, totalRounds: 3 }}
                        variant="desktop"
                    />
                </div>
            ),
        },
        {
            id: 'join-rejoin-notices',
            name: '23. Late Join & Rejoin Notices',
            description: "Late join: 'You joined mid-round. You\\'ll draw in turn 4.' Rejoin: 'Welcome back. You have 420 points.'",
            render: () => (
                <div className="flex flex-col gap-3">
                    <MidRoundBanner turnNumber={4} onDismiss={() => {}} />
                    <div className="flex items-center gap-2 p-3 bg-card border-2 border-ink shadow-hard rounded-[8px] text-xs font-bold text-ink">
                        <span className="w-2.5 h-2.5 rounded-full bg-cobalt" />
                        <span>Welcome back. You have 420 points.</span>
                    </div>
                </div>
            ),
        },
        {
            id: 'afk-nudge',
            name: '24. AFK Nudge Toast & Skipped Notice (E14)',
            description: "Toast: 'Pick a word, or your turns will be skipped.' and announcement: 'Maya is away from the keyboard. Skipping their turns.'",
            render: () => (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 p-3 bg-card border-2 border-tomato shadow-hard rounded-[8px] text-xs font-bold text-tomato-deep">
                        <AlertTriangle className="w-4 h-4 text-tomato shrink-0" />
                        <span>Pick a word, or your turns will be skipped.</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-paper border-2 border-ink rounded-[8px] text-xs font-bold text-ink-soft">
                        <span className="w-2 h-2 rounded-full bg-tomato shrink-0" />
                        <span>Maya is away from the keyboard. Skipping their turns.</span>
                    </div>
                </div>
            ),
        },
        {
            id: 'server-busy-rate-limits',
            name: '25. Server Busy & Rate Limits (E21, E22)',
            description: "StatusScreens: 'The server is busy. Try again in a minute.' and 'Too many tries. Wait a moment.'",
            render: () => (
                <div className="flex flex-col gap-6">
                    <StatusScreen
                        role="alert"
                        illustration={errorSvg}
                        title="The server is busy."
                        sentence="Try again in a minute."
                        primaryAction={{ label: 'Try again', onClick: () => {} }}
                        className="min-h-0 p-0"
                    />
                    <StatusScreen
                        role="alert"
                        illustration={errorSvg}
                        title="Too many tries."
                        sentence="Wait a moment."
                        primaryAction={{ label: 'Wait a moment', onClick: () => {} }}
                        className="min-h-0 p-0"
                    />
                </div>
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
