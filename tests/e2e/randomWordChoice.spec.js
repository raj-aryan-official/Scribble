import { test, expect } from '@playwright/test';

test.describe('Random Word Choice & Default Selection E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();
    });

    test('1. Host can toggle Word choice: Pick from 3 | Random word in Lobby', async ({ page }) => {
        // Create room as host
        const nicknameInput = page.locator('input#player-nickname');
        await expect(nicknameInput).toBeVisible({ timeout: 10000 });
        await page.waitForFunction(() => window.__scribble_socket?.connected);
        await nicknameInput.fill('HostPlayer');
        await page.locator('button:has-text("Start a room")').click();

        // Wait for Lobby
        await page.waitForURL(/\/lobby\//);

        // Segmented control is visible
        const pickBtn = page.locator('[data-testid="word-choice-option-pick"]');
        const randomBtn = page.locator('[data-testid="word-choice-option-random"]');

        await expect(pickBtn).toBeVisible();
        await expect(randomBtn).toBeVisible();

        // Default is Pick from 3
        await expect(pickBtn).toHaveClass(/bg-tomato/);

        // Click Random word
        await randomBtn.click();
        await expect(randomBtn).toHaveClass(/bg-tomato/);
        await expect(pickBtn).not.toHaveClass(/bg-tomato/);
    });

    test('2. SettingsModal includes "Always pick randomly for me" switch', async ({ page }) => {
        await page.goto('/');

        // Open settings modal via gear button
        const gearBtn = page.locator('button[aria-label="Settings"]');
        await expect(gearBtn).toBeVisible();
        await gearBtn.click();

        // Check for toggle
        const toggle = page.locator('#setting-always-pick-randomly');
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-checked', 'false');

        // Toggle on
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-checked', 'true');

        // Verify persisted in localStorage
        const savedSettings = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('scribble_settings') || '{}');
        });
        expect(savedSettings.alwaysPickRandomly).toBe(true);
    });
});

