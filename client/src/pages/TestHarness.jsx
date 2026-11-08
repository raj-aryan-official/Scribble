import React from 'react';
import { useParams } from 'react-router-dom';
import { GameContext } from '../context/GameContext';
import Lobby from './Lobby';
import Game from './Game';

export const TestHarness = () => {
    const { view } = useParams(); // 'lobby' | 'drawer' | 'guesser'

    const mockPlayers = [
        { id: 'drawer-1', username: 'Maya', avatar: 'avatar-1', isHost: true },
        { id: 'guesser-1', username: 'Alex', avatar: 'avatar-2', isHost: false },
        { id: 'guesser-2', username: 'Sam', avatar: 'avatar-3', isHost: false },
        { id: 'guesser-3', username: 'Jordan', avatar: 'avatar-4', isHost: false },
    ];

    const mockScores = {
        'drawer-1': 280,
        'guesser-1': 320,
        'guesser-2': 140,
        'guesser-3': 0,
    };

    if (view === 'lobby') {
        const lobbyState = {
            gameState: 'LOBBY',
            roomCode: 'PLAY42',
            players: mockPlayers,
            currentUser: mockPlayers[0],
            scores: {},
            settings: { rounds: 3, drawTime: 60, difficulty: 'Medium', maxPlayers: 8, packs: [], customWords: [] },
            messages: [],
        };
        return (
            <GameContext.Provider value={{ state: lobbyState, dispatch: () => {} }}>
                <Lobby />
            </GameContext.Provider>
        );
    }

    const isDrawer = view === 'drawer';
    const currentUserId = isDrawer ? 'drawer-1' : 'guesser-2'; // guesser-2 is still guessing

    const gameState = {
        gameState: 'DRAWING',
        roomCode: 'PLAY42',
        currentRound: 2,
        totalRounds: 3,
        drawerId: 'drawer-1',
        currentUser: mockPlayers.find((p) => p.id === currentUserId),
        wordToGuess: isDrawer ? 'PENGUIN' : null,
        wordHint: isDrawer ? 'P E N G U I N' : 'P _ _ _ _ _ N',
        players: mockPlayers,
        scores: mockScores,
        guessedPlayers: ['guesser-1'],
        myGainedPoints: 0,
        timer: 42,
        settings: { rounds: 3, drawTime: 60, difficulty: 'Medium', maxPlayers: 8, packs: [], customWords: [] },
        messages: [
            { username: 'Alex', text: 'bird', type: 'guess', playerId: 'guesser-1' },
            { username: 'Alex', text: 'Guessed the word! (+320)', type: 'correct', gained: 320, playerId: 'guesser-1' },
        ],
    };

    return (
        <GameContext.Provider value={{ state: gameState, dispatch: () => {} }}>
            <Game />
        </GameContext.Provider>
    );
};

export default TestHarness;
