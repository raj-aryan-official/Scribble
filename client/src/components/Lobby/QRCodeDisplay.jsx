import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, X } from 'lucide-react';
import Button from '../ui/Button';

export const QRCodeDisplay = ({ url, onClose, onCopied }) => {
    const [svgContent, setSvgContent] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        QRCode.toString(url, {
            type: 'svg',
            margin: 1,
            color: {
                dark: '#1C1B18',
                light: '#00000000',
            },
        })
            .then((svg) => {
                if (isMounted) {
                    setSvgContent(svg);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setError(true);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [url]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            onCopied?.('Invite link copied to clipboard');
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Ignore
        }
    };

    return (
        <div className="bg-card border-2 border-ink shadow-hard rounded-[12px] p-4 flex flex-col items-center text-center relative animate-in fade-in zoom-in-95 duration-150">
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 text-ink-soft hover:text-ink rounded-[6px] hover:bg-paper cursor-pointer"
                    aria-label="Close QR code"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            <span className="text-xs font-black uppercase tracking-wider text-ink mb-1">
                Scan to Join
            </span>
            <p className="text-xs text-ink-soft mb-3">
                Point your phone camera here to join immediately.
            </p>

            <div className="w-44 h-44 sm:w-48 sm:h-48 bg-paper border-2 border-ink rounded-[8px] p-2 flex items-center justify-center shadow-hard-sm">
                {svgContent ? (
                    <div
                        dangerouslySetInnerHTML={{ __html: svgContent }}
                        className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                    />
                ) : error ? (
                    <span className="text-xs font-bold text-tomato">Failed to generate QR</span>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                        <span className="text-[11px] text-ink-soft">Drawing QR...</span>
                    </div>
                )}
            </div>

            <div className="mt-3 flex items-center gap-2 w-full justify-center">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopy}
                    className="text-xs min-h-[36px] flex items-center gap-1.5 font-bold"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-leaf" /> : <Copy className="w-3.5 h-3.5 text-ink" />}
                    <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
                </Button>
            </div>
        </div>
    );
};

export default QRCodeDisplay;

