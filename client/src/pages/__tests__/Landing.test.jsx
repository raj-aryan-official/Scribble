import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { extractRoomCode } from '../../components/Landing/RoomCodeInput';
import { FUN_NAMES } from '../../constants/funNames';
import { CREDIT_LINE } from '../../config';
import Wordmark from '../../components/Landing/Wordmark';
import DoodleCat from '../../components/Landing/DoodleCat';
import AvatarPicker from '../../components/ui/AvatarPicker';
import RoomCodeInput from '../../components/Landing/RoomCodeInput';
import HowToPlayModal from '../../components/Landing/HowToPlayModal';

describe('Landing Page Rebuild & Utilities', () => {
    describe('extractRoomCode (pasted invite link extraction)', () => {
        it('extracts uppercase code from a direct 6-letter string', () => {
            expect(extractRoomCode('abcdef')).toBe('ABCDEF');
            expect(extractRoomCode('X1Y2Z3')).toBe('X1Y2Z3');
        });

        it('extracts room code from full http localhost invite link', () => {
            expect(extractRoomCode('http://localhost:5173/join/ABCDEF')).toBe('ABCDEF');
            expect(extractRoomCode('http://localhost:3000/join/ROOM12')).toBe('ROOM12');
        });

        it('extracts room code from production URL with query params', () => {
            expect(extractRoomCode('https://scribble.app/join/CAT999?ref=twitter#share')).toBe('CAT999');
            expect(extractRoomCode('https://scribble.game/join/DOG123?utm_source=copy')).toBe('DOG123');
        });

        it('extracts room code from lobby link', () => {
            expect(extractRoomCode('http://localhost:5173/lobby/FOX456')).toBe('FOX456');
        });

        it('handles spaces or whitespace cleanly', () => {
            expect(extractRoomCode('  ABC DEF  ')).toBe('ABCDEF');
        });

        it('returns empty string on null or non-string input', () => {
            expect(extractRoomCode('')).toBe('');
            expect(extractRoomCode(null)).toBe('');
            expect(extractRoomCode(undefined)).toBe('');
        });
    });

    describe('Fun Names (40 animal nicknames)', () => {
        it('has exactly 40 names in FUN_NAMES', () => {
            expect(FUN_NAMES).toHaveLength(40);
        });

        it('includes "Sleepy Otter"', () => {
            expect(FUN_NAMES).toContain('Sleepy Otter');
        });

        it('all names are non-empty strings under 20 characters', () => {
            FUN_NAMES.forEach((name) => {
                expect(typeof name).toBe('string');
                expect(name.trim().length).toBeGreaterThan(0);
                expect(name.length).toBeLessThanOrEqual(20);
            });
        });
    });

    describe('Config Credit Line', () => {
        it('exports a single credit line from client/src/config.js', () => {
            expect(CREDIT_LINE).toBeDefined();
            expect(CREDIT_LINE).toBe('An ink & paper multiplayer drawing game');
        });
    });

    describe('Wordmark & Copy', () => {
        it('renders wordmark with 8 dropping letters in SVG and tilted -2 degrees', () => {
            const html = renderToStaticMarkup(<Wordmark />);
            expect(html).toContain('aria-label="Scribble logo"');
            expect(html).toContain('-rotate-2');
            expect(html).toContain('viewBox="0 0 300 68"');
            expect(html).toContain('>S<');
            expect(html).toContain('>C<');
            expect(html).toContain('>R<');
            expect(html).toContain('>I<');
            expect(html).toContain('>B<');
            expect(html).toContain('>L<');
            expect(html).toContain('>E<');
        });
    });

    describe('DoodleCat Looping Animation', () => {
        it('is marked with aria-hidden="true" as decorative', () => {
            const html = renderToStaticMarkup(<DoodleCat />);
            expect(html).toContain('aria-hidden="true"');
            expect(html).toContain('pointer-events-none');
        });

        it('renders cat face paths and speech bubble with blanks', () => {
            const html = renderToStaticMarkup(<DoodleCat />);
            expect(html).toContain('polygon');
            expect(html).toContain('stroke="#1C1B18"');
        });
    });

    describe('AvatarPicker (12 avatars, prev/next buttons)', () => {
        it('renders 12 avatar buttons, prev/next buttons, and radio group', () => {
            const html = renderToStaticMarkup(
                <AvatarPicker selectedAvatar="avatar-3" />
            );
            expect(html).toContain('role="radiogroup"');
            expect(html).toContain('aria-label="Previous avatar"');
            expect(html).toContain('aria-label="Next avatar"');
            // Count radio buttons
            const radioMatches = html.match(/role="radio"/g);
            expect(radioMatches).toHaveLength(12);
        });

        it('marks selected avatar with aria-checked="true" and scale-115', () => {
            const html = renderToStaticMarkup(
                <AvatarPicker selectedAvatar="avatar-5" />
            );
            expect(html).toContain('aria-checked="true"');
            expect(html).toContain('scale-115');
        });
    });

    describe('RoomCodeInput (6-box accessible input)', () => {
        it('renders fieldset labelled "Room code, 6 characters"', () => {
            const html = renderToStaticMarkup(
                <RoomCodeInput value="ABC" />
            );
            expect(html).toContain('aria-label="Room code, 6 characters"');
            expect(html).toContain('Character 1 of 6');
            expect(html).toContain('Character 6 of 6');
        });

        it('renders error message when error prop is provided', () => {
            const html = renderToStaticMarkup(
                <RoomCodeInput value="ABC" error="No room with that code. Check the letters?" />
            );
            expect(html).toContain('role="alert"');
            expect(html).toContain('No room with that code. Check the letters?');
            expect(html).toContain('aria-invalid="true"');
        });
    });

    describe('HowToPlayModal', () => {
        it('renders three steps (Draw, Guess, Score) and one line on scoring', () => {
            const html = renderToStaticMarkup(
                <HowToPlayModal isOpen={true} onClose={() => {}} />
            );
            expect(html).toContain('1. Pick &amp; Draw');
            expect(html).toContain('2. Guess in Chat');
            expect(html).toContain('3. Score Points');
            expect(html).toContain('Points are awarded for speed: guess quickly for up to 500 pts; drawers earn points when others guess.');
        });
    });
});
