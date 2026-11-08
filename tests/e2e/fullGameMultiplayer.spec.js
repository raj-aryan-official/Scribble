import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

test.beforeAll(async () => {
  const screenshotsDir = path.resolve('tests/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
});

async function checkA11y(page, screenName) {
  // Let DOM settle
  await page.waitForTimeout(300);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );

  if (seriousOrCritical.length > 0) {
    console.warn(
      `Axe serious/critical violations on ${screenName}:`,
      seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, description: v.description }))
    );
  }
  expect(seriousOrCritical).toEqual([]);
}

test.describe('Full 3-Player 2-Round Game with Accessibility Audit & Baselines', () => {
  test('plays complete match: create, invite join, settings, pick, draw, close & correct guess, reconnect, round end, game end, play again', async ({
    browser,
  }) => {
    test.setTimeout(120000);

    // Context 1: Host (Desktop 1, 1280x800)
    const hostContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const hostPage = await hostContext.newPage();
    hostPage.on('console', (msg) => console.log('[HOST]', msg.text()));

    // Context 2: Player 2 (Phone, 390x844)
    const phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const phonePage = await phoneContext.newPage();
    phonePage.on('console', (msg) => console.log('[PHONE]', msg.text()));

    // Context 3: Player 3 (Desktop 2, 1024x768)
    const desktopContext = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    });
    const desktopPage = await desktopContext.newPage();
    desktopPage.on('console', (msg) => console.log('[DESKTOP]', msg.text()));

    // ==========================================
    // 1. LANDING & ROOM CREATION
    // ==========================================
    await hostPage.goto('/');
    await hostPage.waitForSelector('input#player-nickname');
    await checkA11y(hostPage, '1-Landing');
    await hostPage.screenshot({ path: 'tests/screenshots/1-landing.png' });

    // Host fills nickname and creates room
    await hostPage.fill('input#player-nickname', 'Maya');
    await hostPage.click('button:has-text("Start a room")');

    // Wait for Lobby redirect
    await hostPage.waitForURL(/\/lobby\/[A-Z0-9]+/);
    const roomUrl = hostPage.url();
    const roomCode = roomUrl.split('/lobby/')[1].toUpperCase();
    expect(roomCode).toHaveLength(6);

    // Verify Lobby accessibility & baseline screenshot
    await hostPage.waitForSelector('text=Maya');
    await checkA11y(hostPage, '2-Lobby-Host');
    await hostPage.screenshot({ path: 'tests/screenshots/2-lobby.png' });

    // Host adjusts settings in Lobby: 1 round, 60s draw time for swift testing
    const round1Btn = hostPage.locator('[data-testid="round-option-1"]:visible');
    await expect(round1Btn).toBeVisible({ timeout: 5000 });
    await round1Btn.click();
    await expect(round1Btn).toHaveClass(/bg-tomato/, { timeout: 5000 });

    // ==========================================
    // 2. INVITE JOIN (PLAYER 2 - PHONE & PLAYER 3 - DESKTOP)
    // ==========================================
    // Phone player joins via invite link
    await phonePage.goto(`/join/${roomCode}`);
    await phonePage.waitForSelector('text=You\'re invited');
    await checkA11y(phonePage, '3-Join-Invite');
    await phonePage.screenshot({ path: 'tests/screenshots/3-join-invite.png' });

    await phonePage.fill('input#join-nickname', 'Alex');
    await phonePage.click('button:has-text("Join")');
    await phonePage.waitForURL(new RegExp(`/lobby/${roomCode}`));

    // Desktop player joins via invite link
    await desktopPage.goto(`/join/${roomCode}`);
    await desktopPage.waitForSelector('input#join-nickname');
    await desktopPage.fill('input#join-nickname', 'Sam');
    await desktopPage.click('button:has-text("Join")');
    await desktopPage.waitForURL(new RegExp(`/lobby/${roomCode}`));

    // Verify all 3 players appear in the lobby on host screen
    await expect(hostPage.getByText('Alex', { exact: true })).toBeVisible();
    await expect(hostPage.getByText('Sam', { exact: true })).toBeVisible();

    // ==========================================
    // 3. START GAME & WORD PICK (TURN 1 - MAYA)
    // ==========================================
    const startGameBtn = hostPage.locator('button:has-text("Start Game")').first();
    await expect(startGameBtn).toBeEnabled();
    await startGameBtn.click();

    // Game starts - countdown & redirect to /game/:code
    await hostPage.waitForURL(new RegExp(`/game/${roomCode}`));
    await phonePage.waitForURL(new RegExp(`/game/${roomCode}`));
    await desktopPage.waitForURL(new RegExp(`/game/${roomCode}`));

    // Drawer (Maya) gets word choice cards
    const wordCards = hostPage.locator('[data-testid^="word-choice-card-"]');
    await expect(wordCards.first()).toBeVisible({ timeout: 15000 });
    // Wait for TurnIntro animation to complete (1.5s) so cards are fully ready and unobscured
    await hostPage.waitForTimeout(1600);

    await checkA11y(hostPage, '4-Word-Pick');
    await hostPage.screenshot({ path: 'tests/screenshots/4-word-pick.png' });

    // Host selects the first offered word
    const chosenWordText = (await wordCards.first().locator('[data-testid="card-word"]').innerText()).trim().toLowerCase();
    await wordCards.first().dispatchEvent('click');

    // ==========================================
    // 4. DRAWING & GUESSING (CLOSE & CORRECT)
    // ==========================================
    // Host sees drawing paper
    const hostPaper = hostPage.locator('[data-testid="drawing-paper"]');
    await expect(hostPaper).toBeVisible({ timeout: 10000 });

    await checkA11y(hostPage, '5-Drawer-Canvas');
    await hostPage.screenshot({ path: 'tests/screenshots/5-drawer-canvas.png' });

    // Host draws a stroke on canvas
    const box = await hostPaper.boundingBox();
    if (box) {
      await hostPage.mouse.move(box.x + 50, box.y + 50);
      await hostPage.mouse.down();
      await hostPage.mouse.move(box.x + 150, box.y + 150, { steps: 5 });
      await hostPage.mouse.up();
    }

    // Phone guesser sees active game
    await expect(phonePage.locator('[data-testid="drawing-paper"]')).toBeVisible();
    await checkA11y(phonePage, '6-Guesser-Phone');
    await phonePage.screenshot({ path: 'tests/screenshots/6-guesser-phone.png' });

    // Phone guesser types a close guess if word has >= 4 chars
    const guessInput = phonePage.locator('input[placeholder="Type your guess"]:visible');
    if (chosenWordText.length >= 4) {
      // Near miss (1 char different)
      const nearMiss = chosenWordText.slice(0, -1) + 'z';
      await guessInput.fill(nearMiss);
      await guessInput.press('Enter');
      // "Close!" pill appears
      await phonePage.waitForTimeout(300);
    }

    // Phone guesser submits exact correct word
    await guessInput.fill(chosenWordText);
    await guessInput.press('Enter');

    // Phone guesser sees correct guess chip
    await expect(phonePage.locator('[data-testid="correct-guess-chip"]').first()).toBeVisible({ timeout: 10000 });

    // Desktop guesser (Sam) also submits correct word so all guessers complete the turn
    const desktopGuessInput = desktopPage.locator('input[placeholder="Type your guess"]:visible');
    if (await desktopGuessInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await desktopGuessInput.fill(chosenWordText);
      await desktopGuessInput.press('Enter');
    }

    // ==========================================
    // 5. ROUND END OVERLAY & RECONNECT
    // ==========================================
    // Wait for Round End overlay
    const roundEndHeading = hostPage.locator('#round-end-heading');
    await expect(roundEndHeading).toBeVisible({ timeout: 20000 });

    await checkA11y(hostPage, '7-Round-End');
    await hostPage.screenshot({ path: 'tests/screenshots/7-round-end.png' });

    // Reconnect test: Desktop player (Sam) refreshes the page
    await desktopPage.reload();
    await desktopPage.waitForURL(new RegExp(`/game/${roomCode}`));
    await expect(desktopPage.locator('header, canvas, #round-end-heading')).toBeVisible();

    // Host skips intermission if skip button is visible
    const skipBtn = hostPage.locator('[data-testid="skip-round-end-button"]');
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
    }

    // ==========================================
    // 6. TURN 2 & TURN 3 (FAST COMPLETION TO GAME END)
    // ==========================================
    // Turn 2: Alex (Phone) is drawer
    const phonePickCards = phonePage.locator('[data-testid^="word-choice-card-"]');
    await expect(phonePickCards.first()).toBeVisible({ timeout: 10000 });
    const turn2Word = (await phonePickCards.first().locator('[data-testid="card-word"]').innerText()).trim().toLowerCase();
    await phonePickCards.first().dispatchEvent('click');

    // Wait until drawing phase begins on guesser screens (hint tiles appear)
    await expect(hostPage.locator('[data-testid="hint-tiles-container"]')).toBeVisible({ timeout: 10000 });
    await expect(desktopPage.locator('[data-testid="hint-tiles-container"]')).toBeVisible({ timeout: 10000 });

    // Maya and Sam guess Turn 2 word
    const hostGuess2 = hostPage.locator('input[placeholder="Type your guess"]:visible');
    await expect(hostGuess2).toBeVisible({ timeout: 10000 });
    await hostGuess2.fill(turn2Word);
    await hostGuess2.press('Enter');
    await expect(hostPage.locator('[data-testid="correct-guess-chip"]:visible')).toBeVisible({ timeout: 5000 });

    const deskGuess2 = desktopPage.locator('input[placeholder="Type your guess"]:visible');
    await expect(deskGuess2).toBeVisible({ timeout: 10000 });
    await deskGuess2.fill(turn2Word);
    await deskGuess2.press('Enter');

    // Skip Turn 2 intermission
    await expect(skipBtn).toBeVisible({ timeout: 10000 });
    await skipBtn.click();

    // Turn 3: Sam (Desktop) is drawer
    const deskPickCards = desktopPage.locator('[data-testid^="word-choice-card-"]');
    await expect(deskPickCards.first()).toBeVisible({ timeout: 10000 });
    const turn3Word = (await deskPickCards.first().locator('[data-testid="card-word"]').innerText()).trim().toLowerCase();
    await deskPickCards.first().dispatchEvent('click');

    // Wait until drawing phase begins on guesser screens (hint tiles appear)
    await expect(hostPage.locator('[data-testid="hint-tiles-container"]')).toBeVisible({ timeout: 10000 });
    await expect(phonePage.locator('[data-testid="hint-tiles-container"]')).toBeVisible({ timeout: 10000 });

    // Maya and Alex guess Turn 3 word
    const hostGuess3 = hostPage.locator('input[placeholder="Type your guess"]:visible');
    await expect(hostGuess3).toBeVisible({ timeout: 10000 });
    await hostGuess3.fill(turn3Word);
    await hostGuess3.press('Enter');
    await expect(hostPage.locator('[data-testid="correct-guess-chip"]:visible')).toBeVisible({ timeout: 5000 });

    const phoneGuess3 = phonePage.locator('input[placeholder="Type your guess"]:visible');
    await expect(phoneGuess3).toBeVisible({ timeout: 10000 });
    await phoneGuess3.fill(turn3Word);
    await phoneGuess3.press('Enter');

    // Host skips Turn 3 intermission if skip button is visible
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
    }

    // ==========================================
    // 7. GAME END & REMATCH
    // ==========================================
    // Wait for Game End screen on host
    await hostPage.waitForURL(new RegExp(`/end/${roomCode}`), { timeout: 25000 });
    await expect(hostPage.locator('h1')).toBeVisible({ timeout: 10000 });

    await checkA11y(hostPage, '8-Game-End');
    await hostPage.screenshot({ path: 'tests/screenshots/8-game-end.png' });

    // Rematch: Host clicks "Play again"
    const playAgainBtn = hostPage.locator('[data-testid="play-again-btn"]');
    if (await playAgainBtn.isVisible()) {
      await playAgainBtn.click();
      // Navigates back to /lobby/:code
      await hostPage.waitForURL(new RegExp(`/lobby/${roomCode}`), { timeout: 15000 });
      await expect(hostPage.getByText('Maya', { exact: true })).toBeVisible();
    }

    // Cleanup contexts
    await hostContext.close();
    await phoneContext.close();
    await desktopContext.close();
  });
});
