import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * DoodleCat
 * Looping ink-and-paper cat face doodle that draws itself over ~6 seconds.
 * Includes a speech bubble with blanks that fill in letter-by-letter ("_ _ _" -> "C A T !").
 * Purely decorative: marked with aria-hidden="true".
 * Fully respects reduced motion by rendering the static completed illustration.
 */
export const DoodleCat = ({ className = '' }) => {
    const shouldReduceMotion = useReducedMotion();
    const [cycleStep, setCycleStep] = useState(shouldReduceMotion ? 3 : 0);

    useEffect(() => {
        if (shouldReduceMotion) return;

        // 6 second loop progression:
        // 0s - 1.4s: _ _ _ (blank)
        // 1.4s - 2.6s: C _ _
        // 2.6s - 3.8s: C A _
        // 3.8s - 5.5s: C A T !
        // 5.5s - 6.0s: reset
        const intervals = [
            setTimeout(() => setCycleStep(0), 0),
            setTimeout(() => setCycleStep(1), 1400),
            setTimeout(() => setCycleStep(2), 2600),
            setTimeout(() => setCycleStep(3), 3800),
            setTimeout(() => setCycleStep(0), 5600),
        ];

        const loopTimer = setInterval(() => {
            setCycleStep(0);
            setTimeout(() => setCycleStep(1), 1400);
            setTimeout(() => setCycleStep(2), 2600);
            setTimeout(() => setCycleStep(3), 3800);
            setTimeout(() => setCycleStep(0), 5600);
        }, 6000);

        return () => {
            intervals.forEach(clearTimeout);
            clearInterval(loopTimer);
        };
    }, [shouldReduceMotion]);

    const drawVariants = {
        hidden: { pathLength: shouldReduceMotion ? 1 : 0 },
        visible: {
            pathLength: 1,
            transition: {
                duration: shouldReduceMotion ? 0 : 3.5,
                ease: 'easeInOut',
                repeat: shouldReduceMotion ? 0 : Infinity,
                repeatType: 'reverse',
                repeatDelay: 1.5,
            },
        },
    };

    return (
        <div
            aria-hidden="true"
            className={`relative select-none pointer-events-none ${className}`}
        >
            <svg
                viewBox="0 0 310 200"
                className="w-full max-w-[280px] sm:max-w-[320px] h-auto overflow-visible"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Speech Bubble Shadow */}
                <path
                    d="M 188 20 C 188 12, 298 12, 298 20 L 298 62 C 298 70, 218 70, 208 70 L 190 85 L 198 70 C 188 70, 188 62, 188 20 Z"
                    fill="#1C1B18"
                    transform="translate(3, 3)"
                />
                {/* Speech Bubble Card */}
                <path
                    d="M 188 20 C 188 12, 298 12, 298 20 L 298 62 C 298 70, 218 70, 208 70 L 190 85 L 198 70 C 188 70, 188 62, 188 20 Z"
                    fill="#FBF6EA"
                    stroke="#1C1B18"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                />

                {/* Speech Bubble Text (letter-by-letter blanks fill) */}
                <g className="font-mono font-black text-xl" fill="#1C1B18">
                    {/* First letter: C */}
                    <text x="210" y="46" textAnchor="middle" fontSize="20" fill={cycleStep >= 1 ? '#E4472B' : '#5B5649'}>
                        {cycleStep >= 1 ? 'C' : '_'}
                    </text>
                    {/* Second letter: A */}
                    <text x="235" y="46" textAnchor="middle" fontSize="20" fill={cycleStep >= 2 ? '#2F4FD8' : '#5B5649'}>
                        {cycleStep >= 2 ? 'A' : '_'}
                    </text>
                    {/* Third letter: T */}
                    <text x="260" y="46" textAnchor="middle" fontSize="20" fill={cycleStep >= 3 ? '#2E9E6B' : '#5B5649'}>
                        {cycleStep >= 3 ? 'T' : '_'}
                    </text>

                    {/* Exclamation point on complete */}
                    {cycleStep >= 3 && (
                        <motion.text
                            x="278"
                            y="46"
                            textAnchor="middle"
                            fontSize="20"
                            fill="#F6B72C"
                            stroke="#1C1B18"
                            strokeWidth="0.8"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                            !
                        </motion.text>
                    )}
                </g>

                {/* Cat Ear Accents (Spot Marigold / Card) */}
                <polygon points="68,52 92,66 64,88" fill="#F6B72C" stroke="#1C1B18" strokeWidth="1.5" />
                <polygon points="172,66 196,52 200,88" fill="#F6B72C" stroke="#1C1B18" strokeWidth="1.5" />

                {/* Self-drawing Cat Head Contour */}
                <motion.path
                    d="M 64 135 C 48 108, 48 78, 68 52 C 75 42, 86 48, 94 66 C 114 60, 148 60, 168 66 C 176 48, 188 42, 196 52 C 214 78, 214 108, 198 135 C 180 162, 82 162, 64 135 Z"
                    stroke="#1C1B18"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    variants={drawVariants}
                    initial="hidden"
                    animate="visible"
                />

                {/* Cute Curved Eyes */}
                <motion.path
                    d="M 86 104 Q 96 95 106 104"
                    stroke="#1C1B18"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    variants={drawVariants}
                    initial="hidden"
                    animate="visible"
                />
                <motion.path
                    d="M 154 104 Q 164 95 174 104"
                    stroke="#1C1B18"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    variants={drawVariants}
                    initial="hidden"
                    animate="visible"
                />

                {/* Cheerful Blush Spots */}
                <ellipse cx="80" cy="116" rx="6" ry="4" fill="#E4472B" opacity="0.3" />
                <ellipse cx="180" cy="116" rx="6" ry="4" fill="#E4472B" opacity="0.3" />

                {/* Nose */}
                <polygon points="126,114 134,114 130,120" fill="#E4472B" stroke="#1C1B18" strokeWidth="1.5" />

                {/* :3 Cat Mouth */}
                <motion.path
                    d="M 130 120 Q 123 128 116 124 M 130 120 Q 137 128 144 124"
                    stroke="#1C1B18"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    variants={drawVariants}
                    initial="hidden"
                    animate="visible"
                />

                {/* Left Whiskers */}
                <motion.path
                    d="M 46 108 L 74 112 M 42 118 L 74 118 M 46 128 L 74 124"
                    stroke="#1C1B18"
                    strokeWidth="2"
                    strokeLinecap="round"
                    variants={drawVariants}
                    initial="hidden"
                    animate="visible"
                />

                {/* Right Whiskers */}
                <motion.path
                    d="M 186 112 L 214 108 M 186 118 L 218 118 M 186 124 L 214 128"
                    stroke="#1C1B18"
                    strokeWidth="2"
                    strokeLinecap="round"
                    variants={drawVariants}
                    initial="hidden"
                    animate="visible"
                />

                {/* Collar with Spot Marigold Bell */}
                <motion.path
                    d="M 76 150 C 104 164, 156 164, 184 150"
                    stroke="#E4472B"
                    strokeWidth="5"
                    strokeLinecap="round"
                    variants={drawVariants}
                    initial="hidden"
                    animate="visible"
                />
                <circle cx="130" cy="162" r="7" fill="#F6B72C" stroke="#1C1B18" strokeWidth="2" />
                <circle cx="130" cy="164" r="1.5" fill="#1C1B18" />
            </svg>
        </div>
    );
};

export default DoodleCat;

