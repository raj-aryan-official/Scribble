import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsCard } from '../../Lobby/SettingsCard';
import { TurnIntro } from '../TurnIntro';
import { GameBar } from '../GameBar';
import { ToolTray } from '../../Canvas/ToolTray';
import { gameReducer } from '../../../context/GameContext';
import { TWIST_IDS, TWIST_DEFINITIONS } from '../../../../../shared/types';
import { SettingsContext } from '../../../context/SettingsContext';
import { GameContext } from '../../../context/GameContext';

const mockSettingsContext = {
    settings: {
        leftHandedLayout: false,
        colorBlindPalette: false,
        paperGrid: false
    }
};

describe('Rule Twists Client Tests', () => {
    describe('1. SettingsCard Twists Controls', () => {
        it('host sees Rule Twists segmented control with Off, Sometimes, Every turn', () => {
            const html = renderToStaticMarkup(
                <SettingsCard
                    isHost={true}
                    settings={{ twists: 'off', enabledTwists: TWIST_IDS }}
                />
            );
            expect(html).toContain('Rule Twists');
            expect(html).toContain('twist-option-off');
            expect(html).toContain('twist-option-sometimes');
            expect(html).toContain('twist-option-every');
        });

        it('shows enabled twists checklist when twists setting is active', () => {
            const html = renderToStaticMarkup(
                <SettingsCard
                    isHost={true}
                    settings={{ twists: 'every', enabledTwists: ['speed', 'mirror'] }}
                />
            );
            expect(html).toContain('enabled-twists-checklist');
            expect(html).toContain('Speed');
            expect(html).toContain('Mirror');
            expect(html).toContain('twist-chip-speed');
            expect(html).toContain('twist-chip-mirror');
        });

        it('non-host sees read-only summary for Rule Twists', () => {
            const html = renderToStaticMarkup(
                <SettingsCard
                    isHost={false}
                    hostName="Maya"
                    settings={{ twists: 'every', enabledTwists: TWIST_IDS }}
                />
            );
            expect(html).toContain('data-testid="readonly-twists"');
            expect(html).toContain('Every turn');
        });
    });

    describe('2. TurnIntro Twist Card Flip', () => {
        it('renders 3D flipping twist card with name and rule line when twist is active', () => {
            const twist = {
                id: 'limited-ink',
                name: 'Limited ink',
                rule: 'Ink drains as you draw. Undo refunds ink; eraser is free.',
                badge: 'Limited ink',
                icon: 'droplet'
            };

            const html = renderToStaticMarkup(
                <TurnIntro
                    round={1}
                    totalRounds={3}
                    drawer={{ username: 'Maya', avatar: 'avatar-1' }}
                    twist={twist}
                />
            );
            expect(html).toContain('data-testid="turn-intro-card"');
            expect(html).toContain('data-testid="twist-card"');
            expect(html).toContain('data-testid="twist-name"');
            expect(html).toContain('Limited ink');
            expect(html).toContain('data-testid="twist-rule"');
            expect(html).toContain('Ink drains as you draw');
        });

        it('displays one-colour swatch on the twist card', () => {
            const twist = {
                id: 'one-colour',
                name: 'One colour',
                rule: 'The colour is locked to a single shade this turn.',
                badge: 'One colour',
                color: '#E4472B'
            };

            const html = renderToStaticMarkup(
                <TurnIntro
                    round={2}
                    totalRounds={3}
                    drawer={{ username: 'Alex', avatar: 'avatar-2' }}
                    twist={twist}
                />
            );
            expect(html).toContain('One colour');
            expect(html).toContain('#E4472B');
        });
    });

    describe('3. GameBar Twist Badge', () => {
        it('displays twist badge beside status line during turn', () => {
            const twist = {
                id: 'speed',
                name: 'Speed',
                rule: 'Half the draw time, double points for everyone!',
                badge: 'Speed 2x',
                icon: 'zap'
            };

            const html = renderToStaticMarkup(
                <GameContext.Provider value={{ state: { currentTwist: twist } }}>
                    <SettingsContext.Provider value={mockSettingsContext}>
                        <GameBar
                            roomCode="ABCDEF"
                            isDrawer={false}
                            drawerName="Maya"
                            twist={twist}
                        />
                    </SettingsContext.Provider>
                </GameContext.Provider>
            );
            expect(html).toContain('data-testid="twist-badge"');
            expect(html).toContain('Speed 2x');
        });
    });

    describe('4. ToolTray Rule Enforcement for Drawer', () => {
        it('no-undo-eraser: disables eraser, undo, and clear buttons', () => {
            const twist = {
                id: 'no-undo-eraser',
                name: 'No undo or eraser'
            };

            const html = renderToStaticMarkup(
                <SettingsContext.Provider value={mockSettingsContext}>
                    <ToolTray
                        tool="pencil"
                        twist={twist}
                    />
                </SettingsContext.Provider>
            );
            expect(html).toContain('title="Eraser disabled in this twist"');
            expect(html).toContain('title="Undo disabled in this twist"');
            expect(html).toContain('title="Clear disabled in this twist"');
        });

        it('thin-line: locks brush size controls to size 2', () => {
            const twist = {
                id: 'thin-line',
                name: 'Thin line only'
            };

            const html = renderToStaticMarkup(
                <SettingsContext.Provider value={mockSettingsContext}>
                    <ToolTray
                        lineWidth={2}
                        twist={twist}
                    />
                </SettingsContext.Provider>
            );
            expect(html).toContain('title="Brush size locked"');
        });

        it('one-colour: locks other color swatches', () => {
            const twist = {
                id: 'one-colour',
                name: 'One colour',
                color: '#E4472B'
            };

            const html = renderToStaticMarkup(
                <SettingsContext.Provider value={mockSettingsContext}>
                    <ToolTray
                        color="#E4472B"
                        twist={twist}
                    />
                </SettingsContext.Provider>
            );
            expect(html).toContain('title="Ink Black (Locked)"');
            expect(html).toContain('Tomato Red');
        });
    });

    describe('5. Game Reducer Twist State', () => {
        it('updates currentTwist and turnInkRemaining on GAME_STARTED', () => {
            const twist = { id: 'speed', totalInk: 1200 };
            const state = gameReducer({}, {
                type: 'GAME_STARTED',
                payload: { gameState: 'WORD_SELECTION', twist }
            });
            expect(state.currentTwist).toEqual(twist);
            expect(state.turnInkRemaining).toEqual(1200);
        });

        it('updates currentTwist on WORD_CHOSEN', () => {
            const twist = { id: 'mirror' };
            const state = gameReducer({}, {
                type: 'WORD_CHOSEN',
                payload: { hint: '_ _ _', length: 3, twist }
            });
            expect(state.currentTwist).toEqual(twist);
        });

        it('updates currentTwist and turnInkRemaining on STATE_SNAPSHOT', () => {
            const twist = { id: 'limited-ink', remainingInk: 750 };
            const state = gameReducer({}, {
                type: 'STATE_SNAPSHOT',
                payload: { twist, turnInkRemaining: 750 }
            });
            expect(state.currentTwist).toEqual(twist);
            expect(state.turnInkRemaining).toEqual(750);
        });
    });
});
