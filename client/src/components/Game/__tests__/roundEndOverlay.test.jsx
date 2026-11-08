import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoundEndOverlay from '../RoundEndOverlay';

describe('RoundEndOverlay - Celebratory Round-End Moment', () => {
    const mockPlayers = [
        { id: 'p1', username: 'Maya', avatar: 'avatar-1' },
        { id: 'p2', username: 'Raj', avatar: 'avatar-2' },
        { id: 'p3', username: 'Alex', avatar: 'avatar-3' },
    ];

    describe('1. Overlay semantics & background dimming', () => {
        it('renders with dialog role, aria-modal, and labelledby', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p1: 500, p2: 320, p3: 0 }}
                    gained={{ p2: 320 }}
                />
            );
            expect(html).toContain('role="dialog"');
            expect(html).toContain('aria-modal="true"');
            expect(html).toContain('aria-labelledby="round-end-heading"');
            expect(html).toContain('id="round-end-heading"');
        });

        it('dims paper to 40 percent (bg-ink/40) rather than a full opaque black layer', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{}}
                    gained={{}}
                />
            );
            expect(html).toContain('bg-ink/40');
            expect(html).not.toContain('bg-black/90');
        });
    });

    describe('2. Word reveal & scoring feedback', () => {
        it('writes the secret word large in heading display face', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p2: 320 }}
                    gained={{ p2: 320 }}
                />
            );
            expect(html).toContain('The word was');
            expect(html).toContain('GUITAR');
            expect(html).toContain('font-heading');
        });

        it('shows "Nobody got it this time." when nobody guessed correctly', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p1: 100, p2: 100, p3: 50 }}
                    gained={{ p1: 0, p2: 0, p3: 0 }}
                />
            );
            expect(html).toContain('Nobody got it this time.');
            expect(html).toContain('text-tomato');
        });

        it('does not show "Nobody got it this time." when someone scored', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p2: 320 }}
                    gained={{ p2: 320 }}
                />
            );
            expect(html).not.toContain('Nobody got it this time.');
        });
    });

    describe('3. Score table, count-up & accessibility', () => {
        it('renders tabular numbers for score values', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p1: 350, p2: 320, p3: 0 }}
                    gained={{ p2: 320, p1: 30 }}
                />
            );
            expect(html).toContain('tabular-nums');
            expect(html).toContain('font-mono');
        });

        it('provides screen readers with final score values immediately without delay', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p2: 320 }}
                    gained={{ p2: 320 }}
                />
            );
            expect(html).toContain('sr-only');
            expect(html).toContain('Raj: +320 points, total 320 points');
        });

        it('announces word and player gains politely once via aria-live', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p2: 320 }}
                    gained={{ p2: 320 }}
                />
            );
            expect(html).toContain('aria-live="polite"');
            expect(html).toContain('The word was GUITAR. Raj gained 320 points');
        });

        it('shows "Fastest" badge with icon on the fastest guesser', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p2: 320, p3: 200 }}
                    gained={{ p2: 320, p3: 200 }}
                    fastestGuesserId="p2"
                />
            );
            expect(html).toContain('data-testid="fastest-badge"');
            expect(html).toContain('Fastest');
        });

        it('shows drawer bonus badge on the drawer row', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    scores={{ p1: 32, p2: 320 }}
                    gained={{ p1: 32, p2: 320 }}
                    drawerId="p1"
                    drawerBonus={32}
                />
            );
            expect(html).toContain('data-testid="drawer-bonus-badge"');
            expect(html).toContain('Drawer bonus');
        });
    });

    describe('4. Drawing thumbnail', () => {
        it('renders a 4:3 canvas thumbnail of the turn drawing', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    strokes={[{ points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] }]}
                />
            );
            expect(html).toContain('data-testid="round-end-thumbnail"');
            expect(html).toContain('aspect-4/3');
            expect(html).toContain('Drawing');
        });
    });

    describe('5. Bottom countdown, next drawer notice & host skip', () => {
        it('renders 5 s draining progress bar', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    duration={5}
                />
            );
            expect(html).toContain('data-testid="countdown-drain-bar"');
            expect(html).toContain('bg-tomato');
        });

        it('renders "Next: Raj draws" with avatar when next drawer is known', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    nextDrawerId="p2"
                />
            );
            expect(html).toContain('Next:');
            expect(html).toContain('Raj');
            expect(html).toContain('draws');
        });

        it('renders "Final scores next..." when there is no next drawer (final round)', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    nextDrawerId={null}
                />
            );
            expect(html).toContain('Final scores next...');
        });

        it('shows host-only Skip button when isHost is true', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    isHost={true}
                    onSkip={vi.fn()}
                />
            );
            expect(html).toContain('data-testid="skip-round-end-button"');
            expect(html).toContain('Skip');
        });

        it('hides Skip button when isHost is false', () => {
            const html = renderToStaticMarkup(
                <RoundEndOverlay
                    word="GUITAR"
                    players={mockPlayers}
                    isHost={false}
                    onSkip={vi.fn()}
                />
            );
            expect(html).not.toContain('data-testid="skip-round-end-button"');
        });
    });
});
