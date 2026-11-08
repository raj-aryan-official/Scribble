import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HintTiles from '../HintTiles';
import TimerBar from '../TimerBar';
import PlayerList from '../PlayerList';

describe('In-Game Components - Visual Language & Behavior', () => {
    describe('HintTiles (reveal state)', () => {
        it('renders full word in marigold chip for drawer', () => {
            const html = renderToStaticMarkup(
                <HintTiles word="CHAMELEON" isDrawer={true} />
            );
            expect(html).toContain('data-testid="drawer-word-chip"');
            expect(html).toContain('CHAMELEON');
            expect(html).toContain('bg-marigold');
        });

        it('renders unrevealed tiles for guesser when hint is all underscores', () => {
            const html = renderToStaticMarkup(
                <HintTiles hint="_ _ _" isDrawer={false} />
            );
            expect(html).toContain('data-testid="hint-tiles-container"');
            // Count number of hint tiles
            const tileMatches = html.match(/data-testid="hint-tile"/g);
            expect(tileMatches).toHaveLength(3);
            expect(html).toContain('data-revealed="false"');
            expect(html).not.toContain('data-revealed="true"');
        });

        it('renders revealed letters correctly and flips state', () => {
            const html = renderToStaticMarkup(
                <HintTiles hint="C _ T" isDrawer={false} />
            );
            expect(html).toContain('data-revealed="true"');
            expect(html).toContain('data-letter="C"');
            expect(html).toContain('data-letter="T"');
            expect(html).toContain('data-revealed="false"');
        });

        it('renders gaps for multi-word hints', () => {
            const html = renderToStaticMarkup(
                <HintTiles hint="_ _ _   _ _" isDrawer={false} />
            );
            expect(html).toContain('data-testid="hint-gap"');
            const tileMatches = html.match(/data-testid="hint-tile"/g);
            expect(tileMatches).toHaveLength(5);
        });
    });

    describe('TimerBar (colour switch at 10 s)', () => {
        it('renders bg-ink and isWarning=false when timeLeft > 10', () => {
            const html = renderToStaticMarkup(
                <TimerBar timeLeft={25} totalTime={60} />
            );
            expect(html).toContain('data-is-warning="false"');
            expect(html).toContain('bg-ink');
            expect(html).not.toContain('data-is-warning="true"');
        });

        it('switches to bg-tomato and isWarning=true when timeLeft <= 10', () => {
            const html10 = renderToStaticMarkup(
                <TimerBar timeLeft={10} totalTime={60} />
            );
            expect(html10).toContain('data-is-warning="true"');
            expect(html10).toContain('bg-tomato');

            const html5 = renderToStaticMarkup(
                <TimerBar timeLeft={5} totalTime={60} />
            );
            expect(html5).toContain('data-is-warning="true"');
            expect(html5).toContain('bg-tomato');
        });
    });

    describe('PlayerList (ranking list orders by score)', () => {
        const players = [
            { id: 'p1', username: 'Alice', avatar: 'avatar-1' },
            { id: 'p2', username: 'Bob', avatar: 'avatar-2' },
            { id: 'p3', username: 'Charlie', avatar: 'avatar-3' },
        ];

        const scores = {
            p1: 120, // 3rd
            p2: 580, // 1st
            p3: 310, // 2nd
        };

        it('orders players strictly by descending score in desktop view', () => {
            const html = renderToStaticMarkup(
                <PlayerList
                    players={players}
                    scores={scores}
                    drawerId="p2"
                    variant="desktop"
                />
            );

            const bobIndex = html.indexOf('Bob');
            const charlieIndex = html.indexOf('Charlie');
            const aliceIndex = html.indexOf('Alice');

            expect(bobIndex).toBeGreaterThan(-1);
            expect(charlieIndex).toBeGreaterThan(-1);
            expect(aliceIndex).toBeGreaterThan(-1);

            // Bob (580) must appear before Charlie (310), who must appear before Alice (120)
            expect(bobIndex).toBeLessThan(charlieIndex);
            expect(charlieIndex).toBeLessThan(aliceIndex);
        });

        it('orders players strictly by descending score in mobile view', () => {
            const html = renderToStaticMarkup(
                <PlayerList
                    players={players}
                    scores={scores}
                    drawerId="p2"
                    variant="mobile"
                />
            );

            const bobIndex = html.indexOf('Bob');
            const charlieIndex = html.indexOf('Charlie');
            const aliceIndex = html.indexOf('Alice');

            expect(bobIndex).toBeLessThan(charlieIndex);
            expect(charlieIndex).toBeLessThan(aliceIndex);
        });
    });
});
