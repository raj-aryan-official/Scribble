import React from 'react';
import avatar1 from '../../assets/avatars/avatar-1.svg';
import avatar2 from '../../assets/avatars/avatar-2.svg';
import avatar3 from '../../assets/avatars/avatar-3.svg';
import avatar4 from '../../assets/avatars/avatar-4.svg';
import avatar5 from '../../assets/avatars/avatar-5.svg';
import avatar6 from '../../assets/avatars/avatar-6.svg';
import avatar7 from '../../assets/avatars/avatar-7.svg';
import avatar8 from '../../assets/avatars/avatar-8.svg';
import avatar9 from '../../assets/avatars/avatar-9.svg';
import avatar10 from '../../assets/avatars/avatar-10.svg';
import avatar11 from '../../assets/avatars/avatar-11.svg';
import avatar12 from '../../assets/avatars/avatar-12.svg';

export const AVATAR_MAP = {
    'avatar-1': avatar1,
    'avatar-2': avatar2,
    'avatar-3': avatar3,
    'avatar-4': avatar4,
    'avatar-5': avatar5,
    'avatar-6': avatar6,
    'avatar-7': avatar7,
    'avatar-8': avatar8,
    'avatar-9': avatar9,
    'avatar-10': avatar10,
    'avatar-11': avatar11,
    'avatar-12': avatar12,
};

export const AVATAR_IDS = Object.keys(AVATAR_MAP);

export const Avatar = ({
    avatarId = 'avatar-1',
    size = 'md',
    alt = 'Avatar',
    className = '',
}) => {
    const sizes = {
        xs: 'w-7 h-7',
        sm: 'w-9 h-9',
        md: 'w-11 h-11',
        lg: 'w-14 h-14',
        xl: 'w-20 h-20',
    };

    const sizeClass = sizes[size] || sizes.md;
    const src = AVATAR_MAP[avatarId];

    return (
        <div
            className={`relative inline-flex items-center justify-center rounded-full border-2 border-ink bg-card flex-shrink-0 overflow-hidden select-none ${sizeClass} ${className}`.trim()}
        >
            {src ? (
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-full object-contain p-0.5"
                    loading="lazy"
                />
            ) : (
                <span className="text-base leading-none" role="img" aria-label={alt}>
                    {avatarId || '🎨'}
                </span>
            )}
        </div>
    );
};

export default Avatar;
