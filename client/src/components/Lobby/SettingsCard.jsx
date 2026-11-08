import React from 'react';
import { Lock, Settings as SettingsIcon } from 'lucide-react';
import Card from '../ui/Card';
import Chip from '../ui/Chip';

const ROUND_OPTIONS = [2, 3, 5, 7, 10, 12];
const DRAW_TIME_OPTIONS = [60, 80, 100, 120];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard', 'Mixed'];
const AVAILABLE_PACKS = [
    { id: 'animals', label: 'Animals' },
    { id: 'food', label: 'Food' },
    { id: 'places', label: 'Places' },
    { id: 'objects', label: 'Objects' },
    { id: 'actions', label: 'Actions' },
];

export const SettingsCard = ({
    isHost = false,
    hostName = 'the host',
    settings = {},
    customWordsText = '',
    onCustomWordsChange,
    onRoundsChange,
    onDrawTimeChange,
    onDifficultyChange,
    onTogglePack,
    validCustomWordCount = 0,
}) => {
    const currentPacks = settings.packs || [];

    return (
        <Card className="flex flex-col gap-5 shadow-hard bg-card p-4 sm:p-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-ink/10 pb-3">
                <div className="flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-ink" />
                    <h2 className="text-lg font-black font-heading text-ink">
                        {isHost ? 'Game Rules' : 'Room Rules'}
                    </h2>
                </div>
                {!isHost && (
                    <div className="flex items-center gap-1.5 text-ink-soft bg-paper border border-ink/30 px-2 py-0.5 rounded-[4px]">
                        <Lock className="w-3.5 h-3.5 text-ink-soft shrink-0" />
                        <span className="text-[11px] font-bold">
                            Only {hostName} can change these.
                        </span>
                    </div>
                )}
            </div>

            {isHost ? (
                /* Host Interactive Controls */
                <div className="flex flex-col gap-4">
                    {/* Rounds Selector */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-ink mb-1.5">
                            Rounds
                        </label>
                        <div className="grid grid-cols-6 gap-1 bg-paper p-1 border-2 border-ink rounded-[6px]">
                            {ROUND_OPTIONS.map((num) => {
                                const isSelected = settings.rounds === num;
                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => onRoundsChange?.(num)}
                                        className={`py-1.5 text-xs sm:text-sm font-bold rounded-[4px] transition-all cursor-pointer select-none ${
                                            isSelected
                                                ? 'bg-tomato text-white border-2 border-ink shadow-hard-sm'
                                                : 'text-ink hover:bg-card border-2 border-transparent'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Draw Time Selector */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-ink mb-1.5">
                            Draw Time
                        </label>
                        <div className="grid grid-cols-4 gap-1 bg-paper p-1 border-2 border-ink rounded-[6px]">
                            {DRAW_TIME_OPTIONS.map((time) => {
                                const isSelected = settings.drawTime === time;
                                return (
                                    <button
                                        key={time}
                                        type="button"
                                        onClick={() => onDrawTimeChange?.(time)}
                                        className={`py-1.5 text-xs sm:text-sm font-bold rounded-[4px] transition-all cursor-pointer select-none ${
                                            isSelected
                                                ? 'bg-tomato text-white border-2 border-ink shadow-hard-sm'
                                                : 'text-ink hover:bg-card border-2 border-transparent'
                                        }`}
                                    >
                                        {time}s
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Word Difficulty Selector */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-ink mb-1.5">
                            Difficulty
                        </label>
                        <div className="grid grid-cols-4 gap-1 bg-paper p-1 border-2 border-ink rounded-[6px]">
                            {DIFFICULTY_OPTIONS.map((diff) => {
                                const isSelected = settings.difficulty === diff;
                                return (
                                    <button
                                        key={diff}
                                        type="button"
                                        onClick={() => onDifficultyChange?.(diff)}
                                        className={`py-1.5 text-xs sm:text-sm font-bold rounded-[4px] transition-all cursor-pointer select-none ${
                                            isSelected
                                                ? 'bg-tomato text-white border-2 border-ink shadow-hard-sm'
                                                : 'text-ink hover:bg-card border-2 border-transparent'
                                        }`}
                                    >
                                        {diff}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Themed Word Packs */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-black uppercase tracking-wider text-ink">
                                Themed Word Packs
                            </label>
                            <span className="text-xs font-bold text-ink-soft">
                                {currentPacks.length > 0 ? `${currentPacks.length} active` : 'All packs'}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {AVAILABLE_PACKS.map((pack) => {
                                const isSelected = currentPacks.includes(pack.id);
                                return (
                                    <Chip
                                        key={pack.id}
                                        variant={isSelected ? 'leaf' : 'default'}
                                        onClick={() => onTogglePack?.(pack.id)}
                                        className="cursor-pointer text-xs py-1 px-2.5"
                                    >
                                        {isSelected ? '✓ ' : '+ '}
                                        {pack.label}
                                    </Chip>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Words */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor="custom-words-input" className="text-xs font-black uppercase tracking-wider text-ink">
                                Custom Words
                            </label>
                            <span className={`text-xs font-bold ${validCustomWordCount >= 50 ? 'text-tomato' : 'text-ink-soft'}`}>
                                {validCustomWordCount} / 50 words
                            </span>
                        </div>
                        <textarea
                            id="custom-words-input"
                            rows={2}
                            value={customWordsText}
                            onChange={onCustomWordsChange}
                            placeholder="spaceship, pancake, chameleon..."
                            className="w-full p-2.5 bg-paper text-ink border-2 border-ink rounded-[6px] text-xs sm:text-sm font-body placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none resize-none"
                        />
                        <p className="text-[11px] text-ink-soft mt-1">
                            Custom words have a ~30% chance of appearing. 3-20 characters each.
                        </p>
                    </div>
                </div>
            ) : (
                /* Non-Host Read-Only Summary */
                <div className="flex flex-col gap-3">
                    <div className="p-3 bg-paper border-2 border-ink/20 rounded-[8px] flex items-center gap-2">
                        <Lock className="w-4 h-4 text-ink-soft shrink-0" />
                        <span className="text-xs font-bold text-ink-soft">
                            Only {hostName} can change these.
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-paper border-2 border-ink p-2.5 rounded-[6px]">
                            <span className="block text-[10px] font-black uppercase text-ink-soft">Rounds</span>
                            <span className="text-base font-black text-ink">{settings.rounds || 3}</span>
                        </div>
                        <div className="bg-paper border-2 border-ink p-2.5 rounded-[6px]">
                            <span className="block text-[10px] font-black uppercase text-ink-soft">Draw Time</span>
                            <span className="text-base font-black text-ink">{settings.drawTime || 60}s</span>
                        </div>
                        <div className="bg-paper border-2 border-ink p-2.5 rounded-[6px]">
                            <span className="block text-[10px] font-black uppercase text-ink-soft">Difficulty</span>
                            <span className="text-base font-black text-ink">{settings.difficulty || 'Medium'}</span>
                        </div>
                        <div className="bg-paper border-2 border-ink p-2.5 rounded-[6px]">
                            <span className="block text-[10px] font-black uppercase text-ink-soft">Packs</span>
                            <span className="text-xs font-black text-ink truncate block mt-0.5">
                                {currentPacks.length > 0
                                    ? currentPacks.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
                                    : 'All Packs'}
                            </span>
                        </div>
                    </div>

                    {settings.customWords?.length > 0 && (
                        <div className="bg-paper border-2 border-ink p-2 rounded-[6px] text-xs font-bold text-ink text-left">
                            <span>Custom words: </span>
                            <span className="text-ink-soft font-normal">{settings.customWords.length} words added</span>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

export default SettingsCard;
