import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, Palette, Zap, Heart, Crown } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../hooks/useSocket';
import { useSound } from '../hooks/useSound';
import { EVENTS } from '../../../shared/types.js';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Toast from '../components/ui/Toast';
import DrawingCard from '../components/Game/DrawingCard';
import DrawingModal from '../components/Game/DrawingModal';

const getOrdinal = (n) => {
    if (!n || typeof n !== 'number') return '';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Hand-drawn Crown SVG with spot palette colors (no gold gradients)
const HandDrawnCrown = () => (
    <svg
        viewBox="0 0 48 32"
        className="w-10 h-8 sm:w-12 sm:h-9 -mb-1 animate-bounce"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <path
            d="M 6 26 L 4 10 L 14 18 L 24 4 L 34 18 L 44 10 L 42 26 Z"
            fill="#F6B72C"
            stroke="#1C1B18"
            strokeWidth="2.5"
            strokeLinejoin="round"
        />
        <circle cx="24" cy="18" r="2.5" fill="#D2381C" stroke="#1C1B18" strokeWidth="1" />
        <circle cx="14" cy="20" r="1.5" fill="#2F4FD8" stroke="#1C1B18" strokeWidth="1" />
        <circle cx="34" cy="20" r="1.5" fill="#2E9E6B" stroke="#1C1B18" strokeWidth="1" />
    </svg>
);

export const GameEnd = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const { state } = useGame();
    const socket = useSocket();
    const { play } = useSound();
    const shouldReduceMotion = useReducedMotion();

    const [toastMessage, setToastMessage] = useState('');
    const [toastVariant, setToastVariant] = useState('success');
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    // Once the player chooses to leave, ignore in-flight room broadcasts (e.g. the
    // leave-driven ROOM_JOINED) so they are not navigated back into the room.
    const leavingRef = useRef(false);

    const isHost = Boolean(state.currentUser?.isHost);
    const myId = state.currentUser?.id;

    // Confetti burst in palette colors only (~2s duration, lazy-loaded, skipped under reduced motion)
    useEffect(() => {
        play('win');

        if (shouldReduceMotion) return;

        let canceled = false;
        import('canvas-confetti').then(({ default: confetti }) => {
            if (canceled) return;
            const duration = 2000;
            const animationEnd = Date.now() + duration;
            const paletteColors = ['#D2381C', '#F6B72C', '#2F4FD8', '#2E9E6B', '#1C1B18'];

            const frame = () => {
                if (canceled) return;
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.7 },
                    colors: paletteColors,
                    disableForReducedMotion: true,
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.7 },
                    colors: paletteColors,
                    disableForReducedMotion: true,
                });

                if (Date.now() < animationEnd) {
                    requestAnimationFrame(frame);
                }
            };

            requestAnimationFrame(frame);
        });

        return () => {
            canceled = true;
        };
    }, [shouldReduceMotion, play]);

    // Socket listener for room restart (moves all connected players back to lobby automatically)
    useEffect(() => {
        if (!socket) return;
        const handleRoomJoined = () => {
            if (leavingRef.current) return;
            navigate(`/lobby/${code}`);
        };
        socket.on(EVENTS.ROOM_JOINED, handleRoomJoined);
        return () => socket.off(EVENTS.ROOM_JOINED, handleRoomJoined);
    }, [socket, code, navigate]);

    const handlePlayAgain = () => {
        if (isHost && socket) {
            socket.emit(EVENTS.PLAY_AGAIN, { roomCode: code });
        }
    };

    const handleLeave = () => {
        leavingRef.current = true;
        try {
            sessionStorage.removeItem('scribble_room_code');
            localStorage.removeItem('scribble_rejoin');
        } catch {
            // Ignore storage access errors
        }
        if (socket && code) {
            socket.emit(EVENTS.LEAVE_ROOM, { roomCode: code });
        }
        navigate('/');
    };

    // Calculate rankings with standard competition tie handling (1, 1, 3 etc.)
    const rankedPlayers = useMemo(() => {
        const sorted = [...(state.players || [])].sort((a, b) => {
            const scoreA = state.scores?.[a.id] || 0;
            const scoreB = state.scores?.[b.id] || 0;
            return scoreB - scoreA;
        });

        let currentRank = 1;
        return sorted.map((p, idx) => {
            const score = state.scores?.[p.id] || 0;
            if (idx > 0) {
                const prevScore = state.scores?.[sorted[idx - 1].id] || 0;
                if (score < prevScore) {
                    currentRank = idx + 1;
                }
            }
            return {
                ...p,
                score,
                rank: currentRank,
            };
        });
    }, [state.players, state.scores]);

    // Current user personal summary
    const myPlayer = useMemo(() => {
        return rankedPlayers.find((p) => p.id === myId);
    }, [rankedPlayers, myId]);

    // Host name for non-host waiting label
    const hostPlayer = useMemo(() => {
        return state.players?.find((p) => p.isHost) || state.players?.[0];
    }, [state.players]);
    const hostName = hostPlayer?.username || 'the host';

    // Winning team calculation for Team mode
    const winningTeam = useMemo(() => {
        if (state.settings?.mode !== 'team' || !state.teamScores) return null;
        let bestTeamId = null;
        let highestScore = -1;
        for (const [tId, score] of Object.entries(state.teamScores)) {
            if (score > highestScore) {
                highestScore = score;
                bestTeamId = tId;
            }
        }
        if (!bestTeamId) return null;
        const teamNames = {
            'team-red': 'Team Red',
            'team-blue': 'Team Blue',
            'team-green': 'Team Green',
            'team-yellow': 'Team Yellow',
        };
        const teamColors = {
            'team-red': '#EF4444',
            'team-blue': '#3B82F6',
            'team-green': '#10B981',
            'team-yellow': '#F59E0B',
        };
        return {
            id: bestTeamId,
            name: teamNames[bestTeamId] || bestTeamId,
            color: teamColors[bestTeamId] || '#EF4444',
            score: highestScore,
        };
    }, [state.settings?.mode, state.teamScores]);

    // Podium configuration
    // When only 2 players: show 1st and 2nd.
    // When 3+ players: show top 3 (or rank <= 3).
    const { podiumItems, compactPlayers } = useMemo(() => {
        if (rankedPlayers.length === 0) {
            return { podiumItems: [], compactPlayers: [] };
        }

        if (rankedPlayers.length === 1) {
            return {
                podiumItems: [rankedPlayers[0]],
                compactPlayers: [],
            };
        }

        if (rankedPlayers.length === 2) {
            // 2 players: Left = 2nd, Right = 1st
            const first = rankedPlayers[0];
            const second = rankedPlayers[1];
            return {
                podiumItems: [second, first],
                compactPlayers: [],
            };
        }

        // 3 or more players:
        // Top 3 positions standard podium: Left = 2nd (index 1), Center = 1st (index 0), Right = 3rd (index 2)
        const first = rankedPlayers[0];
        const second = rankedPlayers[1];
        const third = rankedPlayers[2];
        const compact = rankedPlayers.slice(3);

        return {
            podiumItems: [second, first, third],
            compactPlayers: compact,
        };
    }, [rankedPlayers]);

    const matchDrawings = state.matchDrawings || [];
    const awards = state.awards || null;

    // Contact Sheet generator: composes all match drawings into a single PNG grid on a hidden canvas
    const handleDownloadAll = () => {
        if (!matchDrawings || matchDrawings.length === 0) return;

        const N = matchDrawings.length;
        const cols = N <= 2 ? N : (N <= 4 ? 2 : 3);
        const rows = Math.ceil(N / cols);

        const cellWidth = 420;
        const cellCanvasHeight = 315; // 4:3
        const cellCardHeight = 390;
        const gap = 24;
        const padding = 32;
        const headerHeight = 100;
        const footerHeight = 40;

        const canvasWidth = padding * 2 + cols * cellWidth + (cols - 1) * gap;
        const canvasHeight = headerHeight + padding + rows * cellCardHeight + (rows - 1) * gap + footerHeight;

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background paper
        ctx.fillStyle = '#F3ECDD';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Header accent line
        ctx.fillStyle = '#D2381C';
        ctx.fillRect(0, 0, canvasWidth, 6);

        // Title
        ctx.fillStyle = '#1C1B18';
        ctx.font = 'bold 32px "Space Grotesk", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`SCRIBBLE · ROOM ${code || ''}`, padding, 32);

        ctx.fillStyle = '#8E8B82';
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.fillText(`${N} ${N === 1 ? 'drawing' : 'drawings'} from the match`, padding, 72);

        // Render each drawing
        matchDrawings.forEach((drawing, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = padding + col * (cellWidth + gap);
            const y = headerHeight + padding + row * (cellCardHeight + gap);

            ctx.save();
            ctx.fillStyle = '#FBF6EA';
            ctx.strokeStyle = '#1C1B18';
            ctx.lineWidth = 2;
            ctx.fillRect(x, y, cellWidth, cellCardHeight);
            ctx.strokeRect(x, y, cellWidth, cellCardHeight);

            // Card Header
            ctx.fillStyle = '#1C1B18';
            ctx.font = 'bold 14px "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Round ${drawing.round || idx + 1} · ${drawing.drawerName || 'Artist'}`, x + 16, y + 20);

            // Canvas drawing area
            const drawX = x + 16;
            const drawY = y + 40;
            const drawW = cellWidth - 32;
            const drawH = cellCanvasHeight - 20;

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(drawX, drawY, drawW, drawH);
            ctx.strokeRect(drawX, drawY, drawW, drawH);

            ctx.save();
            ctx.beginPath();
            ctx.rect(drawX, drawY, drawW, drawH);
            ctx.clip();

            const strokes = drawing.strokes || [];
            for (const stroke of strokes) {
                const points = stroke.points || [];
                if (points.length === 0) continue;

                ctx.save();
                ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : (stroke.color || '#1C1B18');
                ctx.lineWidth = Math.max(1.5, (stroke.size || 5) * (drawW / 800));
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                if (points.length === 1) {
                    const pt = points[0];
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.beginPath();
                    ctx.arc(drawX + pt.x * drawW, drawY + pt.y * drawH, ctx.lineWidth / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(drawX + points[0].x * drawW, drawY + points[0].y * drawH);
                    for (let i = 1; i < points.length; i++) {
                        ctx.lineTo(drawX + points[i].x * drawW, drawY + points[i].y * drawH);
                    }
                    ctx.stroke();
                }
                ctx.restore();
            }
            ctx.restore();

            // Word caption
            ctx.fillStyle = '#1C1B18';
            ctx.font = 'bold 18px "Space Grotesk", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((drawing.word || '').toUpperCase(), x + cellWidth / 2, y + cellCardHeight - 20);

            ctx.restore();
        });

        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scribble-match-${code || 'drawings'}-all.png`;
            a.click();
            URL.revokeObjectURL(url);
            setToastMessage(`Downloaded all ${N} drawings!`);
            setToastVariant('success');
        }, 'image/png');
    };

    return (
        <div className="flex-1 w-full max-w-[1000px] mx-auto bg-paper flex flex-col items-center p-4 sm:p-6 md:p-8 select-none">
            <Toast
                isOpen={Boolean(toastMessage)}
                onClose={() => setToastMessage('')}
                message={toastMessage}
                variant={toastVariant}
            />

            {/* Full-size Drawing Modal */}
            <DrawingModal
                drawing={selectedDrawing}
                isOpen={Boolean(selectedDrawing)}
                onClose={() => setSelectedDrawing(null)}
                onToast={(msg, variant) => {
                    setToastMessage(msg);
                    setToastVariant(variant || 'success');
                }}
            />

            <div className="w-full flex flex-col items-center gap-6 sm:gap-8">
                {/* 1. Header with Personal Line */}
                <div className="text-center">
                    <span
                        data-testid="personal-result-line"
                        className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink-soft block mb-1"
                    >
                        {myPlayer ? (
                            <>
                                You finished <span className="text-cobalt font-black">{getOrdinal(myPlayer.rank)}</span> with <span className="font-mono font-black text-ink">{myPlayer.score}</span> points
                            </>
                        ) : (
                            'Match Complete'
                        )}
                    </span>
                    <h1
                        tabIndex={-1}
                        className="text-4xl sm:text-5xl md:text-6xl font-black font-heading text-ink tracking-tight outline-none"
                    >
                        Winner's Circle
                    </h1>
                </div>

                {/* Winning Team Banner (Team Mode) */}
                {winningTeam && (
                    <div
                        data-testid="winning-team-banner"
                        className="px-6 py-3 rounded-[8px] border-2 border-ink shadow-hard flex items-center gap-3 text-white"
                        style={{ backgroundColor: winningTeam.color }}
                    >
                        <Crown className="w-6 h-6 fill-white" />
                        <span className="font-heading font-black text-xl sm:text-2xl uppercase tracking-wider">
                            {winningTeam.name} Wins!
                        </span>
                        <span className="font-mono font-bold text-sm bg-white/20 px-2.5 py-0.5 rounded-[4px]">
                            {winningTeam.score} pts
                        </span>
                    </div>
                )}

                {/* Accessible Ordered List of Standings (Visually Hidden) */}
                <ol className="sr-only">
                    {rankedPlayers.map((p) => (
                        <li key={p.id}>
                            {p.rank === 1 ? '1st place (Winner)' : `${getOrdinal(p.rank)} place`}: {p.username} with {p.score} points
                        </li>
                    ))}
                </ol>

                {/* 2. Podium (Staggered rise: 3rd, 2nd, 1st; spring avatars; hand-drawn crown; spot colors) */}
                {podiumItems.length > 0 && (
                    <div
                        data-testid="podium-container"
                        className="w-full max-w-lg flex items-end justify-center gap-2 sm:gap-4 pt-6 pb-2"
                    >
                        {podiumItems.map((player) => {
                            const isFirst = player.rank === 1;
                            const isSecond = player.rank === 2;

                            // Rising order: 3rd rises first (0.1s), 2nd (0.25s), 1st (0.4s)
                            let blockDelay = 0.1;
                            if (isSecond) blockDelay = 0.25;
                            if (isFirst) blockDelay = 0.4;

                            // Block height
                            let heightClass = 'h-20 sm:h-24';
                            if (isSecond) heightClass = 'h-28 sm:h-32';
                            if (isFirst) heightClass = 'h-36 sm:h-44';

                            // Block colors in spot palette
                            let bgClass = 'bg-tomato text-white border-2 border-ink shadow-hard';
                            if (isSecond) bgClass = 'bg-ink text-paper border-2 border-ink shadow-hard';
                            if (isFirst) bgClass = 'bg-marigold text-ink border-2 border-ink shadow-hard-lg';

                            return (
                                <motion.div
                                    key={player.id}
                                    initial={{ y: shouldReduceMotion ? 0 : 80, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 300,
                                        damping: 24,
                                        delay: shouldReduceMotion ? 0 : blockDelay,
                                    }}
                                    className={`flex-1 flex flex-col items-center ${isFirst ? 'z-elevated' : 'z-default'}`}
                                >
                                    {/* Avatar drops on with a spring */}
                                    <motion.div
                                        initial={{ y: shouldReduceMotion ? 0 : -35, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 350,
                                            damping: 20,
                                            delay: shouldReduceMotion ? 0 : blockDelay + 0.15,
                                        }}
                                        className="mb-2 text-center flex flex-col items-center"
                                    >
                                        {/* Winner wears hand-drawn crown SVG */}
                                        {isFirst && <HandDrawnCrown />}

                                        <Avatar
                                            avatarId={player.avatar}
                                            size={isFirst ? 'lg' : 'md'}
                                        />

                                        <p className="font-heading font-black text-xs sm:text-sm text-ink truncate max-w-[100px] mt-1">
                                            {player.username}
                                        </p>
                                        {player.teamName && (
                                            <span
                                                data-testid={`player-team-pill-${player.id}`}
                                                className="text-[9px] font-black uppercase text-white px-1.5 py-0.5 rounded-[3px] border border-ink mt-0.5"
                                                style={{ backgroundColor: player.teamColor || '#3B82F6' }}
                                            >
                                                {player.teamName}
                                            </span>
                                        )}
                                        <p className="font-mono font-bold text-xs text-ink-soft tabular-nums">
                                            {player.score} pts
                                        </p>
                                    </motion.div>

                                    {/* Podium Block */}
                                    <div
                                        className={`w-full ${heightClass} ${bgClass} rounded-t-[8px] flex flex-col items-center justify-center`}
                                    >
                                        <span className="font-mono font-black text-2xl sm:text-4xl">
                                            {player.rank}
                                        </span>
                                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest">
                                            {isFirst ? 'Winner' : getOrdinal(player.rank)}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* 3. Two Awards Cards Under Podium ('Best artist' & 'Fastest guesser') */}
                {awards && (awards.bestArtist || awards.fastestGuesser || awards.crowdFavourite) && (
                    <div
                        data-testid="awards-container"
                        className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                    >
                        {awards.bestArtist && (
                            <div className="bg-card border-2 border-ink rounded-[8px] p-3 shadow-hard-sm flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-marigold border-2 border-ink flex items-center justify-center shrink-0">
                                    <Palette className="w-5 h-5 text-ink" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                                        Best artist
                                    </span>
                                    <p className="font-heading font-black text-sm text-ink truncate">
                                        {awards.bestArtist.username}
                                    </p>
                                    <p className="text-[11px] font-mono text-ink-soft">
                                        {awards.bestArtist.avgTime}s avg guess
                                    </p>
                                </div>
                                <Avatar avatarId={awards.bestArtist.avatar} size="xs" />
                            </div>
                        )}

                        {awards.fastestGuesser && (
                            <div className="bg-card border-2 border-ink rounded-[8px] p-3 shadow-hard-sm flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-tomato border-2 border-ink flex items-center justify-center shrink-0 text-white">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                                        Fastest guesser
                                    </span>
                                    <p className="font-heading font-black text-sm text-ink truncate">
                                        {awards.fastestGuesser.username}
                                    </p>
                                    <p className="text-[11px] font-mono text-ink-soft">
                                        {awards.fastestGuesser.avgTime}s avg guess
                                    </p>
                                </div>
                                <Avatar avatarId={awards.fastestGuesser.avatar} size="xs" />
                            </div>
                        )}

                        {awards.crowdFavourite && (
                            <div
                                data-testid="award-crowd-favourite"
                                className="bg-card border-2 border-ink rounded-[8px] p-3 shadow-hard-sm flex items-center gap-3"
                            >
                                <div className="w-10 h-10 rounded-full bg-rose-100 border-2 border-ink flex items-center justify-center shrink-0 text-tomato">
                                    <Heart className="w-5 h-5 fill-tomato text-tomato" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">
                                        Crowd favourite
                                    </span>
                                    <p className="font-heading font-black text-sm text-ink truncate">
                                        {awards.crowdFavourite.username}
                                    </p>
                                    <p className="text-[11px] font-mono text-ink-soft">
                                        {awards.crowdFavourite.likes} {awards.crowdFavourite.likes === 1 ? 'like' : 'likes'}
                                    </p>
                                </div>
                                <Avatar avatarId={awards.crowdFavourite.avatar} size="xs" />
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Drawing of the Match (Swipeable strip, tap to view modal, Download all) */}
                {matchDrawings.length > 0 && (
                    <div className="w-full flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black font-heading text-ink">
                                    Drawings of the Match
                                </h2>
                                <p className="text-xs text-ink-soft">
                                    Tap any drawing to view full-size, download, or share
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs bg-card border-2 border-ink px-2 py-0.5 rounded-[4px] text-ink">
                                    {matchDrawings.length} {matchDrawings.length === 1 ? 'drawing' : 'drawings'}
                                </span>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleDownloadAll}
                                    className="flex items-center gap-1.5 font-bold text-xs"
                                    data-testid="download-all-drawings-btn"
                                >
                                    <Download className="w-3.5 h-3.5 text-ink" />
                                    Download all
                                </Button>
                            </div>
                        </div>

                        {/* Swipeable Strip */}
                        <div
                            data-testid="drawings-strip"
                            role="region"
                            aria-label="Drawings of the match"
                            tabIndex={0}
                            className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-hide max-w-full focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none rounded-[6px]"
                        >
                            {matchDrawings.map((drawing, idx) => (
                                <DrawingCard
                                    key={idx}
                                    drawing={drawing}
                                    onSelect={(d) => setSelectedDrawing(d)}
                                    onToast={(msg, variant) => {
                                        setToastMessage(msg);
                                        setToastVariant(variant || 'success');
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Compact Standings (Full Standings or Players from 4th place down, personal row in cobalt) */}
                <Card className="w-full p-4 sm:p-6 shadow-hard bg-card">
                    <h3 className="text-base sm:text-lg font-bold font-heading text-ink border-b-2 border-ink/10 pb-2 mb-3">
                        {compactPlayers.length > 0 ? 'Full Standings' : 'Final Scores'}
                    </h3>

                    <div className="flex flex-col gap-2">
                        {rankedPlayers.map((player) => {
                            const isMe = player.id === myId;
                            return (
                                <div
                                    key={player.id}
                                    data-testid={isMe ? 'user-standing-row' : 'standing-row'}
                                    className={`flex items-center justify-between p-2.5 rounded-[8px] border-2 transition-colors ${
                                        isMe
                                            ? 'bg-cobalt/10 border-cobalt shadow-hard-xs'
                                            : player.rank === 1
                                            ? 'bg-marigold/30 border-ink'
                                            : 'bg-paper border-ink'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="font-mono font-black text-xs sm:text-sm w-6 text-center text-ink">
                                            #{player.rank}
                                        </span>
                                        <Avatar avatarId={player.avatar} size="xs" />
                                        <span className="font-bold text-xs sm:text-sm truncate text-ink">
                                            {player.username}
                                        </span>
                                        {player.teamName && (
                                            <span
                                                data-testid={`player-standing-team-${player.id}`}
                                                className="text-[9px] font-black uppercase text-white px-1.5 py-0.5 rounded-[3px] border border-ink shrink-0"
                                                style={{ backgroundColor: player.teamColor || '#3B82F6' }}
                                            >
                                                {player.teamName}
                                            </span>
                                        )}
                                        {isMe && (
                                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-[4px] bg-cobalt text-white shrink-0">
                                                YOU
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-mono font-black text-xs sm:text-sm text-ink tabular-nums">
                                        {player.score} pts
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 5. Actions: 'Play again' / Waiting for host, and 'Leave' */}
                    <div className="mt-6 flex flex-col sm:flex-row items-stretch justify-center gap-3">
                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={handleLeave}
                            className="flex-1 uppercase font-bold"
                            data-testid="leave-game-btn"
                        >
                            Leave
                        </Button>

                        {isHost ? (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handlePlayAgain}
                                className="flex-1 uppercase font-bold"
                                data-testid="play-again-btn"
                            >
                                Play again
                            </Button>
                        ) : (
                            <div
                                data-testid="waiting-for-host"
                                className="flex-1 flex items-center justify-center py-2.5 px-4 rounded-[8px] bg-paper border-2 border-ink text-ink font-bold text-xs sm:text-sm shadow-hard-xs text-center"
                            >
                                Waiting for {hostName} to start another round
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default GameEnd;
