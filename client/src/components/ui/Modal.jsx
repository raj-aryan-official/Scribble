import React, { useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Button from './Button';

export const Modal = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    showCloseButton = true,
    className = '',
    contentClassName = '',
}) => {
    const titleId = useId();
    const descId = useId();
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);

    // Save active element before opening, restore on close
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement;
        } else if (previousActiveElement.current) {
            previousActiveElement.current.focus?.();
            previousActiveElement.current = null;
        }
    }, [isOpen]);

    // Escape key listener & focus trap
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
                return;
            }

            if (e.key === 'Tab') {
                const modal = modalRef.current;
                if (!modal) return;

                const focusableElements = modal.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length === 0) {
                    e.preventDefault();
                    return;
                }

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Initial focus on open
    useEffect(() => {
        if (isOpen && modalRef.current) {
            const focusable = modalRef.current.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable) {
                focusable.focus();
            } else {
                modalRef.current.focus();
            }
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-ink/60"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose?.();
                        }
                    }}
                >
                    <motion.div
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? titleId : undefined}
                        aria-describedby={description ? descId : undefined}
                        tabIndex={-1}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                        className={`relative w-full max-w-md bg-card border-2 border-ink shadow-hard-lg rounded-[12px] p-6 text-ink outline-none ${className}`}
                    >
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                {title && (
                                    <h2 id={titleId} className="text-xl font-bold font-heading text-ink">
                                        {title}
                                    </h2>
                                )}
                                {description && (
                                    <p id={descId} className="text-sm text-ink-soft mt-1">
                                        {description}
                                    </p>
                                )}
                            </div>

                            {showCloseButton && (
                                <Button
                                    variant="quiet"
                                    size="sm"
                                    onClick={onClose}
                                    aria-label="Close dialog"
                                    className="p-1 min-h-[36px] w-[36px] -mr-2 -mt-2 text-ink hover:bg-ink/10"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            )}
                        </div>

                        <div className={`text-ink ${contentClassName}`}>
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Modal;

