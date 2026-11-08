import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmptyPlayerSlots from '../../components/Lobby/EmptyPlayerSlots';
import PlayerTag from '../../components/Lobby/PlayerTag';
import RoomCard from '../../components/Lobby/RoomCard';
import SettingsCard from '../../components/Lobby/SettingsCard';
import StartGameBar from '../../components/Lobby/StartGameBar';

describe('Lobby Screen Components', () => {
    describe('EmptyPlayerSlots (Alone in Room state)', () => {
        it('renders 3 dashed empty slots and waiting message', () => {
            const html = renderToStaticMarkup(<EmptyPlayerSlots />);
            expect(html).toContain('Waiting for friends. Share the link to get started.');
            expect(html).toContain('Empty seat');
            // Check for 3 slots
            const slotMatches = html.match(/Empty seat/g);
            expect(slotMatches).toHaveLength(3);
        });

        it('renders pencil doodle SVG', () => {
            const html = renderToStaticMarkup(<EmptyPlayerSlots />);
            expect(html).toContain('<svg');
            expect(html).toContain('stroke-dasharray="4 4"');
        });
    });

    describe('PlayerTag', () => {
        const mockPlayer = {
            id: 'player-1',
            username: 'Maya',
            avatar: 'avatar-1',
            isHost: true,
            isDisconnected: false,
        };

        it('renders player username and avatar', () => {
            const html = renderToStaticMarkup(
                <PlayerTag player={mockPlayer} isCurrentUser={false} />
            );
            expect(html).toContain('Maya');
            expect(html).toContain('data-avatar="avatar-1"');
            expect(html).toContain('alt="Avatar"');
        });

        it('renders host crown icon for host player', () => {
            const html = renderToStaticMarkup(
                <PlayerTag player={mockPlayer} isCurrentUser={false} />
            );
            expect(html).toContain('Room Host');
        });

        it('renders cobalt "You" marker for current user', () => {
            const html = renderToStaticMarkup(
                <PlayerTag player={mockPlayer} isCurrentUser={true} />
            );
            expect(html).toContain('You');
            expect(html).toContain('bg-cobalt');
            expect(html).toContain('Change your avatar');
        });

        it('renders Away badge for disconnected player', () => {
            const disconnectedPlayer = { ...mockPlayer, isDisconnected: true };
            const html = renderToStaticMarkup(
                <PlayerTag player={disconnectedPlayer} isCurrentUser={false} />
            );
            expect(html).toContain('Away');
            expect(html).toContain('opacity-50');
        });

        it('renders accessible Kick button for host on other players', () => {
            const otherPlayer = {
                id: 'player-2',
                username: 'Raj',
                avatar: 'avatar-2',
                isHost: false,
            };
            const html = renderToStaticMarkup(
                <PlayerTag
                    player={otherPlayer}
                    isCurrentUser={false}
                    canKick={true}
                    onKick={vi.fn()}
                />
            );
            expect(html).toContain('aria-label="Kick Raj from room"');
            expect(html).toContain('title="Kick Raj"');
        });

        it('does not render kick button when canKick is false', () => {
            const html = renderToStaticMarkup(
                <PlayerTag player={mockPlayer} isCurrentUser={false} canKick={false} />
            );
            expect(html).not.toContain('aria-label="Kick Maya from room"');
        });
    });

    describe('RoomCard', () => {
        it('renders room code tag and three action buttons', () => {
            const html = renderToStaticMarkup(
                <RoomCard
                    code="XYZ123"
                    copiedCode={false}
                    copiedLink={false}
                    showQR={false}
                />
            );
            expect(html).toContain('XYZ123');
            expect(html).toContain('Copy Code');
            expect(html).toContain('Copy Link');
            expect(html).toContain('Share');
            expect(html).toContain('Show QR');
        });

        it('displays "Copied" when copiedCode is true', () => {
            const html = renderToStaticMarkup(
                <RoomCard
                    code="XYZ123"
                    copiedCode={true}
                    copiedLink={false}
                    showQR={false}
                />
            );
            expect(html).toContain('Copied');
        });

        it('displays "Hide QR" when showQR is true', () => {
            const html = renderToStaticMarkup(
                <RoomCard
                    code="XYZ123"
                    copiedCode={false}
                    copiedLink={false}
                    showQR={true}
                />
            );
            expect(html).toContain('Hide QR');
        });
    });

    describe('SettingsCard', () => {
        const settings = {
            rounds: 5,
            drawTime: 80,
            difficulty: 'Hard',
            packs: ['animals', 'food'],
            customWords: ['dragon', 'spaceship'],
        };

        it('renders interactive controls for host', () => {
            const html = renderToStaticMarkup(
                <SettingsCard
                    isHost={true}
                    hostName="Maya"
                    settings={settings}
                    validCustomWordCount={2}
                    onCustomWordsChange={vi.fn()}
                />
            );
            expect(html).toContain('Game Rules');
            expect(html).toContain('Rounds');
            expect(html).toContain('Draw Time');
            expect(html).toContain('Difficulty');
            expect(html).toContain('Themed Word Packs');
            expect(html).toContain('Custom Words');
            expect(html).not.toContain('Only Maya can change these.');
        });

        it('renders read-only card with lock icon and host name for non-host', () => {
            const html = renderToStaticMarkup(
                <SettingsCard
                    isHost={false}
                    hostName="Maya"
                    settings={settings}
                />
            );
            expect(html).toContain('Only Maya can change these.');
            expect(html).toContain('Rounds');
            expect(html).toContain('5');
            expect(html).toContain('80s');
            expect(html).toContain('Hard');
            expect(html).toContain('Animals, Food');
            expect(html).toContain('2 words added');
            // Ensure no interactive form inputs for non-host
            expect(html).not.toContain('<textarea');
        });
    });

    describe('StartGameBar', () => {
        it('renders Start Game button and ready message for host with 2+ players', () => {
            const html = renderToStaticMarkup(
                <StartGameBar
                    isHost={true}
                    hostName="Maya"
                    canStart={true}
                    countdown={null}
                />
            );
            expect(html).toContain('Start Game');
            expect(html).toContain('Ready to start');
            expect(html).not.toContain('disabled=""');
        });

        it('renders disabled Start Game button with explanation when < 2 players', () => {
            const html = renderToStaticMarkup(
                <StartGameBar
                    isHost={true}
                    hostName="Maya"
                    canStart={false}
                    countdown={null}
                />
            );
            expect(html).toContain('Start Game');
            expect(html).toContain('disabled=""');
            expect(html).toContain('Need at least 2 players to start');
        });

        it('renders countdown state and cancel affordance during countdown', () => {
            const html = renderToStaticMarkup(
                <StartGameBar
                    isHost={true}
                    hostName="Maya"
                    canStart={true}
                    countdown={3}
                />
            );
            expect(html).toContain('Tap to Cancel');
            expect(html).toContain('3');
            expect(html).toContain('Starting game in 3...');
        });

        it('renders waiting state for non-host with actual host name', () => {
            const html = renderToStaticMarkup(
                <StartGameBar
                    isHost={false}
                    hostName="Maya"
                    canStart={true}
                />
            );
            expect(html).toContain('Waiting for Maya to start');
            expect(html).not.toContain('Start Game');
        });
    });
});
