import React from 'react';
import StatusScreen from '../ui/StatusScreen';
import closedSvg from '../../assets/states/closed.svg';
import fullSvg from '../../assets/states/full.svg';
import kickedSvg from '../../assets/states/kicked.svg';
import hostEndedSvg from '../../assets/states/host-ended.svg';
import everyoneLeftSvg from '../../assets/states/everyone-left.svg';
import lostSvg from '../../assets/states/lost.svg';
import errorSvg from '../../assets/states/error.svg';

export const EDGE_STATES = {
    ROOM_CLOSED: {
        title: 'This room has closed.',
        sentence: 'The host ended the session or the game was closed.',
        illustration: closedSvg,
        primaryAction: {
            label: 'Start a new room',
            href: '/',
        },
    },
    ROOM_NOT_FOUND: {
        title: 'This room has closed.',
        sentence: 'We could not find an active game for this code.',
        illustration: closedSvg,
        primaryAction: {
            label: 'Start a new room',
            href: '/',
        },
    },
    ROOM_FULL: {
        title: 'That room is full.',
        sentence: 'This room has reached maximum player capacity.',
        illustration: fullSvg,
        primaryAction: {
            label: 'Start your own room',
            href: '/',
        },
    },
    KICKED: {
        title: 'The host removed you from the room.',
        sentence: 'You are no longer in this game session.',
        illustration: kickedSvg,
        primaryAction: {
            label: 'Back to start',
            href: '/',
        },
    },
    HOST_ENDED: {
        title: 'The host ended the game.',
        sentence: 'The game has concluded early for all players.',
        illustration: hostEndedSvg,
        primaryAction: {
            label: 'See the scores',
            // Will navigate or run onAction
        },
        secondaryAction: {
            label: 'Back to start',
            href: '/',
        },
    },
    NOT_ENOUGH_PLAYERS: {
        title: 'Everyone else left, so the game ended.',
        sentence: 'Scribble requires at least 2 players to draw and guess.',
        illustration: everyoneLeftSvg,
        primaryAction: {
            label: 'Back to lobby',
            href: '/',
        },
    },
    RECONNECTING: {
        title: 'We lost you.',
        sentence: 'The connection could not be restored.',
        illustration: lostSvg,
        primaryAction: {
            label: 'Try again',
        },
        secondaryAction: {
            label: 'Back to start',
            href: '/',
        },
    },
    ERROR: {
        title: 'Something went wrong',
        sentence: 'An unexpected issue occurred.',
        illustration: errorSvg,
        primaryAction: {
            label: 'Reload',
            onClick: () => window.location.reload(),
        },
    },
    SUPERSEDED: {
        title: "You're playing in another tab.",
        sentence: "This session was opened in another window or tab.",
        illustration: lostSvg,
        primaryAction: {
            label: 'Take over here',
        },
        secondaryAction: {
            label: 'Leave',
            href: '/',
        },
    },
    SERVER_BUSY: {
        title: 'The server is busy.',
        sentence: 'Try again in a minute.',
        illustration: errorSvg,
        primaryAction: {
            label: 'Try again',
            onClick: () => window.location.reload(),
        },
    },
    RATE_LIMITED: {
        title: 'Too many tries.',
        sentence: 'Wait a moment.',
        illustration: errorSvg,
        primaryAction: {
            label: 'Try again',
            onClick: () => window.location.reload(),
        },
    },
};

export const mapErrorToEdgeState = (errorString) => {
    if (!errorString || typeof errorString !== 'string') return null;
    const lower = errorString.toLowerCase();
    if (lower.includes('superseded') || lower.includes('another tab') || lower.includes('another window')) {
        return 'SUPERSEDED';
    }
    if (lower.includes('busy') || lower.includes('capacity')) {
        return 'SERVER_BUSY';
    }
    if (lower.includes('too many tries') || lower.includes('too many requests')) {
        return 'RATE_LIMITED';
    }
    if (
        lower.includes('closed') ||
        lower.includes('not found') ||
        lower.includes('no room') ||
        lower.includes('invalid room')
    ) {
        return 'ROOM_CLOSED';
    }
    if (lower.includes('full')) return 'ROOM_FULL';
    if (lower.includes('kicked') || lower.includes('removed')) return 'KICKED';
    if (lower.includes('host ended') || lower.includes('ended by host')) return 'HOST_ENDED';
    if (
        lower.includes('everyone else left') ||
        lower.includes('everyone left') ||
        lower.includes('not enough players')
    ) {
        return 'NOT_ENOUGH_PLAYERS';
    }
    if (lower.includes('we lost you') || lower.includes('lost connection')) return 'RECONNECTING';
    if (lower.includes('error') || lower.includes('went wrong')) return 'ERROR';
    return null;
};

export const EdgeState = ({
    type = 'ROOM_CLOSED',
    onAction,
    onSecondaryAction,
    actionText,
    secondaryActionText,
    className = '',
}) => {
    const config = EDGE_STATES[type] || EDGE_STATES.ROOM_CLOSED;

    const primaryAction = {
        label: actionText || config.primaryAction.label,
        onClick: onAction || (() => {
            if (config.primaryAction.href) window.location.href = config.primaryAction.href;
        }),
    };

    const secondaryAction = config.secondaryAction
        ? {
              label: secondaryActionText || config.secondaryAction.label,
              onClick: onSecondaryAction || (() => {
                  if (config.secondaryAction.href) window.location.href = config.secondaryAction.href;
              }),
          }
        : undefined;

    return (
        <StatusScreen
            role="alert"
            illustration={config.illustration}
            title={config.title}
            sentence={config.sentence}
            primaryAction={primaryAction}
            secondaryAction={secondaryAction}
            className={className}
        />
    );
};

export default EdgeState;
