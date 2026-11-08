import React, { useEffect, useState, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, ChevronUp, Settings as SettingsIcon } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { useSound } from '../hooks/useSound';
import { EVENTS } from '../../../shared/types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import PlayerTag from '../components/Lobby/PlayerTag';
import EmptyPlayerSlots from '../components/Lobby/EmptyPlayerSlots';
import RoomCard from '../components/Lobby/RoomCard';
import SettingsCard from '../components/Lobby/SettingsCard';
import StartGameBar from '../components/Lobby/StartGameBar';
import AvatarEditModal from '../components/Lobby/AvatarEditModal';

const LazyQRCodeDisplay = lazy(() => import('../components/Lobby/QRCodeDisplay'));

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
    const { play } = useSound();

    const [toastMessage, setToastMessage] = useState('');
    const [toastVariant, setToastVariant] = useState('info');
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [playerToKick, setPlayerToKick] = useState(null);
    const [countdown, setCountdown] = useState(null);

    // Live announcements for screen readers
    const [playerAnnouncement, setPlayerAnnouncement] = useState('');
    const [copyAnnouncement, setCopyAnnouncement] = useState('');

    const isHost = Boolean(state.currentUser?.isHost);
    const hostPlayer = state.players.find((p) => p.isHost) || { username: 'Host' };
    const connectedPlayers = state.players.filter((p) => !p.isDisconnected);
    const canStart = connectedPlayers.length >= 2;

    // Mobile collapsible settings: closed by default for non-hosts
    const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

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

    // Announce player joins / leaves and play pop sound
    const prevPlayerMapRef = useRef(new Map());
    const isFirstMountRef = useRef(true);

    useEffect(() => {
        const currentMap = new Map(state.players.map((p) => [p.id, p.username]));

        if (!isFirstMountRef.current) {
            // New players joined
            for (const [id, username] of currentMap.entries()) {
                if (!prevPlayerMapRef.current.has(id)) {
                    play('joinPop');
                    setPlayerAnnouncement(`${username} joined`);
                }
            }
            // Players left
            for (const [id, username] of prevPlayerMapRef.current.entries()) {
                if (!currentMap.has(id)) {
                    setPlayerAnnouncement(`${username} left`);
                }
            }
        } else {
            isFirstMountRef.current = false;
        }

        prevPlayerMapRef.current = currentMap;
    }, [state.players, play]);

    // Cancel countdown if player count drops below 2
    useEffect(() => {
        if (countdown !== null && !canStart) {
            setCountdown(null);
            setToastMessage('Start cancelled: need at least 2 players');
            setToastVariant('error');
        }
    }, [canStart, countdown]);

    // Countdown tick timer
    useEffect(() => {
        if (countdown === null) return;

        if (countdown > 1) {
            const timer = setTimeout(() => {
                setCountdown((prev) => (prev ? prev - 1 : null));
                play('tick');
            }, 1000);
            return () => clearTimeout(timer);
        }

        if (countdown === 1) {
            const timer = setTimeout(() => {
                setCountdown(null);
                socket.emit(EVENTS.START_GAME, { roomCode: code });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown, code, socket, play]);

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
            setCopyAnnouncement(`Room code ${code} copied to clipboard`);
            showToast(`Room code ${code} copied!`, 'success');
            setTimeout(() => setCopiedCode(false), 1500);
        } catch {
            showToast('Failed to copy room code', 'error');
        }
    };

    const handleCopyLink = async () => {
        const link = `${window.location.origin}/join/${code}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedLink(true);
            setCopyAnnouncement('Invite link copied to clipboard');
            showToast('Invite link copied to clipboard!', 'success');
            setTimeout(() => setCopiedLink(false), 1500);
        } catch {
            showToast('Failed to copy link', 'error');
        }
    };

    const handleShare = async () => {
        const link = `${window.location.origin}/join/${code}`;
        const shareText = `Come draw with me on Scribble: ${link}`;

        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: 'Scribble',
                    text: shareText,
                    url: link,
                });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }

        // Fallback to clipboard
        handleCopyLink();
    };

    const handleStartOrCancel = () => {
        if (countdown !== null) {
            // Cancel countdown
            setCountdown(null);
            showToast('Game start cancelled', 'info');
        } else if (canStart) {
            // Begin countdown
            setCountdown(3);
            play('tick');
        }
    };

    const handleConfirmKick = () => {
        if (!playerToKick) return;
        socket.emit(EVENTS.KICK_PLAYER, { roomCode: code, playerId: playerToKick.id });
        showToast(`Kicked ${playerToKick.username}`, 'info');
        setPlayerToKick(null);
    };

    const handleSaveAvatar = (newAvatar) => {
        socket.emit(EVENTS.EDIT_PROFILE, { roomCode: code, avatar: newAvatar });
        try {
            localStorage.setItem('scribble_avatar', newAvatar);
        } catch {
            // Ignore storage errors
        }
    };

    const emitUpdateSettings = useCallback((updated) => {
        if (!isHost) return;
        socket.emit(EVENTS.UPDATE_SETTINGS, {
            roomCode: code,
            settings: {
                ...currentSettings,
                ...updated,
            },
        });
    }, [isHost, socket, code, currentSettings]);

    const handleRoundsChange = (rounds) => emitUpdateSettings({ rounds });
    const handleDrawTimeChange = (drawTime) => emitUpdateSettings({ drawTime });
    const handleDifficultyChange = (difficulty) => emitUpdateSettings({ difficulty });

    const handleTogglePack = (packId) => {
        const active = currentSettings.packs || [];
        const isSelected = active.includes(packId);
        const nextPacks = isSelected
            ? active.filter((p) => p !== packId)
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
    const isAloneInRoom = state.players.length === 1;

    return (
        <div className="flex-1 w-full max-w-[1000px] mx-auto flex flex-col p-4 sm:p-6 md:p-8 pb-32 md:pb-8">
            {/* Live announcements */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {playerAnnouncement}
            </div>
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {copyAnnouncement}
            </div>

            {/* Feedback & Error Toasts */}
            <Toast
                isOpen={Boolean(toastMessage)}
                onClose={() => setToastMessage('')}
                message={toastMessage}
                variant={toastVariant}
            />
            <Toast
                isOpen={Boolean(state.error)}
                onClose={() => dispatch({ type: 'SET_ERROR', payload: null })}
                message={state.error}
                variant="error"
            />

            {/* Kick Player Confirm Modal */}
            <Modal
                isOpen={Boolean(playerToKick)}
                onClose={() => setPlayerToKick(null)}
                title={`Kick ${playerToKick?.username} from room?`}
                description="They cannot rejoin this game."
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-ink-soft">
                        They cannot rejoin this game.
                    </p>
                    <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-ink/10">
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={() => setPlayerToKick(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            className="bg-tomato hover:bg-tomato-deep text-white"
                            onClick={handleConfirmKick}
                        >
                            Kick {playerToKick?.username}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Avatar Edit Modal */}
            <AvatarEditModal
                isOpen={isAvatarModalOpen}
                onClose={() => setIsAvatarModalOpen(false)}
                currentAvatar={state.currentUser?.avatar || 'avatar-1'}
                onSave={handleSaveAvatar}
            />

            {/* Mobile Top Room Tag & Share Row (<md) */}
            <div className="block md:hidden mb-4">
                <RoomCard
                    code={code}
                    copiedCode={copiedCode}
                    copiedLink={copiedLink}
                    onCopyCode={handleCopyCode}
                    onCopyLink={handleCopyLink}
                    onShare={handleShare}
                    showQR={showQR}
                    onToggleQR={() => setShowQR(!showQR)}
                >
                    {showQR && (
                        <Suspense
                            fallback={
                                <div className="p-3 bg-paper border-2 border-ink rounded-[8px] text-xs font-bold text-center">
                                    Loading QR...
                                </div>
                            }
                        >
                            <LazyQRCodeDisplay
                                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`}
                                onClose={() => setShowQR(false)}
                                onCopied={(msg) => showToast(msg, 'success')}
                            />
                        </Suspense>
                    )}
                </RoomCard>
            </div>

            {/* Main Desktop Two-Thirds / One-Third Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left Two-Thirds: Paper Desk / Players */}
                <section
                    aria-labelledby="players-heading"
                    className="md:col-span-7 lg:col-span-7 flex flex-col gap-4 bg-card/60 border-2 border-ink shadow-hard rounded-[16px] p-4 sm:p-6"
                >
                    {/* Players Header */}
                    <div className="flex items-center justify-between border-b-2 border-ink/10 pb-3">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-ink" />
                            <h1
                                id="players-heading"
                                className="text-xl sm:text-2xl font-black font-heading text-ink leading-none"
                            >
                                Players ({state.players.length})
                            </h1>
                        </div>
                        <span
                            className={`text-xs font-black uppercase px-2.5 py-1 rounded-[4px] border border-ink ${
                                canStart ? 'bg-leaf/15 text-leaf-deep' : 'bg-tomato/15 text-tomato'
                            }`}
                        >
                            {canStart ? 'Ready to play' : 'Need 2+ players'}
                        </span>
                    </div>

                    {/* Desk Name Tags Grid */}
                    <ol
                        aria-label={`Players (${state.players.length})`}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                        <AnimatePresence mode="popLayout">
                            {state.players.map((player) => (
                                <PlayerTag
                                    key={player.id}
                                    player={player}
                                    isCurrentUser={player.id === state.currentUser?.id}
                                    canKick={isHost && player.id !== state.currentUser?.id}
                                    onKick={() => setPlayerToKick(player)}
                                    onChangeAvatar={() => setIsAvatarModalOpen(true)}
                                />
                            ))}
                        </AnimatePresence>
                    </ol>

                    {/* Alone In Room State */}
                    {isAloneInRoom && <EmptyPlayerSlots />}

                    {/* Mobile Settings Accordion (<md) */}
                    <div className="block md:hidden mt-2 pt-3 border-t-2 border-ink/10">
                        <button
                            type="button"
                            onClick={() => setIsMobileSettingsOpen(!isMobileSettingsOpen)}
                            className="w-full flex items-center justify-between p-3 bg-paper border-2 border-ink rounded-[8px] shadow-hard-sm font-bold text-sm text-ink cursor-pointer select-none"
                            aria-expanded={isMobileSettingsOpen}
                        >
                            <div className="flex items-center gap-2">
                                <SettingsIcon className="w-4 h-4 text-ink" />
                                <span>{isHost ? 'Game Rules & Settings' : 'Room Rules'}</span>
                            </div>
                            {isMobileSettingsOpen ? (
                                <ChevronUp className="w-4 h-4 text-ink" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-ink" />
                            )}
                        </button>

                        {isMobileSettingsOpen && (
                            <div className="mt-3">
                                <SettingsCard
                                    isHost={isHost}
                                    hostName={hostPlayer.username}
                                    settings={currentSettings}
                                    customWordsText={customWordsText}
                                    onCustomWordsChange={handleCustomWordsChange}
                                    onRoundsChange={handleRoundsChange}
                                    onDrawTimeChange={handleDrawTimeChange}
                                    onDifficultyChange={handleDifficultyChange}
                                    onTogglePack={handleTogglePack}
                                    validCustomWordCount={validCustomWordCount}
                                />
                            </div>
                        )}
                    </div>
                </section>

                {/* Right One-Third (Desktop): Room Card & Settings Card */}
                <aside className="hidden md:flex md:col-span-5 lg:col-span-5 flex-col gap-6">
                    {/* Room Card on Desktop */}
                    <RoomCard
                        code={code}
                        copiedCode={copiedCode}
                        copiedLink={copiedLink}
                        onCopyCode={handleCopyCode}
                        onCopyLink={handleCopyLink}
                        onShare={handleShare}
                        showQR={showQR}
                        onToggleQR={() => setShowQR(!showQR)}
                    >
                        {showQR && (
                            <Suspense
                                fallback={
                                    <div className="p-3 bg-paper border-2 border-ink rounded-[8px] text-xs font-bold text-center">
                                        Loading QR...
                                    </div>
                                }
                            >
                                <LazyQRCodeDisplay
                                    url={`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`}
                                    onClose={() => setShowQR(false)}
                                    onCopied={(msg) => showToast(msg, 'success')}
                                />
                            </Suspense>
                        )}
                    </RoomCard>

                    {/* Settings Card on Desktop */}
                    <SettingsCard
                        isHost={isHost}
                        hostName={hostPlayer.username}
                        settings={currentSettings}
                        customWordsText={customWordsText}
                        onCustomWordsChange={handleCustomWordsChange}
                        onRoundsChange={handleRoundsChange}
                        onDrawTimeChange={handleDrawTimeChange}
                        onDifficultyChange={handleDifficultyChange}
                        onTogglePack={handleTogglePack}
                        validCustomWordCount={validCustomWordCount}
                    />

                    {/* Desktop Start Game Bar */}
                    <StartGameBar
                        isHost={isHost}
                        hostName={hostPlayer.username}
                        canStart={canStart}
                        countdown={countdown}
                        onStartOrCancel={handleStartOrCancel}
                    />
                </aside>
            </div>

            {/* Mobile Sticky Bottom Bar (<md) */}
            <div className="block md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t-2 border-ink p-3 shadow-hard pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-md mx-auto">
                    <StartGameBar
                        isHost={isHost}
                        hostName={hostPlayer.username}
                        canStart={canStart}
                        countdown={countdown}
                        onStartOrCancel={handleStartOrCancel}
                        className="border-0 shadow-none p-0 bg-transparent"
                    />
                </div>
            </div>
        </div>
    );
};

export default Lobby;
