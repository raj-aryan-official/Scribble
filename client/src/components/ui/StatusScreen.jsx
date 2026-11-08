import React, { useEffect, useRef } from 'react';
import Card from './Card';
import Button from './Button';

/**
 * StatusScreen
 * Calm, clear, accessible full-screen failure and informational state display.
 *
 * Requirements:
 * - Uses role="alert" for failures and role="status" for informational states
 * - Automatically moves focus to its heading on mount (tabIndex={-1})
 * - Copy rules: plain words, no blame, no error codes, one clear action
 * - Responsive down to 360px viewport width
 */
export const StatusScreen = ({
    illustration,
    title,
    sentence,
    primaryAction,
    secondaryAction,
    role = 'alert',
    children,
    className = '',
    'data-testid': testId = 'status-screen',
}) => {
    const headingRef = useRef(null);

    useEffect(() => {
        // Automatically move focus to heading on mount without aggressive scroll jumping
        headingRef.current?.focus({ preventScroll: true });
    }, []);

    const renderAction = (action, isPrimary = true) => {
        if (!action) return null;
        const { label, onClick, href } = action;

        const handleClick = (e) => {
            if (onClick) {
                onClick(e);
            } else if (href) {
                window.location.href = href;
            }
        };

        return (
            <Button
                type="button"
                variant={isPrimary ? 'primary' : 'secondary'}
                size="md"
                onClick={handleClick}
                className="w-full font-bold uppercase min-h-[44px]"
            >
                {label}
            </Button>
        );
    };

    return (
        <div
            role={role}
            aria-live={role === 'alert' ? 'assertive' : 'polite'}
            data-testid={testId}
            className={`min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-paper text-ink select-none ${className}`}
        >
            <Card className="flex flex-col items-center justify-center p-6 sm:p-8 max-w-sm w-full text-center shadow-hard-lg bg-card border-2 border-ink rounded-[12px] gap-4">
                {/* Spot Illustration */}
                {illustration && (
                    <div
                        data-testid="status-illustration"
                        className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0 mb-1"
                    >
                        {typeof illustration === 'string' ? (
                            <img
                                src={illustration}
                                alt=""
                                aria-hidden="true"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            illustration
                        )}
                    </div>
                )}

                {/* Title & One Sentence */}
                <div className="flex flex-col gap-1.5 w-full">
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-xl sm:text-2xl font-black font-heading text-ink outline-none tracking-tight"
                    >
                        {title}
                    </h1>
                    {sentence && (
                        <p className="text-sm text-ink-soft leading-relaxed px-1">
                            {sentence}
                        </p>
                    )}
                </div>

                {/* Optional additional details or list */}
                {children && <div className="w-full">{children}</div>}

                {/* Actions: Primary & optional Secondary */}
                {(primaryAction || secondaryAction) && (
                    <div className="flex flex-col gap-2 w-full mt-2">
                        {renderAction(primaryAction, true)}
                        {renderAction(secondaryAction, false)}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default StatusScreen;
