import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { Copy, Check, Share2, Home, Settings as SettingsIcon } from 'lucide-react';
import { EVENTS } from '../../../shared/types';

const ROUND_OPTIONS = [2, 3, 5, 7, 10, 12];
const DRAW_TIME_OPTIONS = [60, 80, 100, 120];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard', 'Mixed'];
const AVAILABLE_PACKS = [
    { id: 'animals', label: 'Animals' },
    { id: 'food', label: 'Food' },
    { id: 'places', label: 'Places' },
    { id: 'objects', label: 'Objects' },
    { id: 'actions', label: 'Actions' }
];

const countValidCustomWords = (text) => {
    if (!text || typeof text !== 'string') return 0;
    const parts = text.split(',');
    const seen = new Set();
    let count = 0;
    for (const part of parts) {
        const clean = part.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim();
        if (clean.length >= 3 && clean.length <= 20) {
            if (!seen.has(clean)) {
                seen.add(clean);
                count++;
            }
        }
    }
    return Math.min(count, 50);
};

const Lobby = () => {
    const { code } = useParams();
    const { state, dispatch } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();

    const isHost = state.currentUser?.isHost;
    const canStart = state.players.filter(p => !p.isDisconnected).length >= 2;

    const currentSettings = useMemo(() => state.settings || {
        rounds: 3,
        drawTime: 60,
        difficulty: 'Medium',
        packs: [],
        customWords: []
    }, [state.settings]);

    const [customWordsText, setCustomWordsText] = useState(() => {
        return Array.isArray(currentSettings.customWords) ? currentSettings.customWords.join(', ') : '';
    });

    const isTypingCustomWords = useRef(false);

    // Sync external customWords if not currently typing
    useEffect(() => {
        if (!isTypingCustomWords.current && Array.isArray(currentSettings.customWords)) {
            const externalStr = currentSettings.customWords.join(', ');
            setCustomWordsText(externalStr);
        }
    }, [currentSettings.customWords]);

    useEffect(() => {
        if (state.gameState === 'DRAWING' || state.gameState === 'WORD_SELECTION') {
            navigate(`/game/${code}`);
        }
    }, [state.gameState, code, navigate]);

    useEffect(() => {
        if (state.error) {
            const timer = setTimeout(() => {
                dispatch({ type: 'SET_ERROR', payload: null });
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [state.error, dispatch]);

    const handleStartGame = () => {
        socket.emit(EVENTS.START_GAME, { roomCode: code });
    };

    const emitUpdateSettings = useCallback((updated) => {
        socket.emit(EVENTS.UPDATE_SETTINGS, {
            roomCode: code,
            settings: {
                ...currentSettings,
                ...updated
            }
        });
    }, [socket, code, currentSettings]);

    const handleRoundsChange = (rounds) => {
        emitUpdateSettings({ rounds });
    };

    const handleDrawTimeChange = (drawTime) => {
        emitUpdateSettings({ drawTime });
    };

    const handleDifficultyChange = (difficulty) => {
        emitUpdateSettings({ difficulty });
    };

    const handleTogglePack = (packId) => {
        const active = currentSettings.packs || [];
        const isSelected = active.includes(packId);
        const nextPacks = isSelected
            ? active.filter(p => p !== packId)
            : [...active, packId];
        emitUpdateSettings({ packs: nextPacks });
    };

    // Debounce custom words updates
    useEffect(() => {
        if (!isHost) return;
        const handler = setTimeout(() => {
            isTypingCustomWords.current = false;
            emitUpdateSettings({ customWords: customWordsText });
        }, 500);

        return () => clearTimeout(handler);
    }, [customWordsText, isHost, emitUpdateSettings]);

    const handleCustomWordsChange = (e) => {
        isTypingCustomWords.current = true;
        setCustomWordsText(e.target.value);
    };

    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const handleCopyLink = () => {
        const link = `${window.location.origin}/join/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const validCustomWordCount = countValidCustomWords(customWordsText);

    return (
        <div className="flex flex-col items-center h-full p-4 md:p-8 bg-background overflow-y-auto">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-2xl">
                {state.error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm font-semibold flex items-center justify-between animate-in fade-in">
                        <span>⚠️ {state.error}</span>
                        <button
                            onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
                            className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="flex flex-row justify-between items-center mb-6 gap-1 md:gap-4 overflow-x-hidden">
                    <div className="flex items-center gap-1 md:gap-3 shrink-0">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="p-1.5 md:p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition active:scale-95 shrink-0"
                            title="Back to Home"
                        >
                            <Home size={18} className="md:w-6 md:h-6" />
                        </button>
                        <h1 className="text-xl md:text-3xl font-heading text-primary truncate leading-none">Lobby</h1>
                    </div>

                    <div className="flex gap-1.5 md:gap-2 items-center shrink-0">
                        <div
                            className="bg-secondary text-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-xs md:text-lg flex items-center gap-1 md:gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-purple-600 shadow-sm whitespace-nowrap"
                            onClick={handleCopyCode}
                            title="Copy Room Code"
                        >
                            <span className="font-mono">{code}</span>
                            {copiedCode ? <Check size={14} className="md:w-[18px] md:h-[18px]" /> : <Copy size={14} className="md:w-[18px] md:h-[18px]" />}
                        </div>
                        <div
                            className="bg-accent text-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-xs md:text-lg flex items-center gap-1 md:gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-pink-600 shadow-sm"
                            onClick={handleCopyLink}
                            title="Copy Invite Link"
                        >
                            <Share2 size={14} className="md:w-[18px] md:h-[18px]" />
                            {copiedLink ? <Check size={14} className="md:w-[18px] md:h-[18px]" /> : null}
                        </div>
                    </div>
                </div>

                {/* GAME SETTINGS CARD */}
                <div className="mb-8 p-4 md:p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-inner">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <SettingsIcon size={20} className="text-primary" />
                            <h2 className="text-lg md:text-xl font-bold text-gray-800">
                                {isHost ? 'Game Settings' : 'Room Settings'}
                            </h2>
                        </div>
                        {!isHost && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">
                                Host Controlled
                            </span>
                        )}
                    </div>

                    {isHost ? (
                        <div className="space-y-4">
                            {/* Rounds Segmented Control */}
                            <div>
                                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5">
                                    Rounds
                                </label>
                                <div className="grid grid-cols-6 gap-1 bg-gray-200 p-1 rounded-lg">
                                    {ROUND_OPTIONS.map(rounds => (
                                        <button
                                            key={rounds}
                                            type="button"
                                            onClick={() => handleRoundsChange(rounds)}
                                            className={`py-1.5 text-xs md:text-sm font-bold rounded-md transition-all cursor-pointer ${
                                                currentSettings.rounds === rounds
                                                    ? 'bg-primary text-white shadow-sm'
                                                    : 'text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            {rounds}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Draw Time Segmented Control */}
                            <div>
                                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5">
                                    Draw Time
                                </label>
                                <div className="grid grid-cols-4 gap-1 bg-gray-200 p-1 rounded-lg">
                                    {DRAW_TIME_OPTIONS.map(time => (
                                        <button
                                            key={time}
                                            type="button"
                                            onClick={() => handleDrawTimeChange(time)}
                                            className={`py-1.5 text-xs md:text-sm font-bold rounded-md transition-all cursor-pointer ${
                                                currentSettings.drawTime === time
                                                    ? 'bg-primary text-white shadow-sm'
                                                    : 'text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            {time}s
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Difficulty Segmented Control */}
                            <div>
                                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5">
                                    Word Difficulty
                                </label>
                                <div className="grid grid-cols-4 gap-1 bg-gray-200 p-1 rounded-lg">
                                    {DIFFICULTY_OPTIONS.map(diff => (
                                        <button
                                            key={diff}
                                            type="button"
                                            onClick={() => handleDifficultyChange(diff)}
                                            className={`py-1.5 text-xs md:text-sm font-bold rounded-md transition-all cursor-pointer ${
                                                currentSettings.difficulty === diff
                                                    ? 'bg-primary text-white shadow-sm'
                                                    : 'text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            {diff}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Word Packs Multi-Select Chips */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs md:text-sm font-semibold text-gray-700">
                                        Themed Word Packs
                                    </label>
                                    <span className="text-xs text-gray-500">
                                        {(currentSettings.packs && currentSettings.packs.length > 0)
                                            ? `${currentSettings.packs.length} pack(s) selected`
                                            : 'All packs active'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_PACKS.map(pack => {
                                        const isSelected = currentSettings.packs && currentSettings.packs.includes(pack.id);
                                        return (
                                            <button
                                                key={pack.id}
                                                type="button"
                                                onClick={() => handleTogglePack(pack.id)}
                                                className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium border transition-all cursor-pointer active:scale-95 ${
                                                    isSelected
                                                        ? 'bg-secondary text-white border-secondary shadow-sm'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                {isSelected ? '✓ ' : ''}{pack.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Words Debounced Textarea */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs md:text-sm font-semibold text-gray-700">
                                        Custom Words
                                    </label>
                                    <span className={`text-xs font-semibold ${validCustomWordCount >= 50 ? 'text-amber-600' : 'text-gray-500'}`}>
                                        {validCustomWordCount} / 50 words
                                    </span>
                                </div>
                                <textarea
                                    rows={2}
                                    value={customWordsText}
                                    onChange={handleCustomWordsChange}
                                    placeholder="Add custom words separated by commas (e.g. dinosaur, lighthouse, unicorn)"
                                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-xs md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                    Custom words will be mixed into word selection (~30% chance). 3-20 characters each.
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* Read-Only Summary for Guests */
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                <span className="block text-[11px] text-gray-500 font-semibold uppercase">Rounds</span>
                                <span className="text-base font-bold text-gray-800">{currentSettings.rounds}</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                <span className="block text-[11px] text-gray-500 font-semibold uppercase">Draw Time</span>
                                <span className="text-base font-bold text-gray-800">{currentSettings.drawTime}s</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                <span className="block text-[11px] text-gray-500 font-semibold uppercase">Difficulty</span>
                                <span className="text-base font-bold text-gray-800">{currentSettings.difficulty}</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                <span className="block text-[11px] text-gray-500 font-semibold uppercase">Packs</span>
                                <span className="text-base font-bold text-gray-800 truncate block">
                                    {(currentSettings.packs && currentSettings.packs.length > 0)
                                        ? currentSettings.packs.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
                                        : 'All'}
                                </span>
                            </div>
                            {currentSettings.customWords && currentSettings.customWords.length > 0 && (
                                <div className="col-span-2 md:col-span-4 bg-white p-2 rounded-lg border border-gray-200 text-xs text-gray-600">
                                    <span className="font-semibold text-gray-800">Custom Words: </span>
                                    {currentSettings.customWords.length} added by host
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* PLAYERS LIST */}
                <div className="mb-8">
                    <h2 className="text-xl md:text-2xl mb-4 font-bold text-gray-700 flex items-center justify-between">
                        <span>Players ({state.players.length})</span>
                        <span className="text-xs md:text-sm font-semibold text-gray-500">
                            {canStart ? '✅ Ready to start' : '⚠️ Need at least 2 players'}
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {state.players.map(p => (
                            <div key={p.id} className={`flex items-center p-3 md:p-4 rounded-lg border shadow-sm transition-all ${p.isDisconnected ? 'bg-gray-100 opacity-60 border-dashed' : 'bg-gray-50'}`}>
                                <span className="text-2xl md:text-4xl mr-3 md:mr-4">{p.avatar}</span>
                                <span className="font-bold text-base md:text-xl text-gray-800 truncate">{p.username}</span>
                                {p.isDisconnected && (
                                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-gray-200 text-gray-600 rounded">away</span>
                                )}
                                {p.isHost && <span className="ml-auto text-yellow-500 text-base md:text-2xl">👑</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* START GAME / WAITING */}
                {isHost ? (
                    <div className="space-y-2">
                        <button
                            onClick={handleStartGame}
                            disabled={!canStart}
                            className={`w-full py-3 md:py-4 rounded-lg font-bold text-xl md:text-2xl transition shadow-lg ${
                                canStart
                                    ? 'bg-accent text-white hover:bg-red-500 active:scale-95 cursor-pointer'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-80'
                            }`}
                        >
                            {canStart ? 'Start Game' : 'Need 2+ Players to Start'}
                        </button>
                        {!canStart && (
                            <p className="text-center text-xs md:text-sm text-gray-500">
                                Scribble requires at least 2 players. Copy the invite link and open an <strong>Incognito / Private tab</strong> (or second browser) to join as Player 2.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 animate-pulse text-base md:text-lg">
                        Waiting for host to start...
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lobby;
