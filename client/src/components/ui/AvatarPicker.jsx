import React, { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AVATAR_IDS, Avatar } from './Avatar';

export const AvatarPicker = ({
    selectedAvatar = 'avatar-1',
    onSelect,
    className = '',
}) => {
    const containerRef = useRef(null);
    const currentIndex = Math.max(0, AVATAR_IDS.indexOf(selectedAvatar));

    const scrollToAvatar = (index) => {
        const buttons = containerRef.current?.querySelectorAll('button[role="radio"]');
        if (buttons && buttons[index]) {
            buttons[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    };

    const handleSelectIndex = (nextIndex) => {
        const nextAvatar = AVATAR_IDS[nextIndex];
        onSelect?.(nextAvatar);
        scrollToAvatar(nextIndex);
    };

    const handlePrev = () => {
        const prevIndex = (currentIndex - 1 + AVATAR_IDS.length) % AVATAR_IDS.length;
        handleSelectIndex(prevIndex);
    };

    const handleNext = () => {
        const nextIndex = (currentIndex + 1) % AVATAR_IDS.length;
        handleSelectIndex(nextIndex);
    };

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
            handleSelectIndex(nextIndex);
            const buttons = containerRef.current?.querySelectorAll('button[role="radio"]');
            if (buttons && buttons[nextIndex]) {
                buttons[nextIndex].focus();
            }
        }
    };

    // Keep active avatar visible on initial mount or change
    useEffect(() => {
        scrollToAvatar(currentIndex);
    }, [currentIndex]);

    return (
        <div className={`flex flex-col gap-1.5 w-full select-none ${className}`}>
            <span id="avatar-picker-label" className="text-xs font-bold uppercase tracking-wider text-ink">
                Choose Avatar
            </span>

            <div className="flex items-center gap-1 w-full">
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous avatar"
                    className="min-w-[36px] min-h-[36px] p-1.5 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer shrink-0 active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Horizontal Scrolling Row of 12 Avatars */}
                <div
                    ref={containerRef}
                    role="radiogroup"
                    aria-labelledby="avatar-picker-label"
                    className="flex-1 flex items-center gap-2 overflow-x-auto py-2 px-1.5 scrollbar-hide focus-visible:outline-none scroll-smooth touch-pan-x"
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
                                onClick={() => handleSelectIndex(index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                aria-label={`Avatar option ${index + 1}`}
                                className={`rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-2 ${
                                    isSelected
                                        ? 'scale-115 ring-2 ring-ink shadow-hard-sm z-elevated'
                                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                                }`}
                            >
                                <Avatar avatarId={id} size={isSelected ? 'md' : 'sm'} />
                            </button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next avatar"
                    className="min-w-[36px] min-h-[36px] p-1.5 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer shrink-0 active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default AvatarPicker;
