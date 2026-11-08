import React from 'react';

export const Button = React.forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    type = 'button',
    onClick,
    ...props
}, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-bold select-none cursor-pointer text-center font-body transition-all duration-150 min-h-[44px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-2';

    const variants = {
        primary: 'bg-tomato text-white border-2 border-ink shadow-hard hover:bg-tomato-deep active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm',
        secondary: 'bg-card text-ink border-2 border-ink shadow-hard hover:bg-paper active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm',
        quiet: 'bg-transparent text-ink border-2 border-transparent hover:bg-ink/5 active:bg-ink/10 active:translate-x-[1px] active:translate-y-[1px]'
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm rounded-[6px]',
        md: 'px-5 py-2 text-base rounded-[12px]',
        lg: 'px-6 py-3 text-lg rounded-[12px]'
    };

    const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed shadow-none active:translate-x-0 active:translate-y-0 active:shadow-none' : '';

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled}
            onClick={disabled ? undefined : onClick}
            className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${disabledStyles} ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
});

Button.displayName = 'Button';
export default Button;
