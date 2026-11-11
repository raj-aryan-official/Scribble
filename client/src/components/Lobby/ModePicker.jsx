import React from 'react';
import { Pencil, Zap, Users, GitMerge, Flame, Sliders, Dices } from 'lucide-react';
import Card from '../ui/Card';
import Chip from '../ui/Chip';
import { MODE_DEFINITIONS, ALLOWED_MODES } from '../../../../shared/types';

const ICONS = {
    pencil: Pencil,
    zap: Zap,
    users: Users,
    'git-merge': GitMerge,
    flame: Flame,
    sliders: Sliders
};

export const ModePicker = ({
    isHost = false,
    currentMode = 'classic',
    settings = {},
    players = [],
    onModeChange,
    onTeamCountChange,
    onHintsChange,
    onScoreMultiplierChange,
    onRandomizeTeams,
    onRoundsChange,
    onDrawTimeChange,
}) => {
    const activeModeId = currentMode || settings.mode || 'classic';
    const activeDef = MODE_DEFINITIONS[activeModeId] || MODE_DEFINITIONS.classic;

    if (!isHost) {
        // Non-host read-only view
        const IconComponent = ICONS[activeDef.icon] || Pencil;
        return (
            <div data-testid="readonly-mode" className="bg-paper border-2 border-ink p-3 rounded-[6px] flex flex-col gap-1.5 text-left">
                <div className="flex items-center gap-2">
                    <span className="p-1 rounded-[4px] bg-marigold border border-ink text-ink">
                        <IconComponent className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-black uppercase text-ink-soft">
                        Game Mode
                    </span>
                    <span className="text-sm font-black text-ink ml-auto">
                        {activeDef.name}
                    </span>
                </div>
                <p className="text-xs font-bold text-ink-soft">
                    {activeDef.description}
                </p>

                {activeModeId === 'team' && (
                    <div className="mt-1 pt-2 border-t border-ink/10 flex flex-wrap gap-1.5" data-testid="readonly-team-list">
                        {['team-red', 'team-blue', 'team-green', 'team-yellow'].slice(0, settings.teamCount || 2).map((tId) => {
                            const teamNames = {
                                'team-red': 'Team Red',
                                'team-blue': 'Team Blue',
                                'team-green': 'Team Green',
                                'team-yellow': 'Team Yellow'
                            };
                            const teamColors = {
                                'team-red': '#EF4444',
                                'team-blue': '#3B82F6',
                                'team-green': '#10B981',
                                'team-yellow': '#F59E0B'
                            };
                            const members = players.filter(p => p.teamId === tId);
                            return (
                                <span
                                    key={tId}
                                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-[4px] border border-ink text-white"
                                    style={{ backgroundColor: teamColors[tId] }}
                                >
                                    {teamNames[tId]} ({members.length})
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2.5" data-testid="mode-picker">
            <label className="block text-xs font-black uppercase tracking-wider text-ink">
                Game Mode
            </label>

            {/* Mode selection grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALLOWED_MODES.map((mId) => {
                    const def = MODE_DEFINITIONS[mId];
                    if (!def) return null;
                    const Icon = ICONS[def.icon] || Pencil;
                    const isSelected = activeModeId === mId;

                    return (
                        <button
                            key={mId}
                            type="button"
                            data-testid={`mode-card-${mId}`}
                            onClick={() => onModeChange?.(mId)}
                            className={`p-2.5 rounded-[6px] border-2 text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-1 min-h-[72px] ${
                                isSelected
                                    ? 'bg-marigold text-ink border-ink shadow-hard-xs'
                                    : 'bg-paper text-ink border-ink/40 hover:border-ink hover:bg-card'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <span className="font-heading font-black text-xs sm:text-sm">
                                    {def.name}
                                </span>
                                <Icon className="w-4 h-4 text-ink shrink-0" />
                            </div>
                            <span
                                className={`text-[10px] font-bold leading-tight line-clamp-2 ${
                                    isSelected ? 'text-ink' : 'text-ink-soft'
                                }`}
                            >
                                {def.description}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Team Mode Specific Controls */}
            {activeModeId === 'team' && (
                <div className="p-3 bg-paper border-2 border-ink rounded-[6px] flex flex-col gap-2.5 mt-1" data-testid="team-mode-settings">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wide text-ink">
                            Number of Teams
                        </span>
                        <div className="flex gap-1">
                            {[2, 3, 4].map((count) => {
                                const isSelected = (settings.teamCount || 2) === count;
                                return (
                                    <button
                                        key={count}
                                        type="button"
                                        data-testid={`team-count-${count}`}
                                        onClick={() => onTeamCountChange?.(count)}
                                        className={`px-2.5 py-0.5 text-xs font-black rounded-[4px] border-2 ${
                                            isSelected
                                                ? 'bg-tomato text-white border-ink shadow-hard-xs'
                                                : 'bg-card text-ink border-ink/40 hover:border-ink'
                                        }`}
                                    >
                                        {count}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-ink/10">
                        <span className="text-xs font-bold text-ink-soft">
                            Roster Distribution
                        </span>
                        <button
                            type="button"
                            data-testid="randomize-teams-btn"
                            onClick={() => onRandomizeTeams?.()}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-black rounded-[4px] bg-card border border-ink hover:bg-paper cursor-pointer shadow-hard-xs"
                        >
                            <Dices className="w-3.5 h-3.5" />
                            Randomise Teams
                        </button>
                    </div>

                    {/* Team Rosters preview */}
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {['team-red', 'team-blue', 'team-green', 'team-yellow'].slice(0, settings.teamCount || 2).map((tId) => {
                            const teamNames = {
                                'team-red': 'Team Red',
                                'team-blue': 'Team Blue',
                                'team-green': 'Team Green',
                                'team-yellow': 'Team Yellow'
                            };
                            const teamColors = {
                                'team-red': '#EF4444',
                                'team-blue': '#3B82F6',
                                'team-green': '#10B981',
                                'team-yellow': '#F59E0B'
                            };
                            const members = players.filter(p => p.teamId === tId);
                            return (
                                <div key={tId} className="p-1.5 rounded-[4px] border border-ink bg-card flex flex-col gap-0.5">
                                    <span
                                        className="text-[10px] font-black uppercase text-white px-1.5 py-0.5 rounded-[3px] self-start"
                                        style={{ backgroundColor: teamColors[tId] }}
                                    >
                                        {teamNames[tId]}
                                    </span>
                                    <span className="text-[11px] font-bold text-ink-soft truncate">
                                        {members.length > 0 ? members.map(m => m.username).join(', ') : 'No players'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Custom Mode Specific Controls */}
            {activeModeId === 'custom' && (
                <div className="p-3 bg-paper border-2 border-ink rounded-[6px] flex flex-col gap-2.5 mt-1" data-testid="custom-mode-settings">
                    {/* Draw Time */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wide text-ink">
                            Time: {settings.drawTime || 60}s
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {[15, 30, 45, 60, 80, 100, 120].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    data-testid={`custom-time-${t}`}
                                    onClick={() => onDrawTimeChange?.(t)}
                                    className={`px-1.5 py-0.5 text-[11px] font-black rounded-[4px] border ${
                                        (settings.drawTime || 60) === t
                                            ? 'bg-tomato text-white border-ink shadow-hard-xs'
                                            : 'bg-card text-ink border-ink/40'
                                    }`}
                                >
                                    {t}s
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hints */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wide text-ink">
                            Hint Count: {settings.hints ?? 2}
                        </span>
                        <div className="flex gap-1">
                            {[0, 1, 2, 3, 4].map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    data-testid={`custom-hints-${h}`}
                                    onClick={() => onHintsChange?.(h)}
                                    className={`px-2 py-0.5 text-xs font-black rounded-[4px] border ${
                                        (settings.hints ?? 2) === h
                                            ? 'bg-tomato text-white border-ink shadow-hard-xs'
                                            : 'bg-card text-ink border-ink/40'
                                    }`}
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Score Multiplier */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wide text-ink">
                            Score Multiplier: {settings.scoreMultiplier || 1.0}x
                        </span>
                        <div className="flex gap-1">
                            {[0.5, 1.0, 1.5, 2.0].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    data-testid={`custom-mult-${m}`}
                                    onClick={() => onScoreMultiplierChange?.(m)}
                                    className={`px-2 py-0.5 text-xs font-black rounded-[4px] border ${
                                        (settings.scoreMultiplier || 1.0) === m
                                            ? 'bg-tomato text-white border-ink shadow-hard-xs'
                                            : 'bg-card text-ink border-ink/40'
                                    }`}
                                >
                                    {m}x
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rounds */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wide text-ink">
                            Rounds: {settings.rounds || 3}
                        </span>
                        <div className="flex gap-1">
                            {[1, 2, 3, 5, 8, 12].map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    data-testid={`custom-rounds-${r}`}
                                    onClick={() => onRoundsChange?.(r)}
                                    className={`px-2 py-0.5 text-xs font-black rounded-[4px] border ${
                                        (settings.rounds || 3) === r
                                            ? 'bg-tomato text-white border-ink shadow-hard-xs'
                                            : 'bg-card text-ink border-ink/40'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModePicker;
