import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/types';

export const ChatBox = ({ roomCode }) => {
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
        scrollToBottom();
    }, [state.messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        socket.emit(EVENTS.SEND_MESSAGE, { roomCode, text: message });
        setMessage('');
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-gray-50 rounded-lg mb-2 min-h-0">
                {state.messages.map((msg, idx) => (
                    <div key={idx} className={`p-2 rounded ${msg.type === 'correct' ? 'bg-green-100 text-green-800' : 'bg-white shadow-sm'}`}>
                        <span className="font-bold mr-2">{msg.username}:</span>
                        <span>{msg.text}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    className="flex-grow p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Type your guess..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded">Send</button>
            </form>
        </div>
    );
};
