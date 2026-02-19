import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { EVENTS } from '../../../shared/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { Activity, Users, Play, Crown, Hash, Clock } from 'lucide-react';

const Landing = () => {
    const [username, setUsername] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [drawTime, setDrawTime] = useState(60);
    const [rounds, setRounds] = useState(3);
    const [activeTab, setActiveTab] = useState('create');
    const navigate = useNavigate();
    const { code } = useParams();
    const { state, dispatch } = useGame();
    const socket = useSocket();

    // Handle Direct Join via URL
    useEffect(() => {
        if (code) {
            setActiveTab('join');
            setRoomCode(code.toUpperCase());
        }
    }, [code]);

    useEffect(() => {
        if (state.error) {
            const timer = setTimeout(() => {
                dispatch({ type: 'SET_ERROR', payload: null });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [state.error, dispatch]);

    useEffect(() => {
        if (state.roomCode) {
            navigate(`/lobby/${state.roomCode}`);
        }
    }, [state.roomCode, navigate]);

    const handleCreateRoom = () => {
        if (!username) return dispatch({ type: 'SET_ERROR', payload: 'Username is required!' });
        socket.emit(EVENTS.CREATE_ROOM, { username, avatar: '👤', settings: { drawTime, rounds } });
    };

    const handleJoinRoom = () => {
        if (!username || !roomCode) return dispatch({ type: 'SET_ERROR', payload: 'Username and Code required!' });
        socket.emit(EVENTS.JOIN_ROOM, { roomCode, username, avatar: '👤' });
    };

    return (
        <div className="h-full bg-[#0f172a] text-white overflow-hidden relative font-sans selection:bg-cyan-500/30">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[40%] left-[30%] w-[30vh] h-[30vh] bg-pink-600/10 rounded-full blur-[80px]" />

                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 h-full flex flex-col items-center justify-center">

                {/* Logo Section */}
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-center mb-12 relative"
                >
                    <div className="relative inline-block">
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                            SCRIBBLE
                        </h1>
                        <motion.div
                            className="absolute -right-8 -top-8 text-4xl"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        >
                            🎨
                        </motion.div>
                    </div>
                    <p className="mt-4 text-slate-400 text-lg md:text-xl font-medium tracking-wide">
                        The Ultimate Multiplayer Drawing Experience
                    </p>
                </motion.div>

                {/* Main Card */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`flex-1 py-4 text-center font-bold transition-colors relative ${activeTab === 'create' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span className="flex items-center justify-center gap-2"><Play size={18} /> Create Room</span>
                            {activeTab === 'create' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('join')}
                            className={`flex-1 py-4 text-center font-bold transition-colors relative ${activeTab === 'join' ? 'text-pink-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span className="flex items-center justify-center gap-2"><Users size={18} /> Join Room</span>
                            {activeTab === 'join' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-pink-400 shadow-[0_0_10px_#f472b6]" />}
                        </button>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Common Input: Username */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Identity</label>
                            <div className="relative group">
                                <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your nickname"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-bold"
                                />
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {activeTab === 'create' ? (
                                <motion.div
                                    key="create"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-6"
                                >
                                    {/* Settings Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Rounds</label>
                                            <div className="relative">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                                <select
                                                    value={rounds}
                                                    onChange={(e) => setRounds(Number(e.target.value))}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-2 text-sm font-bold text-white focus:outline-none appearance-none cursor-pointer hover:bg-black/30 transition-colors"
                                                >
                                                    {[2, 3, 5, 7, 10, 12].map(n => <option key={n} value={n} className="bg-slate-800">{n} Rounds</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                                <select
                                                    value={drawTime}
                                                    onChange={(e) => setDrawTime(Number(e.target.value))}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-2 text-sm font-bold text-white focus:outline-none appearance-none cursor-pointer hover:bg-black/30 transition-colors"
                                                >
                                                    {[60, 80, 100, 120].map(t => <option key={t} value={t} className="bg-slate-800">{t} Seconds</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(34,211,238,0.4)" }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleCreateRoom}
                                        className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold text-lg text-white shadow-lg shadow-cyan-500/20 relative overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                        <span className="relative flex items-center justify-center gap-2"><Crown size={20} /> Create Room</span>
                                    </motion.button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="join"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Room Code</label>
                                        <div className="relative group">
                                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-pink-400 transition-colors" size={20} />
                                            <input
                                                type="text"
                                                value={roomCode}
                                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                                maxLength={6}
                                                placeholder="X Y Z 1 2 3"
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all font-mono font-bold tracking-[0.2em] text-lg uppercase"
                                            />
                                        </div>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(244,114,182,0.4)" }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleJoinRoom}
                                        className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl font-bold text-lg text-white shadow-lg shadow-pink-500/20 relative overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                        <span className="relative flex items-center justify-center gap-2"><Play size={20} /> Join Adventure</span>
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {state.error && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-200 rounded-full font-bold text-sm backdrop-blur flex items-center gap-2"
                    >
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        {state.error}
                    </motion.div>
                )}

                <div className="mt-12 text-slate-500 text-xs font-mono tracking-widest text-center">
                    <p>ENGINEERED FOR PERFORMANCE</p>
                    <p className="mt-1 opacity-50">v2.1.0 • RAJ ARYAN</p>
                </div>
            </div>
        </div>
    );
};

export default Landing;
