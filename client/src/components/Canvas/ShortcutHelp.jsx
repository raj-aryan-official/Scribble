import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

const SHORTCUTS = [
    { key: 'P', desc: 'Pencil tool' },
    { key: 'E', desc: 'Eraser tool' },
    { key: '[ / ]', desc: 'Decrease / increase brush size' },
    { key: '1 – 9', desc: 'Select color swatch 1 to 9' },
    { key: 'Ctrl/Cmd + Z', desc: 'Undo stroke' },
];

export const ShortcutHelp = ({ className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);

    // Close when clicking outside or pressing Escape
    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} data-testid="shortcut-help">
            <button
                type="button"
                aria-label="Keyboard shortcuts"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                title="Keyboard shortcuts (?)"
                onClick={() => setIsOpen(!isOpen)}
                className={`min-w-[44px] min-h-[44px] p-2 rounded-[6px] border-2 border-ink shadow-hard-sm flex items-center justify-center cursor-pointer font-heading font-black text-sm focus-visible:ring-2 focus-visible:ring-cob2 focus-visible:outline-none transition-all ${
                    isOpen ? 'bg-marigold text-ink' : 'bg-paper text-ink hover:bg-card'
                }`}
            >
                <HelpCircle className="w-5 h-5" />
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label="Keyboard shortcuts"
                    className="absolute bottom-full mb-2 right-0 z-popover bg-card border-2 border-ink shadow-hard-lg rounded-[12px] p-4 w-72 sm:w-80 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                    <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-ink">
                            Keyboard Shortcuts
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close shortcuts popover"
                            className="p-1 text-ink-soft hover:text-ink cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <ul className="flex flex-col gap-2 text-xs">
                        {SHORTCUTS.map(({ key, desc }) => (
                            <li key={key} className="flex items-center justify-between gap-2">
                                <span className="text-ink-soft font-bold">{desc}</span>
                                <kbd className="font-mono font-black text-[11px] px-2 py-0.5 bg-paper border border-ink rounded-[4px] shadow-hard-xs text-ink whitespace-nowrap">
                                    {key}
                                </kbd>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ShortcutHelp;

