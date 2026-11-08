import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import AvatarPicker from '../components/ui/AvatarPicker';
import Spinner from '../components/ui/Spinner';
import Toast from '../components/ui/Toast';
import Wordmark from '../components/Landing/Wordmark';
import RoomCodeInput from '../components/Landing/RoomCodeInput';

export const Landing = () => {
    const [username, setUsername] = useState('');
    const [avatar, setAvatar] = useState('avatar-1');
    const [roomCode, setRoomCode] = useState('');
    const [inputError, setInputError] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    const navigate = useNavigate();
    const { code } = useParams();
    const { state, dispatch } = useGame();
    const socket = useSocket();

    // Auto-fill code from URL if present (e.g. /join/:code)
    useEffect(() => {
        if (code) {
            setRoomCode(code.toUpperCase().slice(0, 6));
        }
    }, [code]);

    // Handle server error reset
    useEffect(() => {
        if (state.error) {
            setIsJoining(false);
        }
    }, [state.error]);

    // Redirect to lobby once room is joined
    useEffect(() => {
        if (!state.roomCode) return;
        if (isJoining || !code) {
            navigate(`/lobby/${state.roomCode}`);
        }
    }, [state.roomCode, navigate, code, isJoining]);

    const getSessionId = () => {
        let sessionId = localStorage.getItem('scribble_session_id');
        if (!sessionId) {
            sessionId = uuidv4();
            localStorage.setItem('scribble_session_id', sessionId);
        }
        return sessionId;
    };

    const validateNickname = () => {
        const trimmed = username.trim();
        if (!trimmed) {
            setInputError('Please enter a nickname');
            return null;
        }
        if (trimmed.length > 16) {
            setInputError('Nickname must be 16 characters or less');
            return null;
        }
        setInputError('');
        return trimmed;
    };

    const handleCreateRoom = (e) => {
        e?.preventDefault();
        const validName = validateNickname();
        if (!validName) return;

        const sessionId = getSessionId();
        setIsJoining(true);
        socket.emit(EVENTS.CREATE_ROOM, {
            username: validName,
            avatar,
            sessionId,
            settings: {},
        });
    };

    const handleJoinRoom = (e) => {
        e?.preventDefault();
        const validName = validateNickname();
        if (!validName) return;

        const cleanCode = roomCode.trim().toUpperCase();
        if (!cleanCode || cleanCode.length !== 6) {
            setInputError('Room code must be 6 characters');
            return;
        }

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
        <div className="flex-1 w-full max-w-[1100px] mx-auto flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative">
            <h1 tabIndex={-1} className="sr-only">Scribble</h1>
            {/* Server Error Toast */}
            <Toast
                isOpen={Boolean(state.error)}
                onClose={() => dispatch({ type: 'SET_ERROR', payload: null })}
                message={state.error}
                variant="error"
            />

            {/* Joining Spinner Overlay */}
            {isJoining && !state.error && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed inset-0 z-sheet flex flex-col items-center justify-center bg-paper/85 backdrop-blur-none p-4"
                >
                    <Card className="flex flex-col items-center justify-center p-8 max-w-xs text-center shadow-hard-lg">
                        <Spinner size="lg" label="Entering room..." />
                        <h2 className="text-xl font-bold font-heading text-ink mt-4">
                            Entering room...
                        </h2>
                        <p className="text-xs text-ink-soft mt-1">
                            Sharpening pencils and laying out paper
                        </p>
                    </Card>
                </div>
            )}

            <div className="w-full max-w-lg flex flex-col items-center gap-6 md:gap-8">
                {/* Header with Wordmark and Copy */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="flex flex-col items-center text-center gap-2"
                >
                    <Wordmark />
                    <p className="text-base sm:text-lg font-bold text-ink-soft">
                        Draw it. Guess it. Win bragging rights.
                    </p>
                </motion.header>

                {/* Index-card Form */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.05 }}
                    className="w-full"
                >
                    <Card className="flex flex-col gap-6 shadow-hard-lg bg-card">
                        {/* Nickname Input */}
                        <Input
                            label="Your Nickname"
                            id="player-nickname"
                            name="nickname"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (inputError) setInputError('');
                            }}
                            error={inputError}
                            maxLength={16}
                            placeholder="e.g. Leonardo"
                            autoComplete="nickname"
                            required
                        />

                        {/* Avatar Picker */}
                        <AvatarPicker
                            selectedAvatar={avatar}
                            onSelect={setAvatar}
                        />

                        {/* Start Room Action */}
                        <div className="flex flex-col gap-2 pt-2">
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleCreateRoom}
                                disabled={isJoining}
                                className="w-full text-base sm:text-lg tracking-wide uppercase"
                            >
                                Start a room
                            </Button>
                        </div>

                        {/* Divider */}
                        <div className="relative flex items-center justify-center my-1 select-none">
                            <div className="w-full border-t-2 border-ink" />
                            <span className="absolute bg-card px-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
                                or join a game
                            </span>
                        </div>

                        {/* Join with 6-box room code */}
                        <div className="flex flex-col gap-3">
                            <RoomCodeInput
                                value={roomCode}
                                onChange={(val) => {
                                    setRoomCode(val);
                                    if (inputError) setInputError('');
                                }}
                                onComplete={() => {
                                    if (username.trim()) {
                                        handleJoinRoom();
                                    }
                                }}
                                disabled={isJoining}
                            />

                            <Button
                                variant="secondary"
                                size="lg"
                                onClick={handleJoinRoom}
                                disabled={isJoining || roomCode.trim().length !== 6}
                                className="w-full uppercase text-base tracking-wide"
                            >
                                Join Room
                            </Button>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default Landing;
