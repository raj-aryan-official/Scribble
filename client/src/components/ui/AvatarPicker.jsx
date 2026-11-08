import React, { useRef } from 'react';
import { AVATAR_IDS, Avatar } from './Avatar';

export const AvatarPicker = ({
    selectedAvatar = 'avatar-1',
    onSelect,
    className = '',
}) => {
    const containerRef = useRef(null);

    const handleKeyDown = (e, index) => {
        let nextIndex = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            nextIndex = (index + 1) % AVATAR_IDS.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            nextIndex = (index - 1 + AVATAR_IDS.length) % AVATAR_IDS.length;
        } else if (e.key === 'Home') {
            e.preventDefault();
            nextIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault();
            nextIndex = AVATAR_IDS.length - 1;
        }

        if (nextIndex !== null) {
            const nextAvatar = AVATAR_IDS[nextIndex];
            onSelect?.(nextAvatar);
            const buttons = containerRef.current?.querySelectorAll('button[role="radio"]');
            if (buttons && buttons[nextIndex]) {
                buttons[nextIndex].focus();
                buttons[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        }
    };

    return (
        <div className={`flex flex-col gap-1.5 w-full ${className}`}>
            <span id="avatar-picker-label" className="text-xs font-bold uppercase tracking-wider text-ink select-none">
                Choose Avatar
            </span>

            <div
                ref={containerRef}
                role="radiogroup"
                aria-labelledby="avatar-picker-label"
                className="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-hide focus-visible:outline-none"
            >
                {AVATAR_IDS.map((id, index) => {
                    const isSelected = selectedAvatar === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => onSelect?.(id)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            aria-label={`Avatar option ${index + 1}`}
                            className={`min-w-[44px] min-h-[44px] p-0.5 rounded-full transition-transform cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-2 ${
                                isSelected
                                    ? 'scale-110 ring-2 ring-ink shadow-hard-sm'
                                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                            }`}
                        >
                            <Avatar avatarId={id} size="sm" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AvatarPicker;
