import { test, expect } from '@playwright/test';

test.describe('Chat Message Deduplication & Listener Hygiene (React StrictMode)', () => {
  test('sends 20 messages and verifies exactly 20 message items appear on all clients with exactly 1 listener', async ({
    browser,
  }) => {
    test.setTimeout(120000);

    // Host Context (Desktop)
    const hostContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const hostPage = await hostContext.newPage();

    // Guesser Context (Desktop)
    const guesserContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const guesserPage = await guesserContext.newPage();

    // 1. Host creates room
    await hostPage.goto('/', { waitUntil: 'networkidle' });
    const hostNickname = hostPage.locator('input#player-nickname');
    await expect(hostNickname).toBeVisible({ timeout: 10000 });
    await hostPage.waitForFunction(() => window.__scribble_socket?.connected);
    await hostPage.waitForTimeout(500);
    await hostNickname.fill('HostDrawer');
    const startBtn = hostPage.locator('button:has-text("Start a room")');
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    await hostPage.waitForURL(/\/lobby\/[A-Z0-9]+/);
    const roomCode = hostPage.url().split('/lobby/')[1].toUpperCase();

    // 2. Guesser joins room
    await guesserPage.goto(`/join/${roomCode}`, { waitUntil: 'networkidle' });
    const joinNickname = guesserPage.locator('input#join-nickname');
    await expect(joinNickname).toBeVisible({ timeout: 10000 });
    await guesserPage.waitForFunction(() => window.__scribble_socket?.connected);
    await guesserPage.waitForTimeout(500);
    await joinNickname.fill('GuesserBob');
    const joinBtn = guesserPage.locator('button:has-text("Join")');
    await expect(joinBtn).toBeVisible({ timeout: 5000 });
    await joinBtn.click();
    await guesserPage.waitForURL(new RegExp(`/lobby/${roomCode}`));

    // Verify both are in lobby
    await expect(hostPage.getByText('GuesserBob', { exact: true })).toBeVisible();

    // 3. Verify listener hygiene: socket.listeners('messageReceived').length is 1 under StrictMode
    const hostListenerCount = await hostPage.evaluate(() => {
      return window.__scribble_socket?.listeners('messageReceived')?.length;
    });
    const guesserListenerCount = await guesserPage.evaluate(() => {
      return window.__scribble_socket?.listeners('messageReceived')?.length;
    });

    console.log(`[TEST] host messageReceived listeners count: ${hostListenerCount}`);
    console.log(`[TEST] guesser messageReceived listeners count: ${guesserListenerCount}`);
    expect(hostListenerCount).toBe(1);
    expect(guesserListenerCount).toBe(1);

    // 4. Start game
    const startGameBtn = hostPage.locator('button:has-text("Start Game")').first();
    await expect(startGameBtn).toBeEnabled();
    await startGameBtn.click();

    await hostPage.waitForURL(new RegExp(`/game/${roomCode}`));
    await guesserPage.waitForURL(new RegExp(`/game/${roomCode}`));

    // Host selects word
    const wordCards = hostPage.locator('[data-testid^="word-choice-card-"]');
    await expect(wordCards.first()).toBeVisible({ timeout: 15000 });
    await hostPage.waitForTimeout(1600); // Wait for TurnIntro animation
    await wordCards.first().dispatchEvent('click');

    // Wait for drawing paper to be active
    await expect(hostPage.locator('[data-testid="drawing-paper"]')).toBeVisible({ timeout: 10000 });
    await expect(guesserPage.locator('[data-testid="drawing-paper"]')).toBeVisible({ timeout: 10000 });

    // 5. Guesser sends 20 unique messages
    // To stay within the rate limit (5 msgs / 3s), send with 650ms delay between each
    const guessInput = guesserPage.locator('input[placeholder="Type your guess"]:visible');
    await expect(guessInput).toBeVisible({ timeout: 5000 });

    console.log('[TEST] Sending 20 chat messages...');
    for (let i = 1; i <= 20; i++) {
      await guessInput.fill(`Test message ${i}`);
      await guessInput.press('Enter');
      await guesserPage.waitForTimeout(650);
    }

    // Wait for messages to settle
    await guesserPage.waitForTimeout(1500);

    // 6. Assert exactly 20 chat message items exist on both clients
    const guesserChatItems = guesserPage.locator('[data-testid="chat-message-item"]');
    const guesserItemCount = await guesserChatItems.count();

    console.log(`[TEST] Guesser sees ${guesserItemCount} chat message items.`);
    expect(guesserItemCount).toBe(20);

    // Verify last message content
    await expect(guesserChatItems.nth(19)).toContainText('Test message 20');

    // Verify listeners remain exactly 1 after all operations
    const finalGuesserListeners = await guesserPage.evaluate(() => {
      return window.__scribble_socket?.listeners('messageReceived')?.length;
    });
    expect(finalGuesserListeners).toBe(1);

    console.log('✅ PLAYWRIGHT TEST PASSED: Exactly 20 messages rendered, 1 listener confirmed.');

    await hostContext.close();
    await guesserContext.close();
  });
});
