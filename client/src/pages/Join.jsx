import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, RefreshCw, Sparkles, User, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { useSound } from '../hooks/useSound';
import { EVENTS } from '../../../shared/types';
import { CREDIT_LINE } from '../config';
import { FUN_NAMES, getRandomFunName } from '../constants/funNames';
import { AVATAR_IDS, Avatar } from '../components/ui/Avatar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import AvatarPicker from '../components/ui/AvatarPicker';
import Spinner from '../components/ui/Spinner';
import Toast from '../components/ui/Toast';
import { getApiBaseUrl } from '../lib/apiBase';

export const Join = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const { state, dispatch } = useGame();
    const socket = useSocket();
    const { isMuted, toggleMute } = useSound();

    const cleanCode = (code || '').trim().toUpperCase();

    // Preview state
    const [preview, setPreview] = useState(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(true);
    const [previewError, setPreviewError] = useState(null);

    // Player inputs
    const [username, setUsername] = useState('');
    const [avatar, setAvatar] = useState('avatar-1');
    const [nicknameError, setNicknameError] = useState('');
    const [isReturningPlayer, setIsReturningPlayer] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    // Connection states
    const [isJoining, setIsJoining] = useState(false);
    const [showJoiningSpinner, setShowJoiningSpinner] = useState(false);
    const [serverUnreachable, setServerUnreachable] = useState(false);

    // Seat Claim States (E19)
    const [seatClaimData, setSeatClaimData] = useState(null);
    const [seatClaimStatus, setSeatClaimStatus] = useState(null); // 'prompt' | 'waiting' | 'accepted' | 'declined'
    const [seatClaimMessage, setSeatClaimMessage] = useState('');

    useEffect(() => {
        if (!socket) return;

        const onClaimAvailable = (data) => {
            setSeatClaimData(data);
            setSeatClaimStatus('prompt');
            setIsJoining(false);
            setShowJoiningSpinner(false);
        };

        const onClaimAccepted = () => {
            setSeatClaimStatus('accepted');
            setSeatClaimMessage('The host let you back in');
        };

        const onClaimDeclined = (data) => {
            setSeatClaimStatus('declined');
            setSeatClaimMessage(data?.reason || 'The host said no');
            setIsJoining(false);
            setShowJoiningSpinner(false);
        };

        socket.on(EVENTS.SEAT_CLAIM_AVAILABLE, onClaimAvailable);
        socket.on(EVENTS.SEAT_CLAIM_ACCEPTED, onClaimAccepted);
        socket.on(EVENTS.SEAT_CLAIM_DECLINED, onClaimDeclined);

        return () => {
            socket.off(EVENTS.SEAT_CLAIM_AVAILABLE, onClaimAvailable);
            socket.off(EVENTS.SEAT_CLAIM_ACCEPTED, onClaimAccepted);
            socket.off(EVENTS.SEAT_CLAIM_DECLINED, onClaimDeclined);
        };
    }, [socket]);

    const [placeholderName, setPlaceholderName] = useState('Sleepy Otter');
    const nicknameInputRef = useRef(null);

    // 1. Check localStorage for returning player
    useEffect(() => {
        try {
            const savedName = localStorage.getItem('scribble_nickname') || '';
            const savedAvatar = localStorage.getItem('scribble_avatar') || 'avatar-1';

            if (savedName.trim()) {
                setUsername(savedName.trim());
                setIsReturningPlayer(true);
                setIsEditingProfile(false);
            } else {
                setIsReturningPlayer(false);
                setIsEditingProfile(true);
            }

            if (savedAvatar && AVATAR_IDS.includes(savedAvatar)) {
                setAvatar(savedAvatar);
            }
        } catch {
            setIsReturningPlayer(false);
            setIsEditingProfile(true);
        }

        setPlaceholderName(getRandomFunName());
    }, []);

    // 2. Fetch room preview on load
    const fetchPreview = useCallback(async () => {
        if (!cleanCode) {
            setIsLoadingPreview(false);
            setPreview({ exists: false });
            return;
        }

        setIsLoadingPreview(true);
        setPreviewError(null);

        try {
            const baseUrl = getApiBaseUrl();
            const res = await fetch(`${baseUrl}/api/rooms/${cleanCode}/preview`);
            if (!res.ok) {
                throw new Error(`Failed to load room (${res.status})`);
            }
            const data = await res.json();
            setPreview(data);
        } catch (err) {
            setPreviewError(err.message || 'Could not connect to server');
        } finally {
            setIsLoadingPreview(false);
        }
    }, [cleanCode]);

    useEffect(() => {
        fetchPreview();
    }, [fetchPreview]);

    // 3. Autofocus for new players when editing profile
    useEffect(() => {
        if (!isReturningPlayer && isEditingProfile && !isLoadingPreview) {
            nicknameInputRef.current?.focus();
        }
    }, [isReturningPlayer, isEditingProfile, isLoadingPreview]);

    // 4. Spinner delay after 400 ms
    useEffect(() => {
        let timer = null;
        if (isJoining) {
            timer = setTimeout(() => setShowJoiningSpinner(true), 400);
        } else {
            setShowJoiningSpinner(false);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isJoining]);

    // 5. Handle server errors
    useEffect(() => {
        if (state.error) {
            setIsJoining(false);
        }
    }, [state.error]);

    // 6. After joining, replace history so Back does not return to /join
    useEffect(() => {
        if (state.roomCode && state.roomCode.toUpperCase() === cleanCode) {
            setIsJoining(false);
            navigate(`/lobby/${cleanCode}`, { replace: true });
        }
    }, [state.roomCode, cleanCode, navigate]);

    // Helper: Persist local preferences
    const savePreferencesLocally = (name, chosenAvatar) => {
        try {
            localStorage.setItem('scribble_nickname', name);
            localStorage.setItem('scribble_avatar', chosenAvatar);
        } catch {
            // Ignore localStorage errors
        }
    };

    // Helper: Session ID
    const getSessionId = () => {
        let sessionId = null;
        try {
            sessionId = localStorage.getItem('scribble_session_id');
            if (!sessionId) {
                sessionId = uuidv4();
                localStorage.setItem('scribble_session_id', sessionId);
            }
        } catch {
            sessionId = uuidv4();
        }
        return sessionId;
    };

    const validateNickname = () => {
        const trimmed = username.trim();
        if (!trimmed) {
            setNicknameError('Please enter a nickname');
            return null;
        }
        if (trimmed.length > 16) {
            setNicknameError('Nickname must be 16 characters or less');
            return null;
        }
        setNicknameError('');
        return trimmed;
    };

    const handleJoin = (e) => {
        e?.preventDefault();
        const validName = validateNickname();
        if (!validName) {
            setIsEditingProfile(true);
            setTimeout(() => nicknameInputRef.current?.focus(), 50);
            return;
        }

        if (!socket || !socket.connected) {
            setServerUnreachable(true);
            return;
        }

        savePreferencesLocally(validName, avatar);
        const sessionId = getSessionId();
        setIsJoining(true);

        socket.emit(EVENTS.JOIN_ROOM, {
            roomCode: cleanCode,
            username: validName,
            avatar,
            sessionId,
        });
    };

    return (
        <div className="flex-1 w-full max-w-[1100px] mx-auto flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 select-none">
            {/* Server Error Toast */}
            <Toast
                isOpen={Boolean(state.error)}
                onClose={() => dispatch({ type: 'SET_ERROR', payload: null })}
                message={state.error}
                variant="error"
            />

            {/* Server Unreachable Toast */}
            <Toast
                isOpen={serverUnreachable}
                onClose={() => setServerUnreachable(false)}
                message="Server unreachable. Please check your connection."
                variant="error"
                action={{
                    label: 'Retry',
                    onClick: () => {
                        setServerUnreachable(false);
                        if (socket) socket.connect();
                        handleJoin();
                    },
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 25 }}
                className="w-full max-w-md flex flex-col gap-4"
            >
                <Card className="flex flex-col gap-5 p-5 sm:p-6 bg-card border-2 border-ink shadow-hard-lg rounded-[12px]">
                    {/* Header: Card Title, Room Code Badge & Sound Toggle */}
                    <div className="flex items-center justify-between border-b-2 border-ink/10 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-tomato animate-pulse" />
                            <h1 tabIndex={-1} className="font-heading font-black text-2xl sm:text-3xl text-ink tracking-tight">
                                You're invited
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs sm:text-sm text-ink-soft bg-paper px-2.5 py-1 rounded-[6px] border-2 border-ink shadow-hard-sm">
                                {cleanCode}
                            </span>
                            <button
                                type="button"
                                onClick={toggleMute}
                                aria-label={isMuted ? 'Unmute game sounds' : 'Mute game sounds'}
                                title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                                className="min-w-[36px] min-h-[36px] p-1.5 bg-paper hover:bg-card border-2 border-ink rounded-[6px] shadow-hard-sm flex items-center justify-center text-ink cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                            >
                                {isMuted ? (
                                    <VolumeX className="w-4 h-4 text-tomato" />
                                ) : (
                                    <Volume2 className="w-4 h-4 text-ink" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* STATE 1: Loading Preview */}
                    {isLoadingPreview && (
                        <div role="status" className="flex flex-col items-center justify-center py-8 gap-3">
                            <Spinner size="lg" label="Checking room..." />
                            <p className="text-sm font-bold text-ink-soft">
                                Finding room details...
                            </p>
                        </div>
                    )}

                    {/* STATE 2: Preview Fetch Failed -> Inline Retry */}
                    {!isLoadingPreview && previewError && (
                        <div className="flex flex-col items-center text-center py-6 gap-3">
                            <div className="w-12 h-12 rounded-full bg-tomato/10 border-2 border-tomato flex items-center justify-center text-tomato shadow-hard-sm">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-bold text-ink text-base">
                                    Could not connect to room
                                </p>
                                <p className="text-xs text-ink-soft mt-1">
                                    Check your internet connection and try again.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={fetchPreview}
                                className="mt-2 flex items-center gap-2 uppercase font-bold"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span>Retry</span>
                            </Button>
                        </div>
                    )}

                    {/* STATE 3: Room Closed or Never Existed */}
                    {!isLoadingPreview && !previewError && preview && !preview.exists && (
                        <div className="flex flex-col items-center text-center py-4 gap-4">
                            {/* Spot Illustration of a Closed / Folded Easel */}
                            <div className="w-20 h-20 rounded-[12px] bg-paper border-2 border-ink shadow-hard flex items-center justify-center">
                                <svg viewBox="0 0 48 48" className="w-12 h-12 overflow-visible" fill="none">
                                    <path d="M 12 40 L 22 14 L 32 40" stroke="#1C1B18" strokeWidth="2.5" strokeLinecap="round" />
                                    <path d="M 24 14 L 24 40" stroke="#1C1B18" strokeWidth="2" strokeLinecap="round" />
                                    <rect x="14" y="22" width="20" height="14" rx="2" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="2" />
                                    <path d="M 19 28 L 29 28" stroke="#E4472B" strokeWidth="2.5" strokeLinecap="round" />
                                    <circle cx="24" cy="33" r="1.5" fill="#1C1B18" />
                                </svg>
                            </div>

                            <div>
                                <h2 className="font-heading font-black text-xl text-ink">
                                    This room has closed.
                                </h2>
                                <p className="text-xs text-ink-soft mt-1 max-w-xs">
                                    The match has concluded or the host has left. You can start a fresh game with your friends!
                                </p>
                            </div>

                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => navigate('/')}
                                className="w-full uppercase font-bold tracking-wide mt-2"
                            >
                                Start a new room
                            </Button>
                        </div>
                    )}

                    {/* STATE 3.5: Seat Claim Flow (E19) */}
                    {!isLoadingPreview && seatClaimStatus && (
                        <div data-testid="seat-claim-flow" className="flex flex-col gap-4 py-2">
                            {seatClaimStatus === 'prompt' && (
                                <div className="flex flex-col gap-4 text-center">
                                    <div className="w-12 h-12 rounded-full bg-marigold/20 border-2 border-ink flex items-center justify-center mx-auto text-ink shadow-hard-sm">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 data-testid="seat-claim-prompt-heading" className="font-heading font-black text-lg text-ink">
                                            {seatClaimData?.username} is away. Ask to take back that seat?
                                        </h2>
                                        <p className="text-xs text-ink-soft mt-1">
                                            A player with this name was in the room and disconnected. You can ask the host to restore the seat or join as a new player.
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 pt-2">
                                        <Button
                                            variant="primary"
                                            size="md"
                                            data-testid="seat-claim-ask-host-btn"
                                            onClick={() => {
                                                if (socket && seatClaimData) {
                                                    socket.emit(EVENTS.CLAIM_SEAT, {
                                                        roomCode: cleanCode,
                                                        playerId: seatClaimData.playerId,
                                                    });
                                                    setSeatClaimStatus('waiting');
                                                }
                                            }}
                                            className="w-full font-bold uppercase min-h-[44px]"
                                        >
                                            Ask the host
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="md"
                                            data-testid="seat-claim-join-new-btn"
                                            onClick={() => {
                                                setSeatClaimStatus(null);
                                                setSeatClaimData(null);
                                                const validName = validateNickname() || username.trim() || 'Player';
                                                const sessionId = getSessionId();
                                                setIsJoining(true);
                                                socket.emit(EVENTS.JOIN_ROOM, {
                                                    roomCode: cleanCode,
                                                    username: validName,
                                                    avatar,
                                                    sessionId,
                                                    bypassSeatClaim: true,
                                                });
                                            }}
                                            className="w-full font-bold uppercase min-h-[44px]"
                                        >
                                            Join as a new player
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {seatClaimStatus === 'waiting' && (
                                <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                                    <Spinner size="lg" label="Waiting for host..." />
                                    <h2 data-testid="seat-claim-waiting-heading" className="font-heading font-black text-base text-ink">
                                        Waiting for the host...
                                    </h2>
                                    <p className="text-xs text-ink-soft">
                                        The host has 20 seconds to accept or decline.
                                    </p>
                                    <Button
                                        variant="quiet"
                                        size="sm"
                                        onClick={() => {
                                            setSeatClaimStatus(null);
                                            setSeatClaimData(null);
                                            const validName = validateNickname() || username.trim() || 'Player';
                                            const sessionId = getSessionId();
                                            setIsJoining(true);
                                            socket.emit(EVENTS.JOIN_ROOM, {
                                                roomCode: cleanCode,
                                                username: validName,
                                                avatar,
                                                sessionId,
                                                bypassSeatClaim: true,
                                            });
                                        }}
                                        className="mt-2 text-xs font-bold text-ink-soft hover:text-ink"
                                    >
                                        Join as a new player instead
                                    </Button>
                                </div>
                            )}

                            {seatClaimStatus === 'accepted' && (
                                <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                                    <span className="text-leaf font-black text-3xl">✓</span>
                                    <h2 data-testid="seat-claim-accepted-heading" className="font-heading font-black text-lg text-ink">
                                        The host let you back in
                                    </h2>
                                    <p className="text-xs text-ink-soft">
                                        Restoring your seat and points...
                                    </p>
                                </div>
                            )}

                            {seatClaimStatus === 'declined' && (
                                <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
                                    <div className="w-10 h-10 rounded-full bg-tomato/10 border border-tomato flex items-center justify-center text-tomato">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <h2 data-testid="seat-claim-declined-heading" className="font-heading font-black text-base text-ink">
                                        {seatClaimMessage || 'The host said no'}
                                    </h2>
                                    <p className="text-xs text-ink-soft">
                                        You can still join the room as a new player.
                                    </p>
                                    <Button
                                        variant="primary"
                                        size="md"
                                        data-testid="seat-claim-declined-join-btn"
                                        onClick={() => {
                                            setSeatClaimStatus(null);
                                            setSeatClaimData(null);
                                            const validName = validateNickname() || username.trim() || 'Player';
                                            const sessionId = getSessionId();
                                            setIsJoining(true);
                                            socket.emit(EVENTS.JOIN_ROOM, {
                                                roomCode: cleanCode,
                                                username: validName,
                                                avatar,
                                                sessionId,
                                                bypassSeatClaim: true,
                                            });
                                        }}
                                        className="w-full font-bold uppercase min-h-[44px] mt-2"
                                    >
                                        Join as a new player
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STATE 4, 5, 6: Room Exists (Lobby, In-Progress, or Full) */}
                    {!isLoadingPreview && !previewError && preview && preview.exists && !seatClaimStatus && (
                        <>
                            {/* Host Banner & Status Line */}
                            <div className="flex items-center gap-3 p-3 bg-paper border-2 border-ink rounded-[8px] shadow-hard-sm">
                                <Avatar avatarId={preview.hostAvatar || 'avatar-1'} size="md" />
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="font-heading font-black text-sm text-ink truncate">
                                        {preview.hostName}'s room
                                    </p>
                                    <p className="text-xs font-medium text-ink-soft mt-0.5 leading-snug">
                                        {preview.state !== 'LOBBY' && preview.state !== 'GAME_END' ? (
                                            <>
                                                A game is in progress (round {preview.round} of {preview.totalRounds}). You'll draw when it's your turn.
                                            </>
                                        ) : (
                                            <>
                                                {preview.playerCount} of {preview.maxPlayers} players, waiting in the lobby
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Room Full Notice */}
                            {preview.playerCount >= preview.maxPlayers ? (
                                <div className="flex flex-col gap-3 py-2">
                                    <div className="p-3 bg-tomato/10 border-2 border-tomato rounded-[6px] text-center">
                                        <p className="text-xs font-bold text-tomato">
                                            This room is currently full ({preview.playerCount}/{preview.maxPlayers} players).
                                        </p>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        disabled={true}
                                        className="w-full uppercase font-bold tracking-wide opacity-50 cursor-not-allowed"
                                    >
                                        This room is full
                                    </Button>

                                    <Button
                                        variant="primary"
                                        size="lg"
                                        onClick={() => navigate('/')}
                                        className="w-full uppercase font-bold tracking-wide"
                                    >
                                        Start your own room
                                    </Button>
                                </div>
                            ) : (
                                /* Room Has Space: Returning Player vs New Player Form */
                                <div className="flex flex-col gap-4">
                                    {isReturningPlayer && !isEditingProfile ? (
                                        /* Returning Player One-Tap Pill */
                                        <div className="flex items-center justify-between p-3 bg-paper/80 border-2 border-ink rounded-[8px] shadow-hard-sm">
                                            <div className="flex items-center gap-2.5">
                                                <Avatar avatarId={avatar} size="sm" />
                                                <div className="text-left">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                                                        Playing as
                                                    </span>
                                                    <span className="font-heading font-black text-sm text-ink">
                                                        {username}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingProfile(true)}
                                                className="text-xs font-bold text-cobalt hover:underline cursor-pointer px-2 py-1 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded-[4px]"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    ) : (
                                        /* New Player / Editing Profile Inputs */
                                        <div className="flex flex-col gap-3.5">
                                            {/* Nickname Input */}
                                            <div className="flex flex-col gap-1 w-full text-left">
                                                <label
                                                    htmlFor="join-nickname"
                                                    className="text-xs font-bold uppercase tracking-wider text-ink select-none"
                                                >
                                                    Your Nickname
                                                </label>
                                                <input
                                                    ref={nicknameInputRef}
                                                    id="join-nickname"
                                                    type="text"
                                                    value={username}
                                                    onChange={(e) => {
                                                        setUsername(e.target.value);
                                                        if (nicknameError) setNicknameError('');
                                                    }}
                                                    onBlur={validateNickname}
                                                    placeholder={`e.g. ${placeholderName}`}
                                                    maxLength={16}
                                                    autoComplete="nickname"
                                                    aria-invalid={Boolean(nicknameError)}
                                                    aria-describedby={nicknameError ? 'join-nickname-error' : undefined}
                                                    className={`w-full min-h-[42px] px-3.5 py-2 text-base font-body bg-paper text-ink placeholder:text-ink-soft/50 border-2 ${
                                                        nicknameError ? 'border-tomato ring-1 ring-tomato' : 'border-ink'
                                                    } rounded-[6px] shadow-hard-sm transition-colors focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none`}
                                                />
                                                {nicknameError && (
                                                    <p
                                                        id="join-nickname-error"
                                                        role="alert"
                                                        className="text-xs font-bold text-tomato mt-0.5 flex items-center gap-1"
                                                    >
                                                        <span>•</span> {nicknameError}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Avatar Picker */}
                                            <AvatarPicker
                                                selectedAvatar={avatar}
                                                onSelect={(next) => {
                                                    setAvatar(next);
                                                    savePreferencesLocally(username, next);
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Action Button: One Tap Join */}
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        onClick={handleJoin}
                                        disabled={isJoining}
                                        className="w-full text-base sm:text-lg tracking-wide uppercase font-bold min-h-[48px]"
                                    >
                                        {showJoiningSpinner ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Spinner size="sm" label="Joining room..." />
                                                <span>Connecting...</span>
                                            </span>
                                        ) : preview.state !== 'LOBBY' && preview.state !== 'GAME_END' ? (
                                            'Join the game'
                                        ) : (
                                            `Join ${preview.hostName}'s room`
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </Card>

                {/* Back Link to Home */}
                <div className="flex items-center justify-between px-1">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft hover:text-ink cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded-[4px] px-2 py-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to home</span>
                    </button>
                    <span className="text-[11px] text-ink-soft">
                        {CREDIT_LINE}
                    </span>
                </div>
            </motion.div>
        </div>
    );
};

export default Join;

