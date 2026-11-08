import React, { useState } from 'react';
import { UserX, Ban, AlertTriangle, ShieldAlert } from 'lucide-react';
import Avatar from '../ui/Avatar';

const REASON_OPTIONS = [
    { id: 'afk', label: 'AFK / Inactive' },
    { id: 'spam', label: 'Spamming chat' },
    { id: 'abuse', label: 'Abusive behavior' },
    { id: 'other', label: 'Disruptive behavior' },
];

export const getVoteKickDisabledReason = ({
    player,
    currentUserId,
    currentUserPlayerId,
    currentUser,
    connectedCount = 4,
    voteState = null,
}) => {
    const isSelf =
        player.id === currentUserId ||
        (currentUserPlayerId && player.playerId === currentUserPlayerId);
    if (isSelf) {
        return 'Cannot vote to kick yourself';
    }

    if (player.isHost) {
        return 'Cannot vote to kick the host';
    }

    if (connectedCount < 4) {
        return 'At least 4 connected players required';
    }

    if (voteState) {
        return 'A vote is already in progress';
    }

    // Check 60s protection if joinedAt is available
    if (player.joinedAt && Date.now() - player.joinedAt < 60000) {
        return 'Player joined less than 60s ago';
    }

    // Check target immunity (10 minutes)
    if (player.voteImmunityUntil && Date.now() < player.voteImmunityUntil) {
        return 'Target is immune from votes for 10 minutes';
    }

    // Check initiator cooldown (2 minutes)
    if (currentUser?.lastVoteStartedAt && Date.now() - currentUser.lastVoteStartedAt < 120000) {
        return 'You must wait 2 minutes before starting another vote';
    }

    // Check 3 strikes rule
    if ((currentUser?.failedVoteCount || 0) >= 3) {
        return 'You cannot start any more votes for the rest of the game';
    }

    return null;
};

export const PlayerMenu = ({
    player,
    currentUserId,
    currentUserPlayerId,
    currentUser,
    isCurrentUserHost = false,
    connectedCount = 4,
    voteState = null,
    onStartVoteKick,
    onDirectKick,
    onClose,
}) => {
    const [selectedReason, setSelectedReason] = useState('afk');
    const [showReasons, setShowReasons] = useState(false);

    const disabledReason = getVoteKickDisabledReason({
        player,
        currentUserId,
        currentUserPlayerId,
        currentUser,
        connectedCount,
        voteState,
    });

    const isVoteAllowed = !disabledReason;

    const handleConfirmVoteKick = () => {
        onStartVoteKick?.(player.id || player.playerId, selectedReason);
        onClose?.();
    };

    const handleConfirmDirectKick = () => {
        onDirectKick?.(player.id || player.playerId);
        onClose?.();
    };

    return (
        <div
            role="dialog"
            aria-label={`Player actions for ${player.username}`}
            data-testid={`player-menu-dialog-${player.id}`}
            className="w-64 bg-card border-2 border-ink shadow-hard rounded-[10px] p-3 flex flex-col gap-2.5 text-ink select-none z-50 text-left"
        >
            {/* Header: Player Avatar and Name */}
            <div className="flex items-center gap-2 border-b border-ink/15 pb-2">
                <Avatar avatarId={player.avatar || 'avatar-1'} size="xs" />
                <div className="flex flex-col min-w-0">
                    <span className="font-heading font-black text-xs sm:text-sm truncate">
                        {player.username}
                    </span>
                    <span className="text-[10px] font-bold text-ink-soft">
                        {player.isHost ? 'Room Host' : 'Player'}
                    </span>
                </div>
            </div>

            {/* Direct Host Kick (Host only) */}
            {isCurrentUserHost && !player.isHost && (
                <button
                    type="button"
                    data-testid={`direct-kick-btn-${player.id}`}
                    onClick={handleConfirmDirectKick}
                    className="w-full flex items-center gap-2 p-2 rounded-[6px] text-xs font-black text-tomato hover:bg-tomato/10 border border-tomato/30 transition-colors cursor-pointer"
                >
                    <UserX className="w-4 h-4 shrink-0 text-tomato" />
                    <span>Kick Player (Host)</span>
                </button>
            )}

            {/* Vote to Kick Action */}
            <div className="flex flex-col gap-1.5">
                <button
                    type="button"
                    data-testid={`vote-kick-action-${player.id}`}
                    disabled={!isVoteAllowed}
                    onClick={() => {
                        if (isVoteAllowed) setShowReasons((prev) => !prev);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-[6px] text-xs font-bold border-2 border-ink shadow-hard-xs transition-all ${
                        isVoteAllowed
                            ? 'bg-paper text-ink hover:bg-tomato/10 hover:text-tomato cursor-pointer active:translate-y-0.5'
                            : 'opacity-50 bg-paper/60 text-ink-soft cursor-not-allowed border-ink/40'
                    }`}
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span className="font-black">Vote to kick</span>
                    </div>
                </button>

                {/* Disabled reason as text when not allowed */}
                {disabledReason && (
                    <span
                        data-testid={`vote-kick-disabled-reason-${player.id}`}
                        className="text-[11px] font-bold text-tomato px-1 leading-tight flex items-center gap-1"
                    >
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {disabledReason}
                    </span>
                )}

                {/* Reason Selection Dropdown / Radio when allowed */}
                {isVoteAllowed && showReasons && (
                    <div className="flex flex-col gap-2 p-2 bg-paper border border-ink/30 rounded-[6px] mt-1">
                        <span className="text-[10px] font-black uppercase text-ink-soft">
                            Select Reason:
                        </span>
                        <div className="flex flex-col gap-1">
                            {REASON_OPTIONS.map((opt) => (
                                <label
                                    key={opt.id}
                                    className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer"
                                >
                                    <input
                                        type="radio"
                                        name={`kick-reason-${player.id}`}
                                        value={opt.id}
                                        checked={selectedReason === opt.id}
                                        onChange={() => setSelectedReason(opt.id)}
                                        className="accent-tomato"
                                    />
                                    <span>{opt.label}</span>
                                </label>
                            ))}
                        </div>
                        <button
                            type="button"
                            data-testid={`confirm-vote-kick-btn-${player.id}`}
                            onClick={handleConfirmVoteKick}
                            className="w-full mt-1 py-1 px-2 bg-tomato text-white font-black text-xs rounded-[4px] border border-ink shadow-hard-xs hover:bg-tomato-deep cursor-pointer"
                        >
                            Start Vote
                        </button>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-[11px] font-bold text-ink-soft hover:text-ink pt-1 border-t border-ink/10 cursor-pointer"
            >
                Close
            </button>
        </div>
    );
};

export default PlayerMenu;
