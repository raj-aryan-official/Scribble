import React, { useState, useEffect, useRef, useCallback } from 'react';

export const TimerBar = ({
    roundEndsAt,
    totalTime = 60,
    timeLeft: fallbackTimeLeft = 60,
    className = '',
}) => {
    const calculateSeconds = useCallback(() => {
        if (roundEndsAt && typeof roundEndsAt === 'number') {
            return Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000));
        }
        return Math.max(0, fallbackTimeLeft || 0);
    }, [roundEndsAt, fallbackTimeLeft]);

    const [secondsLeft, setSecondsLeft] = useState(calculateSeconds);
    const [announcement, setAnnouncement] = useState('');
    const lastAnnouncedRef = useRef(null);

    // Update smooth countdown
    useEffect(() => {
        setSecondsLeft(calculateSeconds());

        const interval = setInterval(() => {
            const current = calculateSeconds();
            setSecondsLeft(current);
        }, 200);

        return () => clearInterval(interval);
    }, [calculateSeconds]);

    // Throttled aria-live announcements: every 15s and at 10, 5, 0
    useEffect(() => {
        const isAnnouncementPoint =
            secondsLeft === 0 ||
            secondsLeft === 5 ||
            secondsLeft === 10 ||
            (secondsLeft > 10 && secondsLeft % 15 === 0);

        if (isAnnouncementPoint && lastAnnouncedRef.current !== secondsLeft) {
            lastAnnouncedRef.current = secondsLeft;
            setAnnouncement(
                secondsLeft === 0 ? 'Time is up!' : `${secondsLeft} seconds remaining`
            );
        }
    }, [secondsLeft]);

    const isWarning = secondsLeft <= 10;
    const progress = Math.max(0, Math.min(100, (secondsLeft / (totalTime || 60)) * 100));

    return (
        <div
            className={`w-full relative select-none ${className}`}
            role="progressbar"
            aria-label="Round countdown"
            aria-valuenow={secondsLeft}
            aria-valuemin={0}
            aria-valuemax={totalTime}
        >
            {/* Screen reader live updates */}
            <span className="sr-only" role="status" aria-live="polite">
                {announcement}
            </span>

            {/* Draining ink line: cobalt, turning tomato in the last 10 seconds */}
            <div className="w-full h-1.5 bg-ink/10 rounded-full overflow-hidden relative">
                <div
                    data-testid="timer-bar"
                    data-is-warning={isWarning}
                    className={`h-full rounded-full transition-all duration-200 ease-linear ${
                        isWarning ? 'bg-tomato' : 'bg-cobalt'
                    }`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default TimerBar;
