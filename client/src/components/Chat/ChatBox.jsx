import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';

export const ChatBox = ({ roomCode, isCompact = false }) => {
    const { state, dispatch } = useGame();
    const socket = useSocket();
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!socket) return;

        socket.on(EVENTS.MESSAGE_RECEIVED, (msg) => {
            dispatch({ type: 'ADD_MESSAGE', payload: msg });
        });

        return () => {
            socket.off(EVENTS.MESSAGE_RECEIVED);
        };
    }, [socket, dispatch]);

    useEffect(() => {
        if (!isCompact) {
            scrollToBottom();
        }
    }, [state.messages, isCompact]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        let finalMessage = message;

        // Prevent Drawer from spoiling the word
        if (state.currentUser?.id === state.drawerId && state.wordToGuess) {
            const regex = new RegExp(state.wordToGuess, 'gi');
            if (regex.test(finalMessage)) {
                // Replace matching word with '#' of same length
                finalMessage = finalMessage.replace(regex, (match) => '#'.repeat(match.length));
            }
        }

        socket.emit(EVENTS.SEND_MESSAGE, { roomCode, text: finalMessage });
        setMessage('');
    };

    return (
        <div className="flex flex-col h-full">
            {!isCompact && (
                <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-gray-50 rounded-lg mb-2 min-h-0">
                    {state.messages.map((msg, idx) => (
                        <div key={idx} className={`p-2 rounded ${msg.type === 'correct' ? 'bg-green-100 text-green-800' : 'bg-white shadow-sm'}`}>
                            <span className="font-bold mr-2">{msg.username}:</span>
                            <span>{msg.text}</span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            )}
            <form onSubmit={handleSubmit} className={`flex gap-2 ${isCompact ? 'p-1 bg-white border-t' : ''}`}>
                <input
                    type="text"
                    className={`flex-grow border rounded focus:outline-none focus:ring-2 focus:ring-primary text-base ${isCompact ? 'p-1.5' : 'p-2'}`}
                    placeholder="Type your guess..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" className={`bg-primary text-white rounded font-bold ${isCompact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}>Send</button>
            </form>
        </div>
    );
};
