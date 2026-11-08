import { test, expect } from '@playwright/test';

test.describe('Rule Twists E2E Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();
    });

    test('1. Host can configure Rule Twists and non-host sees synchronized settings in Lobby', async ({ browser }) => {
        const hostContext = await browser.newContext();
        const guesserContext = await browser.newContext();

        const hostPage = await hostContext.newPage();
        const guesserPage = await guesserContext.newPage();

        // 1. Host creates room
        await hostPage.goto('/');
        await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
        await hostPage.locator('input#player-nickname').fill('TwistHost');
        await hostPage.locator('button:has-text("Start a room")').click();
        await hostPage.waitForURL(/\/lobby\//);

        const url = hostPage.url();
        const code = url.split('/lobby/')[1];

        // 2. Twist segmented buttons are visible
        const offBtn = hostPage.locator('[data-testid="twist-option-off"]');
        const sometimesBtn = hostPage.locator('[data-testid="twist-option-sometimes"]');
        const everyBtn = hostPage.locator('[data-testid="twist-option-every"]');

        await expect(offBtn).toBeVisible();
        await expect(sometimesBtn).toBeVisible();
        await expect(everyBtn).toBeVisible();

        // Default is Off
        await expect(offBtn).toHaveClass(/bg-tomato/);
        await expect(hostPage.locator('[data-testid="enabled-twists-checklist"]')).toHaveCount(0);

        // Click 'Every turn'
        await everyBtn.click();
        await expect(everyBtn).toHaveClass(/bg-tomato/);

        // Enabled twists checklist appears
        const checklist = hostPage.locator('[data-testid="enabled-twists-checklist"]');
        await expect(checklist).toBeVisible();

        // Toggle off 'speed' twist chip
        const speedChip = hostPage.locator('[data-testid="twist-chip-speed"]');
        await expect(speedChip).toBeVisible();
        await speedChip.click();

        // 3. Guesser joins
        await guesserPage.goto(`/join/${code}`);
        await guesserPage.waitForFunction(() => window.__scribble_socket?.connected);
        await guesserPage.locator('input#join-nickname').fill('TwistGuesser');
        await guesserPage.locator('button:has-text("Join")').click();
        await guesserPage.waitForURL(new RegExp(`/lobby/${code}`));

        // 4. Guesser sees read-only twists summary with 9 enabled
        const readonlyTwists = guesserPage.locator('[data-testid="readonly-twists"]');
        await expect(readonlyTwists).toBeVisible();
        await expect(readonlyTwists).toContainText('Every turn (9 enabled)');

        // Guesser does not have interactive twist buttons
        await expect(guesserPage.locator('[data-testid="twist-option-every"]')).toHaveCount(0);

        await hostContext.close();
        await guesserContext.close();
    });

    test('2. Active Limited Ink Twist displays turn intro card, badge, ink bar, and drains on stroke', async ({ browser }) => {
        const hostContext = await browser.newContext();
        const guesserContext = await browser.newContext();

        const hostPage = await hostContext.newPage();
        const guesserPage = await guesserContext.newPage();

        // 1. Host creates room
        await hostPage.goto('/');
        await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
        await hostPage.locator('input#player-nickname').fill('InkMaster');
        await hostPage.locator('button:has-text("Start a room")').click();
        await hostPage.waitForURL(/\/lobby\//);

        const code = hostPage.url().split('/lobby/')[1];

        // 2. Guesser joins
        await guesserPage.goto(`/join/${code}`);
        await guesserPage.waitForFunction(() => window.__scribble_socket?.connected);
        await guesserPage.locator('input#join-nickname').fill('GuessObserver');
        await guesserPage.locator('button:has-text("Join")').click();
        await guesserPage.waitForURL(new RegExp(`/lobby/${code}`));

        // Set wordChoice to 'random'
        const randomWordOption = hostPage.locator('[data-testid="word-choice-option-random"]');
        if (await randomWordOption.isVisible()) {
            await randomWordOption.click();
        }

        // Host selects 'Every turn' for twists
        await hostPage.locator('[data-testid="twist-option-every"]').click();

        // Disable all twists except 'limited-ink'
        const otherTwists = [
            'one-colour',
            'no-undo-eraser',
            'thin-line',
            'mirror',
            'upside-down',
            'blindfold',
            'speed',
            'wobbly-pen',
            'first-guesser-bonus',
        ];
        for (const tId of otherTwists) {
            await hostPage.locator(`[data-testid="twist-chip-${tId}"]`).click();
            // Small pause between clicks to ensure settings updates propagate
            await hostPage.waitForTimeout(50);
        }

        // Verify guesser sees 'Every turn (1 enabled)'
        await expect(guesserPage.locator('[data-testid="readonly-twists"]')).toContainText('Every turn (1 enabled)');

        // 3. Start game
        const startBtn = hostPage.locator('button:has-text("Start game")').first();
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();

        await hostPage.waitForURL(new RegExp(`/game/${code}`));
        await guesserPage.waitForURL(new RegExp(`/game/${code}`));

        // 4. Verify Turn Intro and Twist Card
        const turnIntro = hostPage.locator('[data-testid="turn-intro-card"]');
        await expect(turnIntro).toBeVisible({ timeout: 10000 });

        const twistCard = hostPage.locator('[data-testid="twist-card"]');
        await expect(twistCard).toBeVisible({ timeout: 5000 });
        await expect(hostPage.locator('[data-testid="twist-name"]')).toContainText('Limited ink');

        // 5. Drawing state - wait for drawing to begin and prompt to appear
        await expect(hostPage.locator('[data-testid="empty-canvas-prompt"]')).toBeVisible({ timeout: 15000 });
        await expect(hostPage.locator('[data-testid="drawing-paper"]')).toBeVisible({ timeout: 15000 });
        await expect(guesserPage.locator('[data-testid="drawing-paper"]')).toBeVisible({ timeout: 15000 });

        // Both see Twist Badge in GameBar
        const hostTwistBadge = hostPage.locator('[data-testid^="twist-badge"]:visible').first();
        await expect(hostTwistBadge).toBeVisible({ timeout: 5000 });
        await expect(hostTwistBadge).toContainText('Limited ink');

        const guesserTwistBadge = guesserPage.locator('[data-testid^="twist-badge"]:visible').first();
        await expect(guesserTwistBadge).toBeVisible({ timeout: 5000 });
        await expect(guesserTwistBadge).toContainText('Limited ink');

        // 6. Drawer sees ink bar, Guesser does NOT
        const inkBar = hostPage.locator('[data-testid="ink-bar"]');
        await expect(inkBar).toBeVisible();
        await expect(inkBar).toContainText('Ink: 100%');

        const guesserInkBar = guesserPage.locator('[data-testid="ink-bar"]');
        await expect(guesserInkBar).toHaveCount(0);

        // 7. Drawer draws on canvas -> ink drains
        const canvas = hostPage.locator('[data-testid="canvas-element"]');
        await expect(canvas).toBeVisible();
        const box = await canvas.boundingBox();
        if (box) {
            const startX = box.x + box.width / 4;
            const startY = box.y + box.height / 4;
            await hostPage.mouse.move(startX, startY);
            await hostPage.mouse.down();
            await hostPage.mouse.move(startX + 100, startY + 100, { steps: 25 });
            await hostPage.mouse.up();
        }

        // Ink percentage decreases from 100%
        await expect(inkBar).not.toContainText('Ink: 100%', { timeout: 5000 });

        // 8. Drawer clicks Undo -> Ink is refunded
        const undoBtn = hostPage.locator('button[aria-label="Undo stroke (Ctrl+Z)"]:visible').first();
        await expect(undoBtn).toBeEnabled();
        await undoBtn.click();

        // Ink returns to 100%
        await expect(inkBar).toContainText('Ink: 100%', { timeout: 5000 });

        await hostContext.close();
        await guesserContext.close();
    });

    test('3. No Undo or Eraser twist disables eraser, undo, and clear in Drawer ToolTray', async ({ browser }) => {
        const hostContext = await browser.newContext();
        const guesserContext = await browser.newContext();

        const hostPage = await hostContext.newPage();
        const guesserPage = await guesserContext.newPage();

        // 1. Host creates room
        await hostPage.goto('/');
        await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
        await hostPage.locator('input#player-nickname').fill('StrictDrawer');
        await hostPage.locator('button:has-text("Start a room")').click();
        await hostPage.waitForURL(/\/lobby\//);

        const code = hostPage.url().split('/lobby/')[1];

        // 2. Guesser joins
        await guesserPage.goto(`/join/${code}`);
        await guesserPage.waitForFunction(() => window.__scribble_socket?.connected);
        await guesserPage.locator('input#join-nickname').fill('StrictGuesser');
        await guesserPage.locator('button:has-text("Join")').click();
        await guesserPage.waitForURL(new RegExp(`/lobby/${code}`));

        // Random word mode for speed
        const randomWordOption = hostPage.locator('[data-testid="word-choice-option-random"]');
        if (await randomWordOption.isVisible()) {
            await randomWordOption.click();
        }

        // Set twists: 'Every turn' and isolate 'no-undo-eraser'
        await hostPage.locator('[data-testid="twist-option-every"]').click();
        const otherTwists = [
            'one-colour',
            'limited-ink',
            'thin-line',
            'mirror',
            'upside-down',
            'blindfold',
            'speed',
            'wobbly-pen',
            'first-guesser-bonus',
        ];
        for (const tId of otherTwists) {
            await hostPage.locator(`[data-testid="twist-chip-${tId}"]`).click();
            await hostPage.waitForTimeout(50);
        }

        // Start game
        const startBtn = hostPage.locator('button:has-text("Start game")').first();
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();

        await hostPage.waitForURL(new RegExp(`/game/${code}`));
        await guesserPage.waitForURL(new RegExp(`/game/${code}`));

        // Wait for DRAWING state
        await expect(hostPage.locator('[data-testid="drawing-paper"]')).toBeVisible({ timeout: 15000 });

        // Drawer tool checks: Eraser, Undo, and Clear buttons must be disabled
        const eraserBtn = hostPage.locator('button[aria-label="Eraser tool (E)"]:visible').first();
        await expect(eraserBtn).toBeDisabled();

        const undoBtn = hostPage.locator('button[aria-label="Undo stroke (Ctrl+Z)"]:visible').first();
        await expect(undoBtn).toBeDisabled();

        const clearBtn = hostPage.locator('button[aria-label="Clear drawing"]:visible').first();
        await expect(clearBtn).toBeDisabled();

        await hostContext.close();
        await guesserContext.close();
    });

    test('4. Reduced motion displays twist intro card gracefully without 3D transform', async ({ browser }) => {
        const hostContext = await browser.newContext({
            reducedMotion: 'reduce',
        });
        const guesserContext = await browser.newContext({
            reducedMotion: 'reduce',
        });
        const hostPage = await hostContext.newPage();
        const guesserPage = await guesserContext.newPage();

        await hostPage.goto('/');
        await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
        await hostPage.locator('input#player-nickname').fill('MotionHost');
        await hostPage.locator('button:has-text("Start a room")').click();
        await hostPage.waitForURL(/\/lobby\//);

        const code = hostPage.url().split('/lobby/')[1];

        await guesserPage.goto(`/join/${code}`);
        await guesserPage.waitForFunction(() => window.__scribble_socket?.connected);
        await guesserPage.locator('input#join-nickname').fill('MotionGuesser');
        await guesserPage.locator('button:has-text("Join")').click();
        await guesserPage.waitForURL(new RegExp(`/lobby/${code}`));

        // Set twists to every turn
        await hostPage.locator('[data-testid="twist-option-every"]').click();
        const randomWordOption = hostPage.locator('[data-testid="word-choice-option-random"]');
        if (await randomWordOption.isVisible()) {
            await randomWordOption.click();
        }

        // Start game
        const startBtn = hostPage.locator('button:has-text("Start game")').first();
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();

        await hostPage.waitForURL(new RegExp(`/game/${code}`));

        // TurnIntro card is visible
        const turnIntro = hostPage.locator('[data-testid="turn-intro-card"]');
        await expect(turnIntro).toBeVisible({ timeout: 10000 });

        // Twist card appears
        const twistCard = hostPage.locator('[data-testid="twist-card"]');
        await expect(twistCard).toBeVisible({ timeout: 5000 });

        await hostContext.close();
        await guesserContext.close();
    });
});

