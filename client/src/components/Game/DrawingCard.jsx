import React, { useEffect, useRef } from 'react';
import { Download, Share2 } from 'lucide-react';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';

const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

export const DrawingCard = ({
    drawing,
    onSelect,
    onToast,
    className = '',
}) => {
    const canvasRef = useRef(null);

    // Redraw strokes onto the canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !drawing?.strokes) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = BASE_WIDTH;
        canvas.height = BASE_HEIGHT;

        // Paper background
        ctx.fillStyle = '#FBF6EA';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Draw each stroke
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
    }, [drawing]);

    const handleDownload = (e) => {
        e?.stopPropagation?.();
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

    const handleShare = async (e) => {
        e?.stopPropagation?.();
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

            // Fallback to direct download
            handleDownload();
        }, 'image/png');
    };

    const altText = `${drawing.drawerName || 'Player'}'s drawing of ${drawing.word || 'word'}`;

    return (
        <div
            data-testid="drawing-card"
            className={`flex flex-col bg-card border-2 border-ink rounded-[12px] shadow-hard p-3 w-64 sm:w-72 shrink-0 select-none ${className}`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Avatar avatarId={drawing.drawerAvatar || 'avatar-1'} size="xs" />
                    <span className="font-bold text-xs sm:text-sm text-ink truncate">
                        {drawing.drawerName || 'Artist'}
                    </span>
                </div>
                <span className="font-mono font-bold text-xs bg-paper border border-ink px-1.5 py-0.5 rounded-[4px] text-ink">
                    R{drawing.round || 1}
                </span>
            </div>

            {/* Canvas Preview Paper Button (opens full size modal) */}
            <button
                type="button"
                onClick={() => onSelect?.(drawing)}
                aria-label={`View ${altText} full size`}
                className="relative w-full aspect-[4/3] bg-paper border-2 border-ink rounded-[6px] overflow-hidden shadow-hard-sm cursor-pointer hover:opacity-95 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none transition-transform hover:-translate-y-0.5"
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-full block"
                    aria-label={altText}
                />
            </button>

            <div className="flex items-center justify-between mt-2.5">
                <span className="font-heading font-black text-base sm:text-lg text-ink capitalize truncate">
                    {drawing.word}
                </span>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownload}
                        aria-label={`Download drawing of ${drawing.word}`}
                        title="Download PNG"
                        className="p-1.5 min-h-[36px] w-[36px]"
                    >
                        <Download className="w-4 h-4 text-ink" />
                    </Button>

                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleShare}
                        aria-label={`Share drawing of ${drawing.word}`}
                        title="Share image"
                        className="p-1.5 min-h-[36px] w-[36px]"
                    >
                        <Share2 className="w-4 h-4 text-white" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DrawingCard;
