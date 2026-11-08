import React, { useState, useEffect, useRef } from 'react';

const RECENT_KEY = 'scribble_recent_emojis';
const MAX_RECENT = 16;

const CATEGORIES = [
    {
        id: 'smileys',
        name: 'Smileys',
        icon: '😀',
        emojis: [
            '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉',
            '😊', '😇', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎', '🥳',
            '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫',
            '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤯', '😳', '🥵',
            '🥶', '😱', '😨', '😰', '🤔', '🤫', '🤥', '😶', '😐', '😑'
        ]
    },
    {
        id: 'gestures',
        name: 'Gestures',
        icon: '👋',
        emojis: [
            '👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰',
            '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
            '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
            '🙏', '✍️', '💪'
        ]
    },
    {
        id: 'animals',
        name: 'Animals',
        icon: '🐱',
        emojis: [
            '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
            '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅',
            '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌',
            '🐞', '🐢', '🐍', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠', '🐬'
        ]
    },
    {
        id: 'food',
        name: 'Food',
        icon: '🍕',
        emojis: [
            '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒',
            '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🌽', '🥕',
            '🥔', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓',
            '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🍜', '🍣', '🍦', '🍩',
            '🍪', '🎂', '🍰', '🍫', '🍿', '☕', '🍵', '🧃', '🥤'
        ]
    },
    {
        id: 'activities',
        name: 'Activities',
        icon: '⚽',
        emojis: [
            '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🏸', '🏒',
            '🥊', '🎯', '⛳', '🎮', '🕹️', '🎲', '🧩', '🎨', '🖌️', '🎭',
            '🎪', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎬'
        ]
    },
    {
        id: 'travel',
        name: 'Travel',
        icon: '🚀',
        emojis: [
            '🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚',
            '🛵', '🏍️', '🚲', '🛴', '🚨', '🚂', '🚆', '🚇', '✈️', '🛫',
            '🚀', '🛸', '🚁', '⛵', '🚤', '🛳️', '⚓', '🏖️', '🏕️', '🗽'
        ]
    },
    {
        id: 'objects',
        name: 'Objects',
        icon: '💡',
        emojis: [
            '💡', '🔦', '🏮', '📱', '💻', '🖥️', '⌨️', '🖱️', '📷', '📺',
            '⏰', '⏳', '🔋', '🔌', '💎', '🔑', '🔨', '🔧', '🧲', '🧪',
            '🔬', '🔭', '🎁', '🎈', '🎉', '🎊', '🎀', '🪄', '🔮', '📦'
        ]
    },
    {
        id: 'symbols',
        name: 'Symbols',
        icon: '❤️',
        emojis: [
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️',
            '💕', '💞', '💓', '💗', '💖', '💘', '✨', '⭐', '🌟', '💫',
            '🔥', '💯', '💢', '💬', '💭', '💤', '🛑', '⛔', '⭕', '❌',
            '❗', '❓', '➕', '➖', '💲', '🔔', '🎵', '🎶', '✔️', '✅'
        ]
    }
];

function loadRecentEmojis() {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(RECENT_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed.slice(0, MAX_RECENT);
            }
        }
    } catch {
        // Ignore localStorage read errors
    }
    return ['❤️', '😂', '🔥', '👏', '🎉', '👍', '😍', '🤔'];
}

function saveRecentEmoji(emoji) {
    if (typeof window === 'undefined') return;
    try {
        const current = loadRecentEmojis();
        const updated = [emoji, ...current.filter(e => e !== emoji)].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {
        // Ignore localStorage write errors
    }
}

export const EmojiPicker = ({ onSelect, isOpen, onClose }) => {
    const [recentEmojis, setRecentEmojis] = useState(loadRecentEmojis);
    const [activeTab, setActiveTab] = useState('smileys');
    const containerRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setRecentEmojis(loadRecentEmojis());
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(e.target)) {
                onClose?.();
            }
        };

        const handleKeyDown = (e) => {
            if (isOpen && e.key === 'Escape') {
                onClose?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleEmojiClick = (emoji) => {
        saveRecentEmoji(emoji);
        setRecentEmojis(loadRecentEmojis());
        onSelect(emoji);
    };

    const currentCategory = CATEGORIES.find(c => c.id === activeTab) || CATEGORIES[0];

    return (
        <div
            ref={containerRef}
            role="dialog"
            aria-label="Emoji Picker"
            className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 z-50 w-72 sm:w-80 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden text-black animate-in fade-in zoom-in-95 duration-100"
        >
            {/* Header / Recent Row */}
            <div className="p-2 border-b-2 border-black bg-yellow-50">
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-600 mb-1 flex items-center justify-between">
                    <span>Recent</span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close emoji picker"
                        className="text-neutral-500 hover:text-black font-bold p-0.5"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                    {recentEmojis.map((emoji, idx) => (
                        <button
                            key={`recent-${emoji}-${idx}`}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            className="p-1 text-lg hover:scale-125 transition-transform shrink-0 rounded hover:bg-yellow-200"
                            aria-label={`Select recent ${emoji}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {/* Category Tabs (8 categories) */}
            <div className="flex border-b-2 border-black bg-neutral-100 overflow-x-auto p-1 gap-1">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveTab(cat.id)}
                        className={`p-1.5 rounded-lg text-sm transition-colors shrink-0 flex items-center justify-center ${
                            activeTab === cat.id
                                ? 'bg-white border-2 border-black font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                : 'hover:bg-neutral-200 border-2 border-transparent'
                        }`}
                        title={cat.name}
                        aria-label={`Show ${cat.name}`}
                    >
                        {cat.icon}
                    </button>
                ))}
            </div>

            {/* Emoji Grid */}
            <div className="p-2 max-h-48 overflow-y-auto grid grid-cols-7 sm:grid-cols-8 gap-1">
                {currentCategory.emojis.map((emoji, idx) => (
                    <button
                        key={`${currentCategory.id}-${emoji}-${idx}`}
                        type="button"
                        onClick={() => handleEmojiClick(emoji)}
                        className="p-1 text-xl hover:scale-125 transition-transform rounded hover:bg-neutral-100 flex items-center justify-center"
                        aria-label={`Select ${emoji}`}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
};

