import React, { useEffect, useRef, useState } from 'react';

/**
 * Measures its container and renders the largest 4:3 paper that fits, centred.
 * Sizing is applied explicitly (not via CSS aspect-ratio) so the canvas always
 * has an exact 4:3 drawing surface on every device.
 */
export const PaperStage = ({
    children,
    className = '',
    paperClassName = '',
    maxWidth = 1400,
    testId = 'drawing-paper',
    onSizeChange,
}) => {
    const containerRef = useRef(null);
    const frameRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (size.width > 0) onSizeChange?.(size.width);
    }, [size.width, onSizeChange]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const measure = () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            frameRef.current = requestAnimationFrame(() => {
                const { width, height } = container.getBoundingClientRect();
                if (width <= 0 || height <= 0) return;
                const maxW = Math.min(width, maxWidth);
                const paperWidth = Math.floor(Math.min(maxW, height * (4 / 3)));
                const paperHeight = Math.floor(paperWidth * (3 / 4));
                setSize((prev) => (
                    prev.width === paperWidth && prev.height === paperHeight
                        ? prev
                        : { width: paperWidth, height: paperHeight }
                ));
            });
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        window.addEventListener('orientationchange', measure);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            observer.disconnect();
            window.removeEventListener('orientationchange', measure);
        };
    }, [maxWidth]);

    const hasSize = size.width > 0 && size.height > 0;

    return (
        <div
            ref={containerRef}
            className={`w-full h-full min-h-0 min-w-0 flex items-center justify-center overflow-hidden ${className}`}
        >
            <div
                data-testid={testId}
                className={`relative bg-card border-2 border-ink shadow-hard overflow-hidden shrink-0 ${paperClassName}`}
                style={
                    hasSize
                        ? { width: `${size.width}px`, height: `${size.height}px` }
                        : { aspectRatio: '4 / 3', width: '100%', maxWidth: '100%', maxHeight: '100%' }
                }
            >
                {children}
            </div>
        </div>
    );
};

export default PaperStage;
