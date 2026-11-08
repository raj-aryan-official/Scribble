import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export const SeatClaimModal = ({
    isOpen,
    username = 'Player',
    timeout = 20,
    endsAt = null,
    onAccept,
    onDecline,
}) => {
    const totalDuration = timeout;
    const [secondsLeft, setSecondsLeft] = useState(() => {
        if (!endsAt) return totalDuration;
        return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    });

    useEffect(() => {
        if (!isOpen) return;

        const updateSeconds = () => {
            if (endsAt) {
                const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
                setSecondsLeft(left);
                if (left <= 0) {
                    onDecline?.();
                }
            } else {
                setSecondsLeft((prev) => {
                    const next = Math.max(0, prev - 1);
                    if (next <= 0) {
                        onDecline?.();
                    }
                    return next;
                });
            }
        };

        updateSeconds();
        const interval = setInterval(updateSeconds, endsAt ? 250 : 1000);
        return () => clearInterval(interval);
    }, [isOpen, endsAt, onDecline]);

    // SVG timer ring values (32px diameter, r=13 -> circ = 2 * PI * 13 ≈ 81.68)
    const radius = 13;
    const circumference = 2 * Math.PI * radius;
    const fraction = totalDuration > 0 ? Math.max(0, Math.min(1, secondsLeft / totalDuration)) : 0;
    const strokeDashoffset = circumference * (1 - fraction);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onDecline}
            title={`${username} wants to take back their seat`}
            showCloseButton={false}
            className="max-w-md select-none"
        >
            <div data-testid="seat-claim-modal" className="flex flex-col gap-5 pt-2">
                <div className="flex items-center gap-3">
                    {/* Shrinking 32px countdown ring */}
                    <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
                            <circle
                                cx="16"
                                cy="16"
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="text-ink/10"
                            />
                            <circle
                                cx="16"
                                cy="16"
                                r={radius}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="text-marigold transition-all duration-200"
                            />
                        </svg>
                        <span
                            data-testid="seat-claim-countdown"
                            className="absolute font-mono font-bold text-xs text-ink"
                        >
                            {secondsLeft}s
                        </span>
                    </div>

                    <p className="text-xs sm:text-sm text-ink-soft font-medium leading-relaxed">
                        This player was disconnected and is asking to return to their seat with their score intact.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={onAccept}
                        data-testid="seat-claim-accept-btn"
                        className="w-full font-bold uppercase min-h-[44px]"
                    >
                        Accept
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={onDecline}
                        data-testid="seat-claim-decline-btn"
                        className="w-full font-bold uppercase min-h-[44px]"
                    >
                        Decline
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SeatClaimModal;
