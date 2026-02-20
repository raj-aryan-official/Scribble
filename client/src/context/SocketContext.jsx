import React, { createContext, useContext, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useGame } from './GameContext';
import { EVENTS } from '../../../shared/types';
import { useSound } from '../hooks/useSound';

export const SocketContext = createContext();

const getSocketUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (window.location.hostname === 'localhost') return 'http://localhost:3000';
    // If on local network (e.g. 192.168.x.x) and port is 5173 (client), assume server is on 3000
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
        socketRef.current = io(SOCKET_URL);
    }

    useEffect(() => {
        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('Connected to server', socket.id);
        });

        socket.on(EVENTS.ROOM_JOINED, (room) => {
            const me = room.players.find(p => p.id === socket.id);
            if (me) {
                dispatch({ type: 'SET_USER', payload: me });
            }
            dispatch({ type: 'JOIN_ROOM', payload: room });
        });

        socket.on(EVENTS.PLAYER_JOINED, (player) => {
            dispatch({ type: 'UPDATE_PLAYERS', payload: player });
        });

        socket.on(EVENTS.GAME_STARTED, (data) => {
            console.log('Game Started/Update:', data);
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

        socket.on('drawerWord', (data) => {
            dispatch({ type: 'DRAWER_WORD', payload: data });
        });

        socket.on('HINT_UPDATE', (data) => {
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

        socket.on(EVENTS.ERROR, (err) => {
            dispatch({ type: 'SET_ERROR', payload: err.message });
        });

        return () => {
            socket.off('connect');
            socket.off(EVENTS.ROOM_JOINED);
            socket.off(EVENTS.PLAYER_JOINED);
            socket.off(EVENTS.GAME_STARTED);
            socket.off(EVENTS.TIMER_UPDATE);
            socket.off(EVENTS.WORD_CHOICES);
            socket.off(EVENTS.WORD_CHOSEN);
            socket.off('HINT_UPDATE');
            socket.off(EVENTS.CORRECT_GUESS);
            socket.off(EVENTS.ROUND_ENDED);
            socket.off(EVENTS.GAME_ENDED);
            socket.off(EVENTS.ERROR);
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
