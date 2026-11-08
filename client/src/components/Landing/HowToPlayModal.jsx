import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export const HowToPlayModal = ({ isOpen, onClose }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="How to Play"
            className="max-w-md select-none"
        >
            <div className="flex flex-col gap-5 text-ink text-sm py-1">
                {/* Step 1: Draw */}
                <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-[8px] bg-paper border-2 border-ink shadow-hard-sm flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 32 32" className="w-7 h-7 overflow-visible" fill="none">
                            <rect x="6" y="20" width="6" height="4" rx="1" fill="#E4472B" stroke="#1C1B18" strokeWidth="1.5" transform="rotate(-45 6 20)" />
                            <rect x="10" y="10" width="6" height="12" fill="#F6B72C" stroke="#1C1B18" strokeWidth="1.5" transform="rotate(-45 10 10)" />
                            <path d="M 21 6 L 25 10 L 28 3 Z" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="1.5" />
                            <path d="M 26 5 L 28 3 L 27 7 Z" fill="#1C1B18" />
                            <path d="M 4 28 C 10 26, 16 30, 24 27" stroke="#1C1B18" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-heading font-black text-base text-ink">
                            1. Pick & Draw
                        </h3>
                        <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">
                            On your turn, choose one of three words and sketch it on paper. No letters or numbers allowed!
                        </p>
                    </div>
                </div>

                {/* Step 2: Guess */}
                <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-[8px] bg-paper border-2 border-ink shadow-hard-sm flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 32 32" className="w-7 h-7 overflow-visible" fill="none">
                            <rect x="4" y="6" width="22" height="15" rx="3" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="1.5" />
                            <path d="M 8 21 L 6 26 L 14 21 Z" fill="#FBF6EA" stroke="#1C1B18" strokeWidth="1.5" strokeLinejoin="round" />
                            <text x="15" y="17" fontSize="9" fontWeight="900" fill="#2F4FD8" textAnchor="middle" className="font-mono">
                                CAT!
                            </text>
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-heading font-black text-base text-ink">
                            2. Guess in Chat
                        </h3>
                        <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">
                            Type guesses into the chat box. Once you guess right, your messages are hidden from those still guessing.
                        </p>
                    </div>
                </div>

                {/* Step 3: Score */}
                <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-[8px] bg-paper border-2 border-ink shadow-hard-sm flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 32 32" className="w-7 h-7 overflow-visible" fill="none">
                            <rect x="4" y="18" width="7" height="10" fill="#2F4FD8" stroke="#1C1B18" strokeWidth="1.5" />
                            <rect x="12" y="13" width="8" height="15" fill="#F6B72C" stroke="#1C1B18" strokeWidth="1.5" />
                            <rect x="21" y="21" width="7" height="7" fill="#E4472B" stroke="#1C1B18" strokeWidth="1.5" />
                            <path d="M 16 4 L 18 8 L 22 8 L 19 11 L 20 15 L 16 13 L 12 15 L 13 11 L 10 8 L 14 8 Z" fill="#2E9E6B" stroke="#1C1B18" strokeWidth="1.2" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-heading font-black text-base text-ink">
                            3. Score Points
                        </h3>
                        <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">
                            Earn bragging rights across multiple rounds. The player with the highest total score wins!
                        </p>
                    </div>
                </div>

                {/* One line on scoring */}
                <div className="p-2.5 bg-paper border-2 border-ink rounded-[6px] shadow-hard-sm text-center">
                    <p className="text-xs font-bold text-ink">
                        Points are awarded for speed: guess quickly for up to 500 pts; drawers earn points when others guess.
                    </p>
                </div>

                <Button
                    variant="primary"
                    size="md"
                    onClick={onClose}
                    className="w-full mt-1 uppercase font-bold tracking-wide"
                >
                    Got it!
                </Button>
            </div>
        </Modal>
    );
};

export default HowToPlayModal;

