import React, { useEffect, useRef } from 'react';
import { Download, Share2, X } from 'lucide-react';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';

const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

export const DrawingModal = ({
    drawing,
    isOpen,
    onClose,
    onToast,
}) => {
    const canvasRef = useRef(null);
    const modalRef = useRef(null);
    const closeBtnRef = useRef(null);

    // Auto-focus close button on open
    useEffect(() => {
        if (isOpen) {
            closeBtnRef.current?.focus();
        }
    }, [isOpen]);

    // Focus trap & Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusables = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusables.length === 0) return;

                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Redraw strokes onto the canvas
    useEffect(() => {
        if (!isOpen || !drawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = BASE_WIDTH;
        canvas.height = BASE_HEIGHT;

        // Paper background
        ctx.fillStyle = '#FBF6EA';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        const strokes = drawing.strokes || [];
        for (const stroke of strokes) {
            const points = stroke.points || [];
            if (points.length < 1) continue;

            ctx.save();
            ctx.strokeStyle = stroke.tool === 'eraser' ? '#FBF6EA' : (stroke.color || '#1C1B18');
            ctx.lineWidth = Math.max(2, (stroke.size || 5) * (BASE_WIDTH / 800));
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (points.length === 1) {
                const pt = points[0];
                const x = pt.x * BASE_WIDTH;
                const y = pt.y * BASE_HEIGHT;
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(points[0].x * BASE_WIDTH, points[0].y * BASE_HEIGHT);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x * BASE_WIDTH, points[i].y * BASE_HEIGHT);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }, [isOpen, drawing]);

    if (!isOpen || !drawing) return null;

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scribble-${drawing.word || 'drawing'}.png`;
            a.click();
            URL.revokeObjectURL(url);
            onToast?.(`Downloaded "${drawing.word}" drawing!`, 'success');
        }, 'image/png');
    };

    const handleShare = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob(async (blob) => {
            if (!blob) return;

            const file = new File([blob], `${drawing.word || 'drawing'}.png`, {
                type: 'image/png',
            });

            if (
                typeof navigator !== 'undefined' &&
                typeof navigator.canShare === 'function' &&
                navigator.canShare({ files: [file] })
            ) {
                try {
                    await navigator.share({
                        title: `Drawing of "${drawing.word}" on Scribble`,
                        text: `Check out ${drawing.drawerName}'s drawing of "${drawing.word}" on Scribble!`,
                        files: [file],
                    });
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                }
            }

            handleDownload();
        }, 'image/png');
    };

    const altText = `${drawing.drawerName || 'Player'}'s drawing of ${drawing.word || 'word'}`;

    return (
        <div
            data-testid="drawing-modal-backdrop"
            className="fixed inset-0 z-modal bg-ink/60 flex items-center justify-center p-3 sm:p-6 backdrop-blur-none"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                data-testid="drawing-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-drawing-title"
                className="bg-paper border-2 border-ink rounded-[12px] shadow-hard-lg max-w-2xl w-full p-4 sm:p-6 flex flex-col gap-4 select-none max-h-[95vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-ink/10 pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar avatarId={drawing.drawerAvatar || 'avatar-1'} size="sm" />
                        <div>
                            <p className="font-bold text-sm text-ink truncate">
                                {drawing.drawerName || 'Artist'}
                            </p>
                            <p className="font-mono text-xs text-ink-soft">
                                Round {drawing.round || 1}
                            </p>
                        </div>
                    </div>

                    <Button
                        ref={closeBtnRef}
                        variant="secondary"
                        size="sm"
                        onClick={onClose}
                        aria-label="Close drawing modal"
                        className="p-1.5 min-h-[36px] w-[36px]"
                    >
                        <X className="w-5 h-5 text-ink" />
                    </Button>
                </div>

                {/* Canvas Display */}
                <div
                    className="relative w-full aspect-4/3 bg-card border-2 border-ink rounded-[8px] overflow-hidden shadow-hard-sm"
                    aria-label={altText}
                >
                    <canvas
                        ref={canvasRef}
                        className="w-full h-full block"
                        aria-label={altText}
                    />
                </div>

                {/* Footer with Title and Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    <h2
                        id="modal-drawing-title"
                        className="font-heading font-black text-xl sm:text-2xl text-ink uppercase tracking-wide text-center sm:text-left"
                    >
                        {drawing.word}
                    </h2>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={handleDownload}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 font-bold"
                        >
                            <Download className="w-4 h-4 text-ink" />
                            Download PNG
                        </Button>

                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleShare}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 font-bold"
                        >
                            <Share2 className="w-4 h-4 text-white" />
                            Share
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrawingModal;
