import { test, expect } from '@playwright/test';

test.describe('Game Modes E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();
    });

    test('1. Host can select all 6 game modes from the Mode Picker in Lobby', async ({ page }) => {
        // Create room as host
        const nicknameInput = page.locator('input#player-nickname');
        await expect(nicknameInput).toBeVisible({ timeout: 10000 });
        await page.waitForFunction(() => window.__scribble_socket?.connected);
        await nicknameInput.fill('ModeHost');
        await page.locator('button:has-text("Start a room")').click();

        // Wait for Lobby
        await page.waitForURL(/\/lobby\//);

        // Verify Mode Picker is visible with all 6 mode cards
        const modePicker = page.locator('[data-testid="mode-picker"]');
        await expect(modePicker).toBeVisible();

        const classicCard = page.locator('[data-testid="mode-card-classic"]');
        const speedCard = page.locator('[data-testid="mode-card-speed"]');
        const teamCard = page.locator('[data-testid="mode-card-team"]');
        const relayCard = page.locator('[data-testid="mode-card-relay"]');
        const hardCard = page.locator('[data-testid="mode-card-hard"]');
        const customCard = page.locator('[data-testid="mode-card-custom"]');

        await expect(classicCard).toBeVisible();
        await expect(speedCard).toBeVisible();
        await expect(teamCard).toBeVisible();
        await expect(relayCard).toBeVisible();
        await expect(hardCard).toBeVisible();
        await expect(customCard).toBeVisible();

        // Default is classic
        await expect(classicCard).toHaveClass(/bg-marigold/);

        // Select Speed mode
        await speedCard.click();
        await expect(speedCard).toHaveClass(/bg-marigold/);
        await expect(classicCard).not.toHaveClass(/bg-marigold/);

        // Select Team mode
        await teamCard.click();
        await expect(teamCard).toHaveClass(/bg-marigold/);
        await expect(page.locator('[data-testid="team-mode-settings"]')).toBeVisible();

        // Select Custom mode
        await customCard.click();
        await expect(customCard).toHaveClass(/bg-marigold/);
        await expect(page.locator('[data-testid="custom-mode-settings"]')).toBeVisible();
    });

    test('2. Team mode: host can change team count and randomise teams', async ({ page }) => {
        const nicknameInput = page.locator('input#player-nickname');
        await expect(nicknameInput).toBeVisible({ timeout: 10000 });
        await page.waitForFunction(() => window.__scribble_socket?.connected);
        await nicknameInput.fill('TeamHost');
        await page.locator('button:has-text("Start a room")').click();

        await page.waitForURL(/\/lobby\//);

        // Switch to Team mode
        await page.locator('[data-testid="mode-card-team"]').click();
        await expect(page.locator('[data-testid="team-mode-settings"]')).toBeVisible();

        // Change team count to 3
        const count3Btn = page.locator('[data-testid="team-count-3"]');
        await count3Btn.click();
        await expect(count3Btn).toHaveClass(/bg-tomato/);

        // Randomise teams button is clickable
        const randomiseBtn = page.locator('[data-testid="randomize-teams-btn"]');
        await expect(randomiseBtn).toBeVisible();
        await randomiseBtn.click();
    });

    test('3. Custom mode: host can configure time, hint count, and score multiplier', async ({ page }) => {
        const nicknameInput = page.locator('input#player-nickname');
        await expect(nicknameInput).toBeVisible({ timeout: 10000 });
        await page.waitForFunction(() => window.__scribble_socket?.connected);
        await nicknameInput.fill('CustomHost');
        await page.locator('button:has-text("Start a room")').click();

        await page.waitForURL(/\/lobby\//);

        // Switch to Custom mode
        await page.locator('[data-testid="mode-card-custom"]').click();
        const customSettings = page.locator('[data-testid="custom-mode-settings"]');
        await expect(customSettings).toBeVisible();

        // Change draw time to 45s
        const time45Btn = page.locator('[data-testid="custom-time-45"]');
        await time45Btn.click();
        await expect(time45Btn).toHaveClass(/bg-tomato/);

        // Change hints to 1
        const hints1Btn = page.locator('[data-testid="custom-hints-1"]');
        await hints1Btn.click();
        await expect(hints1Btn).toHaveClass(/bg-tomato/);

        // Change multiplier to 2.0x
        const mult2Btn = page.locator('[data-testid="custom-mult-2"]');
        await mult2Btn.click();
        await expect(mult2Btn).toHaveClass(/bg-tomato/);
    });

    test('4. Non-host sees read-only mode card and cannot change mode', async ({ browser }) => {
        const hostContext = await browser.newContext();
        const guestContext = await browser.newContext();

        const hostPage = await hostContext.newPage();
        const guestPage = await guestContext.newPage();

        // Host creates room
        await hostPage.goto('/');
        await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
        const hostNick = hostPage.locator('input#player-nickname');
        await expect(hostNick).toBeVisible({ timeout: 10000 });
        await hostNick.fill('HostUser');
        await hostPage.locator('button:has-text("Start a room")').click();
        await hostPage.waitForURL(/\/lobby\//);

        const roomCode = hostPage.url().split('/lobby/')[1];

        // Host switches to Speed mode
        await hostPage.locator('[data-testid="mode-card-speed"]').click();

        // Guest joins room
        await guestPage.goto(`/join/${roomCode}`);
        await guestPage.waitForFunction(() => window.__scribble_socket?.connected);
        const guestNick = guestPage.locator('input#join-nickname');
        await expect(guestNick).toBeVisible({ timeout: 10000 });
        await guestNick.fill('GuestUser');
        await guestPage.locator('button:has-text("Join")').click();
        await guestPage.waitForURL(new RegExp(`/lobby/${roomCode}`));

        // Guest should see read-only mode container and no interactive mode cards
        const readonlyMode = guestPage.locator('[data-testid="readonly-mode"]');
        await expect(readonlyMode).toBeVisible();
        await expect(readonlyMode).toContainText('Speed');
        await expect(guestPage.locator('[data-testid="mode-card-classic"]')).not.toBeVisible();

        await hostContext.close();
        await guestContext.close();
    });
});
