import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Check, Crown } from 'lucide-react';
import Avatar from '../ui/Avatar';

export const PlayerList = ({
    players = [],
    scores = {},
    drawerId,
    guessedPlayerIds = [],
    speakingPeers = {},
    variant = 'desktop', // 'desktop' | 'mobile'
    className = '',
}) => {
    // Sort players by score descending
    const rankedPlayers = [...players].sort(
        (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
    );

    if (variant === 'mobile') {
        return (
            <div
                data-testid="player-list-mobile"
                aria-label="Player scoreboard"
                className={`flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-hide max-w-full select-none ${className}`}
            >
                {rankedPlayers.map((player, index) => {
                    const isDrawer = player.id === drawerId;
                    const hasGuessed = guessedPlayerIds.includes(player.id);
                    const isSpeaking = Boolean(speakingPeers[player.id]);
                    const score = scores[player.id] || 0;

                    return (
                        <div
                            key={player.id}
                            data-testid="player-item"
                            data-player-id={player.id}
                            data-player-score={score}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 border-ink shadow-hard-sm shrink-0 transition-transform ${
                                player.isDisconnected
                                    ? 'bg-paper opacity-50 border-dashed'
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

                            <motion.div
                                animate={hasGuessed ? { scale: [1, 1.2, 1] } : {}}
                                transition={{ duration: 0.3 }}
                                className={`rounded-full relative transition-transform ${
                                    isSpeaking ? 'ring-2 ring-leaf ring-offset-1 scale-110' : ''
                                }`}
                            >
                                <Avatar avatarId={player.avatar} size="xs" />
                                {hasGuessed && (
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-leaf border border-ink flex items-center justify-center text-white shadow-xs">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    </span>
                                )}
                            </motion.div>

                            <span className="text-xs font-bold truncate max-w-[70px]">
                                {player.username}
                            </span>

                            {isDrawer && (
                                <Pencil className="w-3 h-3 text-ink shrink-0" aria-label="Drawing" />
                            )}
                            {hasGuessed && (
                                <Check className="w-3 h-3 text-white shrink-0" aria-label="Guessed" />
                            )}

                            <span className="font-mono font-bold text-[11px] ml-0.5">
                                {score}
                            </span>
                        </div>
                    );
                })}
            </div>
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

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
                {rankedPlayers.map((player, index) => {
                    const isDrawer = player.id === drawerId;
                    const hasGuessed = guessedPlayerIds.includes(player.id);
                    const isSpeaking = Boolean(speakingPeers[player.id]);
                    const score = scores[player.id] || 0;

                    return (
                        <div
                            key={player.id}
                            data-testid="player-item"
                            data-player-id={player.id}
                            data-player-score={score}
                            className={`flex items-center gap-2.5 p-2 rounded-[8px] border-2 border-ink shadow-hard-sm transition-all ${
                                player.isDisconnected
                                    ? 'bg-paper opacity-50 border-dashed'
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

                            <motion.div
                                animate={hasGuessed ? { scale: [1, 1.2, 1] } : {}}
                                transition={{ duration: 0.3 }}
                                className={`rounded-full shrink-0 relative transition-transform ${
                                    isSpeaking ? 'ring-2 ring-leaf ring-offset-2 scale-110' : ''
                                }`}
                            >
                                <Avatar avatarId={player.avatar} size="xs" />
                                {hasGuessed && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-leaf border border-ink flex items-center justify-center text-white shadow-xs">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    </span>
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
                                </div>
                                {player.isDisconnected && (
                                    <span className="text-[10px] font-bold text-tomato uppercase tracking-wide">
                                        away
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {isDrawer && (
                                    <span title="Drawing" aria-label="Drawing">
                                        <Pencil className="w-4 h-4 text-ink" />
                                    </span>
                                )}
                                {hasGuessed && (
                                    <span title="Guessed" aria-label="Guessed">
                                        <Check className="w-4 h-4 text-white" />
                                    </span>
                                )}
                                <span className="font-mono font-black text-xs sm:text-sm">
                                    {score}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};

export default PlayerList;

