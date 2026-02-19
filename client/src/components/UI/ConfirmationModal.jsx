import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                        <AlertTriangle size={24} />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-500 mb-6">{message}</p>

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`px-4 py-2 rounded-xl text-white font-bold shadow-md transition-transform active:scale-95 ${isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
