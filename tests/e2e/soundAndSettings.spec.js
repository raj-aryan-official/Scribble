import { test, expect } from '@playwright/test';

test.describe('Sound Toggle & Settings Panel E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Clear storage before each test
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();
    });

    test('1. Sound toggle: one-time hint, one tap mute, survives reload, and toggles with M key', async ({ page }) => {
        // Landing page loaded
        const soundToggle = page.locator('button[aria-label="Mute game sounds"]');
        await expect(soundToggle).toBeVisible();
        await expect(soundToggle).toHaveAttribute('aria-pressed', 'false');

        // One-time hint is visible initially
        const soundHint = page.locator('[data-testid="sound-hint-bubble"]');
        await expect(soundHint).toBeVisible();
        await expect(soundHint).toContainText('Sound is on. Tap to mute.');

        // Tap speaker button to mute
        await soundToggle.click();

        // Muted immediately
        const unmuteToggle = page.locator('button[aria-label="Unmute game sounds"]');
        await expect(unmuteToggle).toBeVisible();
        await expect(unmuteToggle).toHaveAttribute('aria-pressed', 'true');

        // Hint is dismissed
        await expect(soundHint).not.toBeVisible();

        // Verify storage persisted
        const savedSettings = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('scribble_settings') || '{}');
        });
        expect(savedSettings.isMuted).toBe(true);

        // Choice survives reload
        await page.reload();
        await expect(unmuteToggle).toBeVisible();
        await expect(unmuteToggle).toHaveAttribute('aria-pressed', 'true');
        await expect(soundHint).not.toBeVisible();

        // Blur input to test global shortcut outside inputs
        await page.locator('body').click();

        // M key toggles it back to unmuted
        await page.keyboard.press('m');
        await expect(soundToggle).toBeVisible();
        await expect(soundToggle).toHaveAttribute('aria-pressed', 'false');

        // Typing in input does not toggle mute
        const nicknameInput = page.locator('input#player-nickname');
        await nicknameInput.focus();
        await nicknameInput.type('m');
        // Still unmuted!
        await expect(soundToggle).toBeVisible();
        await expect(soundToggle).toHaveAttribute('aria-pressed', 'false');
    });

    test('2. Settings panel: opens on gear click, updates options, and keyboard accessible', async ({ page }) => {
        const gearButton = page.locator('button[aria-label="Settings"]');
        await expect(gearButton).toBeVisible();

        // Click gear button to open
        await gearButton.click();

        const dialog = page.locator('div[role="dialog"]');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Settings');

        // Master Volume slider
        const volumeSlider = page.locator('input[aria-label="Master volume"]');
        await expect(volumeSlider).toBeVisible();
        await volumeSlider.fill('0.8');

        // Toggle Left-Handed Mode
        const leftHandedSwitch = page.locator('button#setting-left-handed');
        await expect(leftHandedSwitch).toBeVisible();
        await expect(leftHandedSwitch).toHaveAttribute('aria-checked', 'false');
        await leftHandedSwitch.click();
        await expect(leftHandedSwitch).toHaveAttribute('aria-checked', 'true');

        // Toggle Paper Grid
        const paperGridSwitch = page.locator('button#setting-paper-grid');
        await expect(paperGridSwitch).toBeVisible();
        await paperGridSwitch.click();
        await expect(paperGridSwitch).toHaveAttribute('aria-checked', 'true');

        // Text size 115%
        const textSize115 = page.locator('button[role="radio"]:has-text("115%")');
        await textSize115.click();
        await expect(textSize115).toHaveAttribute('aria-checked', 'true');

        // Verify root font size scaled
        const rootFontSize = await page.evaluate(() => document.documentElement.style.fontSize);
        expect(rootFontSize).toBe('115%');

        // Keyboard accessibility: Escape closes panel
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();

        // Settings survive page reload
        await page.reload();
        const reloadedSettings = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('scribble_settings') || '{}');
        });
        expect(reloadedSettings.leftHandedLayout).toBe(true);
        expect(reloadedSettings.paperGrid).toBe(true);
        expect(reloadedSettings.textSize).toBe(115);
    });
});
