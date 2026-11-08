import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            showCloseButton={true}
            className="max-w-sm text-center"
        >
            <div className="flex flex-col items-center">
                <div
                    className={`w-12 h-12 rounded-full border-2 border-ink flex items-center justify-center mb-4 ${
                        isDanger ? 'bg-tomato text-white' : 'bg-marigold text-ink'
                    }`}
                >
                    <AlertTriangle className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-bold font-heading text-ink mb-2">
                    {title}
                </h3>
                <p className="text-sm text-ink-soft mb-6">
                    {message}
                </p>

                <div className="flex gap-3 justify-center w-full">
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={onClose}
                        className="flex-1"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 ${!isDanger ? 'bg-cobalt hover:bg-cobalt/90' : ''}`}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;
