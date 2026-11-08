import React from 'react';
import { Tooltip } from '../ui/Tooltip';
import { REACTION_DEFINITIONS, ReactionIcon } from './ReactionStickers';
import { Heart } from 'lucide-react';

export const ReactionBar = ({
    onReact,
    onLike,
    hasLiked = false,
    disabled = false,
    className = '',
}) => {
    return (
        <div
            data-testid="reaction-bar"
            role="toolbar"
            aria-label="Drawing reactions"
            className={`flex items-center justify-between bg-paper border-2 border-ink rounded-xl shadow-hard-xs px-2 py-1.5 gap-1 sm:gap-2 max-w-full overflow-x-auto select-none ${className}`}
        >
            {/* 8 Reaction Buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
                {REACTION_DEFINITIONS.map((reaction) => (
                    <Tooltip key={reaction.kind} content={reaction.label} position="top">
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onReact?.(reaction.kind)}
                            aria-label={reaction.label}
                            data-testid={`reaction-btn-${reaction.kind}`}
                            className="p-1 sm:p-1.5 rounded-lg border-2 border-transparent hover:border-ink hover:bg-neutral-100 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                        >
                            <ReactionIcon kind={reaction.kind} size={22} className="shrink-0" />
                        </button>
                    </Tooltip>
                ))}
            </div>

            {/* Separator */}
            <div className="h-6 w-0.5 bg-ink/20 shrink-0 mx-0.5" aria-hidden="true" />

            {/* Like This Drawing Button */}
            <Tooltip content={hasLiked ? 'You liked this drawing' : 'Like this drawing (+5 pts to drawer)'} position="top">
                <button
                    type="button"
                    disabled={disabled || hasLiked}
                    onClick={() => onLike?.()}
                    aria-label={hasLiked ? 'You liked this drawing' : 'Like this drawing'}
                    aria-pressed={hasLiked}
                    data-testid="like-drawing-btn"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-ink font-heading font-black text-xs transition-all cursor-pointer ${
                        hasLiked
                            ? 'bg-rose-100 text-tomato border-tomato opacity-90 cursor-default'
                            : 'bg-paper text-ink hover:bg-rose-50 active:scale-95 shadow-hard-xs'
                    } disabled:pointer-events-none`}
                >
                    <Heart
                        className={`w-4 h-4 ${hasLiked ? 'fill-tomato text-tomato' : 'text-tomato fill-rose-200'}`}
                    />
                    <span className="hidden sm:inline font-bold">
                        {hasLiked ? 'Liked' : 'Like'}
                    </span>
                </button>
            </Tooltip>
        </div>
    );
};

export default ReactionBar;

