import React, { createContext, useReducer, useContext } from 'react';
import { GAME_STATES } from '../../../shared/types';

const GameContext = createContext();

const initialState = {
    gameState: GAME_STATES.LOBBY,
    roomCode: null,
    players: [],
    currentUser: null, // { id, username, avatar, isHost }
    messages: [],
    wordChoices: [],
    currentRound: 0,
    timer: 0,
    scores: {},
    error: null
};

const gameReducer = (state, action) => {
    switch (action.type) {
        case 'SET_USER':
            return { ...state, currentUser: action.payload };
        case 'JOIN_ROOM':
            return { ...state, roomCode: action.payload.code, players: action.payload.players, gameState: action.payload.gameState };
        case 'UPDATE_PLAYERS':
            // Check if player already exists to avoid duplicates (React StrictMode double invoke)
            if (state.players.find(p => p.id === action.payload.id)) return state;
            return { ...state, players: [...state.players, action.payload] };
        case 'SET_GAME_STATE':
            return { ...state, gameState: action.payload };
        case 'ADD_MESSAGE':
            return { ...state, messages: [...state.messages, action.payload] };
        case 'SET_WORD_CHOICES':
            return { ...state, wordChoices: action.payload };
        case 'UPDATE_TIMER':
            return { ...state, timer: action.payload };
        case 'WORD_CHOSEN':
            return {
                ...state,
                wordHint: action.payload.hint,
                wordLength: action.payload.length,
                gameState: GAME_STATES.DRAWING,
                wordToGuess: null,
                wordChoices: [],
                drawerId: action.payload.drawerId
            };
        case 'DRAWER_WORD':
            return { ...state, wordToGuess: action.payload.word };
        case 'CORRECT_GUESS':
            // payload: { playerId, points, word }
            return {
                ...state,
                scores: { ...state.scores, [action.payload.playerId]: action.payload.points }
            };
        case 'GAME_STARTED':
            return {
                ...state,
                gameState: action.payload.gameState || state.gameState,
                currentRound: action.payload.currentRound || state.currentRound,
                drawerId: action.payload.drawerId || state.drawerId
            };
        case 'ROUND_ENDED':
            return { ...state, gameState: GAME_STATES.ROUND_END, wordToGuess: action.payload.word, scores: action.payload.scores };
        case 'GAME_ENDED':
            return { ...state, gameState: GAME_STATES.GAME_END, scores: action.payload.scores };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        default:
            return state;
    }
};

export const GameProvider = ({ children }) => {
    const [state, dispatch] = useReducer(gameReducer, initialState);

    return (
        <GameContext.Provider value={{ state, dispatch }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => useContext(GameContext);
