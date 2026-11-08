import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModePicker } from '../ModePicker';
import { PlayerTag } from '../PlayerTag';
import { PlayerList } from '../../Game/PlayerList';
import { GameBar } from '../../Game/GameBar';
import { GameEnd } from '../../../pages/GameEnd';
import { GameContext } from '../../../context/GameContext';
import { SettingsContext } from '../../../context/SettingsContext';
import { MemoryRouter } from 'react-router-dom';

const mockSettingsContext = {
    settings: {
        leftHandedLayout: false,
        colorBlindPalette: false,
        paperGrid: false
    },
    soundHintDismissed: true,
    dismissSoundHint: () => {},
    openSettings: () => {}
};

describe('ModePicker & Mode Display Component Tests', () => {
    const mockPlayers = [
        { id: 'p1', username: 'Alice', isHost: true, teamId: 'team-red', teamName: 'Team Red', teamColor: '#EF4444' },
        { id: 'p2', username: 'Bob', isHost: false, teamId: 'team-blue', teamName: 'Team Blue', teamColor: '#3B82F6' },
        { id: 'p3', username: 'Charlie', isHost: false, teamId: 'team-red', teamName: 'Team Red', teamColor: '#EF4444' },
        { id: 'p4', username: 'Diana', isHost: false, teamId: 'team-blue', teamName: 'Team Blue', teamColor: '#3B82F6' }
    ];

    it('renders all 6 mode cards for host in ModePicker', () => {
        const html = renderToStaticMarkup(
            <ModePicker
                isHost={true}
                currentMode="classic"
                settings={{ mode: 'classic' }}
            />
        );

        expect(html).toContain('data-testid="mode-card-classic"');
        expect(html).toContain('data-testid="mode-card-speed"');
        expect(html).toContain('data-testid="mode-card-team"');
        expect(html).toContain('data-testid="mode-card-relay"');
        expect(html).toContain('data-testid="mode-card-hard"');
        expect(html).toContain('data-testid="mode-card-custom"');
        expect(html).toContain('Classic');
        expect(html).toContain('Speed');
        expect(html).toContain('Team');
        expect(html).toContain('Relay');
        expect(html).toContain('Hard');
        expect(html).toContain('Custom');
    });

    it('renders team mode specific controls when mode is team', () => {
        const html = renderToStaticMarkup(
            <ModePicker
                isHost={true}
                currentMode="team"
                settings={{ mode: 'team', teamCount: 2 }}
                players={mockPlayers}
            />
        );

        expect(html).toContain('data-testid="team-mode-settings"');
        expect(html).toContain('data-testid="team-count-2"');
        expect(html).toContain('data-testid="team-count-3"');
        expect(html).toContain('data-testid="team-count-4"');
        expect(html).toContain('data-testid="randomize-teams-btn"');
        expect(html).toContain('Alice, Charlie');
        expect(html).toContain('Bob, Diana');
    });

    it('renders custom mode specific controls when mode is custom', () => {
        const html = renderToStaticMarkup(
            <ModePicker
                isHost={true}
                currentMode="custom"
                settings={{ mode: 'custom', drawTime: 45, hints: 1, scoreMultiplier: 1.5 }}
            />
        );

        expect(html).toContain('data-testid="custom-mode-settings"');
        expect(html).toContain('Time: 45s');
        expect(html).toContain('Hint Count: 1');
        expect(html).toContain('Score Multiplier: 1.5x');
        expect(html).toContain('data-testid="custom-time-30"');
        expect(html).toContain('data-testid="custom-hints-2"');
        expect(html).toContain('data-testid="custom-mult-2"');
    });

    it('renders read-only mode card for non-hosts', () => {
        const html = renderToStaticMarkup(
            <ModePicker
                isHost={false}
                currentMode="team"
                settings={{ mode: 'team', teamCount: 2 }}
                players={mockPlayers}
            />
        );

        expect(html).toContain('data-testid="readonly-mode"');
        expect(html).not.toContain('data-testid="mode-card-classic"');
        expect(html).toContain('data-testid="readonly-team-list"');
        expect(html).toContain('Team Red (2)');
        expect(html).toContain('Team Blue (2)');
    });

    it('renders player team badge in PlayerTag when assigned to a team', () => {
        const html = renderToStaticMarkup(
            <PlayerTag
                player={mockPlayers[0]}
                isCurrentUser={false}
            />
        );

        expect(html).toContain('data-testid="player-team-p1"');
        expect(html).toContain('Team Red');
    });

    it('renders team scoreboard and player team badge in PlayerList', () => {
        const mockGameContext = {
            state: {
                settings: { mode: 'team' },
                teamScores: {
                    'team-red': 450,
                    'team-blue': 320
                },
                currentUser: { id: 'p1', username: 'Alice' }
            }
        };

        const html = renderToStaticMarkup(
            <GameContext.Provider value={mockGameContext}>
                <PlayerList
                    players={mockPlayers}
                    scores={{ p1: 250, p2: 120, p3: 200, p4: 200 }}
                    drawerId="p1"
                />
            </GameContext.Provider>
        );

        expect(html).toContain('data-testid="team-scoreboard"');
        expect(html).toContain('data-testid="team-score-team-red"');
        expect(html).toContain('450');
        expect(html).toContain('data-testid="team-score-team-blue"');
        expect(html).toContain('320');
        expect(html).toContain('data-testid="player-team-badge-p1"');
    });

    it('renders drawer team badge in GameBar during team mode', () => {
        const mockGameContext = {
            state: {
                roomCode: 'ABCD12',
                gameState: 'DRAWING',
                settings: { mode: 'team' },
                drawerId: 'p1',
                players: mockPlayers,
                currentUser: { id: 'p2', username: 'Bob' }
            }
        };

        const html = renderToStaticMarkup(
            <SettingsContext.Provider value={mockSettingsContext}>
                <GameContext.Provider value={mockGameContext}>
                    <GameBar
                        roomCode="ABCD12"
                        isDrawer={false}
                        drawerName="Alice"
                        wordHint="_ _ _ _ _"
                    />
                </GameContext.Provider>
            </SettingsContext.Provider>
        );

        expect(html).toContain('data-testid="gamebar-team-badge"');
        expect(html).toContain('Team Red');
        expect(html).toContain('Alice is drawing for Team Red');
    });

    it('renders winning team banner on GameEnd in team mode', () => {
        const mockGameContext = {
            state: {
                settings: { mode: 'team' },
                teamScores: {
                    'team-red': 550,
                    'team-blue': 400
                },
                players: mockPlayers,
                scores: { p1: 300, p3: 250, p2: 200, p4: 200 },
                currentUser: { id: 'p1', username: 'Alice' }
            }
        };

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <GameContext.Provider value={mockGameContext}>
                    <GameEnd />
                </GameContext.Provider>
            </MemoryRouter>
        );

        expect(html).toContain('data-testid="winning-team-banner"');
        expect(html).toContain('Team Red Wins!');
        expect(html).toContain('550 pts');
        expect(html).toContain('data-testid="player-team-pill-p1"');
    });
});
