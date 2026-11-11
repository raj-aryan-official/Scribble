import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, Crown, MoreVertical } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';
import { EVENTS } from '../../../../shared/types';
import PlayerMenu from './PlayerMenu';

export const PlayerList = ({
    players = [],
    scores = {},
    drawerId,
    guessedPlayerIds = [],
    speakingPeers = {},
    turnInfo = null,
    variant = 'desktop', // 'desktop' | 'mobile'
    className = '',
    currentUserId: propCurrentUserId,
    currentUserPlayerId: propCurrentUserPlayerId,
    isCurrentUserHost: propIsCurrentUserHost,
    onStartVoteKick: propOnStartVoteKick,
    onDirectKick: propOnDirectKick,
}) => {
    const gameContext = useGame?.();
    const state = gameContext?.state || {};
    const socket = useSocket?.();
    const [activeMenuPlayer, setActiveMenuPlayer] = useState(null);

    const currentUserId = propCurrentUserId !== undefined ? propCurrentUserId : state.currentUser?.id;
    const currentUserPlayerId = propCurrentUserPlayerId !== undefined ? propCurrentUserPlayerId : state.currentUser?.playerId;
    const isCurrentUserHost = propIsCurrentUserHost !== undefined ? propIsCurrentUserHost : Boolean(state.currentUser?.isHost);
    const voteState = state.voteState;
    const connectedCount = players.filter(
        (p) => !p.isDisconnected && p.status !== 'away' && p.status !== 'left'
    ).length;

    const handleStartVoteKick = (targetId, reason) => {
        if (propOnStartVoteKick) {
            propOnStartVoteKick(targetId, reason);
        } else {
            socket?.emit(EVENTS.START_VOTE_KICK, {
                roomCode: state.roomCode,
                targetId,
                reason,
            });
        }
        setActiveMenuPlayer(null);
    };

    const handleDirectKick = (targetId) => {
        if (propOnDirectKick) {
            propOnDirectKick(targetId);
        } else {
            socket?.emit(EVENTS.KICK_PLAYER, {
                roomCode: state.roomCode,
                targetId,
            });
        }
        setActiveMenuPlayer(null);
    };

    const queue = Array.isArray(turnInfo?.queue) ? turnInfo.queue : [];
    // Sort players by score descending
    const rankedPlayers = [...players].sort(
        (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
    );

    // Track score increases to render floating "+XYZ" gain animations
    const prevScoresRef = useRef(scores);
    const [floatingGains, setFloatingGains] = useState({});
    const gainTimersRef = useRef([]);

    useEffect(() => {
        const timers = gainTimersRef.current;
        return () => {
            timers.forEach(clearTimeout);
            timers.length = 0;
        };
    }, []);

    useEffect(() => {
        const prev = prevScoresRef.current;
        const newGains = {};
        let hasChange = false;

        Object.entries(scores).forEach(([playerId, currentScore]) => {
            const prevScore = prev[playerId] || 0;
            if (currentScore > prevScore) {
                const diff = currentScore - prevScore;
                newGains[playerId] = { amount: diff, id: Date.now() + Math.random() };
                hasChange = true;
            }
        });

        if (hasChange) {
            setFloatingGains((prevGains) => ({ ...prevGains, ...newGains }));
            const timer = setTimeout(() => {
                setFloatingGains((prevGains) => {
                    const next = { ...prevGains };
                    Object.entries(newGains).forEach(([playerId, gain]) => {
                        if (next[playerId]?.id === gain.id) delete next[playerId];
                    });
                    return next;
                });
            }, 1200);
            gainTimersRef.current.push(timer);
        }
        prevScoresRef.current = scores;
    }, [scores]);

    if (variant === 'mobile') {
        return (
            <>
                <div
                    data-testid="player-list-mobile"
                role="region"
                aria-label="Player scoreboard"
                tabIndex={0}
                className={`h-[56px] min-h-[56px] max-h-[56px] flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-hide max-w-full select-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none ${className}`}
            >
                {rankedPlayers.map((player, index) => {
                    const isAway = Boolean(player.isDisconnected || player.status === 'away');
                    const isDrawer = player.id === drawerId || player.playerId === drawerId;
                    const hasGuessed = guessedPlayerIds.includes(player.id) || (player.playerId && guessedPlayerIds.includes(player.playerId));
                    const isSpeaking = Boolean(speakingPeers[player.id]);
                    const score = scores[player.id] !== undefined ? scores[player.id] : (player.score || 0);
                    const gain = floatingGains[player.id];
                    const queueIndex = queue.findIndex(id => id === player.id || id === player.playerId);

                    let drawOrderLabel = null;
                    if (!isDrawer && !hasGuessed && !isAway) {
                        if (queueIndex === 0) {
                            drawOrderLabel = 'Draws next';
                        } else if (queueIndex > 0) {
                            drawOrderLabel = `Draws in ${queueIndex + 1}`;
                        }
                    }

                    const hasMissed = Boolean(player.missedDraws && player.missedDraws.length > 0 && !isDrawer);
                    const isMakeUp = Boolean(player.isMakeUpTurn || (hasMissed && !isAway && queueIndex >= 0));
                    const isJoinedLate = Boolean(player.joinedMidRound && (!turnInfo?.round || turnInfo.round === 1));

                    return (
                        <div
                            key={player.id}
                            data-testid="player-item"
                            data-player-id={player.id}
                            data-player-score={score}
                            data-player-state={isDrawer ? 'drawing' : hasGuessed ? 'guessed' : 'guessing'}
                            data-draw-order={drawOrderLabel || undefined}
                            className={`min-h-[44px] flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-ink shadow-hard-sm shrink-0 relative transition-transform ${
                                player.isDisconnected
                                    ? 'bg-paper border-dashed text-ink'
                                    : hasGuessed
                                    ? 'bg-leaf-deep text-white'
                                    : isDrawer
                                    ? 'bg-marigold text-ink'
                                    : 'bg-card text-ink'
                            }`}
                        >
                            <span className="font-mono font-black text-xs">
                                #{index + 1}
                            </span>

                            {/* Avatar with burst effect on guess or soft pulse on drawer like */}
                            <motion.div
                                key={`avatar-pulse-${isDrawer ? state.likesCount : (hasGuessed ? 'guessed' : 'none')}`}
                                animate={
                                    hasGuessed
                                        ? { scale: [1, 1.3, 1] }
                                        : isDrawer && state.likesCount > 0
                                        ? { scale: [1, 1.15, 1] }
                                        : {}
                                }
                                transition={{ duration: 0.35 }}
                                className={`rounded-full relative transition-transform ${
                                    isSpeaking ? 'ring-2 ring-leaf ring-offset-1 scale-110' : ''
                                } ${isDrawer && state.likesCount > 0 ? 'animate-pulse' : ''}`}
                            >
                                <Avatar avatarId={player.avatar} size="xs" />
                                {hasGuessed && (
                                    <>
                                        <motion.span
                                            initial={{ scale: 0.8, opacity: 0.8 }}
                                            animate={{ scale: 1.6, opacity: 0 }}
                                            transition={{ duration: 0.6 }}
                                            className="absolute inset-0 rounded-full border-2 border-leaf pointer-events-none"
                                        />
                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-leaf border border-ink flex items-center justify-center text-white shadow-xs">
                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        </span>
                                    </>
                                )}
                            </motion.div>

                            <span className="text-xs font-bold truncate max-w-[70px]">
                                {player.username}
                            </span>

                            {player.teamName && (
                                <span
                                    data-testid={`player-team-badge-${player.id}`}
                                    className="text-[8px] font-black uppercase text-white px-1 py-0.5 rounded-[3px] border border-ink shrink-0"
                                    style={{ backgroundColor: player.teamColor || '#3B82F6' }}
                                >
                                    {player.teamName}
                                </span>
                            )}

                            {isAway && (
                                <span className="text-[9px] font-bold text-tomato-deep uppercase bg-paper/80 px-1 py-0.5 rounded border border-tomato/30 shrink-0">
                                    Away
                                </span>
                            )}
                            {drawOrderLabel && (
                                <span
                                    data-testid="draw-order-label"
                                    className="text-[9px] font-bold text-ink-soft bg-paper/80 px-1 py-0.5 rounded border border-ink/20 shrink-0"
                                >
                                    {drawOrderLabel}
                                </span>
                            )}
                            {isMakeUp && (
                                <span className="text-[9px] font-bold text-leaf-deep bg-paper/80 px-1 py-0.5 rounded border border-leaf/30 shrink-0">
                                    Make-up turn
                                </span>
                            )}
                            {hasMissed && !isMakeUp && (
                                <span className="text-[9px] font-bold text-tomato-deep bg-paper/80 px-1 py-0.5 rounded border border-tomato/30 shrink-0">
                                    Missed turn
                                </span>
                            )}
                            {isJoinedLate && (
                                <span className="text-[9px] font-medium text-ink-soft bg-paper/60 px-1 py-0.5 rounded border border-ink/20 shrink-0">
                                    joined late
                                </span>
                            )}

                            {/* State indicators: Drawing (pencil), Guessed (tick), Still guessing */}
                            {isDrawer && (
                                <span role="img" title="Drawing" aria-label="Drawing" className="shrink-0 flex items-center">
                                    <Pencil className="w-3 h-3 text-ink" aria-hidden="true" />
                                </span>
                            )}
                            {hasGuessed && (
                                <span role="img" title="Guessed" aria-label="Guessed" className="shrink-0 flex items-center">
                                    <Check className="w-3 h-3 text-white stroke-[3]" aria-hidden="true" />
                                </span>
                            )}

                            {/* Score and floating gain */}
                            <div className="relative inline-flex items-center ml-0.5">
                                <span className="font-mono font-bold text-[11px]">
                                    {score}
                                </span>
                                <AnimatePresence>
                                    {gain && (
                                        <motion.span
                                            key={gain.id}
                                            aria-hidden="true"
                                            initial={{ y: 0, scale: 0.9 }}
                                            animate={{ y: -16, scale: 1.1 }}
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                            className="absolute -top-3.5 -right-1 font-mono font-black text-[10px] text-leaf-deep pointer-events-none select-none z-10"
                                            data-testid="floating-score-gain"
                                        >
                                            +{gain.amount}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Player actions menu button */}
                            <button
                                type="button"
                                aria-label={`Player actions for ${player.username}`}
                                data-testid={`player-menu-btn-${player.id}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuPlayer(player);
                                }}
                                className="p-0.5 rounded hover:bg-ink/10 text-ink-soft hover:text-ink transition-colors cursor-pointer shrink-0"
                                title={`Player actions for ${player.username}`}
                            >
                                <MoreVertical className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
            </div>
            {activeMenuPlayer && (
                <div
                    role="presentation"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4"
                    onClick={() => setActiveMenuPlayer(null)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <PlayerMenu
                            player={activeMenuPlayer}
                            currentUserId={currentUserId}
                            currentUserPlayerId={currentUserPlayerId}
                            currentUser={state.currentUser}
                            isCurrentUserHost={isCurrentUserHost}
                            connectedCount={connectedCount}
                            voteState={voteState}
                            onStartVoteKick={handleStartVoteKick}
                            onDirectKick={handleDirectKick}
                            onClose={() => setActiveMenuPlayer(null)}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

    return (
        <aside
            data-testid="player-list-desktop"
            aria-label="Player scoreboard"
            className={`w-full flex flex-col gap-2 p-3 bg-card border-2 border-ink shadow-hard rounded-[12px] overflow-hidden select-none ${className}`}
        >
            <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2 px-1">
                <h3 className="font-heading font-black text-sm uppercase tracking-wider text-ink">
                    Players
                </h3>
                <span className="text-xs font-bold text-ink-soft">
                    {players.length}
                </span>
            </div>

            {/* Team Scoreboard (Team Mode) */}
            {state.settings?.mode === 'team' && state.teamScores && (
                <div
                    data-testid="team-scoreboard"
                    className="flex items-center gap-1.5 p-1.5 bg-paper border border-ink rounded-[6px] flex-wrap"
                >
                    {Object.entries(state.teamScores).map(([tId, tScore]) => {
                        const teamNames = {
                            'team-red': 'Team Red',
                            'team-blue': 'Team Blue',
                            'team-green': 'Team Green',
                            'team-yellow': 'Team Yellow',
                        };
                        const teamColors = {
                            'team-red': '#EF4444',
                            'team-blue': '#3B82F6',
                            'team-green': '#10B981',
                            'team-yellow': '#F59E0B',
                        };
                        return (
                            <div
                                key={tId}
                                data-testid={`team-score-${tId}`}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-white text-[11px] font-black border border-ink shadow-hard-xs"
                                style={{ backgroundColor: teamColors[tId] || '#3B82F6' }}
                            >
                                <span>{teamNames[tId] || tId}:</span>
                                <span className="font-mono">{tScore}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100dvh-220px)] pr-1">
                {rankedPlayers.map((player, index) => {
                    const isDrawer = player.id === drawerId || player.playerId === drawerId;
                    const hasGuessed = guessedPlayerIds.includes(player.id) || (player.playerId && guessedPlayerIds.includes(player.playerId));
                    const isSpeaking = Boolean(speakingPeers[player.id]);
                    const isAway = Boolean(player.isDisconnected || player.status === 'away');
                    const score = scores[player.id] !== undefined ? scores[player.id] : (player.score || 0);
                    const gain = floatingGains[player.id];
                    const queueIndex = queue.findIndex(id => id === player.id || id === player.playerId);
                    let drawOrderLabel = null;
                    if (!isDrawer && !hasGuessed && !isAway) {
                        if (queueIndex === 0) {
                            drawOrderLabel = 'Draws next';
                        } else if (queueIndex > 0) {
                            drawOrderLabel = `Draws in ${queueIndex + 1}`;
                        }
                    }

                    const hasMissed = Boolean(player.missedDraws && player.missedDraws.length > 0 && !isDrawer);
                    const isMakeUp = Boolean(player.isMakeUpTurn || (hasMissed && !isAway && queueIndex >= 0));
                    const isJoinedLate = Boolean(player.joinedMidRound && (!turnInfo?.round || turnInfo.round === 1));

                    return (
                        <div
                            key={player.id}
                            data-testid="player-item"
                            data-player-id={player.id}
                            data-player-score={score}
                            data-player-state={isDrawer ? 'drawing' : hasGuessed ? 'guessed' : 'guessing'}
                            data-draw-order={drawOrderLabel || undefined}
                            className={`flex items-center gap-2.5 p-2 rounded-[8px] border-2 border-ink shadow-hard-sm transition-all ${
                                isAway
                                    ? 'bg-paper border-dashed text-ink'
                                    : hasGuessed
                                    ? 'bg-leaf-deep text-white'
                                    : isDrawer
                                    ? 'bg-marigold text-ink'
                                    : 'bg-paper text-ink'
                            }`}
                        >
                            <span className="font-mono font-black text-xs w-5 text-center shrink-0">
                                #{index + 1}
                            </span>

                            {/* Avatar with burst effect on guess or soft pulse on drawer like */}
                            <motion.div
                                key={`avatar-pulse-${isDrawer ? state.likesCount : (hasGuessed ? 'guessed' : 'none')}`}
                                animate={
                                    hasGuessed
                                        ? { scale: [1, 1.3, 1] }
                                        : isDrawer && state.likesCount > 0
                                        ? { scale: [1, 1.15, 1] }
                                        : {}
                                }
                                transition={{ duration: 0.35 }}
                                className={`rounded-full shrink-0 relative transition-transform ${
                                    isSpeaking ? 'ring-2 ring-leaf ring-offset-2 scale-110' : ''
                                } ${isDrawer && state.likesCount > 0 ? 'animate-pulse' : ''}`}
                            >
                                <Avatar avatarId={player.avatar} size="xs" />
                                {hasGuessed && (
                                    <>
                                        <motion.span
                                            initial={{ scale: 0.8, opacity: 0.8 }}
                                            animate={{ scale: 1.6, opacity: 0 }}
                                            transition={{ duration: 0.6 }}
                                            className="absolute inset-0 rounded-full border-2 border-leaf pointer-events-none"
                                        />
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-leaf border border-ink flex items-center justify-center text-white shadow-xs">
                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        </span>
                                    </>
                                )}
                            </motion.div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-xs sm:text-sm truncate">
                                        {player.username}
                                    </span>
                                    {player.isHost && (
                                        <Crown className="w-3 h-3 text-marigold fill-marigold shrink-0" aria-label="Host" />
                                    )}
                                    {player.teamName && (
                                        <span
                                            data-testid={`player-team-badge-${player.id}`}
                                            className="text-[9px] font-black uppercase text-white px-1.5 py-0.5 rounded-[3px] border border-ink shadow-hard-xs shrink-0"
                                            style={{ backgroundColor: player.teamColor || '#3B82F6' }}
                                        >
                                            {player.teamName}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {isAway && (
                                        <span className="text-[10px] font-bold text-tomato-deep uppercase tracking-wide">
                                            Away
                                        </span>
                                    )}
                                    {drawOrderLabel && (
                                        <span
                                            data-testid="draw-order-label"
                                            className={`text-[10px] font-bold leading-none ${hasGuessed ? 'text-white/90' : 'text-ink-soft'}`}
                                        >
                                            {isAway ? `• ${drawOrderLabel}` : drawOrderLabel}
                                        </span>
                                    )}
                                    {isMakeUp && (
                                        <span className={`text-[10px] font-bold leading-none ${hasGuessed ? 'text-white' : 'text-leaf-deep'}`}>
                                            • Make-up turn
                                        </span>
                                    )}
                                    {hasMissed && !isMakeUp && (
                                        <span className={`text-[10px] font-bold leading-none ${hasGuessed ? 'text-white' : 'text-tomato-deep'}`}>
                                            • Missed turn
                                        </span>
                                    )}
                                    {isJoinedLate && (
                                        <span className="text-[10px] font-medium text-ink-soft bg-paper/60 px-1 py-0.5 rounded border border-ink/20 leading-none">
                                            joined late
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="relative flex items-center gap-1.5 shrink-0">
                                {/* State indicators: Drawing (pencil), Guessed (tick) */}
                                {isDrawer && (
                                    <span role="img" title="Drawing" aria-label="Drawing">
                                        <Pencil className="w-4 h-4 text-ink" aria-hidden="true" />
                                    </span>
                                )}
                                {hasGuessed && (
                                    <span role="img" title="Guessed" aria-label="Guessed">
                                        <Check className="w-4 h-4 text-white stroke-[3]" aria-hidden="true" />
                                    </span>
                                )}

                                {/* Score display and floating gain */}
                                <div className="relative flex items-center">
                                    <span className="font-mono font-black text-xs sm:text-sm">
                                        {score}
                                    </span>
                                    <AnimatePresence>
                                        {gain && (
                                            <motion.span
                                                key={gain.id}
                                                aria-hidden="true"
                                                initial={{ y: 0, scale: 0.9 }}
                                                animate={{ y: -20, scale: 1.1 }}
                                                transition={{ duration: 1, ease: 'easeOut' }}
                                                className="absolute -top-4 -right-1 font-mono font-black text-xs text-ink pointer-events-none select-none z-10"
                                                data-testid="floating-score-gain"
                                            >
                                                +{gain.amount}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Player actions menu button */}
                                <button
                                    type="button"
                                    aria-label={`Player actions for ${player.username}`}
                                    data-testid={`player-menu-btn-${player.id}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuPlayer(player);
                                    }}
                                    className="p-1 rounded hover:bg-ink/10 text-ink-soft hover:text-ink transition-colors cursor-pointer shrink-0"
                                    title={`Player actions for ${player.username}`}
                                >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {activeMenuPlayer && (
                <div
                    role="presentation"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4"
                    onClick={() => setActiveMenuPlayer(null)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <PlayerMenu
                            player={activeMenuPlayer}
                            currentUserId={currentUserId}
                            currentUserPlayerId={currentUserPlayerId}
                            currentUser={state.currentUser}
                            isCurrentUserHost={isCurrentUserHost}
                            connectedCount={connectedCount}
                            voteState={voteState}
                            onStartVoteKick={handleStartVoteKick}
                            onDirectKick={handleDirectKick}
                            onClose={() => setActiveMenuPlayer(null)}
                        />
                    </div>
                </div>
            )}
        </aside>
    );
};

export default PlayerList;
