import { test, expect } from '@playwright/test';

test.describe('Reactions, Likes & Emoji Chat E2E Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();
    });

    test('1. Chat input converts emoji shortcodes and has functional EmojiPicker', async ({ page }) => {
        const nicknameInput = page.locator('input#player-nickname');
        await expect(nicknameInput).toBeVisible({ timeout: 10000 });
        await page.waitForFunction(() => window.__scribble_socket?.connected);
        await nicknameInput.fill('HostTester');
        await page.locator('button:has-text("Start a room")').click();

        await page.waitForURL(/\/lobby\//);

        // In lobby chat, check guess/chat input
        const chatInput = page.locator('input[placeholder*="Chat"], input[placeholder*="guess"]');
        if (await chatInput.isVisible()) {
            // Test shortcode replacement
            await chatInput.fill('Hello :fire: world :smile:');
            await expect(chatInput).toHaveValue('Hello 🔥 world 😄');

            // Test EmojiPicker toggle
            const emojiBtn = page.locator('[data-testid="emoji-picker-btn"]');
            if (await emojiBtn.isVisible()) {
                await emojiBtn.click();
                const picker = page.locator('div[role="dialog"][aria-label="Emoji Picker"]');
                await expect(picker).toBeVisible();

                // Select an animal emoji
                const animalsTab = page.locator('button[aria-label="Show Animals"]');
                await animalsTab.click();
                const catBtn = page.locator('button[aria-label="Select 🐱"]');
                await catBtn.click();

                // Input now has cat emoji appended
                const val = await chatInput.inputValue();
                expect(val).toContain('🐱');
            }
        }
    });

    test('2. Two-player game: guesser sees ReactionBar and Like button, drawer sees Likes counter', async ({ browser }) => {
        const hostContext = await browser.newContext();
        const guesserContext = await browser.newContext();

        const hostPage = await hostContext.newPage();
        const guesserPage = await guesserContext.newPage();

        // 1. Host creates room
        await hostPage.goto('/');
        await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
        await hostPage.locator('input#player-nickname').fill('ArtistMaya');
        await hostPage.locator('button:has-text("Start a room")').click();
        await hostPage.waitForURL(/\/lobby\//);

        // Get room code
        const url = hostPage.url();
        const code = url.split('/lobby/')[1];

        // 2. Guesser joins
        await guesserPage.goto(`/join/${code}`);
        await guesserPage.waitForFunction(() => window.__scribble_socket?.connected);
        await guesserPage.locator('input#join-nickname').fill('GuesserRaj');
        await guesserPage.locator('button:has-text("Join")').click();
        await guesserPage.waitForURL(new RegExp(`/lobby/${code}`));

        // Set wordChoice to 'random' so game starts immediately into drawing without waiting for manual word pick
        const randomWordOption = hostPage.locator('[data-testid="word-choice-option-random"]');
        if (await randomWordOption.isVisible()) {
            await randomWordOption.click();
        }

        // 3. Host starts game
        const startBtn = hostPage.locator('button:has-text("Start game")').first();
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();

        // Wait for both to be in game
        await hostPage.waitForURL(new RegExp(`/game/${code}`));
        await guesserPage.waitForURL(new RegExp(`/game/${code}`));

        // If word cards appear for drawer, pick the first word
        const wordCards = hostPage.locator('[data-testid^="word-choice-card-"]');
        if (await wordCards.first().isVisible({ timeout: 6000 }).catch(() => false)) {
            await hostPage.waitForTimeout(1600);
            await wordCards.first().dispatchEvent('click');
        }

        // Wait for DRAWING state (drawing paper visible)
        await expect(hostPage.locator('[data-testid="drawing-paper"]')).toBeVisible({ timeout: 15000 });
        await expect(guesserPage.locator('[data-testid="drawing-paper"]')).toBeVisible({ timeout: 15000 });

        // Drawer (Host) should NOT see ReactionBar
        const drawerReactionBar = hostPage.locator('[data-testid="reaction-bar"]');
        await expect(drawerReactionBar).toHaveCount(0);

        // Guesser SHOULD see ReactionBar with 8 reaction buttons and Like button
        const guesserReactionBar = guesserPage.locator('[data-testid="reaction-bar"]:visible');
        await expect(guesserReactionBar).toBeVisible({ timeout: 10000 });

        const fireBtn = guesserPage.locator('[data-testid="reaction-btn-fire"]:visible');
        await expect(fireBtn).toBeVisible();

        const likeBtn = guesserPage.locator('[data-testid="like-drawing-btn"]:visible');
        await expect(likeBtn).toBeVisible();
        await expect(likeBtn).toHaveText(/Like/);

        // 4. Guesser clicks fire reaction -> floating reactions canvas handles sprite
        await fireBtn.click();
        const canvas = guesserPage.locator('[data-testid="reactions-canvas"]');
        await expect(canvas).toBeVisible();

        // 5. Guesser clicks Like button
        await likeBtn.click();
        await expect(likeBtn).toHaveText(/Liked/);
        await expect(likeBtn).toBeDisabled();

        // 6. Drawer sees Live Likes Counter
        const drawerLikesCounter = hostPage.locator('[data-testid="drawer-likes-counter"]');
        await expect(drawerLikesCounter).toBeVisible({ timeout: 5000 });
        await expect(drawerLikesCounter).toContainText('Likes 1');

        await hostContext.close();
        await guesserContext.close();
    });
});
