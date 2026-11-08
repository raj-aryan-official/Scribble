import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HintTiles from '../../Game/HintTiles';
import GuessInput from '../GuessInput';
import MessageList from '../MessageList';
import MidRoundBanner from '../../Game/MidRoundBanner';
import PlayerList from '../../Game/PlayerList';
import GuessPanel from '../../Game/GuessPanel';
import { GameContext } from '../../../context/GameContext';

describe('Instant and Rewarding Guessing Experience', () => {
    describe('1. Hint Tiles (letters, gaps, word length, announcements)', () => {
        it('renders one tile per letter and shows word length for single-word hints', () => {
            const html = renderToStaticMarkup(
                <HintTiles hint="_ _ _ _ _" isDrawer={false} />
            );
            const tiles = html.match(/data-testid="hint-tile"/g);
            expect(tiles).toHaveLength(5);
            expect(html).toContain('data-testid="hint-length"');
            expect(html).toContain('5');
        });

        it('renders gaps for spaces and length formatted as "3, 5" for multi-word hints', () => {
            const html = renderToStaticMarkup(
                <HintTiles hint="c _ t   _ _ _ _ _" isDrawer={false} />
            );
            const gaps = html.match(/data-testid="hint-gap"/g);
            expect(gaps).toHaveLength(1);
            expect(html).toContain('data-testid="hint-length"');
            expect(html).toContain('3, 5');
        });

        it('renders polite aria-live status container for screen reader announcements', () => {
            const html = renderToStaticMarkup(
                <HintTiles hint="_ _ _" isDrawer={false} />
            );
            expect(html).toContain('role="status"');
            expect(html).toContain('aria-live="polite"');
        });
    });

    describe('2. Guess Input (prominent, placeholder, desktop autofocus, char counter)', () => {
        it('renders placeholder "Type your guess" and desktop autoFocus', () => {
            const html = renderToStaticMarkup(
                <GuessInput
                    message=""
                    setMessage={vi.fn()}
                    onSubmit={vi.fn()}
                    isMobile={false}
                    isDrawer={false}
                    hasGuessed={false}
                />
            );
            expect(html).toContain('placeholder="Type your guess"');
            expect(html).toContain('autofocus=""');
        });

        it('disables autofocus on mobile so keyboard does not pop up', () => {
            const html = renderToStaticMarkup(
                <GuessInput
                    message=""
                    setMessage={vi.fn()}
                    onSubmit={vi.fn()}
                    isMobile={true}
                    isDrawer={false}
                    hasGuessed={false}
                />
            );
            expect(html).toContain('placeholder="Type your guess"');
            expect(html).not.toContain('autofocus=""');
        });

        it('hides character counter under 80 chars, displays counter from 80 of 100', () => {
            const shortMsg = 'a'.repeat(79);
            const htmlShort = renderToStaticMarkup(
                <GuessInput
                    message={shortMsg}
                    setMessage={vi.fn()}
                    onSubmit={vi.fn()}
                />
            );
            expect(htmlShort).not.toContain('data-testid="char-counter"');

            const longMsg = 'a'.repeat(85);
            const htmlLong = renderToStaticMarkup(
                <GuessInput
                    message={longMsg}
                    setMessage={vi.fn()}
                    onSubmit={vi.fn()}
                />
            );
            expect(htmlLong).toContain('data-testid="char-counter"');
            expect(htmlLong).toContain('85/100');
        });
    });

    describe('3. Feedback States (Wrong guess, Close, Correct)', () => {
        it('renders marigold pill "Close!" under input when closeHint is true', () => {
            const html = renderToStaticMarkup(
                <GuessInput
                    message="pinguin"
                    setMessage={vi.fn()}
                    onSubmit={vi.fn()}
                    closeHint={true}
                />
            );
            expect(html).toContain('data-testid="close-guess-pill"');
            expect(html).toContain('Close!');
            expect(html).toContain('bg-marigold');
        });

        it('collapses input into leaf-green chip "You got it! +320" when player guessed correctly', () => {
            const html = renderToStaticMarkup(
                <GuessInput
                    message=""
                    setMessage={vi.fn()}
                    onSubmit={vi.fn()}
                    hasGuessed={true}
                    gainedPoints={320}
                />
            );
            expect(html).toContain('data-testid="correct-guess-chip"');
            expect(html).toContain('You got it! +320');
            expect(html).toContain('bg-leaf');
        });

        it('updates panel label to "Chatting with players who\'ve guessed" when guessed', () => {
            const gameState = {
                currentUser: { id: 'p1', username: 'Alex' },
                drawerId: 'drawer-1',
                guessedPlayers: ['p1'],
                messages: [],
            };
            const html = renderToStaticMarkup(
                <GameContext.Provider value={{ state: gameState, dispatch: vi.fn() }}>
                    <GuessPanel roomCode="TEST" isMobile={false} />
                </GameContext.Provider>
            );
            expect(html).toMatch(/Chatting with players who(&#x27;|')ve guessed/);
        });
    });

    describe('4. Player List (states: drawing, guessed, guessing & floating score gains)', () => {
        const players = [
            { id: 'drawer-1', username: 'Maya', avatar: 'avatar-1' },
            { id: 'guesser-1', username: 'Alex', avatar: 'avatar-2' },
            { id: 'guesser-2', username: 'Sam', avatar: 'avatar-3' },
        ];
        const scores = { 'drawer-1': 100, 'guesser-1': 320, 'guesser-2': 0 };

        it('renders drawing (pencil), guessed (tick, leaf fill) and still guessing states', () => {
            const html = renderToStaticMarkup(
                <PlayerList
                    players={players}
                    scores={scores}
                    drawerId="drawer-1"
                    guessedPlayerIds={['guesser-1']}
                    variant="desktop"
                />
            );

            expect(html).toContain('data-player-state="drawing"');
            expect(html).toContain('data-player-state="guessed"');
            expect(html).toContain('data-player-state="guessing"');
            expect(html).toContain('bg-marigold'); // Drawer
            expect(html).toContain('bg-leaf-deep'); // Guessed leaf fill
        });
    });

    describe('5. Message List (100 messages, ink styling, leaf tint with check icon for correct guess)', () => {
        const messages = [
            { username: 'Alex', text: 'cat', type: 'guess', playerId: 'p1' },
            { username: 'Alex', text: 'dog', type: 'guess', playerId: 'p1' },
            { username: 'Sam', text: 'Guessed the word! (+320)', type: 'correct', gained: 320, playerId: 'p2' },
        ];

        it('renders regular messages with name in ink and text in ink-soft', () => {
            const html = renderToStaticMarkup(
                <MessageList messages={messages} currentUserId="p1" />
            );
            expect(html).toContain('data-testid="chat-message-item"');
            expect(html).toContain('text-ink');
            expect(html).toContain('text-ink-soft');
            expect(html).toContain('cat');
        });

        it('renders correct-guess line in leaf-deep text on leaf tint with tick icon', () => {
            const html = renderToStaticMarkup(
                <MessageList messages={messages} currentUserId="p1" />
            );
            expect(html).toContain('data-testid="correct-message-item"');
            expect(html).toContain('bg-leaf/20');
            expect(html).toContain('text-leaf-deep');
            expect(html).toContain('Sam guessed the word!');
            expect(html).toContain('+320');
        });
    });

    describe('6. Joined Mid-Round Quiet Banner', () => {
        it('renders quiet banner with turn number "You joined mid-round. You\'ll draw in turn 4."', () => {
            const html = renderToStaticMarkup(
                <MidRoundBanner turnNumber={4} onDismiss={vi.fn()} />
            );
            expect(html).toContain('data-testid="mid-round-banner"');
            expect(html).toContain("You joined mid-round. You&#x27;ll draw in turn 4.");
        });
    });

    describe('7. Spectator-Safe & Accessibility', () => {
        it('never renders the secret word for guessers in HintTiles', () => {
            const secretWord = 'SUPERSECRET';
            const html = renderToStaticMarkup(
                <HintTiles word={secretWord} hint="_ _ _ _ _" isDrawer={false} />
            );
            expect(html).not.toContain(secretWord);
            expect(html).not.toContain('SUPERSECRET');
        });

        it('has visually hidden accessible label for screen readers on input', () => {
            const html = renderToStaticMarkup(
                <GuessInput
                    message=""
                    setMessage={vi.fn()}
                    onSubmit={vi.fn()}
                    idPrefix="test"
                />
            );
            expect(html).toContain('class="sr-only"');
            expect(html).toContain('Type your guess');
        });
    });
});
