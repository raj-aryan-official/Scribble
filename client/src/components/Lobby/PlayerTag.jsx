import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Pencil, UserX } from 'lucide-react';
import Avatar from '../ui/Avatar';

export const PlayerTag = ({
    player,
    isCurrentUser = false,
    canKick = false,
    onKick,
    onChangeAvatar,
}) => {
    const isDisconnected = Boolean(player.isDisconnected || player.status === 'away');

    return (
        <motion.li
            layout
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className={`flex items-center justify-between gap-3 p-3 bg-card border-2 border-ink shadow-hard-sm rounded-[12px] relative group transition-opacity list-none ${
                isDisconnected ? 'opacity-50 border-dashed bg-paper' : ''
            }`}
            data-testid={`player-tag-${player.id}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                {/* Avatar with change button if current user */}
                {isCurrentUser ? (
                    <button
                        type="button"
                        onClick={onChangeAvatar}
                        data-avatar={player.avatar}
                        className="relative rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-cobalt focus-visible:outline-offset-2 shrink-0 group/avatar"
                        aria-label="Change your avatar"
                        title="Change your avatar"
                    >
                        <Avatar avatarId={player.avatar} size="sm" />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-paper border border-ink flex items-center justify-center text-ink group-hover/avatar:bg-marigold transition-colors shadow-xs">
                            <Pencil className="w-2.5 h-2.5" />
                        </span>
                    </button>
                ) : (
                    <div className="shrink-0" data-avatar={player.avatar}>
                        <Avatar avatarId={player.avatar} size="sm" />
                    </div>
                )}

                {/* Nickname and Badges */}
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-ink truncate text-sm sm:text-base">
                            {player.username}
                        </span>

                        {player.isHost && (
                            <span
                                role="img"
                                title="Room Host"
                                aria-label="Room Host"
                                className="inline-flex items-center text-marigold fill-marigold shrink-0"
                            >
                                <Crown className="w-4 h-4 text-marigold fill-marigold" aria-hidden="true" />
                            </span>
                        )}

                        {isCurrentUser && (
                            <span className="bg-cobalt text-white text-[10px] font-black uppercase px-1.5 py-0.5 rounded-[4px] border border-ink shadow-hard-sm shrink-0">
                                You
                            </span>
                        )}

                        {player.teamName && (
                            <span
                                data-testid={`player-team-${player.id}`}
                                className="text-white text-[10px] font-black uppercase px-1.5 py-0.5 rounded-[4px] border border-ink shadow-hard-xs shrink-0"
                                style={{ backgroundColor: player.teamColor || '#3B82F6' }}
                            >
                                {player.teamName}
                            </span>
                        )}

                        {isDisconnected && (
                            <span className="bg-paper text-tomato-deep border border-tomato/50 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[4px] shrink-0">
                                Away
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Host Kick Action Button */}
            {canKick && (
                <div className="shrink-0 flex items-center">
                    <button
                        type="button"
                        onClick={() => onKick?.(player)}
                        aria-label={`Kick ${player.username} from room`}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus:opacity-100 p-1.5 rounded-[6px] hover:bg-tomato/15 text-ink-soft hover:text-tomato border border-transparent hover:border-ink transition-all cursor-pointer"
                        title={`Kick ${player.username}`}
                    >
                        <UserX className="w-4 h-4" />
                    </button>
                </div>
            )}
        </motion.li>
    );
};

export default PlayerTag;
