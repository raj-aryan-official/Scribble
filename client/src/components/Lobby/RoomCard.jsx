import React from 'react';
import { Copy, Check, Share2, QrCode } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

export const RoomCard = ({
    code,
    copiedCode = false,
    copiedLink = false,
    onCopyCode,
    onCopyLink,
    onShare,
    showQR = false,
    onToggleQR,
    children,
}) => {
    return (
        <Card className="flex flex-col gap-4 shadow-hard bg-card p-4 sm:p-5">
            {/* Hand-lettered Room Code Tag */}
            <div className="flex flex-col items-center text-center">
                <span className="text-[11px] font-black uppercase tracking-widest text-ink-soft mb-1">
                    Room Code
                </span>
                <div
                    className="relative bg-paper border-2 border-ink shadow-hard-sm px-6 py-2.5 rounded-[8px] transform -rotate-1 select-all"
                    title={`Room Code: ${code}`}
                >
                    {/* Decorative tag hole */}
                    <span
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-card border-2 border-ink"
                        aria-hidden="true"
                    />
                    <span className="font-heading font-black text-3xl sm:text-4xl text-ink tracking-widest uppercase ml-3">
                        {code}
                    </span>
                </div>
            </div>

            {/* Three Actions: Copy code, Copy link, Share + Show QR toggle */}
            <div className="grid grid-cols-2 gap-2 mt-1">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onCopyCode}
                    aria-label="Copy room code"
                    className="min-h-[40px] px-2.5 flex items-center justify-center gap-1.5 text-xs font-black uppercase"
                >
                    {copiedCode ? (
                        <>
                            <Check className="w-4 h-4 text-leaf" />
                            <span>Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4 text-ink" />
                            <span>Copy Code</span>
                        </>
                    )}
                </Button>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onCopyLink}
                    aria-label="Copy invite link"
                    className="min-h-[40px] px-2.5 flex items-center justify-center gap-1.5 text-xs font-black uppercase"
                >
                    {copiedLink ? (
                        <>
                            <Check className="w-4 h-4 text-leaf" />
                            <span>Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4 text-ink" />
                            <span>Copy Link</span>
                        </>
                    )}
                </Button>

                <Button
                    variant="primary"
                    size="sm"
                    onClick={onShare}
                    aria-label="Share room invite"
                    className="min-h-[40px] px-2.5 flex items-center justify-center gap-1.5 text-xs font-black uppercase bg-cobalt hover:bg-cobalt/90 text-white"
                >
                    <Share2 className="w-4 h-4 text-white" />
                    <span>Share</span>
                </Button>

                <Button
                    variant={showQR ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={onToggleQR}
                    aria-label={showQR ? 'Hide QR Code' : 'Show QR Code'}
                    className={`min-h-[40px] px-2.5 flex items-center justify-center gap-1.5 text-xs font-black uppercase ${
                        showQR ? 'bg-marigold text-ink hover:bg-marigold' : ''
                    }`}
                >
                    <QrCode className="w-4 h-4" />
                    <span>{showQR ? 'Hide QR' : 'Show QR'}</span>
                </Button>
            </div>

            {/* Lazy-loaded QR Code display slot */}
            {children}
        </Card>
    );
};

export default RoomCard;
