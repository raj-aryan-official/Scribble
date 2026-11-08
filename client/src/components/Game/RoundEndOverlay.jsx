import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Zap, Heart } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { useSound } from '../../hooks/useSound';
import { ReactionIcon } from '../Reactions/ReactionStickers';

export const RoundEndOverlay = ({
    word = '',
    scores = {},
    gained = {},
    gains = null,
    fastestGuesserId = null,
    drawerBonus = 0,
    drawerId = null,
    nextDrawerId = null,
    nextDrawerName = null,
    nextDrawerAvatar = null,
    strokes = [],
    players = [],
    duration = 5,
    isHost = false,
    reason = null,
    departedDrawerName = null,
    likesCount = 0,
    topReaction = null,
    onSkip,
    onComplete,
}) => {
    const shouldReduceMotion = useReducedMotion();
    const { play } = useSound();
    const headingRef = useRef(null);
    const thumbnailCanvasRef = useRef(null);
    const soundPlayedRef = useRef(false);

    // Compute player rows
    const computedRows = useMemo(() => {
        return players.map((p) => {
            let playerGained = 0;
            let playerTotal = scores[p.id] || 0;

            if (Array.isArray(gains)) {
                const found = gains.find((g) => g.id === p.id);
                if (found) {
                    playerGained = found.gained || 0;
                    if (found.total !== undefined) {
                        playerTotal = found.total;
                    }
                }
            } else if (gained && gained[p.id] !== undefined) {
                playerGained = gained[p.id] || 0;
            }

            const prevTotal = Math.max(0, playerTotal - playerGained);
            const isDrawer = p.id === drawerId;
            const isFastest = p.id === fastestGuesserId && playerGained > 0;
            const bonus = isDrawer ? (drawerBonus || playerGained) : 0;

            return {
                id: p.id,
                name: p.username,
                avatar: p.avatar,
                gained: playerGained,
                total: playerTotal,
                prevTotal,
                isDrawer,
                isFastest,
                drawerBonus: bonus,
            };
        });
    }, [players, scores, gained, gains, fastestGuesserId, drawerId, drawerBonus]);

    const hasAnyGains = useMemo(() => {
        return computedRows.some((r) => r.gained > 0);
    }, [computedRows]);

    // Next drawer lookup
    const nextDrawer = useMemo(() => {
        if (!nextDrawerId) return null;
        const found = players.find((p) => p.id === nextDrawerId);
        if (found) return found;
        return {
            id: nextDrawerId,
            username: nextDrawerName || 'Next player',
            avatar: nextDrawerAvatar || 'avatar-1',
        };
    }, [nextDrawerId, nextDrawerName, nextDrawerAvatar, players]);

    // Focus heading on mount
    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    // Sound effect on open: chime if someone scored, softer tone if nobody scored
    useEffect(() => {
        if (soundPlayedRef.current) return;
        soundPlayedRef.current = true;

        if (hasAnyGains) {
            play('roundEnd');
        } else {
            play('pencilTap');
        }
    }, [hasAnyGains, play]);

    // Smooth layout reordering state: start in previous rank order, glide into gain-sorted order
    const [isReordered, setIsReordered] = useState(shouldReduceMotion);
    useEffect(() => {
        if (shouldReduceMotion) {
            setIsReordered(true);
            return;
        }
        const timer = setTimeout(() => {
            setIsReordered(true);
        }, 150);
        return () => clearTimeout(timer);
    }, [shouldReduceMotion]);

    const displayedRows = useMemo(() => {
        const copy = [...computedRows];
        if (!isReordered) {
            return copy.sort((a, b) => b.prevTotal - a.prevTotal);
        }
        return copy.sort((a, b) => {
            if (b.gained !== a.gained) {
                return b.gained - a.gained;
            }
            return b.total - a.total;
        });
    }, [computedRows, isReordered]);

    // Count-up progress over 600 ms with tabular numbers
    const [countProgress, setCountProgress] = useState(shouldReduceMotion ? 1 : 0);
    useEffect(() => {
        if (shouldReduceMotion) {
            setCountProgress(1);
            return;
        }
        let startTime = null;
        let rafId = null;

        const animateCount = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(1, elapsed / 600);
            setCountProgress(progress);

            if (progress < 1) {
                rafId = requestAnimationFrame(animateCount);
            }
        };

        rafId = requestAnimationFrame(animateCount);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [shouldReduceMotion]);

    // 5-second draining bar & countdown timer
    const [drainPercent, setDrainPercent] = useState(100);
    const [secondsLeft, setSecondsLeft] = useState(duration);

    useEffect(() => {
        const startTime = Date.now();
        const totalMs = duration * 1000;
        const endTime = startTime + totalMs;
        let rafId = null;

        const tick = () => {
            const now = Date.now();
            const remaining = Math.max(0, endTime - now);
            const percent = (remaining / totalMs) * 100;
            setDrainPercent(percent);
            setSecondsLeft(Math.ceil(remaining / 1000));

            if (remaining > 0) {
                rafId = requestAnimationFrame(tick);
            } else {
                onComplete?.();
            }
        };

        rafId = requestAnimationFrame(tick);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [duration, onComplete]);

    // Render thumbnail of drawing
    useEffect(() => {
        const canvas = thumbnailCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#FBF6EA';
        ctx.fillRect(0, 0, w, h);

        if (!strokes || strokes.length === 0) {
            ctx.fillStyle = '#8E8B82';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No drawing', w / 2, h / 2);
            return;
        }

        for (const stroke of strokes) {
            const points = stroke.points || [];
            if (points.length === 0) continue;

            ctx.save();
            ctx.strokeStyle = stroke.tool === 'eraser' ? '#FBF6EA' : (stroke.color || '#1C1B18');
            const strokeWidth = Math.max(1, (stroke.size || 5) * (w / 800));
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (points.length === 1) {
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(points[0].x * w, points[0].y * h, strokeWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(points[0].x * w, points[0].y * h);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x * w, points[i].y * h);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }, [strokes]);

    // Polite live announcement for screen readers (announced once)
    const liveAnnouncement = useMemo(() => {
        if (!word) return '';
        const wordUpper = word.toUpperCase();
        if (!hasAnyGains) {
            return `The word was ${wordUpper}. Nobody got it this time.`;
        }
        const winners = computedRows
            .filter((r) => r.gained > 0)
            .map((r) => `${r.name} gained ${r.gained} points`)
            .join(', ');
        return `The word was ${wordUpper}. ${winners}`;
    }, [word, hasAnyGains, computedRows]);

    return (
        <div
            data-testid="round-end-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="round-end-heading"
            tabIndex={-1}
            className="absolute inset-0 z-sheet bg-ink/40 flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto select-none"
        >
            {/* Screen Reader polite announcement */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {liveAnnouncement}
            </div>

            {/* Central Round-End Paper Card */}
            <div className="bg-paper border-2 border-ink rounded-[12px] shadow-hard p-3 sm:p-5 max-w-lg w-full flex flex-col gap-3 max-h-[95%] overflow-y-auto">
                {/* Drawer Left Notice */}
                {reason === 'drawer-left' && (
                    <div
                        role="status"
                        aria-live="polite"
                        data-testid="drawer-left-notice"
                        className="w-full bg-marigold text-ink font-bold px-3 py-1.5 rounded-[6px] border-2 border-ink shadow-hard-xs text-xs sm:text-sm text-center mb-1"
                    >
                        {departedDrawerName || 'Maya'} left. Skipping to the next drawer.
                    </div>
                )}

                {/* Word Reveal Header */}
                <div className="text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft block">
                        The word was
                    </span>
                    <h2
                        id="round-end-heading"
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-2xl sm:text-3xl md:text-4xl font-black font-heading text-ink uppercase tracking-wide outline-none mt-0.5"
                    >
                        {word}
                    </h2>
                    {!hasAnyGains && (
                        <p className="text-xs sm:text-sm font-bold text-tomato mt-1">
                            Nobody got it this time.
                        </p>
                    )}

                    {/* Reactions & Likes summary */}
                    {(likesCount > 0 || topReaction) && (
                        <div
                            data-testid="round-end-reactions"
                            className="mt-2 inline-flex items-center justify-center gap-3 py-1 px-3 bg-neutral-100 rounded-lg border border-ink/20 text-xs font-bold"
                        >
                            {likesCount > 0 && (
                                <span className="flex items-center gap-1 text-tomato" data-testid="round-end-likes">
                                    <Heart className="w-3.5 h-3.5 fill-tomato text-tomato" />
                                    <span>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</span>
                                </span>
                            )}
                            {topReaction && (
                                <span className="flex items-center gap-1 text-ink" data-testid="round-end-top-reaction">
                                    <span className="text-ink-soft">Top:</span>
                                    <ReactionIcon kind={topReaction.kind} size={16} />
                                    <span className="font-mono">{topReaction.count}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Score Table & Drawing Thumbnail Row */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 w-full my-1">
                    {/* Score Table */}
                    <div
                        className="flex-1 w-full flex flex-col gap-1.5 min-w-0"
                        role="list"
                        aria-label="Round scores"
                    >
                        {displayedRows.map((item, index) => {
                            const displayedGained = Math.round(item.gained * countProgress);
                            const displayedTotal = item.prevTotal + displayedGained;

                            return (
                                <motion.div
                                    key={item.id}
                                    role="listitem"
                                    layout={!shouldReduceMotion}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 350,
                                        damping: 28,
                                    }}
                                    className={`flex items-center justify-between p-2 sm:p-2.5 rounded-[8px] border-2 border-ink shadow-hard-xs ${
                                        item.gained > 0 ? 'bg-card' : 'bg-paper'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono font-black text-xs sm:text-sm w-5 text-center text-ink shrink-0">
                                            #{index + 1}
                                        </span>
                                        <Avatar avatarId={item.avatar} size="xs" />
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-xs sm:text-sm text-ink truncate max-w-[110px] sm:max-w-[140px]">
                                                    {item.name}
                                                </span>
                                                {item.isFastest && (
                                                    <span
                                                        data-testid="fastest-badge"
                                                        className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 bg-marigold text-ink border border-ink rounded-[4px] shrink-0"
                                                    >
                                                        <Zap className="w-2.5 h-2.5 fill-ink stroke-ink" aria-hidden="true" />
                                                        Fastest
                                                    </span>
                                                )}
                                            </div>
                                            {item.isDrawer && item.drawerBonus > 0 && (
                                                <span
                                                    data-testid="drawer-bonus-badge"
                                                    className="text-[10px] font-bold text-ink-soft shrink-0"
                                                >
                                                    Drawer bonus +{Math.round(item.drawerBonus * countProgress)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Screen reader final values immediately */}
                                    <span className="sr-only">
                                        {item.name}: +{item.gained} points, total {item.total} points
                                    </span>

                                    {/* Visible animated numbers */}
                                    <div aria-hidden="true" className="flex items-center gap-2 shrink-0">
                                        {item.gained > 0 ? (
                                            <span className="font-mono font-bold text-xs bg-leaf text-white px-2 py-0.5 rounded-[4px] border border-ink tabular-nums">
                                                +{displayedGained}
                                            </span>
                                        ) : (
                                            <span className="font-mono font-bold text-xs text-ink-soft px-1 tabular-nums">
                                                +0
                                            </span>
                                        )}
                                        <span className="font-mono font-black text-xs sm:text-sm text-ink tabular-nums w-12 sm:w-14 text-right">
                                            {displayedTotal} pts
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Thumbnail of Drawing */}
                    <div className="shrink-0 flex flex-col items-center justify-center p-2 bg-card rounded-[8px] border-2 border-ink shadow-hard-xs self-center sm:self-start">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1">
                            Drawing
                        </span>
                        <canvas
                            ref={thumbnailCanvasRef}
                            data-testid="round-end-thumbnail"
                            width={160}
                            height={120}
                            className="w-28 sm:w-36 aspect-4/3 rounded-[4px] border border-ink/40 bg-paper object-contain"
                            aria-label={`Drawing thumbnail for ${word}`}
                        />
                    </div>
                </div>

                {/* Bottom Countdown, Next Drawer & Host Skip */}
                <div className="w-full flex flex-col gap-2 pt-2 border-t-2 border-ink/10 mt-1">
                    {/* 5 s draining countdown bar */}
                    <div className="w-full h-2 bg-card rounded-full border-2 border-ink overflow-hidden p-0.5">
                        <div
                            data-testid="countdown-drain-bar"
                            className="h-full bg-tomato rounded-full transition-all duration-75"
                            style={{ width: `${Math.max(0, Math.min(100, drainPercent))}%` }}
                        />
                    </div>

                    {/* Next Drawer Notice & Host Skip button */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            {nextDrawer ? (
                                <>
                                    <Avatar avatarId={nextDrawer.avatar} size="xs" />
                                    <span className="text-xs sm:text-sm font-bold text-ink truncate">
                                        Next: <span className="text-cobalt font-black">{nextDrawer.username}</span> draws
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs sm:text-sm font-bold text-ink-soft">
                                    Final scores next...
                                </span>
                            )}
                            <span className="text-[11px] font-mono font-bold text-ink-soft ml-1">
                                ({secondsLeft}s)
                            </span>
                        </div>

                        {isHost && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onSkip}
                                className="shrink-0 text-xs py-1 px-3"
                                data-testid="skip-round-end-button"
                            >
                                Skip
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoundEndOverlay;
