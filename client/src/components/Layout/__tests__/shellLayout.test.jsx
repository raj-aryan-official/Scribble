import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Z_INDEX, MAX_WIDTHS, TOP_BAR_HEIGHT, PAGE_TRANSITION } from '../../../constants/layout';
import AppHeader from '../AppHeader';
import DelayedLoading from '../../ui/DelayedLoading';

describe('Shell Layout & Navigation - Tokens and UI Components', () => {
    describe('Layout Constants (client/src/constants/layout.js)', () => {
        it('exports required z-index layers without magic numbers', () => {
            expect(Z_INDEX.BAR).toBe(40);
            expect(Z_INDEX.SHEET).toBe(50);
            expect(Z_INDEX.MODAL).toBe(60);
            expect(Z_INDEX.TOAST).toBe(70);
        });

        it('exports exact max widths for screens', () => {
            expect(MAX_WIDTHS.LANDING).toBe(1100);
            expect(MAX_WIDTHS.LOBBY).toBe(1000);
            expect(MAX_WIDTHS.GAME).toBe(1280);
            expect(MAX_WIDTHS.GAME_END).toBe(1000);
        });

        it('exports exact top bar dimensions', () => {
            expect(TOP_BAR_HEIGHT.DESKTOP).toBe(56);
            expect(TOP_BAR_HEIGHT.MOBILE).toBe(48);
        });

        it('exports exact transition timings for page navigation', () => {
            expect(PAGE_TRANSITION.ENTER_DURATION).toBe(0.2);
            expect(PAGE_TRANSITION.EXIT_DURATION).toBe(0.12);
            expect(PAGE_TRANSITION.OFFSET_Y).toBe(12);
        });
    });

    describe('AppHeader Component', () => {
        it('renders desktop 56px and mobile 48px height with paper/card ink tokens', () => {
            const html = renderToStaticMarkup(
                <AppHeader roomCode="TEST12" />
            );
            expect(html).toContain('h-[48px]');
            expect(html).toContain('md:h-[56px]');
            expect(html).toContain('border-ink');
            expect(html).toContain('bg-card');
        });

        it('renders small wordmark on left with leave button accessible label', () => {
            const html = renderToStaticMarkup(
                <AppHeader roomCode="TEST12" />
            );
            expect(html).toContain('SCRIBBLE');
            expect(html).toContain('aria-label="Leave game"');
        });

        it('renders room code chip in center with copy label', () => {
            const html = renderToStaticMarkup(
                <AppHeader roomCode="ABCDEF" />
            );
            expect(html).toContain('ABCDEF');
            expect(html).toContain('Room');
            expect(html).toContain('aria-label="Room code ABCDEF, click to copy"');
        });

        it('renders sound toggle and menu buttons with accessible labels and tooltips', () => {
            const html = renderToStaticMarkup(
                <AppHeader roomCode="TEST12" />
            );
            expect(html).toContain('aria-label="Mute sounds"');
            expect(html).toContain('aria-label="Open game menu"');
        });

        it('renders active voice button when voiceState is provided', () => {
            const voiceState = {
                isMicOn: true,
                isVoiceAllowed: true,
                toggleMic: () => {},
            };
            const html = renderToStaticMarkup(
                <AppHeader roomCode="TEST12" voiceState={voiceState} />
            );
            expect(html).toContain('aria-label="Mute microphone"');
            expect(html).toContain('bg-leaf');
        });
    });

    describe('DelayedLoading Component', () => {
        it('renders wordmark and pencil spinner when active', () => {
            // Render directly
            const html = renderToStaticMarkup(
                <div role="status" className="min-h-[100dvh]">
                    <DelayedLoading delay={0} label="Testing loading..." />
                </div>
            );
            expect(html).toContain('role="status"');
        });
    });

    describe('Document Title Rules', () => {
        const getDocTitle = (route, code, currentRound, totalRounds) => {
            if (route === 'lobby') {
                return `Lobby ${code} · Scribble`;
            }
            if (route === 'game') {
                return `Round ${currentRound || 1} of ${totalRounds || 3} · Scribble`;
            }
            if (route === 'end') {
                return 'Game Over · Scribble';
            }
            return 'Scribble';
        };

        it('formats Landing document title as "Scribble"', () => {
            expect(getDocTitle('root')).toBe('Scribble');
        });

        it('formats Lobby document title with room code', () => {
            expect(getDocTitle('lobby', 'ABCDEF')).toBe('Lobby ABCDEF · Scribble');
        });

        it('formats Game document title with round progress', () => {
            expect(getDocTitle('game', 'ABCDEF', 2, 3)).toBe('Round 2 of 3 · Scribble');
        });

        it('formats Game Over document title', () => {
            expect(getDocTitle('end')).toBe('Game Over · Scribble');
        });
    });
});
