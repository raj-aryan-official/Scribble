import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Share2, ArrowLeft, Settings as SettingsIcon, Crown, Users } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import Avatar from '../components/ui/Avatar';
import Spinner from '../components/ui/Spinner';
import Toast from '../components/ui/Toast';

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

export const Lobby = () => {
    const { code } = useParams();
    const { state, dispatch } = useGame();
    const navigate = useNavigate();
    const socket = useSocket();

    const [toastMessage, setToastMessage] = useState('');
    const [toastVariant, setToastVariant] = useState('info');
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const isHost = Boolean(state.currentUser?.isHost);
    const connectedPlayers = state.players.filter(p => !p.isDisconnected);
    const canStart = connectedPlayers.length >= 2;

    const currentSettings = useMemo(() => state.settings || {
        rounds: 3,
        drawTime: 60,
        difficulty: 'Medium',
        packs: [],
        customWords: [],
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

    // Navigate to game once started
    useEffect(() => {
        if (state.gameState === 'DRAWING' || state.gameState === 'WORD_SELECTION') {
            navigate(`/game/${code}`);
        }
    }, [state.gameState, code, navigate]);

    const showToast = (message, variant = 'info') => {
        setToastMessage(message);
        setToastVariant(variant);
    };

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(true);
            showToast(`Room code ${code} copied to clipboard!`, 'success');
            setTimeout(() => setCopiedCode(false), 2000);
        } catch {
            showToast('Failed to copy room code', 'error');
        }
    };

    const handleShareOrCopyLink = async () => {
        const link = `${window.location.origin}/join/${code}`;
        const shareText = `Come draw with me on Scribble: ${link}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Scribble',
                    text: shareText,
                    url: link,
                });
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
            }
        }

        // Fallback to clipboard
        try {
            await navigator.clipboard.writeText(shareText);
            setCopiedLink(true);
            showToast('Invite link copied to clipboard!', 'success');
            setTimeout(() => setCopiedLink(false), 2000);
        } catch {
            showToast('Failed to copy link', 'error');
        }
    };

    const handleStartGame = () => {
        socket.emit(EVENTS.START_GAME, { roomCode: code });
    };

    const emitUpdateSettings = useCallback((updated) => {
        socket.emit(EVENTS.UPDATE_SETTINGS, {
            roomCode: code,
            settings: {
                ...currentSettings,
                ...updated,
            },
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

    const validCustomWordCount = countValidCustomWords(customWordsText);

    return (
        <div className="flex-1 w-full max-w-[1000px] mx-auto flex flex-col items-center p-4 sm:p-6 md:p-8">
            {/* Feedback Toast */}
            <Toast
                isOpen={Boolean(toastMessage)}
                onClose={() => setToastMessage('')}
                message={toastMessage}
                variant={toastVariant}
            />

            {/* Error Toast */}
            <Toast
                isOpen={Boolean(state.error)}
                onClose={() => dispatch({ type: 'SET_ERROR', payload: null })}
                message={state.error}
                variant="error"
            />

            <div className="w-full max-w-3xl flex flex-col gap-6">
                {/* Top Nav & Room Code Tag Bar */}
                <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card border-2 border-ink shadow-hard rounded-[12px] p-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate('/')}
                            aria-label="Back to home"
                            className="p-2 min-h-[40px] w-[40px]"
                        >
                            <ArrowLeft className="w-5 h-5 text-ink" />
                        </Button>
                        <div>
                            <h1 tabIndex={-1} className="text-2xl font-black font-heading text-ink leading-tight">
                                Game Lobby
                            </h1>
                            <p className="text-xs text-ink-soft">
                                Waiting for players to join
                            </p>
                        </div>
                    </div>

                    {/* Room Code Tag with Copy and Share */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <div
                            className="flex items-center gap-2 bg-paper border-2 border-ink shadow-hard-sm px-3 py-1.5 rounded-[6px]"
                            title="Room Code"
                        >
                            <span className="text-xs font-bold uppercase text-ink-soft">Room</span>
                            <span className="font-mono font-black text-xl text-ink tracking-wider">
                                {code}
                            </span>
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCopyCode}
                            aria-label="Copy room code"
                            className="min-h-[40px] px-3 flex items-center gap-1.5 text-xs font-bold uppercase"
                        >
                            {copiedCode ? <Check className="w-4 h-4 text-leaf" /> : <Copy className="w-4 h-4 text-ink" />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                        </Button>

                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleShareOrCopyLink}
                            aria-label="Share invite link"
                            className="min-h-[40px] px-3 flex items-center gap-1.5 text-xs font-bold uppercase"
                        >
                            {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4 text-white" />}
                            <span>{copiedLink ? 'Copied' : 'Share'}</span>
                        </Button>
                    </div>
                </header>

                {/* Players Section */}
                <section aria-labelledby="players-heading">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-ink" />
                            <h2 id="players-heading" className="text-lg font-bold font-heading text-ink">
                                Players ({state.players.length})
                            </h2>
                        </div>
                        <span className={`text-xs font-bold ${canStart ? 'text-leaf' : 'text-tomato'}`}>
                            {canStart ? 'Ready to play' : 'Need at least 2 players'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <AnimatePresence mode="popLayout">
                            {state.players.map((p) => {
                                const isDisconnected = Boolean(p.isDisconnected);
                                return (
                                    <motion.div
                                        key={p.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.85, y: 15 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                        className={`flex items-center gap-3 p-3 bg-card border-2 border-ink shadow-hard-sm rounded-[12px] relative transition-opacity ${
                                            isDisconnected ? 'opacity-50 border-dashed bg-paper' : ''
                                        }`}
                                    >
                                        <Avatar avatarId={p.avatar} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-ink truncate text-sm sm:text-base">
                                                    {p.username}
                                                </span>
                                                {p.isHost && (
                                                    <span title="Room Host" aria-label="Room Host">
                                                        <Crown className="w-4 h-4 text-marigold fill-marigold shrink-0" />
                                                    </span>
                                                )}
                                            </div>
                                            {isDisconnected && (
                                                <span className="text-[11px] font-bold text-tomato uppercase tracking-wide">
                                                    Disconnected
                                                </span>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </section>

                {/* Host Settings Card */}
                <Card className="flex flex-col gap-5 shadow-hard bg-card">
                    <div className="flex items-center justify-between border-b-2 border-ink/10 pb-3">
                        <div className="flex items-center gap-2">
                            <SettingsIcon className="w-5 h-5 text-ink" />
                            <h2 className="text-lg font-bold font-heading text-ink">
                                {isHost ? 'Game Settings' : 'Room Settings'}
                            </h2>
                        </div>
                        {!isHost && (
                            <Chip variant="default" className="text-[11px]">
                                Host Controlled
                            </Chip>
                        )}
                    </div>

                    {isHost ? (
                        <div className="flex flex-col gap-5">
                            {/* Rounds Selector */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-2">
                                    Rounds
                                </label>
                                <div className="grid grid-cols-6 gap-1.5 bg-paper p-1.5 border-2 border-ink rounded-[6px]">
                                    {ROUND_OPTIONS.map((num) => {
                                        const isSelected = currentSettings.rounds === num;
                                        return (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => handleRoundsChange(num)}
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
                                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-2">
                                    Draw Time
                                </label>
                                <div className="grid grid-cols-4 gap-1.5 bg-paper p-1.5 border-2 border-ink rounded-[6px]">
                                    {DRAW_TIME_OPTIONS.map((time) => {
                                        const isSelected = currentSettings.drawTime === time;
                                        return (
                                            <button
                                                key={time}
                                                type="button"
                                                onClick={() => handleDrawTimeChange(time)}
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
                                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-2">
                                    Difficulty
                                </label>
                                <div className="grid grid-cols-4 gap-1.5 bg-paper p-1.5 border-2 border-ink rounded-[6px]">
                                    {DIFFICULTY_OPTIONS.map((diff) => {
                                        const isSelected = currentSettings.difficulty === diff;
                                        return (
                                            <button
                                                key={diff}
                                                type="button"
                                                onClick={() => handleDifficultyChange(diff)}
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
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-ink">
                                        Themed Word Packs
                                    </label>
                                    <span className="text-xs font-bold text-ink-soft">
                                        {currentSettings.packs?.length > 0
                                            ? `${currentSettings.packs.length} active`
                                            : 'All packs'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_PACKS.map((pack) => {
                                        const isSelected = currentSettings.packs?.includes(pack.id);
                                        return (
                                            <Chip
                                                key={pack.id}
                                                variant={isSelected ? 'leaf' : 'default'}
                                                onClick={() => handleTogglePack(pack.id)}
                                                className="cursor-pointer text-xs py-1.5 px-3"
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
                                <div className="flex items-center justify-between mb-1.5">
                                    <label htmlFor="custom-words-input" className="text-xs font-bold uppercase tracking-wider text-ink">
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
                                    onChange={handleCustomWordsChange}
                                    placeholder="Add comma-separated words: spaceship, pancake, chameleon..."
                                    className="w-full p-3 bg-paper text-ink border-2 border-ink rounded-[6px] text-sm font-body placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none resize-none"
                                />
                                <p className="text-[11px] text-ink-soft mt-1">
                                    Custom words have a ~30% chance of appearing. 3-20 characters each.
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* Read-only view for guests */
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="bg-paper border-2 border-ink p-3 rounded-[6px]">
                                <span className="block text-[11px] font-bold uppercase text-ink-soft">Rounds</span>
                                <span className="text-lg font-black text-ink">{currentSettings.rounds}</span>
                            </div>
                            <div className="bg-paper border-2 border-ink p-3 rounded-[6px]">
                                <span className="block text-[11px] font-bold uppercase text-ink-soft">Draw Time</span>
                                <span className="text-lg font-black text-ink">{currentSettings.drawTime}s</span>
                            </div>
                            <div className="bg-paper border-2 border-ink p-3 rounded-[6px]">
                                <span className="block text-[11px] font-bold uppercase text-ink-soft">Difficulty</span>
                                <span className="text-lg font-black text-ink">{currentSettings.difficulty}</span>
                            </div>
                            <div className="bg-paper border-2 border-ink p-3 rounded-[6px]">
                                <span className="block text-[11px] font-bold uppercase text-ink-soft">Packs</span>
                                <span className="text-sm font-bold text-ink truncate block mt-0.5">
                                    {currentSettings.packs?.length > 0
                                        ? currentSettings.packs.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
                                        : 'All'}
                                </span>
                            </div>
                            {currentSettings.customWords?.length > 0 && (
                                <div className="col-span-2 sm:col-span-4 bg-paper border-2 border-ink p-2.5 rounded-[6px] text-xs font-bold text-ink text-left">
                                    <span>Custom words enabled: </span>
                                    <span className="text-ink-soft font-normal">{currentSettings.customWords.length} words added</span>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Start Game Action / Waiting Status */}
                <div className="flex flex-col gap-2">
                    {isHost ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleStartGame}
                                disabled={!canStart}
                                className="w-full sm:w-auto sm:min-w-[200px] text-lg uppercase tracking-wide"
                            >
                                Start Game
                            </Button>
                            <span className={`text-sm font-bold text-center sm:text-left ${canStart ? 'text-leaf' : 'text-tomato'}`}>
                                {canStart
                                    ? '✓ Ready to begin!'
                                    : 'Need at least 2 players to start'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-3 py-4 bg-card border-2 border-ink shadow-hard-sm rounded-[12px] text-ink font-bold">
                            <Spinner size="sm" label="Waiting for host" />
                            <span>Waiting for host to start the game...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Lobby;
