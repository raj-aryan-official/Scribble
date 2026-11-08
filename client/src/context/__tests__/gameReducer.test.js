import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../GameContext';

describe('gameReducer - ADD_MESSAGE deduplication and cap', () => {
    it('appends a new message when id is unique', () => {
        const state = { ...initialState, messages: [] };
        const action = {
            type: 'ADD_MESSAGE',
            payload: { id: 'msg-1', text: 'Hello', username: 'Alice', type: 'chat' }
        };

        const nextState = gameReducer(state, action);
        expect(nextState.messages).toHaveLength(1);
        expect(nextState.messages[0].id).toBe('msg-1');
        expect(nextState.messages[0].text).toBe('Hello');
    });

    it('ignores a message whose id is already in the list (deduplication)', () => {
        const state = {
            ...initialState,
            messages: [
                { id: 'msg-1', text: 'First message', username: 'Alice', type: 'chat' }
            ]
        };

        const duplicateAction = {
            type: 'ADD_MESSAGE',
            payload: { id: 'msg-1', text: 'Duplicate text attempt', username: 'Alice', type: 'chat' }
        };

        const nextState = gameReducer(state, duplicateAction);
        expect(nextState.messages).toHaveLength(1);
        expect(nextState.messages[0].text).toBe('First message');
    });

    it('caps the message list at 100 messages when exceeding the limit', () => {
        let state = { ...initialState, messages: [] };

        // Add 120 messages
        for (let i = 1; i <= 120; i++) {
            state = gameReducer(state, {
                type: 'ADD_MESSAGE',
                payload: { id: `msg-${i}`, text: `Message ${i}`, username: 'Player', type: 'chat' }
            });
        }

        expect(state.messages).toHaveLength(100);
        // Oldest 20 messages (1-20) were dropped; first item should be msg-21
        expect(state.messages[0].id).toBe('msg-21');
        expect(state.messages[99].id).toBe('msg-120');
    });
});

