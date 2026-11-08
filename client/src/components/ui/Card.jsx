import React from 'react';

export const Card = ({
    children,
    className = '',
    as: Component = 'div',
    ...props
}) => {
    return (
        <Component
            className={`bg-card border-2 border-ink shadow-hard rounded-[12px] p-4 md:p-6 text-ink ${className}`.trim()}
            {...props}
        >
            {children}
        </Component>
    );
};

export default Card;

