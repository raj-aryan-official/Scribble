import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { GAME_STATES } from '../../../../shared/types';
import DelayedLoading from '../ui/DelayedLoading';

/**
 * RouteGuards
 * Protects room-scoped routes:
 * 1. Checks for a live or resumable session. If none exists, redirects to /join/:code (never a blank page).
 * 2. Redirects between /lobby/:code and /game/:code depending on game state.
 */

const useRoomSessionCheck = () => {
    const { code } = useParams();
    const { state } = useGame();

    const normalizedCode = (code || '').toUpperCase();
    const currentCode = (state.roomCode || '').toUpperCase();

    const isSessionActive = Boolean(
        currentCode &&
        currentCode === normalizedCode &&
        state.currentUser
    );

    let savedRoom = null;
    let savedSession = null;
    try {
        savedRoom = sessionStorage.getItem('scribble_room_code');
        savedSession = localStorage.getItem('scribble_session_id');
    } catch {
        // Ignore storage access errors
    }

    const isResumable = Boolean(
        savedRoom &&
        savedRoom.toUpperCase() === normalizedCode &&
        savedSession
    );

    return {
        code: normalizedCode,
        state,
        isSessionActive,
        isResumable,
    };
};

export const LobbyGuard = ({ children }) => {
    const { code, state, isSessionActive, isResumable } = useRoomSessionCheck();

    // 1. No live or resumable session -> redirect to /join/:code
    if (!isSessionActive && !isResumable) {
        return <Navigate to={`/join/${code}`} replace />;
    }

    // 2. Resumable session waiting for server state
    if (!isSessionActive && isResumable) {
        if (state.error) {
            try {
                sessionStorage.removeItem('scribble_room_code');
            } catch {
                // Ignore storage errors
            }
            return <Navigate to={`/join/${code}`} replace />;
        }
        return <DelayedLoading label="Rejoining lobby..." />;
    }

    // 3. Game is finished -> redirect to /end/:code
    if (state.gameState === GAME_STATES.GAME_END) {
        return <Navigate to={`/end/${code}`} replace />;
    }

    // 4. Room is in game state -> redirect to /game/:code
    if (state.gameState !== GAME_STATES.LOBBY) {
        return <Navigate to={`/game/${code}`} replace />;
    }

    return children;
};

export const GameGuard = ({ children }) => {
    const { code, state, isSessionActive, isResumable } = useRoomSessionCheck();

    // 1. No live or resumable session -> redirect to /join/:code
    if (!isSessionActive && !isResumable) {
        return <Navigate to={`/join/${code}`} replace />;
    }

    // 2. Resumable session waiting for server state
    if (!isSessionActive && isResumable) {
        if (state.error) {
            try {
                sessionStorage.removeItem('scribble_room_code');
            } catch {
                // Ignore storage errors
            }
            return <Navigate to={`/join/${code}`} replace />;
        }
        return <DelayedLoading label="Rejoining game..." />;
    }

    // 3. Room is in lobby state -> redirect to /lobby/:code
    if (state.gameState === GAME_STATES.LOBBY) {
        return <Navigate to={`/lobby/${code}`} replace />;
    }

    // 4. Room is in game end state -> redirect to /end/:code
    if (state.gameState === GAME_STATES.GAME_END) {
        return <Navigate to={`/end/${code}`} replace />;
    }

    return children;
};

export const EndGuard = ({ children }) => {
    const { code, state, isSessionActive, isResumable } = useRoomSessionCheck();

    // 1. No live or resumable session -> redirect to /join/:code
    if (!isSessionActive && !isResumable) {
        return <Navigate to={`/join/${code}`} replace />;
    }

    // 2. Resumable session waiting for server state
    if (!isSessionActive && isResumable) {
        if (state.error) {
            try {
                sessionStorage.removeItem('scribble_room_code');
            } catch {
                // Ignore storage errors
            }
            return <Navigate to={`/join/${code}`} replace />;
        }
        return <DelayedLoading label="Loading results..." />;
    }

    // 3. Room moved back to lobby (e.g. Play Again) -> redirect to /lobby/:code
    if (state.gameState === GAME_STATES.LOBBY) {
        return <Navigate to={`/lobby/${code}`} replace />;
    }

    // 4. Room moved to a new game -> redirect to /game/:code
    if (state.gameState !== GAME_STATES.GAME_END) {
        return <Navigate to={`/game/${code}`} replace />;
    }

    return children;
};
