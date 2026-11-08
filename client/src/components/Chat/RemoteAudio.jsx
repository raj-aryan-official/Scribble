import React, { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';

const AudioItem = ({ stream, isDeafened, onAutoplayBlocked }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        const el = audioRef.current;
        if (!el || !stream) return;

        if (el.srcObject !== stream) {
            el.srcObject = stream;
        }
        el.muted = isDeafened;

        const playPromise = el.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
                    onAutoplayBlocked?.(true);
                }
            });
        }
    }, [stream, isDeafened, onAutoplayBlocked]);

    return (
        <audio
            ref={audioRef}
            autoPlay
            playsInline
            muted={isDeafened}
            aria-hidden="true"
            className="hidden"
        />
    );
};

export const RemoteAudio = ({
    streams = {},
    isDeafened = false,
    isAutoplayBlocked = false,
    onAutoplayBlocked,
    onEnableSound
}) => {
    return (
        <>
            {/* Render audio elements for all remote streams in state */}
            <div className="hidden" aria-hidden="true">
                {Object.entries(streams).map(([peerId, stream]) => (
                    <AudioItem
                        key={peerId}
                        peerId={peerId}
                        stream={stream}
                        isDeafened={isDeafened}
                        onAutoplayBlocked={onAutoplayBlocked}
                    />
                ))}
            </div>

            {/* First-tap 'Enable sound' prompt where autoplay is blocked */}
            {isAutoplayBlocked && (
                <div className="fixed top-16 md:top-6 left-1/2 -translate-x-1/2 z-toast bg-marigold text-ink px-4 py-2.5 rounded-[8px] border-2 border-ink shadow-hard flex items-center gap-3">
                    <Volume2 size={20} className="shrink-0 text-ink" />
                    <span className="text-xs md:text-sm font-bold">
                        Browser blocked voice audio. Tap to enable sound.
                    </span>
                    <button
                        type="button"
                        onClick={onEnableSound}
                        className="bg-card text-ink hover:bg-paper px-3 py-1 rounded-[6px] border-2 border-ink font-bold text-xs shadow-hard-sm transition active:translate-x-[1px] active:translate-y-[1px] cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                        aria-label="Enable sound"
                    >
                        Enable Sound
                    </button>
                </div>
            )}
        </>
    );
};

