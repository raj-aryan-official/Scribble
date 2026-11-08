import React, { createContext, useContext, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useGame } from './GameContext';
import { EVENTS, GAME_STATES } from '../../../shared/types';
import { useSound } from '../hooks/useSound';

export const SocketContext = createContext();

const getSocketUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window === 'undefined') return 'http://localhost:3000';
    if (window.location.hostname === 'localhost') return 'http://localhost:3000';
    if (window.location.port === '5173') {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        return `${protocol}//${hostname}:3000`;
    }
    return window.location.origin;
};

const SOCKET_URL = getSocketUrl();
const REJOIN_STORAGE_KEY = 'scribble_rejoin';

export function saveRejoinData(data) {
    try {
        if (!data || !data.roomCode) return;
        localStorage.setItem(REJOIN_STORAGE_KEY, JSON.stringify({
            roomCode: data.roomCode,
            playerId: data.playerId,
            rejoinToken: data.rejoinToken
        }));
    } catch {
        // Safe localStorage ignore
    }
}

export function getRejoinData() {
    try {
        const raw = localStorage.getItem(REJOIN_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function clearRejoinData() {
    try {
        localStorage.removeItem(REJOIN_STORAGE_KEY);
        sessionStorage.removeItem('scribble_room_code');
    } catch {
        // Safe localStorage ignore
    }
}

export const SocketProvider = ({ children }) => {
    const { dispatch } = useGame();
    const socketRef = useRef(null);
    const { play } = useSound();

    if (!socketRef.current) {
        socketRef.current = io(SOCKET_URL, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
    }

    useEffect(() => {
        const socket = socketRef.current;

        const attemptRejoin = () => {
            const rejoin = getRejoinData();
            if (rejoin && rejoin.roomCode && rejoin.rejoinToken) {
                socket.emit(EVENTS.REJOIN_ROOM, {
                    roomCode: rejoin.roomCode,
                    rejoinToken: rejoin.rejoinToken
                });
                return;
            }
            const savedRoomCode = sessionStorage.getItem('scribble_room_code');
            const savedSessionId = localStorage.getItem('scribble_session_id');
            if (savedRoomCode && savedSessionId) {
                socket.emit(EVENTS.REJOIN_ROOM, { roomCode: savedRoomCode, sessionId: savedSessionId });
            }
        };

        const handleConnect = () => {
            console.log('Connected to server', socket.id);
            attemptRejoin();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && socket.connected) {
                attemptRejoin();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const handleRoomJoined = (room) => {
            if (room?.code) {
                sessionStorage.setItem('scribble_room_code', room.code);
            }
            if (room?.rejoinToken && room?.code) {
                saveRejoinData({
                    roomCode: room.code,
                    playerId: room.playerId,
                    rejoinToken: room.rejoinToken
                });
            }
            const me = room?.players?.find(p => p.id === socket.id || (room.playerId && p.playerId === room.playerId));
            if (me) {
                dispatch({ type: 'SET_USER', payload: me });
            }
            dispatch({ type: 'JOIN_ROOM', payload: room });
            if (room?.code && window.location.pathname.startsWith('/end/')) {
                const targetPath = `/lobby/${room.code}`;
                if (window.location.pathname !== targetPath) {
                    window.history.pushState(null, '', targetPath);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
            }
        };

        const handleStateSnapshot = (snapshot) => {
            const room = snapshot?.publicRoom || snapshot?.room;
            if (room?.code) {
                sessionStorage.setItem('scribble_room_code', room.code);
            }
            if (snapshot?.rejoinToken && room?.code) {
                saveRejoinData({
                    roomCode: room.code,
                    playerId: snapshot.playerId,
                    rejoinToken: snapshot.rejoinToken
                });
            }
            const me = room?.players?.find(p => p.id === socket.id || (snapshot.playerId && p.playerId === snapshot.playerId));
            if (me) {
                dispatch({ type: 'SET_USER', payload: me });
            }
            dispatch({ type: 'STATE_SNAPSHOT', payload: snapshot, socketId: socket.id });

            // Navigate to the page that matches the state
            const targetCode = room?.code;
            if (targetCode) {
                const gState = snapshot?.gameState || room?.gameState;
                let targetPath = `/lobby/${targetCode}`;
                if (gState === GAME_STATES.GAME_END) {
                    targetPath = `/end/${targetCode}`;
                } else if (gState && gState !== GAME_STATES.LOBBY) {
                    targetPath = `/game/${targetCode}`;
                }
                if (window.location.pathname !== targetPath) {
                    window.history.pushState(null, '', targetPath);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
            }
        };

        const handleError = (err) => {
            const msg = typeof err === 'string' ? err : err?.message;
            const code = err?.code;
            if (code === 'SESSION_EXPIRED' || code === 'ROOM_NOT_FOUND') {
                clearRejoinData();
                dispatch({ type: 'SET_ERROR', payload: msg || 'Session expired. Please rejoin.' });
                if (window.location.pathname !== '/') {
                    window.history.pushState(null, '', '/');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
            } else {
                dispatch({ type: 'SET_ERROR', payload: msg });
            }
        };

        const handleSuperseded = () => {
            console.warn('Session superseded by newer connection');
            clearRejoinData();
            socket.disconnect(); // Stops auto-reconnect
            dispatch({
                type: 'SET_ERROR',
                payload: 'This session was opened in another window or tab.'
            });
        };

        const handleKicked = () => {
            clearRejoinData();
            dispatch({ type: 'SET_ERROR', payload: 'The host removed you from the room.' });
            if (window.location.pathname !== '/') {
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
            }
        };

        const handlePlayerStatus = (data) => {
            dispatch({ type: 'PLAYER_STATUS', payload: data });
        };

        socket.on('connect', handleConnect);
        socket.on(EVENTS.ROOM_JOINED, handleRoomJoined);
        socket.on(EVENTS.STATE_SNAPSHOT, handleStateSnapshot);
        socket.on(EVENTS.SUPERSEDED, handleSuperseded);
        socket.on(EVENTS.KICKED, handleKicked);
        socket.on(EVENTS.PLAYER_STATUS, handlePlayerStatus);

        socket.on(EVENTS.PLAYER_JOINED, (player) => {
            dispatch({ type: 'UPDATE_PLAYERS', payload: player });
        });

        socket.on(EVENTS.TURN_INFO, (data) => {
            dispatch({ type: 'TURN_INFO', payload: data });
        });

        socket.on(EVENTS.GAME_STARTED, (data) => {
            dispatch({ type: 'GAME_STARTED', payload: data });
        });

        socket.on(EVENTS.TIMER_UPDATE, (timeLeft) => {
            dispatch({ type: 'UPDATE_TIMER', payload: timeLeft });
            if (timeLeft <= 5) play('tick');
        });

        socket.on(EVENTS.WORD_CHOICES, (choices) => {
            dispatch({ type: 'SET_WORD_CHOICES', payload: choices });
        });

        socket.on(EVENTS.WORD_CHOSEN, (data) => {
            console.log('[CLIENT] RECEIVED WORD_CHOSEN:', data);
            dispatch({ type: 'WORD_CHOSEN', payload: data });
        });

        socket.on(EVENTS.MESSAGE_RECEIVED, (msg) => {
            dispatch({ type: 'ADD_MESSAGE', payload: msg });
        });

        socket.on(EVENTS.DRAWER_WORD, (data) => {
            console.log('[CLIENT] RECEIVED DRAWER_WORD:', data);
            dispatch({ type: 'DRAWER_WORD', payload: data });
        });

        socket.on(EVENTS.HINT_UPDATE, (data) => {
            dispatch({ type: 'HINT_UPDATE', payload: data });
        });

        socket.on(EVENTS.CORRECT_GUESS, (data) => {
            dispatch({ type: 'CORRECT_GUESS', payload: data });
            play('correct');
        });

        socket.on(EVENTS.ROUND_ENDED, (data) => {
            dispatch({ type: 'ROUND_ENDED', payload: data });
            play('end');
        });

        socket.on(EVENTS.GAME_ENDED, (data) => {
            dispatch({ type: 'GAME_ENDED', payload: data });
            play('end');
        });

        socket.on(EVENTS.ERROR, handleError);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            socket.off('connect', handleConnect);
            socket.off(EVENTS.ROOM_JOINED, handleRoomJoined);
            socket.off(EVENTS.STATE_SNAPSHOT, handleStateSnapshot);
            socket.off(EVENTS.SUPERSEDED, handleSuperseded);
            socket.off(EVENTS.KICKED, handleKicked);
            socket.off(EVENTS.PLAYER_STATUS, handlePlayerStatus);
            socket.off(EVENTS.PLAYER_JOINED);
            socket.off(EVENTS.TURN_INFO);
            socket.off(EVENTS.GAME_STARTED);
            socket.off(EVENTS.TIMER_UPDATE);
            socket.off(EVENTS.WORD_CHOICES);
            socket.off(EVENTS.WORD_CHOSEN);
            socket.off(EVENTS.MESSAGE_RECEIVED);
            socket.off(EVENTS.DRAWER_WORD);
            socket.off(EVENTS.HINT_UPDATE);
            socket.off(EVENTS.CORRECT_GUESS);
            socket.off(EVENTS.ROUND_ENDED);
            socket.off(EVENTS.GAME_ENDED);
            socket.off(EVENTS.ERROR, handleError);
        };
    }, [dispatch, play]);

    return (
        <SocketContext.Provider value={socketRef.current}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    return useContext(SocketContext);
};
