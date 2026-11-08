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
    defaultChoice: null,
    wordChoiceMode: 'pick',
    turnId: null,
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
    turnInfo: null,
    turnWait: null,
    isSuperseded: false,
    seatClaimRequest: null,
    isPaused: false,
    pausedData: null,
    publicRoom: null,
    voteState: null,
    hasVotedKick: false,
    likesCount: 0,
    hasLiked: false,
    incomingReactionBatch: null,
    topReaction: null,
    currentTwist: null,
    turnInkRemaining: null,
    toast: null,
    error: null
};

const gameReducer = (state, action) => {
    switch (action.type) {
        case 'SET_USER':
            return { ...state, currentUser: action.payload };
        case 'SET_SUPERSEDED':
            return { ...state, isSuperseded: action.payload };
        case 'SET_SEAT_CLAIM_REQUEST':
            return { ...state, seatClaimRequest: action.payload };
        case 'SET_VOTE_STATE':
            return {
                ...state,
                voteState: action.payload,
                hasVotedKick: action.payload ? state.hasVotedKick : false
            };
        case 'CAST_VOTE_LOCAL':
            return {
                ...state,
                hasVotedKick: true
            };
        case 'SHOW_TOAST':
            return { ...state, toast: typeof action.payload === 'string' ? { message: action.payload, variant: 'info' } : action.payload };
        case 'HIDE_TOAST':
            return { ...state, toast: null };
        case 'GAME_PAUSED':
            return {
                ...state,
                gameState: GAME_STATES.PAUSED,
                isPaused: true,
                pausedData: action.payload
            };
        case 'GAME_RESUMED':
            return {
                ...state,
                gameState: GAME_STATES.DRAWING,
                isPaused: false,
                pausedData: null,
                roundEndsAt: action.payload?.roundEndsAt || state.roundEndsAt
            };
        case 'ROOM_JOINED':
            return {
                ...state,
                publicRoom: action.payload,
                players: action.payload.players || state.players,
                scores: action.payload.scores || state.scores,
                gameState: action.payload.gameState || state.gameState
            };
        case 'JOIN_ROOM':
            return {
                ...state,
                publicRoom: action.payload,
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
            let me = room?.players?.find(p => p.id === myId || (snapshot.playerId && p.playerId === snapshot.playerId)) || state.currentUser;
            if (snapshot.ownRecord && me) {
                me = { ...me, ...snapshot.ownRecord };
            }
            const currentGameState = snapshot.gameState || room?.gameState || state.gameState;
            const isMid = Boolean(
                currentGameState &&
                currentGameState !== GAME_STATES.LOBBY &&
                state.gameState === GAME_STATES.LOBBY
            );
            const myGuessed = Boolean(snapshot.ownRecord?.guessedThisTurn);
            const updatedGuessed = myGuessed && myId && !state.guessedPlayers.includes(myId)
                ? [...state.guessedPlayers, myId]
                : state.guessedPlayers;

            const updatedScores = room?.scores || state.scores;
            if (snapshot.ownRecord && myId && snapshot.ownRecord.score !== undefined) {
                updatedScores[myId] = snapshot.ownRecord.score;
            }

            const isTurnWait = currentGameState === GAME_STATES.TURN_WAIT || Boolean(snapshot.turnWaitEndsAt);
            const turnWaitObj = isTurnWait ? {
                waitingFor: snapshot.waitingFor || (room?.players?.find(p => p.id === snapshot.waitingForDrawerId || p.playerId === snapshot.waitingForDrawerId)?.username) || 'Player',
                waitingForDrawerId: snapshot.waitingForDrawerId,
                endsAt: snapshot.turnWaitEndsAt || snapshot.endsAt
            } : null;

            const isPausedState = currentGameState === GAME_STATES.PAUSED;

            return {
                ...state,
                gameState: currentGameState,
                isPaused: isPausedState,
                pausedData: isPausedState ? (snapshot.pausedData || { timeout: 60, endsAt: snapshot.pausedEndsAt || room?.pausedEndsAt }) : null,
                isSuperseded: false,
                publicRoom: room || state.publicRoom,
                roomCode: room?.code || state.roomCode,
                players: room?.players || state.players,
                scores: updatedScores,
                totalRounds: room?.settings?.rounds || state.totalRounds,
                currentRound: room?.currentRound || state.currentRound,
                settings: room?.settings || state.settings,
                currentUser: me || null,
                drawerId: snapshot.drawerId || null,
                wordHint: snapshot.hint || '',
                wordLength: snapshot.word ? snapshot.word.length : (snapshot.hint ? snapshot.hint.replace(/\s+/g, '').length : 0),
                timer: snapshot.timeLeft ?? state.timer,
                wordToGuess: snapshot.word || state.wordToGuess,
                guessedPlayers: updatedGuessed,
                wordChoices: snapshot.wordChoices || [],
                defaultChoice: typeof snapshot.defaultChoice === 'number' ? snapshot.defaultChoice : 0,
                wordChoiceMode: snapshot.wordChoiceMode || snapshot.publicRoom?.settings?.wordChoice || state.settings?.wordChoice || 'pick',
                turnId: snapshot.turnId || snapshot.turnInfo?.turnId || state.turnId,
                messages: Array.isArray(snapshot.recentChat) && snapshot.recentChat.length > 0 ? snapshot.recentChat.slice(-100) : (state.messages || []).slice(-100),
                startsAt: snapshot.startsAt || null,
                selectionEndsAt: snapshot.selectionEndsAt || null,
                roundEndsAt: snapshot.roundEndsAt || null,
                joinedMidRound: isMid || state.joinedMidRound,
                turnInfo: snapshot.turnInfo || snapshot.TURN_INFO || state.turnInfo,
                turnWait: turnWaitObj,
                voteState: snapshot.activeVote !== undefined ? snapshot.activeVote : state.voteState,
                likesCount: snapshot.likesCount ?? state.likesCount ?? 0,
                topReaction: snapshot.topReaction || null,
                currentTwist: snapshot.twist !== undefined ? snapshot.twist : state.currentTwist,
                turnInkRemaining: snapshot.turnInkRemaining !== undefined ? snapshot.turnInkRemaining : state.turnInkRemaining,
                error: null
            };
        }
        case 'PLAYER_STATUS': {
            const { playerId, status } = action.payload || {};
            if (!playerId) return state;
            const updatedPlayers = state.players.map(p => {
                if (p.id === playerId || p.playerId === playerId) {
                    return {
                        ...p,
                        status,
                        isDisconnected: status === 'away' || status === 'left'
                    };
                }
                return p;
            });
            return {
                ...state,
                players: updatedPlayers
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
            if (!action.payload) return state;
            if (action.payload.id && state.messages.some(m => m.id === action.payload.id)) {
                return state;
            }
            const nextMessages = [...state.messages, action.payload];
            return { ...state, messages: nextMessages.slice(-100) };
        }
        case 'SET_WORD_CHOICES': {
            const choices = Array.isArray(action.payload) ? action.payload : (action.payload?.choices || []);
            const defaultChoice = typeof action.payload?.defaultChoice === 'number' ? action.payload.defaultChoice : 0;
            return {
                ...state,
                wordChoices: choices,
                defaultChoice,
                wordToGuess: null
            };
        }
        case 'UPDATE_TIMER':
            return { ...state, timer: action.payload };
        case 'UPDATE_INK':
            return { ...state, turnInkRemaining: action.payload };
        case 'WORD_CHOSEN':
            return {
                ...state,
                wordHint: action.payload.hint,
                wordLength: action.payload.length,
                gameState: GAME_STATES.DRAWING,
                wordToGuess: state.currentUser?.id === action.payload.drawerId ? state.wordToGuess : null,
                wordChoices: [],
                defaultChoice: null,
                turnId: action.payload.turnId || state.turnId,
                guessedPlayers: [],
                drawerId: action.payload.drawerId,
                roundEndsAt: action.payload.roundEndsAt || null,
                startsAt: null,
                selectionEndsAt: null,
                turnWait: null,
                myGainedPoints: 0,
                likesCount: 0,
                hasLiked: false,
                incomingReactionBatch: null,
                topReaction: null,
                currentTwist: action.payload.twist !== undefined ? action.payload.twist : state.currentTwist
            };
        case 'REACTION_BATCH':
            return { ...state, incomingReactionBatch: action.payload };
        case 'LIKE_UPDATE':
            return {
                ...state,
                likesCount: typeof action.payload?.likes === 'number' ? action.payload.likes : state.likesCount,
                scores: action.payload?.scores || state.scores
            };
        case 'SET_LOCAL_LIKED':
            return {
                ...state,
                hasLiked: true,
                likesCount: state.likesCount + 1
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
        case 'TURN_INFO':
            return {
                ...state,
                turnInfo: action.payload,
                drawerId: action.payload?.drawerId || state.drawerId,
                currentRound: action.payload?.round || state.currentRound,
                totalRounds: action.payload?.totalRounds || state.totalRounds
            };
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
        case 'GAME_STARTED': {
            const isTurnWait = (action.payload.gameState === GAME_STATES.TURN_WAIT);
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
                joinedMidRound: false,
                wordHint: '',
                wordLength: 0,
                wordToGuess: null,
                wordChoiceMode: action.payload.wordChoiceMode || state.settings?.wordChoice || 'pick',
                turnId: action.payload.turnId || state.turnId,
                turnInfo: action.payload.turnInfo || state.turnInfo,
                currentTwist: action.payload.twist !== undefined ? action.payload.twist : state.currentTwist,
                turnInkRemaining: action.payload.twist?.totalInk ?? null,
                turnWait: isTurnWait ? {
                    waitingFor: action.payload.waitingFor || 'Player',
                    waitingForDrawerId: action.payload.waitingForDrawerId,
                    endsAt: action.payload.endsAt || action.payload.turnWaitEndsAt
                } : null
            };
        }
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
                joinedMidRound: false,
                wordHint: '',
                wordLength: 0,
                likesCount: typeof action.payload.likesCount === 'number' ? action.payload.likesCount : state.likesCount,
                topReaction: action.payload.topReaction || null
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
export { gameReducer, initialState };
