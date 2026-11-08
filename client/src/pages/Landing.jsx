import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Dice5 } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/types';
import { CREDIT_LINE } from '../config';
import { FUN_NAMES, getRandomFunName } from '../constants/funNames';
import { AVATAR_IDS } from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import AvatarPicker from '../components/ui/AvatarPicker';
import Spinner from '../components/ui/Spinner';
import Toast from '../components/ui/Toast';
import Wordmark from '../components/Landing/Wordmark';
import DoodleCat from '../components/Landing/DoodleCat';
import RoomCodeInput, { extractRoomCode } from '../components/Landing/RoomCodeInput';
import HowToPlayModal from '../components/Landing/HowToPlayModal';

export const Landing = () => {
    const navigate = useNavigate();
    const { code } = useParams();
    const { state, dispatch } = useGame();
    const socket = useSocket();

    // Form inputs
    const [username, setUsername] = useState('');
    const [avatar, setAvatar] = useState('avatar-1');
    const [roomCode, setRoomCode] = useState('');

    // Field-level error states
    const [nicknameError, setNicknameError] = useState('');
    const [roomCodeError, setRoomCodeError] = useState('');

    // Connection & loading states
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectingAction, setConnectingAction] = useState(null); // 'create' | 'join'
    const [showConnectingState, setShowConnectingState] = useState(false);
    const [serverUnreachable, setServerUnreachable] = useState(false);

    // Modals
    const [showHowToPlay, setShowHowToPlay] = useState(false);

    // Random placeholder from 40 fun names
    const [placeholderName, setPlaceholderName] = useState('Sleepy Otter');

    // DOM & Action refs
    const nicknameInputRef = useRef(null);
    const lastActionRef = useRef(null);

    // 1. Prefill nickname & avatar from localStorage (inside try/catch)
    useEffect(() => {
        try {
            const savedName = localStorage.getItem('scribble_nickname');
            if (savedName) setUsername(savedName);
            const savedAvatar = localStorage.getItem('scribble_avatar');
            if (savedAvatar && AVATAR_IDS.includes(savedAvatar)) {
                setAvatar(savedAvatar);
            }
        } catch {
            // Ignore localStorage errors
        }

        // Random fun placeholder from 40 names
        setPlaceholderName(getRandomFunName());

        // Autofocus nickname on desktop only (viewport width >= 768px)
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            nicknameInputRef.current?.focus();
        }
    }, []);

    // 2. Auto-fill code from URL if present (e.g. /join/:code)
    useEffect(() => {
        if (code) {
            const extracted = extractRoomCode(code);
            setRoomCode(extracted);
        }
    }, [code]);

    // 3. Show Spinner and 'Connecting...' ONLY after 400 ms delay
    useEffect(() => {
        let timer = null;
        if (isConnecting) {
            timer = setTimeout(() => {
                setShowConnectingState(true);
            }, 400);
        } else {
            setShowConnectingState(false);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isConnecting]);

    // 4. Handle Server Errors (Room not found, full room, server error)
    useEffect(() => {
        if (!state.error) return;

        setIsConnecting(false);
        setConnectingAction(null);

        const errorStr = String(state.error);
        const lower = errorStr.toLowerCase();

        if (lower.includes('not found') || lower.includes('no room') || lower.includes('invalid room')) {
            setRoomCodeError('No room with that code. Check the letters?');
            dispatch({ type: 'SET_ERROR', payload: null });
        } else if (lower.includes('full')) {
            setRoomCodeError('That room is full.');
            dispatch({ type: 'SET_ERROR', payload: null });
        }
    }, [state.error, dispatch]);

    // 5. Redirect once room is joined
    useEffect(() => {
        if (!state.roomCode) return;
        setIsConnecting(false);
        setConnectingAction(null);
        navigate(`/lobby/${state.roomCode}`);
    }, [state.roomCode, navigate]);

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

    // Helper: Persist preferences locally
    const savePreferencesLocally = (name, chosenAvatar) => {
        try {
            localStorage.setItem('scribble_nickname', name);
            localStorage.setItem('scribble_avatar', chosenAvatar);
        } catch {
            // Ignore localStorage errors
        }
    };

    // Validation on Blur: 1 to 16 characters
    const validateNickname = useCallback(() => {
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
    }, [username]);

    // Randomize Name & Avatar
    const handleRandomize = () => {
        const randomName = getRandomFunName();
        const randomAvatarIndex = Math.floor(Math.random() * AVATAR_IDS.length);
        const randomAvatar = AVATAR_IDS[randomAvatarIndex];

        setUsername(randomName);
        setAvatar(randomAvatar);
        setNicknameError('');
        savePreferencesLocally(randomName, randomAvatar);
    };

    // Handle Start a room
    const handleCreateRoom = (e) => {
        e?.preventDefault();
        const validName = validateNickname();
        if (!validName) {
            nicknameInputRef.current?.focus();
            return;
        }

        if (!socket || !socket.connected) {
            setServerUnreachable(true);
            lastActionRef.current = () => handleCreateRoom();
            return;
        }

        savePreferencesLocally(validName, avatar);
        const sessionId = getSessionId();

        setConnectingAction('create');
        setIsConnecting(true);
        setNicknameError('');
        setRoomCodeError('');

        socket.emit(EVENTS.CREATE_ROOM, {
            username: validName,
            avatar,
            sessionId,
            settings: {},
        });
    };

    // Handle Join with code
    const handleJoinRoom = (e) => {
        e?.preventDefault();
        const validName = validateNickname();
        if (!validName) {
            nicknameInputRef.current?.focus();
            return;
        }

        const cleanCode = extractRoomCode(roomCode);
        if (!cleanCode || cleanCode.length !== 6) {
            setRoomCodeError('Room code must be 6 characters');
            return;
        }

        if (!socket || !socket.connected) {
            setServerUnreachable(true);
            lastActionRef.current = () => handleJoinRoom();
            return;
        }

        savePreferencesLocally(validName, avatar);
        const sessionId = getSessionId();

        setConnectingAction('join');
        setIsConnecting(true);
        setNicknameError('');
        setRoomCodeError('');

        socket.emit(EVENTS.JOIN_ROOM, {
            roomCode: cleanCode,
            username: validName,
            avatar,
            sessionId,
        });
    };

    // Enter submits active action
    const handleCardKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (roomCode.trim().length === 6) {
                handleJoinRoom(e);
            } else {
                handleCreateRoom(e);
            }
        }
    };

    return (
        <div className="flex-1 w-full max-w-[1100px] mx-auto flex flex-col justify-center px-4 py-3 sm:py-6 md:py-8 lg:py-10 relative">
            <h1 tabIndex={-1} className="sr-only">Scribble</h1>

            {/* Server Unreachable Toast with Retry */}
            <Toast
                isOpen={serverUnreachable}
                onClose={() => setServerUnreachable(false)}
                message="Server unreachable. Please check your connection."
                variant="error"
                duration={5000}
                action={{
                    label: 'Retry',
                    onClick: () => {
                        setServerUnreachable(false);
                        if (socket) socket.connect();
                        if (lastActionRef.current) {
                            lastActionRef.current();
                        }
                    },
                }}
            />

            {/* General Server Error Toast (fallback) */}
            <Toast
                isOpen={Boolean(state.error && !roomCodeError)}
                onClose={() => dispatch({ type: 'SET_ERROR', payload: null })}
                message={state.error}
                variant="error"
            />

            {/* Two Column Layout on Desktop, Card First on Phone */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 items-center gap-6 sm:gap-8 lg:gap-12">
                {/* Desktop Left Column / Phone Bottom Doodle */}
                <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                    className="order-2 md:order-1 flex flex-col items-center md:items-start text-center md:text-left gap-3 sm:gap-5"
                >
                    <Wordmark />
                    <p className="text-base sm:text-lg md:text-xl font-bold text-ink-soft max-w-sm">
                        Draw it. Guess it. Win bragging rights.
                    </p>

                    {/* Looping Cat Doodle: hidden on phone when screen height < 700px */}
                    <div className="w-full flex justify-center md:justify-start pt-2 phone-short-hide">
                        <DoodleCat />
                    </div>
                </motion.div>

                {/* Desktop Right Column / Phone First Item: The Index Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.05 }}
                    className="order-1 md:order-2 w-full max-w-md mx-auto md:max-w-none"
                >
                    <Card
                        onKeyDown={handleCardKeyDown}
                        className="flex flex-col gap-3.5 sm:gap-4 p-4 sm:p-6 bg-card border-2 border-ink shadow-hard-lg rounded-[12px]"
                    >
                        {/* 1. Nickname Field with Dice Randomizer */}
                        <div className="flex flex-col gap-1 w-full text-left">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="player-nickname"
                                    className="text-xs font-bold uppercase tracking-wider text-ink select-none"
                                >
                                    Your Nickname
                                </label>
                                <button
                                    type="button"
                                    onClick={handleRandomize}
                                    aria-label="Randomize nickname and avatar"
                                    title="Randomize nickname and avatar"
                                    className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft hover:text-ink cursor-pointer px-1.5 py-0.5 rounded-[4px] hover:bg-paper transition-colors focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                                >
                                    <Dice5 className="w-3.5 h-3.5 text-tomato" />
                                    <span>Randomize</span>
                                </button>
                            </div>

                            <input
                                ref={nicknameInputRef}
                                id="player-nickname"
                                name="nickname"
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
                                aria-describedby={nicknameError ? 'nickname-error' : undefined}
                                className={`w-full min-h-[42px] px-3.5 py-2 text-base font-body bg-paper text-ink placeholder:text-ink-soft/50 border-2 ${
                                    nicknameError ? 'border-tomato ring-1 ring-tomato' : 'border-ink'
                                } rounded-[6px] shadow-hard-sm transition-colors focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-1`}
                            />

                            {nicknameError && (
                                <p
                                    id="nickname-error"
                                    role="alert"
                                    className="text-xs font-bold text-tomato mt-0.5 flex items-center gap-1"
                                >
                                    <span>•</span> {nicknameError}
                                </p>
                            )}
                        </div>

                        {/* 2. Avatar Picker */}
                        <AvatarPicker
                            selectedAvatar={avatar}
                            onSelect={(selected) => {
                                setAvatar(selected);
                                savePreferencesLocally(username, selected);
                            }}
                        />

                        {/* 3. Primary Button: Start a room */}
                        <div className="pt-1">
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleCreateRoom}
                                disabled={isConnecting}
                                className="w-full text-base sm:text-lg tracking-wide uppercase font-bold min-h-[46px]"
                            >
                                {showConnectingState && connectingAction === 'create' ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Spinner size="sm" label="Connecting..." />
                                        <span>Connecting...</span>
                                    </span>
                                ) : (
                                    'Start a room'
                                )}
                            </Button>
                        </div>

                        {/* 4. Divider: or join with a code */}
                        <div className="relative flex items-center justify-center my-0.5 select-none">
                            <div className="w-full border-t-2 border-ink" />
                            <span className="absolute bg-card px-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                                or join with a code
                            </span>
                        </div>

                        {/* 6-box Code Input & Join Button */}
                        <div className="flex flex-col gap-2.5">
                            <RoomCodeInput
                                value={roomCode}
                                onChange={(val) => {
                                    setRoomCode(val);
                                    if (roomCodeError) setRoomCodeError('');
                                }}
                                onComplete={() => {
                                    if (username.trim()) {
                                        handleJoinRoom();
                                    }
                                }}
                                onEnter={() => {
                                    if (roomCode.trim().length === 6) {
                                        handleJoinRoom();
                                    }
                                }}
                                error={roomCodeError}
                                disabled={isConnecting}
                            />

                            <Button
                                variant="secondary"
                                size="lg"
                                onClick={handleJoinRoom}
                                disabled={isConnecting || roomCode.trim().length !== 6}
                                className="w-full uppercase text-base tracking-wide font-bold min-h-[44px]"
                            >
                                {showConnectingState && connectingAction === 'join' ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Spinner size="sm" label="Connecting..." />
                                        <span>Connecting...</span>
                                    </span>
                                ) : (
                                    'Join Room'
                                )}
                            </Button>
                        </div>
                    </Card>

                    {/* 5. Below the card: Quiet 'How to play' Link & Single Credit Line */}
                    <div className="flex flex-col items-center gap-1.5 mt-3 select-none">
                        <button
                            type="button"
                            onClick={() => setShowHowToPlay(true)}
                            aria-label="Open how to play instructions"
                            className="text-xs sm:text-sm font-bold text-ink-soft hover:text-ink underline underline-offset-4 decoration-ink-soft/40 hover:decoration-ink cursor-pointer focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded-[4px] px-2 py-0.5"
                        >
                            How to play
                        </button>
                        <p className="text-xs text-ink-soft/80 text-center font-normal">
                            {CREDIT_LINE}
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* How to Play Modal */}
            <HowToPlayModal
                isOpen={showHowToPlay}
                onClose={() => setShowHowToPlay(false)}
            />
        </div>
    );
};

export default Landing;
