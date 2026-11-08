import React from 'react';

export const Chip = ({
    children,
    variant = 'default',
    className = '',
    onClick,
    ...props
}) => {
    const variants = {
        default: 'bg-paper text-ink border-2 border-ink',
        card: 'bg-card text-ink border-2 border-ink',
        tomato: 'bg-tomato text-white border-2 border-ink',
        marigold: 'bg-marigold text-ink border-2 border-ink',
        cobalt: 'bg-cobalt text-white border-2 border-ink',
        leaf: 'bg-leaf-deep text-white border-2 border-ink'
    };

    const isInteractive = Boolean(onClick);
    const interactiveStyles = isInteractive
        ? 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-1 select-none'
        : '';

    const Component = isInteractive ? 'button' : 'span';

    return (
        <Component
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-[6px] transition-transform ${variants[variant] || variants.default} ${interactiveStyles} ${className}`.trim()}
            {...props}
        >
            {children}
        </Component>
    );
};

export default Chip;
