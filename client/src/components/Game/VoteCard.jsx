import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, Ban } from 'lucide-react';
import Avatar from '../ui/Avatar';

const REASON_LABELS = {
    afk: 'AFK / Inactive',
    spam: 'Spamming chat',
    abuse: 'Abusive behavior',
    other: 'Disruptive behavior',
};

/**
 * Circular Draining Timer Ring for Vote Duration (20s)
 */
const VoteTimerRing = ({ remainingSec = 20, totalSec = 20 }) => {
    const size = 36;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const fraction = Math.max(0, Math.min(1, remainingSec / totalSec));
    const strokeDashoffset = circumference * (1 - fraction);
    const isUrgent = remainingSec <= 5;

    return (
        <div
            role="timer"
            aria-label={`${remainingSec} seconds remaining`}
            className={`relative inline-flex items-center justify-center shrink-0 w-9 h-9 ${
                isUrgent ? 'text-tomato' : 'text-ink'
            }`}
        >
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-90 block" aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="opacity-20"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-100 ease-linear"
                />
            </svg>
            <span className="absolute font-mono font-black text-xs tabular-nums leading-none">
                {remainingSec}
            </span>
        </div>
    );
};

export const VoteCard = ({
    voteState,
    currentUserId,
    currentUserPlayerId,
    isHost = false,
    hasVoted = false,
    onVote,
    onCancel,
}) => {
    const cardRef = useRef(null);
    const [now, setNow] = useState(Date.now());
    const [localVoted, setLocalVoted] = useState(hasVoted);

    // Sync localVoted when voteId changes
    useEffect(() => {
        setLocalVoted(hasVoted);
    }, [voteState?.voteId, hasVoted]);

    // Timer tick for smooth draining ring
    useEffect(() => {
        if (!voteState?.endsAt) return;
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 100);
        return () => clearInterval(interval);
    }, [voteState?.endsAt]);

    // Focus card on mount and announce politely
    useEffect(() => {
        if (voteState?.voteId) {
            cardRef.current?.focus();
        }
    }, [voteState?.voteId]);

    if (!voteState || !voteState.voteId) return null;

    const remainingMs = voteState.endsAt ? Math.max(0, voteState.endsAt - now) : 20000;
    const remainingSec = Math.ceil(remainingMs / 1000);

    const isTarget =
        currentUserId === voteState.targetId ||
        (currentUserPlayerId && currentUserPlayerId === voteState.targetId);

    const reasonLabel = REASON_LABELS[voteState.reason] || voteState.reason || 'Disruptive behavior';
    const targetName = voteState.targetName || 'Player';
    const yes = voteState.yes || 0;
    const no = voteState.no || 0;
    const threshold = voteState.threshold || Math.ceil(0.6 * (voteState.total || 1));

    const handleVote = (yesVote) => {
        if (localVoted || isTarget) return;
        setLocalVoted(true);
        onVote?.(yesVote);
    };

    return (
        <AnimatePresence>
            <motion.div
                ref={cardRef}
                tabIndex={-1}
                role="region"
                aria-label="Vote to kick in progress"
                data-testid="vote-card"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                className="w-full bg-paper border-2 border-ink shadow-hard rounded-[10px] p-2.5 sm:p-3 mb-2 flex flex-col gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt select-none shrink-0"
            >
                {/* Polite live region announcement */}
                <div role="status" aria-live="polite" className="sr-only">
                    {isTarget
                        ? `A vote to remove you is open. Reason: ${reasonLabel}. ${remainingSec} seconds remaining.`
                        : `A vote to remove ${targetName} is open. Reason: ${reasonLabel}. ${remainingSec} seconds remaining.`}
                </div>

                {isTarget ? (
                    /* TARGET VIEW: 'A vote to remove you is open' with no voter details */
                    <div className="flex items-center justify-between gap-3" data-testid="vote-card-target-view">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-tomato/20 border border-tomato flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4 text-tomato" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-heading font-black text-xs sm:text-sm text-tomato truncate">
                                    A vote to remove you is open
                                </span>
                                <span className="text-[11px] font-bold text-ink-soft truncate">
                                    Reason: {reasonLabel}
                                </span>
                            </div>
                        </div>
                        <VoteTimerRing remainingSec={remainingSec} totalSec={20} />
                    </div>
                ) : (
                    /* ELIGIBLE VOTERS VIEW */
                    <div className="flex flex-col gap-2">
                        {/* Header: Target avatar, name, reason, timer */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Avatar avatarId={voteState.targetAvatar || 'avatar-1'} size="xs" />
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-black text-ink text-xs sm:text-sm truncate">
                                            Kick {targetName}?
                                        </span>
                                        <span className="text-[10px] font-bold uppercase tracking-wide bg-card border border-ink/30 px-1.5 py-0.2 rounded text-ink-soft shrink-0">
                                            {reasonLabel}
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-bold text-ink-soft">
                                        Live tally: Yes: {yes} · No: {no} ({yes}/{threshold} needed)
                                    </span>
                                </div>
                            </div>

                            <VoteTimerRing remainingSec={remainingSec} totalSec={20} />
                        </div>

                        {/* Controls: Yes / No buttons & Host cancel button */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-ink/10">
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    type="button"
                                    data-testid="vote-yes-button"
                                    disabled={localVoted}
                                    onClick={() => handleVote(true)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-[6px] border-2 border-ink text-xs font-black transition-all cursor-pointer shadow-hard-xs ${
                                        localVoted
                                            ? 'opacity-60 cursor-not-allowed bg-paper text-ink'
                                            : 'bg-leaf text-white hover:bg-leaf-deep active:translate-y-0.5'
                                    }`}
                                >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Yes</span>
                                </button>

                                <button
                                    type="button"
                                    data-testid="vote-no-button"
                                    disabled={localVoted}
                                    onClick={() => handleVote(false)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-[6px] border-2 border-ink text-xs font-black transition-all cursor-pointer shadow-hard-xs ${
                                        localVoted
                                            ? 'opacity-60 cursor-not-allowed bg-paper text-ink'
                                            : 'bg-card text-ink hover:bg-paper active:translate-y-0.5'
                                    }`}
                                >
                                    <X className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>No</span>
                                </button>
                            </div>

                            {/* Host cancel action */}
                            {isHost && (
                                <button
                                    type="button"
                                    data-testid="cancel-vote-button"
                                    onClick={onCancel}
                                    className="px-2 py-1 text-[11px] font-bold text-ink-soft hover:text-tomato border border-ink/30 hover:border-tomato rounded-[4px] bg-paper transition-colors cursor-pointer shrink-0"
                                    title="Host cancel vote"
                                >
                                    <Ban className="w-3.5 h-3.5 inline mr-1" />
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default VoteCard;

