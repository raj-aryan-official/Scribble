import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WordChoice from '../WordChoice';
import GameBar from '../GameBar';
import SettingsCard from '../../Lobby/SettingsCard';
import SettingsModal from '../../Settings/SettingsModal';
import { GameContext } from '../../../context/GameContext';
import { SettingsContext, DEFAULT_SETTINGS } from '../../../context/SettingsContext';

const renderWithContext = (ui, gameStateOverride = {}, settingsOverride = {}) => {
    const defaultState = {
        gameState: 'WORD_SELECTION',
        roomCode: 'TEST99',
        currentRound: 1,
        totalRounds: 3,
        drawerId: 'player-1',
        currentUser: { id: 'player-1', username: 'Maya', isHost: true },
        players: [
            { id: 'player-1', username: 'Maya', avatar: 'avatar-1', isHost: true },
            { id: 'player-2', username: 'Alex', avatar: 'avatar-2', isHost: false },
        ],
        wordChoices: ['cat', 'guitar', 'labyrinth'],
        defaultChoice: 1,
        wordChoiceMode: 'pick',
        wordToGuess: null,
        wordHint: '',
        timer: 10,
        settings: { drawTime: 60, rounds: 3, wordChoice: 'pick' },
        guessedPlayers: [],
        ...gameStateOverride,
    };

    const defaultSettingsContext = {
        settings: { ...DEFAULT_SETTINGS, ...settingsOverride },
        updateSettings: () => {},
        resetSettings: () => {},
        isOpen: true,
        openSettings: () => {},
        closeSettings: () => {},
    };

    return renderToStaticMarkup(
        <SettingsContext.Provider value={defaultSettingsContext}>
            <GameContext.Provider value={{ state: defaultState, dispatch: () => {} }}>
                {ui}
            </GameContext.Provider>
        </SettingsContext.Provider>
    );
};

describe('Word Choice & Random Mode Client Tests', () => {
    describe('1. Pick Mode: Default Selection & Card Display', () => {
        it('preselected defaultChoice card shows the Default tag and cobalt ring', () => {
            const html = renderWithContext(<WordChoice roomCode="TEST99" />, {
                defaultChoice: 1,
                wordChoices: ['cat', 'guitar', 'labyrinth'],
            });

            // Contains Default tag
            expect(html).toContain('data-testid="default-choice-tag"');
            expect(html).toContain('Default');

            // Card 1 is guitar and has ring-2 ring-cobalt
            expect(html).toContain('data-testid="word-choice-card-1"');
            expect(html).toContain('ring-2 ring-cobalt');
            expect(html).toContain('guitar');
        });

        it('other non-default cards do not show the Default tag', () => {
            const html = renderWithContext(<WordChoice roomCode="TEST99" />, {
                defaultChoice: 0,
                wordChoices: ['cat', 'guitar', 'labyrinth'],
            });

            // Card 0 has the default tag
            expect(html).toContain('data-testid="word-choice-card-0"');
            // Exactly one Default tag in the output
            const matches = html.match(/data-testid="default-choice-tag"/g);
            expect(matches).not.toBeNull();
            expect(matches.length).toBe(1);
        });

        it('renders the "Surprise me" button with Dices icon', () => {
            const html = renderWithContext(<WordChoice roomCode="TEST99" />);
            expect(html).toContain('data-testid="surprise-me-button"');
            expect(html).toContain('Surprise me');
            expect(html).toContain('lucide-dices');
        });
    });

    describe('2. Random Mode: Immediate Assignment & 3s Preview', () => {
        it('drawer view in random mode displays "Your word: GUITAR" for 3s and NO choice cards', () => {
            const html = renderWithContext(<WordChoice roomCode="TEST99" />, {
                wordChoiceMode: 'random',
                wordToGuess: 'guitar',
                wordChoices: null,
            });

            // Renders random mode drawer card
            expect(html).toContain('data-testid="word-choice-random-drawer"');
            expect(html).toContain('Your word:');
            expect(html).toContain('GUITAR');
            expect(html).toContain('Random Word Mode');
            expect(html).toContain('Round begins in 3s');

            // Crucial: NO choice cards rendered!
            expect(html).not.toContain('data-testid="word-choice-card-0"');
            expect(html).not.toContain('data-testid="word-choice-card-1"');
            expect(html).not.toContain('data-testid="word-choice-card-2"');
            expect(html).not.toContain('data-testid="surprise-me-button"');
        });

        it('spectator view in random mode displays "{drawer} is getting a word" without revealing the word', () => {
            const html = renderWithContext(
                <WordChoice roomCode="TEST99" />,
                {
                    wordChoiceMode: 'random',
                    drawerId: 'player-1',
                    currentUser: { id: 'player-2', username: 'Alex', isHost: false },
                    wordToGuess: null, // Spectator never receives word!
                    wordChoices: null,
                }
            );

            // Renders spectator container
            expect(html).toContain('data-testid="word-choice-spectator"');
            expect(html).toContain('Maya is getting a word');
            expect(html).toContain('Round starting soon...');

            // Does NOT contain the secret word
            expect(html).not.toContain('GUITAR');
            expect(html).not.toContain('guitar');
        });
    });

    describe('3. GameBar Status Line in Random Mode', () => {
        it('in WORD_SELECTION with random mode: drawer sees "Your word: GUITAR"', () => {
            const html = renderWithContext(<GameBar />, {
                gameState: 'WORD_SELECTION',
                wordChoiceMode: 'random',
                wordToGuess: 'guitar',
                currentUser: { id: 'player-1', username: 'Maya', isHost: true },
                drawerId: 'player-1',
            });

            expect(html).toContain('Your word: GUITAR');
        });

        it('in WORD_SELECTION with random mode: guesser sees "Maya is getting a word"', () => {
            const html = renderWithContext(<GameBar />, {
                gameState: 'WORD_SELECTION',
                wordChoiceMode: 'random',
                currentUser: { id: 'player-2', username: 'Alex', isHost: false },
                drawerId: 'player-1',
                wordToGuess: null,
            });

            expect(html).toContain('Maya is getting a word');
        });

        it('in WORD_SELECTION with pick mode: drawer sees "You are choosing a word" and guesser sees "Maya is choosing a word"', () => {
            const drawerHtml = renderWithContext(<GameBar />, {
                gameState: 'WORD_SELECTION',
                wordChoiceMode: 'pick',
                currentUser: { id: 'player-1', username: 'Maya', isHost: true },
                drawerId: 'player-1',
            });
            expect(drawerHtml).toContain('You are choosing a word');

            const guesserHtml = renderWithContext(<GameBar />, {
                gameState: 'WORD_SELECTION',
                wordChoiceMode: 'pick',
                currentUser: { id: 'player-2', username: 'Alex', isHost: false },
                drawerId: 'player-1',
            });
            expect(guesserHtml).toContain('Maya is choosing a word');
        });
    });

    describe('4. SettingsCard in Lobby', () => {
        it('host sees segmented control for Word choice with Pick from 3 and Random word', () => {
            const html = renderToStaticMarkup(
                <SettingsCard
                    isHost={true}
                    hostName="Maya"
                    settings={{ wordChoice: 'pick', rounds: 3, drawTime: 60, difficulty: 'Medium', packs: [] }}
                />
            );

            expect(html).toContain('Word Choice');
            expect(html).toContain('data-testid="word-choice-option-pick"');
            expect(html).toContain('Pick from 3');
            expect(html).toContain('data-testid="word-choice-option-random"');
            expect(html).toContain('Random word');
        });

        it('non-host sees read-only summary for Word choice', () => {
            const html = renderToStaticMarkup(
                <SettingsCard
                    isHost={false}
                    hostName="Maya"
                    settings={{ wordChoice: 'random', rounds: 3, drawTime: 60, difficulty: 'Medium', packs: [] }}
                />
            );

            expect(html).toContain('data-testid="readonly-word-choice"');
            expect(html).toContain('Random word');
            // Host interactive buttons are not present
            expect(html).not.toContain('data-testid="word-choice-option-pick"');
            expect(html).not.toContain('data-testid="word-choice-option-random"');
        });
    });

    describe('5. SettingsModal Gameplay Setting', () => {
        it('renders "Always pick randomly for me" switch in SettingsModal', () => {
            const html = renderWithContext(<SettingsModal isOpen={true} onClose={() => {}} />);
            expect(html).toContain('Always pick randomly for me');
            expect(html).toContain('id="setting-always-pick-randomly"');
            expect(html).toContain('Gameplay');
        });
    });
});

