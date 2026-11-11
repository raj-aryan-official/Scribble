import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useGame } from './GameContext';
import { EVENTS, GAME_STATES } from '../../../shared/types';
import { useSound } from '../hooks/useSound';
import { getApiBaseUrl } from '../lib/apiBase';

export const SocketContext = createContext();

const SOCKET_URL = getApiBaseUrl();
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
    const playRef = useRef(play);
    const [socketInstance, setSocketInstance] = useState(null);

    useEffect(() => {
        playRef.current = play;
    }, [play]);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        socketRef.current = socket;
        setSocketInstance(socket);

        if (typeof window !== 'undefined') {
            window.__scribble_socket = socket;
        }

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
            console.log('Socket connected:', socket.id);
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

            if (snapshot?.ownRecord || snapshot?.isRejoin) {
                const myScore = snapshot.ownRecord?.score ?? room?.scores?.[snapshot.playerId] ?? 0;
                dispatch({
                    type: 'SHOW_TOAST',
                    payload: {
                        message: `Welcome back. You have ${myScore} points.`,
                        variant: 'info'
                    }
                });
            }

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
            socket.disconnect(); // Stops auto-reconnect
            dispatch({ type: 'SET_SUPERSEDED', payload: true });
        };

        const handleKicked = (data) => {
            clearRejoinData();
            const msg = data?.by === 'vote'
                ? 'You were removed from the room by vote.'
                : (data?.message || 'The host removed you from the room.');
            dispatch({ type: 'SET_ERROR', payload: msg });
            if (window.location.pathname !== '/') {
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
            }
        };

        const handlePlayerStatus = (data) => {
            dispatch({ type: 'PLAYER_STATUS', payload: data });
        };

        const handlePlayerJoined = (player) => {
            dispatch({ type: 'UPDATE_PLAYERS', payload: player });
        };

        const handleTurnInfo = (data) => {
            dispatch({ type: 'TURN_INFO', payload: data });
        };

        const handleGameStarted = (data) => {
            dispatch({ type: 'GAME_STARTED', payload: data });
        };

        const handleTimerUpdate = (timeLeft) => {
            dispatch({ type: 'UPDATE_TIMER', payload: timeLeft });
            if (timeLeft <= 5) playRef.current('tick');
        };

        const handleWordChoices = (arg1, arg2) => {
            let choices = [];
            let defaultChoice = 0;
            if (Array.isArray(arg1)) {
                choices = arg1;
                defaultChoice = typeof arg2 === 'number' ? arg2 : 0;
            } else if (arg1 && typeof arg1 === 'object') {
                choices = arg1.choices || [];
                defaultChoice = typeof arg1.defaultChoice === 'number' ? arg1.defaultChoice : 0;
            }
            dispatch({ type: 'SET_WORD_CHOICES', payload: { choices, defaultChoice } });
        };

        const handleWordChosen = (data) => {
            dispatch({ type: 'WORD_CHOSEN', payload: data });
        };

        const handleMessageReceived = (msg) => {
            dispatch({ type: 'ADD_MESSAGE', payload: msg });
            if (msg.type === 'system' && msg.text) {
                if (msg.text.includes('is the host again')) {
                    dispatch({
                        type: 'SHOW_TOAST',
                        payload: { message: msg.text, variant: 'info' }
                    });
                } else if (msg.text.includes('Vote passed') || msg.text.includes('Vote to remove') || msg.text.includes('cancelled the vote')) {
                    dispatch({
                        type: 'SHOW_TOAST',
                        payload: {
                            message: msg.text,
                            variant: msg.text.includes('passed') ? 'success' : 'info'
                        }
                    });
                }
            }
        };

        const handleSeatClaimRequest = (data) => {
            dispatch({
                type: 'SET_SEAT_CLAIM_REQUEST',
                payload: {
                    ...data,
                    endsAt: Date.now() + ((data.timeout || 20) * 1000)
                }
            });
        };

        const handleAfkNudge = (data) => {
            dispatch({
                type: 'SHOW_TOAST',
                payload: {
                    message: data?.message || 'Pick a word, or your turns will be skipped.',
                    variant: 'error'
                }
            });
        };

        const handleGamePaused = (data) => {
            dispatch({ type: 'GAME_PAUSED', payload: data });
        };

        const handleGameResumed = (data) => {
            dispatch({ type: 'GAME_RESUMED', payload: data });
        };

        const handleDrawerWord = (data) => {
            dispatch({ type: 'DRAWER_WORD', payload: data });
        };

        const handleHintUpdate = (data) => {
            dispatch({ type: 'HINT_UPDATE', payload: data });
        };

        const handleCorrectGuess = (data) => {
            dispatch({ type: 'CORRECT_GUESS', payload: data });
            playRef.current('correct');
        };

        const handleRoundEnded = (data) => {
            dispatch({ type: 'ROUND_ENDED', payload: data });
            playRef.current('end');
        };

        const handleGameEnded = (data) => {
            dispatch({ type: 'GAME_ENDED', payload: data });
            playRef.current('end');
        };

        const handleVoteState = (data) => {
            dispatch({ type: 'SET_VOTE_STATE', payload: data });
        };

        const handleReactionBatch = (data) => {
            dispatch({ type: 'REACTION_BATCH', payload: data });
        };

        const handleLikeUpdate = (data) => {
            dispatch({ type: 'LIKE_UPDATE', payload: data });
        };

        // Attach listeners using named handler functions
        socket.on('connect', handleConnect);
        socket.on(EVENTS.ROOM_JOINED, handleRoomJoined);
        socket.on(EVENTS.STATE_SNAPSHOT, handleStateSnapshot);
        socket.on(EVENTS.SUPERSEDED, handleSuperseded);
        socket.on(EVENTS.KICKED, handleKicked);
        socket.on(EVENTS.PLAYER_STATUS, handlePlayerStatus);
        socket.on(EVENTS.PLAYER_JOINED, handlePlayerJoined);
        socket.on(EVENTS.TURN_INFO, handleTurnInfo);
        socket.on(EVENTS.GAME_STARTED, handleGameStarted);
        socket.on(EVENTS.TIMER_UPDATE, handleTimerUpdate);
        socket.on(EVENTS.WORD_CHOICES, handleWordChoices);
        socket.on(EVENTS.WORD_CHOSEN, handleWordChosen);
        socket.on(EVENTS.MESSAGE_RECEIVED, handleMessageReceived);
        socket.on(EVENTS.SEAT_CLAIM_REQUEST, handleSeatClaimRequest);
        socket.on(EVENTS.AFK_NUDGE, handleAfkNudge);
        socket.on(EVENTS.GAME_PAUSED, handleGamePaused);
        socket.on(EVENTS.GAME_RESUMED, handleGameResumed);
        socket.on(EVENTS.DRAWER_WORD, handleDrawerWord);
        socket.on(EVENTS.HINT_UPDATE, handleHintUpdate);
        socket.on(EVENTS.CORRECT_GUESS, handleCorrectGuess);
        socket.on(EVENTS.ROUND_ENDED, handleRoundEnded);
        socket.on(EVENTS.GAME_ENDED, handleGameEnded);
        socket.on(EVENTS.VOTE_STATE, handleVoteState);
        socket.on(EVENTS.REACTION_BATCH, handleReactionBatch);
        socket.on(EVENTS.LIKE_UPDATE, handleLikeUpdate);
        socket.on(EVENTS.ERROR, handleError);

        // In development, after mount, warn if socket.listeners(event).length is not 1 for any game event
        if (import.meta.env?.DEV) {
            const gameEvents = [
                EVENTS.ROOM_JOINED,
                EVENTS.STATE_SNAPSHOT,
                EVENTS.PLAYER_JOINED,
                EVENTS.TURN_INFO,
                EVENTS.GAME_STARTED,
                EVENTS.TIMER_UPDATE,
                EVENTS.WORD_CHOICES,
                EVENTS.WORD_CHOSEN,
                EVENTS.MESSAGE_RECEIVED,
                EVENTS.SEAT_CLAIM_REQUEST,
                EVENTS.AFK_NUDGE,
                EVENTS.GAME_PAUSED,
                EVENTS.GAME_RESUMED,
                EVENTS.DRAWER_WORD,
                EVENTS.HINT_UPDATE,
                EVENTS.CORRECT_GUESS,
                EVENTS.ROUND_ENDED,
                EVENTS.GAME_ENDED,
                EVENTS.SUPERSEDED,
                EVENTS.KICKED,
                EVENTS.PLAYER_STATUS,
                EVENTS.VOTE_STATE,
                EVENTS.REACTION_BATCH,
                EVENTS.LIKE_UPDATE,
                EVENTS.ERROR
            ];
            gameEvents.forEach((ev) => {
                const count = socket.listeners(ev).length;
                if (count !== 1) {
                    console.warn(`[DEV WARNING] socket.listeners('${ev}').length is ${count}, expected 1`);
                }
            });
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            socket.off('connect', handleConnect);
            socket.off(EVENTS.ROOM_JOINED, handleRoomJoined);
            socket.off(EVENTS.STATE_SNAPSHOT, handleStateSnapshot);
            socket.off(EVENTS.SUPERSEDED, handleSuperseded);
            socket.off(EVENTS.KICKED, handleKicked);
            socket.off(EVENTS.PLAYER_STATUS, handlePlayerStatus);
            socket.off(EVENTS.PLAYER_JOINED, handlePlayerJoined);
            socket.off(EVENTS.TURN_INFO, handleTurnInfo);
            socket.off(EVENTS.GAME_STARTED, handleGameStarted);
            socket.off(EVENTS.TIMER_UPDATE, handleTimerUpdate);
            socket.off(EVENTS.WORD_CHOICES, handleWordChoices);
            socket.off(EVENTS.WORD_CHOSEN, handleWordChosen);
            socket.off(EVENTS.MESSAGE_RECEIVED, handleMessageReceived);
            socket.off(EVENTS.SEAT_CLAIM_REQUEST, handleSeatClaimRequest);
            socket.off(EVENTS.AFK_NUDGE, handleAfkNudge);
            socket.off(EVENTS.GAME_PAUSED, handleGamePaused);
            socket.off(EVENTS.GAME_RESUMED, handleGameResumed);
            socket.off(EVENTS.DRAWER_WORD, handleDrawerWord);
            socket.off(EVENTS.HINT_UPDATE, handleHintUpdate);
            socket.off(EVENTS.CORRECT_GUESS, handleCorrectGuess);
            socket.off(EVENTS.ROUND_ENDED, handleRoundEnded);
            socket.off(EVENTS.GAME_ENDED, handleGameEnded);
            socket.off(EVENTS.VOTE_STATE, handleVoteState);
            socket.off(EVENTS.REACTION_BATCH, handleReactionBatch);
            socket.off(EVENTS.LIKE_UPDATE, handleLikeUpdate);
            socket.off(EVENTS.ERROR, handleError);

            // Disconnect socket in provider's cleanup so hot reload cannot leave a second connection
            socket.disconnect();
            socketRef.current = null;
            setSocketInstance(null);
            if (typeof window !== 'undefined' && window.__scribble_socket === socket) {
                window.__scribble_socket = null;
            }
        };
    }, [dispatch]);

    return (
        <SocketContext.Provider value={socketInstance || socketRef.current}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    return useContext(SocketContext);
};
