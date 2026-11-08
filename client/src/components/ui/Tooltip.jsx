import React, { useState, useId, cloneElement, isValidElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Tooltip = ({
    children,
    content,
    position = 'top', // 'top' | 'bottom' | 'left' | 'right'
    className = '',
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipId = useId();

    if (!content) return children;

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const handleOpen = () => setIsVisible(true);
    const handleClose = () => setIsVisible(false);

    let trigger = children;
    if (isValidElement(children)) {
        trigger = cloneElement(children, {
            'aria-describedby': isVisible ? tooltipId : undefined,
            onMouseEnter: (e) => {
                children.props.onMouseEnter?.(e);
                handleOpen();
            },
            onMouseLeave: (e) => {
                children.props.onMouseLeave?.(e);
                handleClose();
            },
            onFocus: (e) => {
                children.props.onFocus?.(e);
                handleOpen();
            },
            onBlur: (e) => {
                children.props.onBlur?.(e);
                handleClose();
            },
        });
    }

    return (
        <div className="relative inline-flex items-center">
            {trigger}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        id={tooltipId}
                        role="tooltip"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-40 px-2 py-1 bg-ink text-paper text-xs font-bold rounded-[6px] shadow-hard-sm pointer-events-none whitespace-nowrap ${
                            positionClasses[position] || positionClasses.top
                        } ${className}`}
                    >
                        {content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Tooltip;

