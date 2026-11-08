import React from 'react';

export const EmptyPlayerSlots = () => {
    return (
        <div className="flex flex-col gap-3 w-full py-2" data-testid="empty-player-slots">
            {/* Three dashed empty name tags */}
            {[1, 2, 3].map((slot) => (
                <div
                    key={`slot-${slot}`}
                    className="flex items-center gap-3 p-3.5 bg-paper/60 border-2 border-dashed border-ink/40 rounded-[12px] select-none"
                    aria-hidden="true"
                >
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-ink/40 flex items-center justify-center text-ink-soft bg-card">
                        <span className="text-xs font-black">?</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                        <div className="h-4 w-28 bg-ink/15 rounded-[4px]" />
                        <div className="h-2.5 w-16 bg-ink/10 rounded-[4px]" />
                    </div>
                    <span className="text-[11px] font-bold text-ink uppercase tracking-wider">
                        Empty seat
                    </span>
                </div>
            ))}

            {/* Pencil Doodle & Empty State Copy */}
            <div className="flex flex-col items-center justify-center pt-3 pb-2 text-center">
                <svg
                    viewBox="0 0 160 80"
                    className="w-32 h-16 text-ink stroke-current fill-none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    {/* Stylized tilted pencil */}
                    <path d="M42 50 L88 18 L99 29 L53 61 Z" fill="#F6B72C" />
                    <path d="M37 54 L42 50 L53 61 L44 66 Z" fill="#F3ECDD" />
                    <path d="M37 54 L34 57 L44 66 Z" fill="#1C1B18" />
                    <path d="M88 18 L95 13 C97 11 101 11 103 13 L105 15 C107 17 107 21 105 23 L99 29 Z" fill="#D2381C" />
                    {/* Metal ferrule */}
                    <line x1="86" y1="20" x2="97" y2="31" stroke="#1C1B18" strokeWidth="2" />
                    {/* Dotted scribble trail from pencil tip */}
                    <path
                        d="M34 57 Q20 70 30 75 Q45 78 55 70 Q70 60 85 72 T125 70 T150 73"
                        stroke="#1C1B18"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                    />
                </svg>

                <p className="text-sm font-bold text-ink-soft mt-1">
                    Waiting for friends. Share the link to get started.
                </p>
            </div>
        </div>
    );
};

export default EmptyPlayerSlots;

