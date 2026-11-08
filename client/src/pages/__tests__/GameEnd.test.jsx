import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GameEnd from '../GameEnd';
import { GameContext } from '../../context/GameContext';

describe('GameEnd - Celebration, Drawings, and Rematch Flow', () => {
    const mockPlayers = [
        { id: 'u1', username: 'Maya', avatar: 'avatar-1', isHost: true },
        { id: 'u2', username: 'Raj', avatar: 'avatar-2', isHost: false },
        { id: 'u3', username: 'Alex', avatar: 'avatar-3', isHost: false },
        { id: 'u4', username: 'Sam', avatar: 'avatar-4', isHost: false },
    ];

    const mockScores = {
        u1: 1200,
        u2: 950,
        u3: 840,
        u4: 400,
    };

    const mockDrawings = [
        {
            word: 'guitar',
            drawerName: 'Maya',
            drawerAvatar: 'avatar-1',
            round: 1,
            strokes: [{ points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] }],
        },
        {
            word: 'tree',
            drawerName: 'Raj',
            drawerAvatar: 'avatar-2',
            round: 2,
            strokes: [{ points: [{ x: 0.5, y: 0.6 }] }],
        },
    ];

    const mockAwards = {
        bestArtist: {
            id: 'u1',
            username: 'Maya',
            avatar: 'avatar-1',
            avgTime: 12.4,
        },
        fastestGuesser: {
            id: 'u2',
            username: 'Raj',
            avatar: 'avatar-2',
            avgTime: 5.8,
        },
    };

    const renderGameEnd = (contextOverrides = {}) => {
        const state = {
            players: mockPlayers,
            scores: mockScores,
            currentUser: mockPlayers[2], // Alex, 3rd place with 840 pts
            matchDrawings: mockDrawings,
            awards: mockAwards,
            roomCode: 'ABCD',
            ...contextOverrides,
        };

        return renderToStaticMarkup(
            <MemoryRouter initialEntries={['/end/ABCD']}>
                <GameContext.Provider value={{ state, dispatch: () => {} }}>
                    <Routes>
                        <Route path="/end/:code" element={<GameEnd />} />
                    </Routes>
                </GameContext.Provider>
            </MemoryRouter>
        );
    };

    describe('1. Personal Result Line & Standings Cobalt Highlight', () => {
        it('renders personal line at the top: "You finished 3rd with 840 points"', () => {
            const html = renderGameEnd({ currentUser: mockPlayers[2] }); // Alex (840)
            expect(html).toContain('data-testid="personal-result-line"');
            expect(html).toContain('You finished');
            expect(html).toContain('3rd');
            expect(html).toContain('840');
            expect(html).toContain('points');
        });

        it('highlights current user row in cobalt with YOU tag in standings list', () => {
            const html = renderGameEnd({ currentUser: mockPlayers[2] }); // Alex
            expect(html).toContain('data-testid="user-standing-row"');
            expect(html).toContain('border-cobalt');
            expect(html).toContain('bg-cobalt/10');
            expect(html).toContain('YOU');
        });
    });

    describe('2. Podium: 3 Blocks, Hand-Drawn Crown, Ties, and 2 Players', () => {
        it('renders top three podium blocks with spot palette colors (marigold, ink, tomato)', () => {
            const html = renderGameEnd();
            expect(html).toContain('data-testid="podium-container"');
            expect(html).toContain('bg-marigold'); // 1st
            expect(html).toContain('bg-ink'); // 2nd
            expect(html).toContain('bg-tomato'); // 3rd
            expect(html).not.toContain('bg-gradient');
        });

        it('renders hand-drawn SVG crown for the 1st place winner', () => {
            const html = renderGameEnd();
            expect(html).toContain('Winner');
            expect(html).toContain('M 6 26 L 4 10 L 14 18');
        });

        it('renders correctly with only 2 players (no ghost 3rd place block)', () => {
            const html = renderGameEnd({
                players: [mockPlayers[0], mockPlayers[1]],
                scores: { u1: 500, u2: 300 },
                currentUser: mockPlayers[1],
            });
            // Should contain 1st and 2nd
            expect(html).toContain('1st');
            expect(html).toContain('2nd');
            // Should NOT have a 3rd block on the podium
            const podiumMatch = html.match(/data-testid="podium-container"[\s\S]*?<\/div>\s*<\/div>/);
            expect(podiumMatch?.[0]).not.toContain('3rd');
        });

        it('handles ties sharing rank and medal', () => {
            const html = renderGameEnd({
                players: [mockPlayers[0], mockPlayers[1]],
                scores: { u1: 800, u2: 800 },
                currentUser: mockPlayers[0],
            });
            // Both are 1st place winners
            const winnerMatches = html.match(/Winner/g);
            expect(winnerMatches.length).toBeGreaterThanOrEqual(2);
        });

        it('provides screen reader accessible ordered list with places and scores', () => {
            const html = renderGameEnd();
            expect(html).toContain('class="sr-only"');
            expect(html).toContain('1st place (Winner): Maya with 1200 points');
            expect(html).toContain('2nd place: Raj with 950 points');
            expect(html).toContain('3rd place: Alex with 840 points');
        });
    });

    describe('3. Two Awards Cards (Best artist & Fastest guesser)', () => {
        it('renders Best artist and Fastest guesser cards with server stats', () => {
            const html = renderGameEnd();
            expect(html).toContain('data-testid="awards-container"');
            expect(html).toContain('Best artist');
            expect(html).toContain('Maya');
            expect(html).toContain('12.4s avg guess');
            expect(html).toContain('Fastest guesser');
            expect(html).toContain('Raj');
            expect(html).toContain('5.8s avg guess');
        });
    });

    describe('4. Drawing of the Match & Contact Sheet', () => {
        it('renders swipeable strip of drawings with captions and accessible alt text', () => {
            const html = renderGameEnd();
            expect(html).toContain('data-testid="drawings-strip"');
            expect(html).toContain('guitar');
            expect(html).toContain('tree');
            expect(html).toContain('aria-label="View Maya&#x27;s drawing of guitar full size"');
        });

        it('renders "Download all" button for contact sheet', () => {
            const html = renderGameEnd();
            expect(html).toContain('data-testid="download-all-drawings-btn"');
            expect(html).toContain('Download all');
        });
    });

    describe('5. Actions: Play Again vs Waiting for Host, and Leave', () => {
        it('shows Play again button when currentUser is host', () => {
            const html = renderGameEnd({ currentUser: mockPlayers[0] }); // Maya (host)
            expect(html).toContain('data-testid="play-again-btn"');
            expect(html).toContain('Play again');
            expect(html).not.toContain('data-testid="waiting-for-host"');
        });

        it('shows "Waiting for Maya to start another round" when currentUser is not host', () => {
            const html = renderGameEnd({ currentUser: mockPlayers[1] }); // Raj (guest)
            expect(html).toContain('data-testid="waiting-for-host"');
            expect(html).toContain('Waiting for Maya to start another round');
            expect(html).not.toContain('data-testid="play-again-btn"');
        });

        it('shows Leave button for everyone', () => {
            const html = renderGameEnd();
            expect(html).toContain('data-testid="leave-game-btn"');
            expect(html).toContain('Leave');
        });
    });
});
