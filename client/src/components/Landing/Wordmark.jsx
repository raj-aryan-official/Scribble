import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const LETTERS = [
    { char: 'S', x: 8 },
    { char: 'C', x: 44 },
    { char: 'R', x: 82 },
    { char: 'I', x: 122 },
    { char: 'B', x: 144 },
    { char: 'B', x: 182 },
    { char: 'L', x: 220 },
    { char: 'E', x: 254 },
];

export const Wordmark = ({ className = '' }) => {
    const shouldReduceMotion = useReducedMotion();

    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: shouldReduceMotion ? 0 : 0.04, // 40 ms stagger
            },
        },
    };

    const letterVariants = {
        hidden: {
            opacity: 0,
            y: shouldReduceMotion ? 0 : -24,
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring',
                stiffness: 400,
                damping: 24,
            },
        },
    };

    return (
        <div className={`transform -rotate-2 inline-block select-none ${className}`}>
            <motion.svg
                viewBox="0 0 300 68"
                className="w-56 sm:w-64 md:w-72 lg:w-80 h-auto overflow-visible"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="Scribble logo"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Dropping in staggered letters */}
                {LETTERS.map(({ char, x }, idx) => (
                    <motion.g key={idx} variants={letterVariants}>
                        {/* Shadow offset */}
                        <text
                            x={x + 3}
                            y={51}
                            className="font-heading font-black tracking-tight"
                            fontSize="46"
                            fill="#1C1B18"
                        >
                            {char}
                        </text>
                        {/* Tomato stroke layer */}
                        <text
                            x={x}
                            y={48}
                            className="font-heading font-black tracking-tight"
                            fontSize="46"
                            fill="#E4472B"
                            stroke="#1C1B18"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                        >
                            {char}
                        </text>
                    </motion.g>
                ))}

                {/* Hand-drawn underline sweep */}
                <motion.path
                    d="M 6 58 C 70 64, 180 62, 294 56"
                    stroke="#1C1B18"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    initial={{ pathLength: shouldReduceMotion ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : 0.32, ease: 'easeOut' }}
                />
                <motion.path
                    d="M 14 60 C 80 66, 170 63, 274 59"
                    stroke="#F6B72C"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: shouldReduceMotion ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : 0.36, ease: 'easeOut' }}
                />
            </motion.svg>
        </div>
    );
};

export default Wordmark;
