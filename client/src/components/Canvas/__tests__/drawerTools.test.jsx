import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ToolTray from '../ToolTray';
import ColorSwatches, { PRESET_COLORS } from '../ColorSwatches';
import BrushSize from '../BrushSize';
import ShortcutHelp from '../ShortcutHelp';
import ConfirmationModal from '../../ui/ConfirmationModal';
import HintTiles from '../../Game/HintTiles';
import PlayerList from '../../Game/PlayerList';
import GuessPanel from '../../Game/GuessPanel';
import { GameContext } from '../../../context/GameContext';

describe('Drawer Tools & Fast Drawing Flow', () => {
    describe('1. ColorSwatches Component', () => {
        it('renders exactly 12 swatches plus custom color picker', () => {
            const html = renderToStaticMarkup(
                <ColorSwatches color="#1C1B18" setColor={vi.fn()} />
            );
            expect(PRESET_COLORS).toHaveLength(12);
            expect(html).toContain('aria-label="Color palette"');
            expect(html).toContain('Custom color picker');

            // 12 preset color buttons
            PRESET_COLORS.forEach(({ name }) => {
                expect(html).toContain(name);
            });
        });

        it('gives active color a 2px ink ring and aria-pressed true', () => {
            const activeHex = '#E4472B'; // Tomato Red
            const html = renderToStaticMarkup(
                <ColorSwatches color={activeHex} setColor={vi.fn()} />
            );
            expect(html).toContain('ring-2 ring-ink');
            expect(html).toContain('aria-pressed="true"');
        });

        it('ensures each swatch button is at least 44px for thumb touch target', () => {
            const html = renderToStaticMarkup(
                <ColorSwatches color="#1C1B18" setColor={vi.fn()} />
            );
            expect(html).toContain('min-w-[44px]');
            expect(html).toContain('min-h-[44px]');
        });
    });

    describe('2. BrushSize Component', () => {
        it('renders 3 presets (small, medium, large) with dot previews', () => {
            const html = renderToStaticMarkup(
                <BrushSize lineWidth={10} setLineWidth={vi.fn()} />
            );
            expect(html).toContain('Brush size Small (4px)');
            expect(html).toContain('Brush size Medium (10px)');
            expect(html).toContain('Brush size Large (22px)');
            expect(html).toContain('aria-pressed="true"');
        });

        it('renders fine slider popover toggle button', () => {
            const html = renderToStaticMarkup(
                <BrushSize lineWidth={10} setLineWidth={vi.fn()} />
            );
            expect(html).toContain('aria-label="Open fine brush size slider"');
            expect(html).toContain('min-w-[44px]');
            expect(html).toContain('min-h-[44px]');
        });
    });

    describe('3. ShortcutHelp Component', () => {
        it('renders ? shortcut help button with aria-label', () => {
            const html = renderToStaticMarkup(<ShortcutHelp />);
            expect(html).toContain('aria-label="Keyboard shortcuts"');
            expect(html).toContain('min-w-[44px]');
            expect(html).toContain('min-h-[44px]');
        });
    });

    describe('4. ToolTray Assembly', () => {
        it('renders pencil and eraser toggle buttons with aria-pressed', () => {
            const html = renderToStaticMarkup(
                <ToolTray
                    tool="pencil"
                    setTool={vi.fn()}
                    lineWidth={6}
                    setLineWidth={vi.fn()}
                    color="#1C1B18"
                    setColor={vi.fn()}
                    undo={vi.fn()}
                    clearCanvas={vi.fn()}
                />
            );
            expect(html).toContain('aria-label="Pencil tool (P)"');
            expect(html).toContain('aria-pressed="true"');
            expect(html).toContain('aria-label="Eraser tool (E)"');
            expect(html).toContain('aria-pressed="false"');
        });

        it('renders Undo, Clear, and Clear confirmation modal with required text', () => {
            const html = renderToStaticMarkup(
                <ToolTray
                    tool="pencil"
                    setTool={vi.fn()}
                    lineWidth={6}
                    setLineWidth={vi.fn()}
                    color="#1C1B18"
                    setColor={vi.fn()}
                    undo={vi.fn()}
                    clearCanvas={vi.fn()}
                />
            );
            expect(html).toContain('aria-label="Undo stroke (Ctrl+Z)"');
            expect(html).toContain('aria-label="Clear drawing"');

            // Confirmation modal with required text
            const modalHtml = renderToStaticMarkup(
                <ConfirmationModal
                    isOpen={true}
                    title="Clear the whole drawing?"
                    onClose={vi.fn()}
                    onConfirm={vi.fn()}
                />
            );
            expect(modalHtml).toContain('Clear the whole drawing?');
        });
    });

    describe('5. Top Bar: Word Chip & "N of M guessed"', () => {
        it('renders the secret word in a marigold chip and "N of M guessed" counter', () => {
            const html = renderToStaticMarkup(
                <HintTiles
                    word="PENGUIN"
                    isDrawer={true}
                    guessedCount={2}
                    totalGuessers={4}
                />
            );
            expect(html).toContain('data-testid="drawer-word-chip"');
            expect(html).toContain('bg-marigold');
            expect(html).toContain('PENGUIN');
            expect(html).toContain('data-testid="drawer-guessed-counter"');
            expect(html).toContain('2 of 4 guessed');
        });
    });

    describe('6. Guesser Feedback & Drawer Chat Channel', () => {
        const mockPlayers = [
            { id: 'drawer-1', username: 'Maya', avatar: 'avatar-1' },
            { id: 'guesser-1', username: 'Alex', avatar: 'avatar-2' },
        ];
        const scores = { 'drawer-1': 100, 'guesser-1': 250 };

        it('player list shows tick on guesser who guessed', () => {
            const html = renderToStaticMarkup(
                <PlayerList
                    players={mockPlayers}
                    scores={scores}
                    drawerId="drawer-1"
                    guessedPlayerIds={['guesser-1']}
                />
            );
            expect(html).toContain('Alex');
            expect(html).toContain('bg-leaf');
        });

        it('drawer chat is labelled "Chatting with players who\'ve guessed"', () => {
            const drawerGameState = {
                currentUser: { id: 'drawer-1', username: 'Maya' },
                drawerId: 'drawer-1',
                messages: [
                    { username: 'Alex', text: 'cat', type: 'guess' }, // Should be filtered out for drawer!
                    { username: 'Alex', text: 'Hi artist!', type: 'guessed' }, // Visible on guessed channel
                ],
                guessedPlayers: ['guesser-1'],
            };

            const html = renderToStaticMarkup(
                <GameContext.Provider value={{ state: drawerGameState, dispatch: vi.fn() }}>
                    <GuessPanel roomCode="TEST1" isMobile={false} />
                </GameContext.Provider>
            );

            expect(html).toMatch(/Chatting with players who(&#x27;|')ve guessed/);
            expect(html).toContain('Hi artist!');
            // Regular un-guessed attempt 'cat' must be hidden from drawer
            expect(html).not.toContain(': cat');
        });
    });
});
