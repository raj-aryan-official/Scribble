import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({
    isOpen,
    onClose,
    message,
    action, // { label: string, onClick: () => void }
    variant = 'info', // 'info' | 'success' | 'error'
    duration = 3000,
    className = '',
}) => {
    useEffect(() => {
        if (!isOpen || !duration) return;
        const timer = setTimeout(() => {
            onClose?.();
        }, duration);
        return () => clearTimeout(timer);
    }, [isOpen, duration, onClose]);

    const icons = {
        info: <Info className="w-5 h-5 text-cobalt flex-shrink-0" />,
        success: <CheckCircle2 className="w-5 h-5 text-leaf flex-shrink-0" />,
        error: <AlertCircle className="w-5 h-5 text-tomato flex-shrink-0" />,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-toast pointer-events-none">
                    <motion.div
                        role="status"
                        aria-live="polite"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 bg-card border-2 border-ink shadow-hard rounded-[12px] text-ink max-w-sm ${className}`}
                    >
                        {icons[variant] || icons.info}
                        <p className="text-sm font-bold flex-1 select-none font-body">
                            {message}
                        </p>
                        {action && (
                            <button
                                type="button"
                                onClick={action.onClick}
                                className="px-2.5 py-1 text-xs font-bold uppercase bg-paper hover:bg-card border-2 border-ink rounded-[4px] shadow-hard-sm cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none shrink-0"
                            >
                                {action.label}
                            </button>
                        )}
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Dismiss toast"
                                className="text-ink-soft hover:text-ink cursor-pointer p-0.5 rounded-[4px] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:outline-none"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Toast;

