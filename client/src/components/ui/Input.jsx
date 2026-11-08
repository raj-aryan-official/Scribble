import React, { useId } from 'react';

export const Input = React.forwardRef(({
    label,
    id: providedId,
    name,
    error,
    helperText,
    type = 'text',
    value,
    onChange,
    placeholder,
    disabled = false,
    required = false,
    maxLength,
    className = '',
    inputClassName = '',
    autoComplete,
    ...props
}, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const describedBy = [
        error ? errorId : null,
        helperText && !error ? helperId : null
    ].filter(Boolean).join(' ') || undefined;

    return (
        <div className={`flex flex-col gap-1.5 w-full text-left ${className}`}>
            {label && (
                <label
                    htmlFor={id}
                    className="text-xs font-bold uppercase tracking-wider text-ink select-none flex items-center justify-between"
                >
                    <span>
                        {label}
                        {required && <span className="text-tomato ml-0.5">*</span>}
                    </span>
                    {maxLength && typeof value === 'string' && (
                        <span className="text-[11px] font-normal text-ink-soft">
                            {value.length}/{maxLength}
                        </span>
                    )}
                </label>
            )}

            <input
                ref={ref}
                id={id}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                maxLength={maxLength}
                autoComplete={autoComplete}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className={`w-full min-h-[44px] px-3.5 py-2 text-base font-body bg-card text-ink placeholder:text-ink-soft/60 border-2 ${
                    error ? 'border-tomato ring-1 ring-tomato' : 'border-ink'
                } rounded-[6px] transition-colors focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`.trim()}
                {...props}
            />

            {error && (
                <p id={errorId} role="alert" className="text-xs font-bold text-tomato mt-0.5 flex items-center gap-1">
                    <span>•</span> {error}
                </p>
            )}

            {!error && helperText && (
                <p id={helperId} className="text-xs text-ink-soft mt-0.5">
                    {helperText}
                </p>
            )}
        </div>
    );
});

Input.displayName = 'Input';
export default Input;
