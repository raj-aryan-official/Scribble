import React from 'react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

export const StartGameBar = ({
    isHost = false,
    hostName = 'the host',
    canStart = false,
    countdown = null,
    onStartOrCancel,
    className = '',
}) => {
    return (
        <div
            className={`w-full bg-card border-2 border-ink shadow-hard rounded-[12px] p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
            data-testid="start-game-bar"
        >
            {isHost ? (
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-between">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={onStartOrCancel}
                            disabled={!canStart && countdown === null}
                            className={`w-full sm:w-auto min-h-[48px] px-6 text-base font-black uppercase tracking-wider transition-all select-none ${
                                countdown !== null
                                    ? 'bg-tomato hover:bg-tomato-deep text-white animate-pulse'
                                    : 'bg-tomato hover:bg-tomato-deep text-white'
                            }`}
                        >
                            {countdown !== null ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="font-mono text-xl">{countdown}</span>
                                    <span>Tap to Cancel</span>
                                </span>
                            ) : (
                                'Start Game'
                            )}
                        </Button>
                    </div>

                    <div className="text-xs sm:text-sm font-bold text-center sm:text-right">
                        {countdown !== null ? (
                            <span className="text-tomato font-black">
                                Starting game in {countdown}...
                            </span>
                        ) : !canStart ? (
                            <span className="text-tomato">
                                Need at least 2 players to start
                            </span>
                        ) : (
                            <span className="text-leaf font-black">
                                ✓ Ready to start
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-3 w-full py-1 text-ink font-bold text-sm">
                    <Spinner size="sm" label="Waiting for host" />
                    <span>Waiting for {hostName} to start</span>
                </div>
            )}
        </div>
    );
};

export default StartGameBar;

