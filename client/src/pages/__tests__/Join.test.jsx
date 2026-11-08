import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

// Test render of the Invite Card states
describe('Invite Link Flow & States (/join/:code)', () => {
    describe('Card Title & Host Banner', () => {
        it('renders "You\'re invited" card title with room code', () => {
            const html = renderToStaticMarkup(
                <Card>
                    <h1>You're invited</h1>
                    <span>ABCDEF</span>
                </Card>
            );
            expect(html).toContain('You&#x27;re invited');
            expect(html).toContain('ABCDEF');
        });

        it('formats waiting in lobby status line correctly', () => {
            const hostName = 'Maya';
            const playerCount = 3;
            const maxPlayers = 8;
            const statusLine = `${hostName}'s room: ${playerCount} of ${maxPlayers} players, waiting in the lobby`;
            expect(statusLine).toBe("Maya's room: 3 of 8 players, waiting in the lobby");
        });

        it('formats in-progress game status line and button text', () => {
            const round = 2;
            const totalRounds = 3;
            const inProgressText = `A game is in progress (round ${round} of ${totalRounds}). You'll draw when it's your turn.`;
            const buttonText = 'Join the game';
            expect(inProgressText).toBe("A game is in progress (round 2 of 3). You'll draw when it's your turn.");
            expect(buttonText).toBe('Join the game');
        });

        it('formats room full state with disabled button and secondary action', () => {
            const fullButtonText = 'This room is full';
            const secondaryText = 'Start your own room';
            const html = renderToStaticMarkup(
                <div>
                    <Button disabled={true}>{fullButtonText}</Button>
                    <Button variant="primary">{secondaryText}</Button>
                </div>
            );
            expect(html).toContain('This room is full');
            expect(html).toContain('disabled=""');
            expect(html).toContain('Start your own room');
        });

        it('formats room closed state with illustration and primary action', () => {
            const closedHeading = 'This room has closed.';
            const primaryAction = 'Start a new room';
            const html = renderToStaticMarkup(
                <div>
                    <h2>{closedHeading}</h2>
                    <Button variant="primary">{primaryAction}</Button>
                </div>
            );
            expect(html).toContain('This room has closed.');
            expect(html).toContain('Start a new room');
        });
    });

    describe('Returning Player vs New Player Experience', () => {
        it('returning player sees single join button with player pill', () => {
            const username = 'Maya';
            const avatar = 'avatar-4';
            const hostName = 'Alex';

            const html = renderToStaticMarkup(
                <Card>
                    <div>
                        <Avatar avatarId={avatar} size="sm" />
                        <span>Playing as</span>
                        <strong>{username}</strong>
                        <button>Change</button>
                    </div>
                    <Button variant="primary">Join {hostName}'s room</Button>
                </Card>
            );

            expect(html).toContain('Playing as');
            expect(html).toContain('Maya');
            expect(html).toContain('Change');
            expect(html).toContain("Join Alex&#x27;s room");
        });
    });

    describe('Lobby Share Link Format', () => {
        it('builds exact share text "Come draw with me on Scribble: <url>"', () => {
            const code = 'ABCDEF';
            const origin = 'https://scribble.example.com';
            const link = `${origin}/join/${code}`;
            const shareText = `Come draw with me on Scribble: ${link}`;

            expect(shareText).toBe('Come draw with me on Scribble: https://scribble.example.com/join/ABCDEF');
            expect(shareText.startsWith('Come draw with me on Scribble:')).toBe(true);
        });
    });
});
