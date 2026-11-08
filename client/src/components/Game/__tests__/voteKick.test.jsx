import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoteCard } from '../VoteCard';
import { PlayerMenu, getVoteKickDisabledReason } from '../PlayerMenu';
import { PlayerList } from '../PlayerList';
import { GameContext } from '../../../context/GameContext';

describe('Vote Kick & Moderation Client Tests', () => {
    describe('1. getVoteKickDisabledReason Rule Validation', () => {
        const basePlayer = {
            id: 'player-2',
            playerId: 'pid-2',
            username: 'Bob',
            avatar: 'avatar-2',
            isHost: false,
            joinedAt: Date.now() - 75000,
        };

        it('disables vote when targeting yourself', () => {
            const reason = getVoteKickDisabledReason({
                player: basePlayer,
                currentUserId: 'player-2',
                currentUserPlayerId: 'pid-2',
                connectedCount: 4,
            });
            expect(reason).toBe('Cannot vote to kick yourself');
        });

        it('disables vote when targeting the host', () => {
            const hostPlayer = { ...basePlayer, isHost: true };
            const reason = getVoteKickDisabledReason({
                player: hostPlayer,
                currentUserId: 'player-1',
                connectedCount: 4,
            });
            expect(reason).toBe('Cannot vote to kick the host');
        });

        it('disables vote when fewer than 4 connected players', () => {
            const reason = getVoteKickDisabledReason({
                player: basePlayer,
                currentUserId: 'player-1',
                connectedCount: 3,
            });
            expect(reason).toBe('At least 4 connected players required');
        });

        it('disables vote when a vote is already in progress', () => {
            const reason = getVoteKickDisabledReason({
                player: basePlayer,
                currentUserId: 'player-1',
                connectedCount: 4,
                voteState: { voteId: 'v1' },
            });
            expect(reason).toBe('A vote is already in progress');
        });

        it('disables vote when target has been in room for less than 60s', () => {
            const newPlayer = { ...basePlayer, joinedAt: Date.now() - 25000 };
            const reason = getVoteKickDisabledReason({
                player: newPlayer,
                currentUserId: 'player-1',
                connectedCount: 4,
            });
            expect(reason).toBe('Player joined less than 60s ago');
        });

        it('disables vote when target has 10-minute vote immunity', () => {
            const immunePlayer = { ...basePlayer, voteImmunityUntil: Date.now() + 300000 };
            const reason = getVoteKickDisabledReason({
                player: immunePlayer,
                currentUserId: 'player-1',
                connectedCount: 4,
            });
            expect(reason).toBe('Target is immune from votes for 10 minutes');
        });

        it('disables vote when initiator is on 2-minute cooldown', () => {
            const reason = getVoteKickDisabledReason({
                player: basePlayer,
                currentUserId: 'player-1',
                currentUser: { lastVoteStartedAt: Date.now() - 40000 },
                connectedCount: 4,
            });
            expect(reason).toBe('You must wait 2 minutes before starting another vote');
        });

        it('disables vote when initiator has 3 failed votes (3 strikes)', () => {
            const reason = getVoteKickDisabledReason({
                player: basePlayer,
                currentUserId: 'player-1',
                currentUser: { failedVoteCount: 3 },
                connectedCount: 4,
            });
            expect(reason).toBe('You cannot start any more votes for the rest of the game');
        });

        it('allows vote when all 8 criteria are satisfied', () => {
            const reason = getVoteKickDisabledReason({
                player: basePlayer,
                currentUserId: 'player-1',
                connectedCount: 4,
                voteState: null,
            });
            expect(reason).toBeNull();
        });
    });

    describe('2. VoteCard Component (Eligible Voter View)', () => {
        const mockVoteState = {
            voteId: 'vote-123',
            targetId: 'player-target',
            targetName: 'Bob',
            targetAvatar: 'avatar-3',
            reason: 'afk',
            yes: 1,
            no: 0,
            total: 3,
            threshold: 2,
            endsAt: Date.now() + 18000,
        };

        it('renders target name, avatar, reason label, and draining ring timer', () => {
            const html = renderToStaticMarkup(
                <VoteCard
                    voteState={mockVoteState}
                    currentUserId="player-voter"
                    isHost={false}
                />
            );

            expect(html).toContain('Kick Bob?');
            expect(html).toContain('AFK / Inactive');
            expect(html).toContain('role="region"');
            expect(html).toContain('role="timer"');
            expect(html).toContain('alt="Avatar"');
        });

        it('renders live tally with needed threshold and Yes / No buttons', () => {
            const html = renderToStaticMarkup(
                <VoteCard
                    voteState={mockVoteState}
                    currentUserId="player-voter"
                    isHost={false}
                />
            );

            expect(html).toContain('Live tally: Yes: 1 · No: 0 (1/2 needed)');
            expect(html).toContain('data-testid="vote-yes-button"');
            expect(html).toContain('data-testid="vote-no-button"');
        });

        it('renders Host Cancel button when isHost is true, hides it for non-host', () => {
            const hostHtml = renderToStaticMarkup(
                <VoteCard
                    voteState={mockVoteState}
                    currentUserId="player-host"
                    isHost={true}
                />
            );
            expect(hostHtml).toContain('data-testid="cancel-vote-button"');
            expect(hostHtml).toContain('Cancel');

            const nonHostHtml = renderToStaticMarkup(
                <VoteCard
                    voteState={mockVoteState}
                    currentUserId="player-voter"
                    isHost={false}
                />
            );
            expect(nonHostHtml).not.toContain('data-testid="cancel-vote-button"');
        });

        it('announces politely to screen readers via aria-live="polite"', () => {
            const html = renderToStaticMarkup(
                <VoteCard
                    voteState={mockVoteState}
                    currentUserId="player-voter"
                    isHost={false}
                />
            );

            expect(html).toContain('aria-live="polite"');
            expect(html).toContain('A vote to remove Bob is open');
        });
    });

    describe('3. VoteCard Component (Target View)', () => {
        const mockVoteState = {
            voteId: 'vote-123',
            targetId: 'player-target',
            targetName: 'Bob',
            targetAvatar: 'avatar-3',
            reason: 'abuse',
            yes: 1,
            no: 0,
            total: 3,
            threshold: 2,
            endsAt: Date.now() + 15000,
        };

        it('shows "A vote to remove you is open" with NO voter details or voting buttons', () => {
            const html = renderToStaticMarkup(
                <VoteCard
                    voteState={mockVoteState}
                    currentUserId="player-target"
                    isHost={false}
                />
            );

            expect(html).toContain('data-testid="vote-card-target-view"');
            expect(html).toContain('A vote to remove you is open');
            expect(html).toContain('Abusive behavior');
            expect(html).not.toContain('data-testid="vote-yes-button"');
            expect(html).not.toContain('data-testid="vote-no-button"');
            expect(html).not.toContain('Live tally');
        });

        it('polite screen reader announcement specifies target is you', () => {
            const html = renderToStaticMarkup(
                <VoteCard
                    voteState={mockVoteState}
                    currentUserId="player-target"
                    isHost={false}
                />
            );

            expect(html).toContain('aria-live="polite"');
            expect(html).toContain('A vote to remove you is open. Reason: Abusive behavior.');
        });
    });

    describe('4. PlayerMenu Component', () => {
        const targetPlayer = {
            id: 'player-2',
            playerId: 'pid-2',
            username: 'Alex',
            avatar: 'avatar-4',
            isHost: false,
            joinedAt: Date.now() - 80000,
        };

        it('renders accessible dialog with player header', () => {
            const html = renderToStaticMarkup(
                <PlayerMenu
                    player={targetPlayer}
                    currentUserId="player-1"
                    connectedCount={4}
                />
            );

            expect(html).toContain('role="dialog"');
            expect(html).toContain('aria-label="Player actions for Alex"');
            expect(html).toContain('Alex');
            expect(html).toContain('alt="Avatar"');
        });

        it('renders host direct kick button only when currentUser is host', () => {
            const hostHtml = renderToStaticMarkup(
                <PlayerMenu
                    player={targetPlayer}
                    currentUserId="player-host"
                    isCurrentUserHost={true}
                    connectedCount={4}
                />
            );
            expect(hostHtml).toContain('data-testid="direct-kick-btn-player-2"');
            expect(hostHtml).toContain('Kick Player (Host)');

            const guestHtml = renderToStaticMarkup(
                <PlayerMenu
                    player={targetPlayer}
                    currentUserId="player-1"
                    isCurrentUserHost={false}
                    connectedCount={4}
                />
            );
            expect(guestHtml).not.toContain('data-testid="direct-kick-btn-player-2"');
        });

        it('renders disabled Vote to Kick button with visible text reason when not allowed', () => {
            // Less than 4 players
            const html = renderToStaticMarkup(
                <PlayerMenu
                    player={targetPlayer}
                    currentUserId="player-1"
                    connectedCount={2}
                />
            );

            expect(html).toContain('disabled=""');
            expect(html).toContain('data-testid="vote-kick-disabled-reason-player-2"');
            expect(html).toContain('At least 4 connected players required');
        });

        it('renders enabled Vote to Kick button when allowed', () => {
            const html = renderToStaticMarkup(
                <PlayerMenu
                    player={targetPlayer}
                    currentUserId="player-1"
                    connectedCount={4}
                />
            );

            expect(html).toContain('data-testid="vote-kick-action-player-2"');
            expect(html).not.toContain('data-testid="vote-kick-disabled-reason-player-2"');
        });
    });

    describe('5. PlayerList Integration', () => {
        const mockPlayers = [
            { id: 'p1', username: 'HostUser', avatar: 'avatar-1', isHost: true },
            { id: 'p2', username: 'Maya', avatar: 'avatar-2', isHost: false },
            { id: 'p3', username: 'Alex', avatar: 'avatar-3', isHost: false },
            { id: 'p4', username: 'Charlie', avatar: 'avatar-4', isHost: false },
        ];

        it('renders player menu trigger buttons in desktop view', () => {
            const html = renderToStaticMarkup(
                <PlayerList
                    players={mockPlayers}
                    scores={{ p1: 100, p2: 80, p3: 60, p4: 40 }}
                    drawerId="p1"
                    variant="desktop"
                />
            );

            expect(html).toContain('data-testid="player-menu-btn-p1"');
            expect(html).toContain('data-testid="player-menu-btn-p2"');
            expect(html).toContain('data-testid="player-menu-btn-p3"');
            expect(html).toContain('data-testid="player-menu-btn-p4"');
        });

        it('renders player menu trigger buttons in mobile view', () => {
            const html = renderToStaticMarkup(
                <PlayerList
                    players={mockPlayers}
                    scores={{ p1: 100, p2: 80, p3: 60, p4: 40 }}
                    drawerId="p1"
                    variant="mobile"
                />
            );

            expect(html).toContain('data-testid="player-menu-btn-p1"');
            expect(html).toContain('data-testid="player-menu-btn-p2"');
        });
    });
});
