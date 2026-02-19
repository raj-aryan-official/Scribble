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
    totalRounds: 0,
    timer: 0,
    scores: {},
    guessedPlayers: [], // Array of player IDs who guessed correctly this round
    error: null
};

const gameReducer = (state, action) => {
    switch (action.type) {
        case 'SET_USER':
            return { ...state, currentUser: action.payload };
        case 'JOIN_ROOM':
            return {
                ...state,
                roomCode: action.payload.code,
                players: action.payload.players,
                gameState: action.payload.gameState,
                // Extract total rounds from settings if available
                totalRounds: action.payload.settings?.rounds || state.totalRounds
            };
        case 'UPDATE_PLAYERS':
            // Check if player already exists to avoid duplicates (React StrictMode double invoke)
            if (state.players.find(p => p.id === action.payload.id)) return state;
            return { ...state, players: [...state.players, action.payload] };
        case 'SET_GAME_STATE':
            return { ...state, gameState: action.payload };
        case 'ADD_MESSAGE':
            return { ...state, messages: [...state.messages, action.payload] };
        case 'SET_WORD_CHOICES':
            // Clear wordToGuess from previous round here to avoid confusion
            return { ...state, wordChoices: action.payload, wordToGuess: null };
        case 'UPDATE_TIMER':
            return { ...state, timer: action.payload };
        case 'WORD_CHOSEN':
            return {
                ...state,
                wordHint: action.payload.hint,
                wordLength: action.payload.length,
                gameState: GAME_STATES.DRAWING,
                // Only clear wordToGuess if we are NOT the drawer (so we don't wipe it out if DRAWER_WORD arrived first)
                wordToGuess: state.currentUser?.id === action.payload.drawerId ? state.wordToGuess : null,
                wordChoices: [],
                guessedPlayers: [], // Reset guesses for new round
                drawerId: action.payload.drawerId
            };
        case 'HINT_UPDATE':
            return { ...state, wordHint: action.payload.hint };
        case 'DRAWER_WORD':
            return { ...state, wordToGuess: action.payload.word };
        case 'CORRECT_GUESS':
            // payload: { playerId, points, word }
            const isMe = action.payload.playerId === state.currentUser?.id;
            return {
                ...state,
                scores: { ...state.scores, [action.payload.playerId]: action.payload.points },
                guessedPlayers: [...state.guessedPlayers, action.payload.playerId],
                // Reveal word if I guessed correctly
                wordToGuess: isMe ? action.payload.word : state.wordToGuess
            };
        case 'GAME_STARTED':
            return {
                ...state,
                gameState: action.payload.gameState || state.gameState,
                currentRound: action.payload.currentRound || state.currentRound,
                totalRounds: action.payload.settings?.rounds || action.payload.totalRounds || state.totalRounds,
                drawerId: action.payload.drawerId || state.drawerId
            };
        case 'ROUND_ENDED':
            return {
                ...state,
                gameState: GAME_STATES.ROUND_END,
                wordToGuess: action.payload.word,
                scores: action.payload.scores,
                currentRound: action.payload.currentRound || state.currentRound
            };
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
