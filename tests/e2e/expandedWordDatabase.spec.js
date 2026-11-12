import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const categoriesDir = path.resolve('server/src/words/categories');
const packDefinitions = JSON.parse(fs.readFileSync(path.resolve('shared/wordPacks.json'), 'utf8'));

function categoryWords(categoryId) {
  const data = JSON.parse(fs.readFileSync(path.join(categoriesDir, `${categoryId}.json`), 'utf8'));
  return Object.values(data).flat();
}

const sportsAndScience = new Set([
  ...categoryWords('sports'),
  ...categoryWords('science_space')
]);

test.describe('Expanded Word Database Wiring', () => {
  test('Expert difficulty and the new pack set drive live word choices', async ({ browser }) => {
    test.setTimeout(90000);

    const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/');
    await hostPage.waitForSelector('input#player-nickname');
    await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
    await hostPage.fill('input#player-nickname', 'HostPlayer');
    await hostPage.click('button:has-text("Start a room")');
    await hostPage.waitForURL(/\/lobby\//);
    const roomCode = hostPage.url().split('/lobby/')[1];

    // All five difficulty tiers are selectable, including Expert.
    for (const tier of ['Easy', 'Medium', 'Hard', 'Expert', 'Mixed']) {
      await expect(hostPage.locator(`button:has-text("${tier}")`).first()).toBeVisible();
    }
    const expertBtn = hostPage.locator('button:has-text("Expert")').first();
    await expertBtn.click();
    await expect(expertBtn).toHaveClass(/bg-tomato/);

    // Every pack definition is rendered from the shared config.
    for (const pack of packDefinitions) {
      await expect(hostPage.locator(`button:has-text("${pack.label}")`).first()).toBeVisible();
    }

    // Select two of the new packs.
    await hostPage.locator('button:has-text("Sports")').first().click();
    await hostPage.locator('button:has-text("Science & Space")').first().click();
    await expect(hostPage.getByText('2 active')).toBeVisible();

    // Second player joins and the game starts.
    const guestContext = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/join/${roomCode}`);
    await guestPage.waitForSelector('input#join-nickname');
    await guestPage.fill('input#join-nickname', 'Guesser');
    await guestPage.click('button:has-text("Join")');
    await guestPage.waitForURL(new RegExp(`/lobby/${roomCode}`));

    const startGameBtn = hostPage.locator('button:has-text("Start Game")').first();
    await expect(startGameBtn).toBeEnabled();
    await startGameBtn.click();
    await hostPage.waitForURL(new RegExp(`/game/${roomCode}`));

    const cards = hostPage.locator('[data-testid^="word-choice-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // Every offered word comes from the selected packs.
    const count = await cards.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const word = (await card.locator('[data-testid="card-word"]').innerText()).trim().toLowerCase();
      expect(sportsAndScience.has(word), `"${word}" is not in the selected packs`).toBe(true);
      await expect(card).toHaveAttribute('aria-label', /, Expert difficulty$/);
    }

    // The client difficulty map recognizes the same word as Expert.
    const clientLevel = await hostPage.evaluate(async (word) => {
      const { getWordDifficulty } = await import('/src/utils/wordDifficulty.js');
      return getWordDifficulty(word);
    }, (await cards.first().locator('[data-testid="card-word"]').innerText()).trim().toLowerCase());
    expect(clientLevel).toEqual({ difficulty: 'Expert', level: 4 });

    await hostContext.close();
    await guestContext.close();
  });
});
