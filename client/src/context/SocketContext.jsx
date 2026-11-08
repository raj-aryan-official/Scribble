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

        const handleConnect = () => {
            console.log('Connected to server', socket.id);
            const savedRoomCode = sessionStorage.getItem('scribble_room_code');
            const savedSessionId = localStorage.getItem('scribble_session_id');
            if (savedRoomCode && savedSessionId) {
                socket.emit(EVENTS.REJOIN_ROOM, { roomCode: savedRoomCode, sessionId: savedSessionId });
            }
        };

        const handleRoomJoined = (room) => {
            if (room?.code) {
                sessionStorage.setItem('scribble_room_code', room.code);
            }
            const me = room?.players?.find(p => p.id === socket.id);
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
            const me = room?.players?.find(p => p.id === socket.id);
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
            if (code === 'SESSION_EXPIRED') {
                sessionStorage.removeItem('scribble_room_code');
                dispatch({ type: 'SET_ERROR', payload: msg || 'Session expired. Please rejoin.' });
                if (window.location.pathname !== '/') {
                    window.history.pushState(null, '', '/');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
            } else {
                dispatch({ type: 'SET_ERROR', payload: msg });
            }
        };

        socket.on('connect', handleConnect);
        socket.on(EVENTS.ROOM_JOINED, handleRoomJoined);
        socket.on(EVENTS.STATE_SNAPSHOT, handleStateSnapshot);

        socket.on(EVENTS.PLAYER_JOINED, (player) => {
            dispatch({ type: 'UPDATE_PLAYERS', payload: player });
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
            dispatch({ type: 'WORD_CHOSEN', payload: data });
        });

        socket.on(EVENTS.DRAWER_WORD, (data) => {
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
            socket.off('connect', handleConnect);
            socket.off(EVENTS.ROOM_JOINED, handleRoomJoined);
            socket.off(EVENTS.STATE_SNAPSHOT, handleStateSnapshot);
            socket.off(EVENTS.PLAYER_JOINED);
            socket.off(EVENTS.GAME_STARTED);
            socket.off(EVENTS.TIMER_UPDATE);
            socket.off(EVENTS.WORD_CHOICES);
            socket.off(EVENTS.WORD_CHOSEN);
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
