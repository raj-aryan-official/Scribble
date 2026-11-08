import React, { createContext, useReducer, useContext } from 'react';
import { GAME_STATES } from '../../../shared/types';

export const GameContext = createContext();

const initialState = {
    gameState: GAME_STATES.LOBBY,
    roomCode: null,
    players: [],
    currentUser: null, // { id, username, avatar, isHost, isDisconnected }
    messages: [],
    wordChoices: [],
    currentRound: 0,
    totalRounds: 0,
    timer: 0,
    scores: {},
    guessedPlayers: [], // Array of player IDs who guessed correctly this round
    wordHint: '',
    wordLength: 0,
    wordToGuess: null,
    drawerId: null,
    settings: { rounds: 3, drawTime: 60, difficulty: 'Medium', maxPlayers: 12, packs: [], customWords: [] },
    matchDrawings: [],
    roundGained: {},
    roundEndData: null,
    awards: null,
    startsAt: null,
    selectionEndsAt: null,
    roundEndsAt: null,
    autoPickedWord: null,
    myGainedPoints: 0,
    joinedMidRound: false,
    endReason: null,
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
                scores: action.payload.scores || state.scores,
                currentRound: action.payload.currentRound || state.currentRound,
                totalRounds: action.payload.settings?.rounds || state.totalRounds,
                settings: action.payload.settings || state.settings,
                joinedMidRound: Boolean(action.payload.gameState && action.payload.gameState !== GAME_STATES.LOBBY)
            };
        case 'STATE_SNAPSHOT': {
            const snapshot = action.payload;
            const room = snapshot.publicRoom || snapshot.room;
            const myId = action.socketId || state.currentUser?.id;
            const me = room?.players?.find(p => p.id === myId) || state.currentUser;
            const currentGameState = snapshot.gameState || room?.gameState || state.gameState;
            const isMid = Boolean(
                currentGameState &&
                currentGameState !== GAME_STATES.LOBBY &&
                state.gameState === GAME_STATES.LOBBY
            );
            return {
                ...state,
                gameState: currentGameState,
                roomCode: room?.code || state.roomCode,
                players: room?.players || state.players,
                scores: room?.scores || state.scores,
                totalRounds: room?.settings?.rounds || state.totalRounds,
                currentRound: room?.currentRound || state.currentRound,
                settings: room?.settings || state.settings,
                currentUser: me || null,
                drawerId: snapshot.drawerId || null,
                wordHint: snapshot.hint || '',
                wordLength: snapshot.word ? snapshot.word.length : (snapshot.hint ? snapshot.hint.replace(/\s+/g, '').length : 0),
                timer: snapshot.timeLeft ?? state.timer,
                wordToGuess: snapshot.word || null,
                wordChoices: snapshot.wordChoices || [],
                messages: Array.isArray(snapshot.recentChat) && snapshot.recentChat.length > 0 ? snapshot.recentChat.slice(-100) : state.messages.slice(-100),
                startsAt: snapshot.startsAt || null,
                selectionEndsAt: snapshot.selectionEndsAt || null,
                roundEndsAt: snapshot.roundEndsAt || null,
                joinedMidRound: isMid || state.joinedMidRound,
                error: null
            };
        }
        case 'UPDATE_PLAYERS':
            if (state.players.find(p => p.id === action.payload.id)) {
                return {
                    ...state,
                    players: state.players.map(p => p.id === action.payload.id ? action.payload : p)
                };
            }
            return { ...state, players: [...state.players, action.payload] };
        case 'SET_GAME_STATE':
            return { ...state, gameState: action.payload };
        case 'ADD_MESSAGE': {
            const nextMessages = [...state.messages, action.payload];
            return { ...state, messages: nextMessages.slice(-100) };
        }
        case 'SET_WORD_CHOICES':
            return { ...state, wordChoices: action.payload, wordToGuess: null };
        case 'UPDATE_TIMER':
            return { ...state, timer: action.payload };
        case 'WORD_CHOSEN':
            return {
                ...state,
                wordHint: action.payload.hint,
                wordLength: action.payload.length,
                gameState: GAME_STATES.DRAWING,
                wordToGuess: state.currentUser?.id === action.payload.drawerId ? state.wordToGuess : null,
                wordChoices: [],
                guessedPlayers: [],
                drawerId: action.payload.drawerId,
                roundEndsAt: action.payload.roundEndsAt || null,
                startsAt: null,
                selectionEndsAt: null,
                myGainedPoints: 0
            };
        case 'HINT_UPDATE':
            return { ...state, wordHint: action.payload.hint };
        case 'DRAWER_WORD':
            return {
                ...state,
                wordToGuess: action.payload.word,
                autoPickedWord: action.payload.autoPicked ? action.payload.word : null
            };
        case 'CLEAR_AUTO_PICKED':
            return { ...state, autoPickedWord: null };
        case 'DISMISS_MID_ROUND':
            return { ...state, joinedMidRound: false };
        case 'CORRECT_GUESS': {
            const isMe = action.payload.playerId === state.currentUser?.id;
            const newScore = action.payload.total ?? action.payload.points;
            const updatedGuessed = state.guessedPlayers.includes(action.payload.playerId)
                ? state.guessedPlayers
                : [...state.guessedPlayers, action.payload.playerId];
            return {
                ...state,
                scores: { ...state.scores, [action.payload.playerId]: newScore },
                guessedPlayers: updatedGuessed,
                myGainedPoints: isMe ? (action.payload.gained || 320) : state.myGainedPoints,
                wordToGuess: isMe && action.payload.word ? action.payload.word : state.wordToGuess
            };
        }
        case 'GAME_STARTED':
            return {
                ...state,
                gameState: action.payload.gameState || state.gameState,
                currentRound: action.payload.currentRound || state.currentRound,
                totalRounds: action.payload.settings?.rounds || action.payload.totalRounds || state.totalRounds,
                drawerId: action.payload.drawerId || state.drawerId,
                startsAt: action.payload.startsAt || null,
                selectionEndsAt: action.payload.selectionEndsAt || null,
                roundEndsAt: action.payload.roundEndsAt || null,
                roundEndData: null,
                awards: null,
                guessedPlayers: [],
                autoPickedWord: null,
                myGainedPoints: 0,
                joinedMidRound: false
            };
        case 'ROUND_ENDED':
            return {
                ...state,
                gameState: GAME_STATES.ROUND_END,
                wordToGuess: action.payload.word,
                scores: action.payload.scores || state.scores,
                roundGained: action.payload.gained || {},
                roundEndData: action.payload,
                currentRound: action.payload.currentRound || state.currentRound,
                guessedPlayers: [],
                myGainedPoints: 0,
                joinedMidRound: false
            };
        case 'GAME_ENDED':
            return {
                ...state,
                gameState: GAME_STATES.GAME_END,
                scores: action.payload.scores || state.scores,
                matchDrawings: action.payload.matchDrawings || state.matchDrawings || [],
                awards: action.payload.awards || action.payload.stats || state.awards || null,
                endReason: action.payload.reason || null
            };
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
