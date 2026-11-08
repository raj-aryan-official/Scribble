import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const Wordmark = ({ className = '' }) => {
    const shouldReduceMotion = useReducedMotion();

    return (
        <div className={`inline-flex items-center gap-3 sm:gap-4 select-none ${className}`}>
            {/* Hand-lettered style wordmark SVG tilted -2 degrees */}
            <div className="transform -rotate-2 inline-block">
                <svg
                    viewBox="0 0 320 64"
                    className="w-56 sm:w-72 md:w-80 h-auto overflow-visible"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="Scribble logo"
                    role="img"
                >
                    {/* Shadow offset layer */}
                    <text
                        x="4"
                        y="52"
                        className="font-heading font-black tracking-tight"
                        fontSize="48"
                        fill="#1C1B18"
                    >
                        SCRIBBLE
                    </text>
                    {/* Top card/tomato colored layer */}
                    <text
                        x="1"
                        y="49"
                        className="font-heading font-black tracking-tight"
                        fontSize="48"
                        fill="#E4472B"
                        stroke="#1C1B18"
                        strokeWidth="2"
                        strokeLinejoin="round"
                    >
                        SCRIBBLE
                    </text>
                    {/* Hand-drawn underline sweep */}
                    <path
                        d="M 6 58 C 70 64, 180 62, 314 56"
                        stroke="#1C1B18"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <path
                        d="M 12 60 C 80 66, 170 63, 290 59"
                        stroke="#F6B72C"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
            </div>

            {/* Looping self-drawing doodle beside the wordmark */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
                <svg
                    viewBox="0 0 48 48"
                    className="w-full h-full overflow-visible"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Crown / Star doodle that self-draws */}
                    <motion.path
                        d="M 8 36 L 6 18 L 16 26 L 24 10 L 32 26 L 42 18 L 40 36 Z"
                        stroke="#1C1B18"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill={shouldReduceMotion ? '#F6B72C' : '#F6B72C'}
                        initial={{ pathLength: shouldReduceMotion ? 1 : 0 }}
                        animate={
                            shouldReduceMotion
                                ? { pathLength: 1 }
                                : {
                                      pathLength: [0, 1, 1, 0],
                                      strokeDashoffset: [0, 0, 0, 100],
                                  }
                        }
                        transition={{
                            repeat: Infinity,
                            duration: 3.5,
                            ease: 'easeInOut',
                            times: [0, 0.45, 0.85, 1],
                        }}
                    />
                    {/* Little sparkle rays */}
                    <motion.line
                        x1="24"
                        y1="4"
                        x2="24"
                        y2="1"
                        stroke="#E4472B"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 3.5, times: [0, 0.4, 0.85, 1] }}
                    />
                    <motion.line
                        x1="4"
                        y1="12"
                        x2="1"
                        y2="10"
                        stroke="#2F4FD8"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 3.5, times: [0, 0.4, 0.85, 1] }}
                    />
                    <motion.line
                        x1="44"
                        y1="12"
                        x2="47"
                        y2="10"
                        stroke="#2E9E6B"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 3.5, times: [0, 0.4, 0.85, 1] }}
                    />
                </svg>
            </div>
        </div>
    );
};

export default Wordmark;
