import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const Spinner = ({
    size = 'md',
    label = 'Loading...',
    className = '',
}) => {
    const shouldReduceMotion = useReducedMotion();

    const sizeDimensions = {
        sm: { width: 24, height: 24 },
        md: { width: 36, height: 36 },
        lg: { width: 48, height: 48 },
    };

    const { width, height } = sizeDimensions[size] || sizeDimensions.md;

    return (
        <div
            role="status"
            aria-label={label}
            className={`inline-flex flex-col items-center justify-center gap-1 ${className}`}
        >
            <motion.svg
                width={width}
                height={height}
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                animate={shouldReduceMotion ? undefined : {
                    x: [-3, 3, -3],
                    rotate: [-8, 8, -8],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 0.7,
                    ease: 'easeInOut',
                }}
            >
                {/* Pencil eraser */}
                <rect x="6" y="24" width="8" height="6" rx="2" fill="#E4472B" stroke="#1C1B18" strokeWidth="2" transform="rotate(-45 6 24)" />
                {/* Ferrule / metal band */}
                <rect x="10" y="20" width="8" height="3" fill="#F3ECDD" stroke="#1C1B18" strokeWidth="2" transform="rotate(-45 10 20)" />
                {/* Pencil body */}
                <rect x="12" y="12" width="8" height="14" fill="#F6B72C" stroke="#1C1B18" strokeWidth="2" transform="rotate(-45 12 12)" />
                {/* Pencil wood tip */}
                <path d="M 23 8 L 29 14 L 33 5 Z" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="2" strokeLinejoin="round" />
                {/* Graphite point */}
                <path d="M 30 7 L 33 5 L 31 10 Z" fill="#1C1B18" />
            </motion.svg>

            {/* Scribble trace */}
            <svg width={width * 1.2} height={8} viewBox="0 0 40 8" fill="none" className="overflow-visible">
                <motion.path
                    d="M 4 4 Q 10 1 16 4 T 28 4 T 36 4"
                    stroke="#1C1B18"
                    strokeWidth="2"
                    strokeLinecap="round"
                    animate={shouldReduceMotion ? undefined : {
                        pathLength: [0.2, 1, 0.2],
                        pathOffset: [0, 0.5, 1],
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: 'easeInOut',
                    }}
                />
            </svg>
            <span className="sr-only">{label}</span>
        </div>
    );
};

export default Spinner;

