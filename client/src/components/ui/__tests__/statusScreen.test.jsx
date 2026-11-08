import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StatusScreen from '../StatusScreen';
import ReconnectBanner from '../ReconnectBanner';
import ConnectingScreen from '../ConnectingScreen';
import EdgeState, { mapErrorToEdgeState, EDGE_STATES } from '../../Game/EdgeState';
import VoiceControls from '../../Chat/VoiceControls';
import GuessInput from '../../Chat/GuessInput';
import { checkBrowserSupport } from '../../../utils/browserSupport';
import lostSvg from '../../../assets/states/lost.svg';

describe('StatusScreen Component', () => {
    it('renders role="alert", heading, sentence, illustration, and actions with proper copy', () => {
        const html = renderToStaticMarkup(
            <StatusScreen
                role="alert"
                illustration={lostSvg}
                title="This room has closed."
                sentence="The host ended the game or the room expired."
                primaryAction={{ label: 'Start a new room' }}
                secondaryAction={{ label: 'Back to start' }}
            />
        );

        expect(html).toContain('role="alert"');
        expect(html).toContain('aria-live="assertive"');
        expect(html).toContain('This room has closed.');
        expect(html).toContain('tabindex="-1"');
        expect(html).toContain('The host ended the game or the room expired.');
        expect(html).toContain('Start a new room');
        expect(html).toContain('Back to start');
    });

    it('renders role="status" and polite aria-live for informational states', () => {
        const html = renderToStaticMarkup(
            <StatusScreen
                role="status"
                title="Connecting..."
                primaryAction={{ label: 'Cancel' }}
            />
        );

        expect(html).toContain('role="status"');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('Connecting...');
    });
});

describe('EdgeState mapping & copy compliance', () => {
    it('maps error strings to calm edge states without blaming or technical codes', () => {
        expect(mapErrorToEdgeState('Room closed')).toBe('ROOM_CLOSED');
        expect(mapErrorToEdgeState('Room not found')).toBe('ROOM_CLOSED');
        expect(mapErrorToEdgeState('Room is full')).toBe('ROOM_FULL');
        expect(mapErrorToEdgeState('You were kicked by the host')).toBe('KICKED');
        expect(mapErrorToEdgeState('The game ended by host')).toBe('HOST_ENDED');
        expect(mapErrorToEdgeState('Not enough players to continue')).toBe('NOT_ENOUGH_PLAYERS');
        expect(mapErrorToEdgeState('We lost you')).toBe('RECONNECTING');
        // Voice & chat rate limit do NOT map to full-screen edge states
        expect(mapErrorToEdgeState('Microphone permission denied')).toBeNull();
        expect(mapErrorToEdgeState('Slow down')).toBeNull();
    });

    it('renders required calm copy for all failure edge states', () => {
        const closedHtml = renderToStaticMarkup(<EdgeState type="ROOM_CLOSED" />);
        expect(closedHtml).toContain('This room has closed.');
        expect(closedHtml).toContain('Start a new room');

        const fullHtml = renderToStaticMarkup(<EdgeState type="ROOM_FULL" />);
        expect(fullHtml).toContain('That room is full.');
        expect(fullHtml).toContain('Start your own room');

        const kickedHtml = renderToStaticMarkup(<EdgeState type="KICKED" />);
        expect(kickedHtml).toContain('The host removed you from the room.');
        expect(kickedHtml).toContain('Back to start');

        const hostEndedHtml = renderToStaticMarkup(<EdgeState type="HOST_ENDED" />);
        expect(hostEndedHtml).toContain('The host ended the game.');
        expect(hostEndedHtml).toContain('See the scores');
        expect(hostEndedHtml).toContain('Back to start');

        const everyoneLeftHtml = renderToStaticMarkup(<EdgeState type="NOT_ENOUGH_PLAYERS" />);
        expect(everyoneLeftHtml).toContain('Everyone else left, so the game ended.');
        expect(everyoneLeftHtml).toContain('Back to lobby');

        const reconnectHtml = renderToStaticMarkup(<EdgeState type="RECONNECTING" />);
        expect(reconnectHtml).toContain('We lost you.');
        expect(reconnectHtml).toContain('Try again');
        expect(reconnectHtml).toContain('Back to start');
    });
});

describe('ConnectingScreen Component', () => {
    it('renders wordmark and animated pencil Spinner with role="status"', () => {
        const html = renderToStaticMarkup(<ConnectingScreen />);
        expect(html).toContain('role="status"');
        expect(html).toContain('Connecting to Scribble...');
        expect(html).toContain('Connecting...');
    });
});

describe('VoiceControls Error Popover', () => {
    it('renders inline popover with browser-specific fix lines when mic access fails', () => {
        const html = renderToStaticMarkup(
            <VoiceControls
                isMicOn={false}
                toggleMic={() => {}}
                isDeafened={false}
                toggleDeafen={() => {}}
                peersCount={2}
                isVoiceAllowed={true}
                voiceError="Microphone access denied"
            />
        );

        expect(html).toContain('data-testid="voice-error-popover"');
        expect(html).toContain('Chrome:');
        expect(html).toContain('Click the lock icon in the address bar and set Microphone to Allow.');
        expect(html).toContain('Safari:');
        expect(html).toContain('Go to Settings &gt; Websites &gt; Microphone and set to Allow.');
        expect(html).toContain('Firefox:');
        expect(html).toContain('Click the microphone icon in the address bar and clear the Blocked permission.');
        expect(html).toContain('Try again');
    });
});

describe('Chat Rate Limit Helper', () => {
    it('shows "Slow down a little." helper text under input when rateLimitWarning is true', () => {
        const hiddenHtml = renderToStaticMarkup(
            <GuessInput
                message="test"
                setMessage={() => {}}
                onSubmit={() => {}}
                rateLimitWarning={false}
            />
        );
        expect(hiddenHtml).not.toContain('Slow down a little.');

        const visibleHtml = renderToStaticMarkup(
            <GuessInput
                message="test"
                setMessage={() => {}}
                onSubmit={() => {}}
                rateLimitWarning={true}
            />
        );
        expect(visibleHtml).toContain('data-testid="rate-limit-helper"');
        expect(visibleHtml).toContain('Slow down a little.');
    });
});

describe('Browser Support Detection', () => {
    it('correctly provides feature detection result object', () => {
        const result = checkBrowserSupport();
        expect(typeof result.isSupported).toBe('boolean');
        expect(Array.isArray(result.missing)).toBe(true);
    });
});
