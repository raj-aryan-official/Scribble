import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameBar } from '../GameBar';
import { GameContext } from '../../../context/GameContext';

const renderWithContext = (ui, stateOverride = {}) => {
    const defaultState = {
        gameState: 'DRAWING',
        roomCode: 'PLAY42',
        currentRound: 1,
        totalRounds: 3,
        turnInfo: { turnInRound: 2, turnsInRound: 5 },
        drawerId: 'p1',
        currentUser: { id: 'p1', username: 'Maya', isHost: true },
        players: [
            { id: 'p1', username: 'Maya', isHost: true },
            { id: 'p2', username: 'Alex', isHost: false },
        ],
        wordToGuess: 'PENGUIN',
        wordHint: 'P _ _ _ _ _ N',
        timer: 45,
        settings: { drawTime: 60, rounds: 3 },
        guessedPlayers: [],
        ...stateOverride,
    };

    return renderToStaticMarkup(
        <GameContext.Provider value={{ state: defaultState, dispatch: () => {} }}>
            {ui}
        </GameContext.Provider>
    );
};

describe('GameBar Component', () => {
    describe('Desktop 72px Layout & 3 Clusters', () => {
        it('renders header landmark with accessible label and sticky bar z-index', () => {
            const html = renderWithContext(<GameBar />);
            expect(html).toContain('<header');
            expect(html).toContain('aria-label="Game navigation bar"');
            expect(html).toContain('sticky');
            expect(html).toContain('z-bar');
            expect(html).toContain('md:h-[72px]');
        });

        it('Cluster 1 (Left): renders small ROOM label in ink-soft, code at 20px display face, and Round 1 of 3 · Turn 2 of 5', () => {
            const html = renderWithContext(<GameBar />);
            // Label ROOM
            expect(html).toContain('ROOM');
            expect(html).toContain('text-ink-soft');
            // Replaced teal label color with ink-soft
            expect(html).not.toContain('text-teal');
            expect(html).not.toContain('bg-teal');
            // Room code in display face
            expect(html).toContain('PLAY42');
            expect(html).toContain('font-heading');
            expect(html).toContain('md:text-[20px]');
            // Round & Turn info
            expect(html).toContain('Round 1 of 3 · Turn 2 of 5');
            // Accessible label for code copy
            expect(html).toContain('aria-label="Room code PLAY42, click to copy"');
        });

        it('Cluster 2 (Centre): status line has reserved height and correct copy for drawer', () => {
            const html = renderWithContext(<GameBar />);
            expect(html).toContain('h-5');
            expect(html).toContain('min-h-[20px]');
            expect(html).toContain('You are drawing!');
            // Drawer sees word in marigold chip in display face, not red monospace
            expect(html).toContain('data-testid="drawer-word-chip"');
            expect(html).toContain('bg-marigold');
            expect(html).toContain('PENGUIN');
            expect(html).toContain('font-heading');
            expect(html).not.toContain('font-mono font-black text-lg sm:text-xl md:text-2xl uppercase tracking-wider select-none text-tomato');
        });

        it('Cluster 2 (Centre): copy by state for guessers and special states', () => {
            // Guesser drawing
            const guesserHtml = renderWithContext(<GameBar />, {
                currentUser: { id: 'p2', username: 'Alex', isHost: false },
                drawerId: 'p1',
            });
            expect(guesserHtml).toContain('Maya is drawing');
            expect(guesserHtml).toContain('data-testid="hint-tiles-container"');

            // After correct guess
            const correctHtml = renderWithContext(<GameBar />, {
                currentUser: { id: 'p2', username: 'Alex', isHost: false },
                drawerId: 'p1',
                guessedPlayers: ['p2'],
            });
            expect(correctHtml).toContain('You got it!');

            // Word picking
            const pickingHtml = renderWithContext(<GameBar />, {
                gameState: 'WORD_SELECTION',
                currentUser: { id: 'p2', username: 'Alex', isHost: false },
                drawerId: 'p1',
            });
            expect(pickingHtml).toContain('Maya is choosing a word');

            // TURN_WAIT state
            const waitHtml = renderWithContext(<GameBar />, {
                gameState: 'TURN_WAIT',
                turnWait: { waitingFor: 'Maya' },
            });
            expect(waitHtml).toContain('Waiting for Maya to reconnect');

            // PAUSED state
            const pausedHtml = renderWithContext(<GameBar />, {
                gameState: 'PAUSED',
            });
            expect(pausedHtml).toContain('Waiting for players to return');
        });

        it('Cluster 3 (Right): renders 40px timer ring with role=timer and tabular numbers', () => {
            const html = renderWithContext(<GameBar />, { timer: 45 });
            expect(html).toContain('role="timer"');
            expect(html).toContain('aria-label="45 seconds remaining"');
            expect(html).toContain('tabular-nums');
            expect(html).toContain('45');
        });

        it('Cluster 3 (Right): timer turns tomato in last 10 seconds', () => {
            const html45 = renderWithContext(<GameBar />, { timer: 45 });
            expect(html45).not.toContain('text-tomato stroke-tomato');

            const html8 = renderWithContext(<GameBar />, { timer: 8 });
            expect(html8).toContain('text-tomato');
            expect(html8).toContain('8');
        });

        it('Cluster 3 (Right): voice group toggles have 40px size and aria-pressed', () => {
            const voiceState = {
                isMicOn: true,
                isDeafened: false,
                isVoiceAllowed: true,
                toggleMic: vi.fn(),
                toggleDeafen: vi.fn(),
            };
            const html = renderWithContext(<GameBar voiceState={voiceState} />);
            expect(html).toContain('aria-label="Mute microphone"');
            expect(html).toContain('aria-pressed="true"');
            expect(html).toContain('bg-leaf/20');
            expect(html).toContain('aria-label="Mute audio"');
            expect(html).toContain('bg-cobalt/15');
            expect(html).toContain('w-10 h-10');
        });

        it('Cluster 3 (Right): mic off has tomato tint and speaker off has ink-soft with slash', () => {
            const voiceState = {
                isMicOn: false,
                isDeafened: true,
                isVoiceAllowed: true,
                toggleMic: vi.fn(),
                toggleDeafen: vi.fn(),
            };
            const html = renderWithContext(<GameBar voiceState={voiceState} />);
            expect(html).toContain('aria-label="Unmute microphone"');
            expect(html).toContain('aria-pressed="false"');
            expect(html).toContain('bg-tomato/15');
            expect(html).toContain('aria-label="Unmute audio"');
            expect(html).toContain('text-ink-soft');
        });

        it('Cluster 3 (Right): renders 1px divider, Exit button, and outlined End Game button for host', () => {
            const html = renderWithContext(<GameBar />);
            // 1px divider
            expect(html).toContain('w-[1px]');
            expect(html).toContain('bg-ink/20');
            // Exit button with accessible label and Exit text from lg
            expect(html).toContain('aria-label="Leave game"');
            expect(html).toContain('Exit');
            // End Game button for host (outlined, not filled)
            expect(html).toContain('aria-label="End game for everyone"');
            expect(html).toContain('End Game');
            expect(html).toContain('border-tomato-deep');
            expect(html).toContain('text-tomato-deep');
            expect(html).toContain('bg-transparent');
        });

        it('Cluster 3 (Right): hides End Game button for non-host players', () => {
            const html = renderWithContext(<GameBar />, {
                currentUser: { id: 'p2', username: 'Alex', isHost: false },
            });
            expect(html).not.toContain('aria-label="End game for everyone"');
        });

        it('renders confirmation modals for Exit and End Game', () => {
            const htmlExit = renderWithContext(<GameBar initialShowExitModal={true} />);
            expect(htmlExit).toContain('Leave this game? You can rejoin from the start page.');

            const htmlEnd = renderWithContext(<GameBar initialShowEndGameModal={true} />);
            expect(htmlEnd).toContain('End the game for everyone? Scores will be shown.');
        });
    });

    describe('Phone Layout (under 768px)', () => {
        it('Row 1 (48px): renders code over Round 1/3 · Turn 2/5, 36px timer ring, mic, speaker, and kebab menu', () => {
            const html = renderWithContext(<GameBar />);
            expect(html).toContain('Round 1/3 · Turn 2/5');
            expect(html).toContain('aria-label="Open game menu"');
            // Responsive timer ring: 36px on phone (w-9 h-9), 40px on desktop (md:w-10 md:h-10)
            expect(html).toContain('w-9 h-9');
            expect(html).toContain('md:w-10 md:h-10');
        });

        it('Row 2 (40px): renders status on left and word chip on right for drawer', () => {
            const html = renderWithContext(<GameBar />);
            expect(html).toContain('You are drawing!');
            expect(html).toContain('PENGUIN');
            expect(html).toContain('bg-marigold');
        });

        it('Row 2 (40px): renders hint tiles across row for guesser', () => {
            const html = renderWithContext(<GameBar />, {
                currentUser: { id: 'p2', username: 'Alex', isHost: false },
                drawerId: 'p1',
            });
            expect(html).toContain('data-testid="hint-tiles-container"');
        });
    });

    describe('Accessibility & DOM Order', () => {
        it('DOM order equals visual order: room -> status and word -> timer -> voice -> exit -> end game', () => {
            const html = renderWithContext(<GameBar />);
            const roomIdx = html.indexOf('Room code PLAY42');
            const statusIdx = html.indexOf('You are drawing!');
            const timerIdx = html.indexOf('role="timer"');
            const voiceIdx = html.indexOf('aria-label="Unmute microphone"');
            const exitIdx = html.indexOf('aria-label="Leave game"');
            const endGameIdx = html.indexOf('aria-label="End game for everyone"');

            expect(roomIdx).toBeGreaterThan(-1);
            expect(statusIdx).toBeGreaterThan(roomIdx);
            expect(timerIdx).toBeGreaterThan(statusIdx);
            expect(voiceIdx).toBeGreaterThan(timerIdx);
            expect(exitIdx).toBeGreaterThan(voiceIdx);
            expect(endGameIdx).toBeGreaterThan(exitIdx);
        });
    });
});
