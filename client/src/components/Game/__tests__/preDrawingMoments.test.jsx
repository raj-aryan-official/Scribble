import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GameStartCountdown from '../GameStartCountdown';
import TurnIntro from '../TurnIntro';
import WordChoice from '../WordChoice';
import ScoringCoachmark from '../ScoringCoachmark';
import AutoPickedBanner from '../AutoPickedBanner';
import { GameContext } from '../../../context/GameContext';

describe('Moments Before Drawing Tests', () => {
    describe('1. Game Start Countdown', () => {
        it('renders large countdown numeral driven by startsAt', () => {
            const startsAt = Date.now() + 2500; // ~3 seconds remaining
            const html = renderToStaticMarkup(
                <GameStartCountdown startsAt={startsAt} />
            );
            expect(html).toContain('Get Ready');
            expect(html).toContain('3');
            expect(html).toContain('Game starts in 3');
        });

        it('includes aria-live announcement for accessibility', () => {
            const startsAt = Date.now() + 1500;
            const html = renderToStaticMarkup(
                <GameStartCountdown startsAt={startsAt} />
            );
            expect(html).toContain('aria-live="polite"');
            expect(html).toContain('Game starts in 3');
        });
    });

    describe('2. Turn Intro Card', () => {
        const mockDrawer = {
            id: 'player-1',
            username: 'Maya',
            avatar: 'avatar-1',
        };

        it('renders round number, drawer avatar, and "Maya is up"', () => {
            const html = renderToStaticMarkup(
                <TurnIntro
                    round={1}
                    totalRounds={3}
                    drawer={mockDrawer}
                />
            );
            expect(html).toContain('Round 1 of 3');
            expect(html).toContain('Maya is up');
            expect(html).toContain('Get ready to guess!');
        });
    });

    describe('3. Word Pick (Drawer View)', () => {
        const drawerState = {
            gameState: 'WORD_SELECTION',
            currentRound: 1,
            drawerId: 'player-1',
            currentUser: { id: 'player-1', username: 'Maya' },
            players: [{ id: 'player-1', username: 'Maya', avatar: 'avatar-1' }],
            wordChoices: [
                { word: 'cat', level: 1, difficulty: 'Easy' },
                { word: 'guitar', level: 2, difficulty: 'Medium' },
                { word: 'labyrinth', level: 3, difficulty: 'Hard' },
            ],
            selectionEndsAt: Date.now() + 10000,
        };

        it('renders three fanned index cards with difficulty dots and keyboard shortcuts', () => {
            const html = renderToStaticMarkup(
                <GameContext.Provider value={{ state: drawerState, dispatch: vi.fn() }}>
                    <WordChoice roomCode="TEST1" cardsReady={true} />
                </GameContext.Provider>
            );

            expect(html).toContain('Pick Your Word');
            expect(html).toContain('role="group"');
            expect(html).toContain('aria-label="Choose a word"');

            // Words
            expect(html).toContain('cat');
            expect(html).toContain('guitar');
            expect(html).toContain('labyrinth');

            // Key indicators
            expect(html).toContain('Key 1');
            expect(html).toContain('Key 2');
            expect(html).toContain('Key 3');

            // Difficulty levels
            expect(html).toContain('Easy');
            expect(html).toContain('Medium');
            expect(html).toContain('Hard');
        });

        it('renders cards as real button elements for accessibility', () => {
            const html = renderToStaticMarkup(
                <GameContext.Provider value={{ state: drawerState, dispatch: vi.fn() }}>
                    <WordChoice roomCode="TEST1" cardsReady={true} />
                </GameContext.Provider>
            );

            expect(html).toContain('aria-label="cat, Easy difficulty"');
            expect(html).toContain('aria-label="guitar, Medium difficulty"');
            expect(html).toContain('aria-label="labyrinth, Hard difficulty"');
        });
    });

    describe('4. Word Pick (Spectator View)', () => {
        const spectatorState = {
            gameState: 'WORD_SELECTION',
            currentRound: 1,
            drawerId: 'player-1',
            currentUser: { id: 'player-2', username: 'Raj' },
            players: [
                { id: 'player-1', username: 'Maya', avatar: 'avatar-1' },
                { id: 'player-2', username: 'Raj', avatar: 'avatar-2' },
            ],
            wordChoices: null, // Spectator does NOT receive wordChoices!
            selectionEndsAt: Date.now() + 10000,
        };

        it('renders drawer avatar holding a pencil, status, and random tip without black overlay', () => {
            const html = renderToStaticMarkup(
                <GameContext.Provider value={{ state: spectatorState, dispatch: vi.fn() }}>
                    <WordChoice roomCode="TEST1" cardsReady={true} />
                </GameContext.Provider>
            );

            // Spectator sees drawer name choosing word
            expect(html).toContain('Maya is choosing a word');
            expect(html).toContain('aria-live="polite"');
            expect(html).toContain('Tip:');

            // Stylized pencil SVG
            expect(html).toContain('<svg');

            // Word choices must NEVER be present in spectator view!
            expect(html).not.toContain('Pick Your Word');
            expect(html).not.toContain('Choose a word');
            // No black overlay class
            expect(html).not.toContain('bg-black');
        });
    });

    describe('5. Scoring Coachmark', () => {
        it('renders one-sentence scoring rule and dismiss button', () => {
            const html = renderToStaticMarkup(<ScoringCoachmark />);
            expect(html).toContain(
                'Speed counts: faster guesses earn more points, and the artist scores when players guess right.'
            );
            expect(html).toContain('Got it');
        });
    });

    describe('6. Auto-Picked Banner', () => {
        it('displays "Picked for you: GUITAR" for 1.5s', () => {
            const html = renderToStaticMarkup(
                <AutoPickedBanner word="guitar" onDismiss={vi.fn()} />
            );
            expect(html).toContain('Time Expired');
            expect(html).toContain('Picked for you:');
            expect(html).toContain('GUITAR');
        });

        it('returns null when no word is provided', () => {
            const html = renderToStaticMarkup(
                <AutoPickedBanner word={null} onDismiss={vi.fn()} />
            );
            expect(html).toBe('');
        });
    });
});

