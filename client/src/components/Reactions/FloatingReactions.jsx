import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioManager } from '../../audio/manager';
import { REACTION_DEFINITIONS } from './ReactionStickers';

const MAX_SPRITES = 40;
const DURATION_MS = 1500;
const SLOW_FRAME_THRESHOLD_MS = 24;

// Inline SVG strings for canvas rendering
const SVG_STRINGS = {
    heart: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#EF4444" stroke="#111827" stroke-width="1.75"/></svg>`,
    clap: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FBBF24" stroke="#111827" stroke-width="1.75"/><path d="M8 12.5L11 9.5M11.5 15.5L14.5 12.5M13 8.5L16 11.5" stroke="#111827" stroke-width="2" stroke-linecap="round"/><path d="M8 16c1.5-2 3.5-3 6-3" stroke="#111827" stroke-width="1.75" stroke-linecap="round"/></svg>`,
    laugh: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FDE047" stroke="#111827" stroke-width="1.75"/><path d="M7 9l3 2-3 2M17 9l-3 2 3 2" stroke="#111827" stroke-width="2" stroke-linecap="round"/><path d="M7 14c1.2 3 8.8 3 10 0" fill="#111827" stroke="#111827" stroke-width="1.5"/><path d="M9 14.5c.8 1.5 5.2 1.5 6 0" fill="#EF4444"/></svg>`,
    wow: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#60A5FA" stroke="#111827" stroke-width="1.75"/><circle cx="8.5" cy="9.5" r="1.5" fill="#111827"/><circle cx="15.5" cy="9.5" r="1.5" fill="#111827"/><ellipse cx="12" cy="15.5" rx="2.5" ry="3.5" fill="#111827"/></svg>`,
    fire: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12 2c-.5 3-4 5-4 9a6 6 0 1012 0c0-4-3.5-6-4-9-.5 2-2 3-4 0z" fill="#F97316" stroke="#111827" stroke-width="1.75"/><path d="M12 11c-.3 1.5-2 2.5-2 4.5a3 3 0 006 0c0-2-1.7-3-2-4.5-.2 1-1 1.5-2 0z" fill="#FDE047"/></svg>`,
    thinking: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#C084FC" stroke="#111827" stroke-width="1.75"/><circle cx="9" cy="8.5" r="1.5" fill="#111827"/><circle cx="15" cy="8.5" r="1.5" fill="#111827"/><path d="M9 15.5c2-.5 4-.5 6 0" stroke="#111827" stroke-width="2" stroke-linecap="round"/><path d="M7 19c2-1 4-1 6-2" stroke="#111827" stroke-width="2" stroke-linecap="round"/></svg>`,
    sad: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#38BDF8" stroke="#111827" stroke-width="1.75"/><circle cx="8.5" cy="10" r="1.5" fill="#111827"/><circle cx="15.5" cy="10" r="1.5" fill="#111827"/><path d="M16.5 13c0 1-.7 1.5-1 1.5s-1-.5-1-1.5c0-.8 1-2 1-2s1 1.2 1 2z" fill="#0284C7"/><path d="M8.5 16.5c1.5-1.5 5.5-1.5 7 0" stroke="#111827" stroke-width="2" stroke-linecap="round"/></svg>`,
    party: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M5 20l3.5-11 10.5 7.5L5 20z" fill="#F43F5E" stroke="#111827" stroke-width="1.75"/><path d="M6.5 15.5l7 5" stroke="#FDE047" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="5" r="1.5" fill="#FBBF24"/><circle cx="13" cy="4" r="1.2" fill="#38BDF8"/><circle cx="21" cy="9" r="1.2" fill="#A855F7"/></svg>`,
    like: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#EF4444" stroke="#111827" stroke-width="2"/></svg>`
};

const ACTION_DESCRIPTIONS = {
    heart: 'sent hearts',
    clap: 'clapped',
    laugh: 'laughed',
    wow: 'were surprised',
    fire: 'sent fire',
    thinking: 'are thinking',
    sad: 'sent sad faces',
    party: 'partied',
    like: 'liked the drawing'
};

export const FloatingReactions = ({
    incomingBatch = null,
    localReaction = null,
    localLike = false,
    className = ''
}) => {
    const canvasRef = useRef(null);
    const spritesRef = useRef([]);
    const imagesRef = useRef({});
    const rafRef = useRef(null);
    const lastPopTimeRef = useRef(0);
    const lastAnnouncementTimeRef = useRef(0);
    const [liveAnnouncement, setLiveAnnouncement] = useState('');
    const [badgeCounts, setBadgeCounts] = useState({});
    const [isReducedMotion, setIsReducedMotion] = useState(false);
    const [isSlowDevice, setIsSlowDevice] = useState(false);
    const slowFramesCountRef = useRef(0);
    const lastFrameTimeRef = useRef(0);

    // Check reduced motion preference
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setIsReducedMotion(mq.matches);

        const handler = (e) => setIsReducedMotion(e.matches);
        mq.addEventListener?.('change', handler);
        return () => mq.removeEventListener?.('change', handler);
    }, []);

    // Preload SVG Image objects
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const imgs = {};
        for (const [kind, svg] of Object.entries(SVG_STRINGS)) {
            const img = new Image();
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            imgs[kind] = img;
        }
        imagesRef.current = imgs;
    }, []);

    // Sound effect trigger (throttled to max once per 200ms)
    const playPopSound = useCallback(() => {
        const now = Date.now();
        if (now - lastPopTimeRef.current >= 200) {
            lastPopTimeRef.current = now;
            audioManager.play('pop');
        }
    }, []);

    // Accessibility announcement (throttled to at most once per 1.5s)
    const announceReactions = useCallback((kind, count) => {
        const now = Date.now();
        if (now - lastAnnouncementTimeRef.current >= 1500) {
            lastAnnouncementTimeRef.current = now;
            const desc = ACTION_DESCRIPTIONS[kind] || 'reacted';
            const countStr = count === 1 ? '1 player' : `${count} players`;
            setLiveAnnouncement(`${countStr} ${desc}`);
        }
    }, []);

    // Spawn a sprite into pool (capped at MAX_SPRITES)
    const spawnSprite = useCallback((kind) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // If reduced motion or slow device, update badge instead of floating
        if (isReducedMotion || isSlowDevice) {
            setBadgeCounts(prev => ({
                ...prev,
                [kind]: (prev[kind] || 0) + 1
            }));
            // Clear badge count after 3 seconds
            setTimeout(() => {
                setBadgeCounts(prev => {
                    const next = { ...prev };
                    if (next[kind]) {
                        next[kind] = Math.max(0, next[kind] - 1);
                        if (next[kind] === 0) delete next[kind];
                    }
                    return next;
                });
            }, 3000);
            return;
        }

        const width = canvas.width;
        const height = canvas.height;

        // Pool cap at MAX_SPRITES
        if (spritesRef.current.length >= MAX_SPRITES) {
            // Drop oldest
            spritesRef.current.shift();
        }

        // Random horizontal start within bottom 20% to 80% of width
        const startX = width * 0.15 + Math.random() * (width * 0.7);
        const startY = height - 10;
        const size = kind === 'like' ? 36 : 30 + Math.random() * 8;

        spritesRef.current.push({
            kind,
            startX,
            startY,
            size,
            swayOffset: Math.random() * Math.PI * 2,
            swayAmplitude: 14 + Math.random() * 12,
            createdAt: performance.now(),
            duration: DURATION_MS
        });
    }, [isReducedMotion, isSlowDevice]);

    // Handle local user reaction (instant float)
    useEffect(() => {
        if (!localReaction) return;
        spawnSprite(localReaction.kind);
        playPopSound();
    }, [localReaction, spawnSprite, playPopSound]);

    // Handle local like
    useEffect(() => {
        if (!localLike) return;
        spawnSprite('like');
        playPopSound();
    }, [localLike, spawnSprite, playPopSound]);

    // Handle incoming batch from server
    useEffect(() => {
        if (!incomingBatch || !incomingBatch.reactions) return;

        let totalCount = 0;
        let lastKind = null;

        for (const [kind, count] of Object.entries(incomingBatch.reactions)) {
            if (count > 0) {
                lastKind = kind;
                totalCount += count;
                // Spawn up to count sprites, capped so batch doesn't exceed pool
                const toSpawn = Math.min(count, 8);
                for (let i = 0; i < toSpawn; i++) {
                    // Stagger slightly if multiple
                    setTimeout(() => {
                        spawnSprite(kind);
                    }, i * 40);
                }
            }
        }

        if (totalCount > 0) {
            playPopSound();
            if (lastKind) {
                announceReactions(lastKind, totalCount);
            }
        }
    }, [incomingBatch, spawnSprite, playPopSound, announceReactions]);

    // Main animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Resize handler to maintain sharp 1:1 canvas pixels
        const resize = () => {
            if (canvas && canvas.parentElement) {
                const rect = canvas.parentElement.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        };
        resize();
        window.addEventListener('resize', resize);

        const render = (now) => {
            // Measure frame time for slow device detection (> 24 ms)
            if (lastFrameTimeRef.current > 0) {
                const dt = now - lastFrameTimeRef.current;
                if (dt > SLOW_FRAME_THRESHOLD_MS) {
                    slowFramesCountRef.current += 1;
                    if (slowFramesCountRef.current > 8 && !isSlowDevice) {
                        setIsSlowDevice(true);
                    }
                } else {
                    slowFramesCountRef.current = Math.max(0, slowFramesCountRef.current - 0.5);
                }
            }
            lastFrameTimeRef.current = now;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Filter expired sprites
            const currentSprites = spritesRef.current.filter((sprite) => {
                return now - sprite.createdAt < sprite.duration;
            });
            spritesRef.current = currentSprites;

            // Draw active sprites
            const imgs = imagesRef.current;
            for (let i = 0; i < currentSprites.length; i++) {
                const s = currentSprites[i];
                const elapsed = now - s.createdAt;
                const progress = elapsed / s.duration; // 0 to 1

                // Float upward with cubic ease-out
                const y = s.startY - (progress * (canvas.height * 0.8));
                // Sway horizontally with sine wave
                const sway = Math.sin(progress * Math.PI * 3 + s.swayOffset) * s.swayAmplitude;
                const x = s.startX + sway;

                // Alpha fade out during last 25% of life
                let alpha = 1;
                if (progress > 0.75) {
                    alpha = Math.max(0, 1 - (progress - 0.75) / 0.25);
                }

                // Initial scale pop
                let scale = 1;
                if (progress < 0.1) {
                    scale = progress / 0.1;
                }

                const img = imgs[s.kind] || imgs.heart;
                if (img && img.complete) {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    const drawSize = s.size * scale;
                    ctx.drawImage(img, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
                    ctx.restore();
                }
            }

            rafRef.current = requestAnimationFrame(render);
        };

        rafRef.current = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', resize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isSlowDevice]);

    const activeBadgeEntries = Object.entries(badgeCounts).filter(([, count]) => count > 0);

    return (
        <div
            data-testid="floating-reactions-container"
            className={`absolute inset-0 pointer-events-none overflow-hidden z-20 ${className}`}
        >
            {/* Polite screen reader live region */}
            <div className="sr-only" role="status" aria-live="polite">
                {liveAnnouncement}
            </div>

            {/* Canvas overlay for floating sprites */}
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
                data-testid="reactions-canvas"
            />

            {/* Fallback badges when device is slow or user prefers reduced motion */}
            {(isReducedMotion || isSlowDevice) && activeBadgeEntries.length > 0 && (
                <div
                    data-testid="reaction-badges-overlay"
                    className="absolute bottom-4 right-4 flex flex-wrap gap-1.5 max-w-[200px] justify-end"
                >
                    {activeBadgeEntries.map(([kind, count]) => {
                        const def = REACTION_DEFINITIONS.find(d => d.kind === kind);
                        return (
                            <span
                                key={kind}
                                className="inline-flex items-center gap-1 bg-paper/95 border-2 border-ink rounded-full px-2.5 py-0.5 font-heading font-black text-xs shadow-hard-xs animate-in fade-in zoom-in-75"
                            >
                                <span>{def?.emoji || '❤️'}</span>
                                <span className="font-mono text-ink">x{count}</span>
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FloatingReactions;

