import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SettingsProvider } from '../../context/SettingsContext';
import { SettingsModal } from '../Settings/SettingsModal';
import { SettingsCard } from '../Lobby/SettingsCard';
import { HintTiles } from '../Game/HintTiles';
import { Landing } from '../../pages/Landing';
import { MemoryRouter } from 'react-router-dom';
import { GameProvider } from '../../context/GameContext';
import { SocketContext } from '../../context/SocketContext';

const mockSocket = {
    on: () => {},
    off: () => {},
    emit: () => {},
    connect: () => {},
    disconnect: () => {},
    connected: true,
};

describe('Hindi & Hinglish Client UI Components', () => {
    beforeEach(() => {
        try {
            localStorage.clear();
        } catch {
            // ignore
        }
    });

    it('SettingsModal renders language switcher with English and Hindi radio options', () => {
        const html = renderToString(
            <SettingsProvider>
                <SettingsModal isOpen={true} onClose={() => {}} />
            </SettingsProvider>
        );

        expect(html).toContain('data-testid="setting-language"');
        expect(html).toContain('data-testid="setting-language-en"');
        expect(html).toContain('data-testid="setting-language-hi"');
        expect(html).toContain('Language / भाषा');
        expect(html).toContain('हिन्दी');
    });

    it('SettingsCard renders word language options for host', () => {
        const html = renderToString(
            <SettingsCard
                isHost={true}
                settings={{ wordLanguage: 'english', packs: [] }}
            />
        );

        expect(html).toContain('data-testid="word-language-option-english"');
        expect(html).toContain('data-testid="word-language-option-hindi"');
        expect(html).toContain('data-testid="word-language-option-hinglish"');
        expect(html).toContain('Word Language');
    });

    it('SettingsCard renders regional packs when wordLanguage is hindi or hinglish', () => {
        const hindiHtml = renderToString(
            <SettingsCard
                isHost={true}
                settings={{ wordLanguage: 'hindi', packs: [] }}
            />
        );

        expect(hindiHtml).toContain('Desi Food');
        expect(hindiHtml).toContain('Cricket');
        expect(hindiHtml).toContain('Festivals');
        expect(hindiHtml).toContain('Cities &amp; Monuments');

        const hinglishHtml = renderToString(
            <SettingsCard
                isHost={true}
                settings={{ wordLanguage: 'hinglish', packs: [] }}
            />
        );

        expect(hinglishHtml).toContain('Desi Food');
        expect(hinglishHtml).toContain('Cinema &amp; Bollywood');
    });

    it('SettingsCard displays read-only word language badge for non-host', () => {
        const html = renderToString(
            <SettingsCard
                isHost={false}
                settings={{ wordLanguage: 'hindi', packs: [] }}
            />
        );

        expect(html).toContain('data-testid="readonly-word-language"');
        expect(html).toContain('हिन्दी (Devanagari)');
    });

    it('HintTiles correctly renders Devanagari grapheme clusters and conjuncts as single tiles', () => {
        // 'पा _' for 'पानी' (2 graphemes)
        const paniHtml = renderToString(
            <HintTiles hint="पा _" isDrawer={false} />
        );

        expect(paniHtml).toContain('data-testid="hint-tiles-container"');
        expect(paniHtml).toContain('data-letter="पा"');
        expect(paniHtml).toContain('पा');
        // Length display for 2 graphemes
        expect(paniHtml).toContain('data-testid="hint-length"');
        expect(paniHtml).toContain('2');

        // 'क्रि के _' for 'क्रिकेट' (3 graphemes)
        const cricketHtml = renderToString(
            <HintTiles hint="क्रि के _" isDrawer={false} />
        );

        expect(cricketHtml).toContain('data-letter="क्रि"');
        expect(cricketHtml).toContain('data-letter="के"');
        expect(cricketHtml).toContain('3');
    });

    it('HintTiles displays full Hindi word in drawer marigold chip', () => {
        const html = renderToString(
            <HintTiles word="पानी पूरी" isDrawer={true} />
        );

        expect(html).toContain('data-testid="drawer-word-chip"');
        expect(html).toContain('पानी पूरी');
    });

    it('Landing page includes language switcher button', () => {
        const html = renderToString(
            <MemoryRouter>
                <SocketContext.Provider value={mockSocket}>
                    <GameProvider>
                        <SettingsProvider>
                            <Landing />
                        </SettingsProvider>
                    </GameProvider>
                </SocketContext.Provider>
            </MemoryRouter>
        );

        expect(html).toContain('data-testid="language-switcher"');
        expect(html).toContain('हिन्दी');
    });
});
