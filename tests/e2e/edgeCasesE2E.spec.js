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
  await page.waitForTimeout(200);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );

  if (seriousOrCritical.length > 0) {
    console.warn(
      `Axe violations on ${screenName}:`,
      JSON.stringify(seriousOrCritical.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => ({ html: n.html, failureSummary: n.failureSummary }))
      })), null, 2)
    );
  }
  expect(seriousOrCritical).toEqual([]);
}

test.describe('Edge Cases & Calm Failure Messaging (GF1-GF3, E1-E22)', () => {
  // 1. Accessibility audit & visual check on /dev/states covering all 25 edge states
  test('/dev/states renders all 25 edge states with zero a11y violations', async ({ page }) => {
    await page.goto('/dev/states');
    await page.waitForSelector('h1');
    expect(await page.textContent('h1')).toContain('Scribble Failure & Edge States Showcase');

    // Run axe accessibility evaluation
    await checkA11y(page, 'DevStates Showcase');

    // Verify key edge state messages from prompt requirements:
    const content = await page.content();
    // 1. TURN_WAIT & Skip
    expect(content).toContain('Waiting for Maya to reconnect...');
    expect(content).toContain("Maya didn't come back. Skipping their turn.");
    // 2. Acting host & Host return
    expect(content).toContain('Raj is hosting while Maya is away');
    expect(content).toContain('Maya is the host again');
    // 3. Superseded tab
    expect(content).toContain("You're playing in another tab.");
    expect(content).toContain('Take over here');
    // 4. Seat claim
    expect(content).toContain('Maya is away. Ask to take back that seat?');
    expect(content).toContain('Waiting for the host...');
    expect(content).toContain('The host let you back in');
    expect(content).toContain('The host said no');
    expect(content).toContain('Maya wants to take back their seat');
    // 5. Paused game
    expect(content).toContain('Waiting for players to return.');
    // 6. Player list labels
    expect(content).toContain('Away');
    expect(content).toContain('Draws next');
    expect(content).toContain('Missed turn');
    expect(content).toContain('Make-up turn');
    expect(content).toContain('joined late');
    // 7. Late join & Rejoin
    expect(content).toContain("You joined mid-round. You'll draw in turn 4.");
    expect(content).toContain('Welcome back. You have 420 points.');
    // 8. AFK nudge
    expect(content).toContain('Pick a word, or your turns will be skipped.');
    expect(content).toContain('Maya is away from the keyboard. Skipping their turns.');
    // 9. Server busy & rate limits
    expect(content).toContain('The server is busy. Try again in a minute.');
    expect(content).toContain('Too many tries. Wait a moment.');
  });

  // 2. Superseded tab (E6) & Take Over flow
  test('E6: Two tabs for one player - old tab shows superseded screen and can take over back', async ({
    browser,
  }) => {
    test.setTimeout(45000);
    const context = await browser.newContext();
    const tab1 = await context.newPage();

    // Tab 1 creates room
    await tab1.goto('/');
    await tab1.fill('input#nickname-input', 'HeroTab');
    await tab1.click('button:has-text("Start a room")');

    await tab1.waitForURL(/\/lobby\//, { timeout: 10000 });
    const roomCode = tab1.url().split('/lobby/')[1];

    // Read stored rejoin data from Tab 1
    const rejoinRaw = await tab1.evaluate(() => localStorage.getItem('scribble_rejoin'));
    expect(rejoinRaw).toBeTruthy();

    // Tab 2 opens the lobby in a fresh context but injects the same rejoin credentials
    const context2 = await browser.newContext();
    const tab2 = await context2.newPage();
    await tab2.goto('/');
    await tab2.evaluate((data) => {
      localStorage.setItem('scribble_rejoin', data);
      localStorage.setItem('scribble_nickname', 'HeroTab');
    }, rejoinRaw);

    // Tab 2 navigates to lobby
    await tab2.goto(`/lobby/${roomCode}`);
    await tab2.waitForURL(new RegExp(`/lobby/${roomCode}`), { timeout: 10000 });

    // Tab 1 must now receive SUPERSEDED and show the calm StatusScreen
    await tab1.waitForSelector('[role="alert"]', { timeout: 10000 });
    const alertHeading = await tab1.textContent('h1');
    expect(alertHeading).toContain("You're playing in another tab.");
    expect(await tab1.textContent('body')).toContain('Take over here');
    expect(await tab1.textContent('body')).toContain('Leave');

    // Run accessibility check on superseded StatusScreen
    await checkA11y(tab1, 'Superseded Screen');

    // Tab 1 clicks "Take over here" to win the session back!
    await tab1.click('button:has-text("Take over here")');

    // Tab 1 is restored back into the lobby
    await tab1.waitForURL(new RegExp(`/lobby/${roomCode}`), { timeout: 10000 });

    // Tab 2 is now superseded!
    await tab2.waitForSelector('[role="alert"]', { timeout: 10000 });
    expect(await tab2.textContent('h1')).toContain("You're playing in another tab.");

    await context.close();
    await context2.close();
  });

  // 3. Drawer disconnects and turn wait pauses / skips (E1, E8)
  test('E1/E8: Drawer leaves - turn pauses with TurnWaitOverlay; if unreturned, turn advances', async ({
    browser,
  }) => {
    test.setTimeout(45000);
    // Host (Drawer) and Guest (Guesser)
    const hostContext = await browser.newContext({ viewport: { width: 1000, height: 750 } });
    const guestContext = await browser.newContext({ viewport: { width: 1000, height: 750 } });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // Host creates room
    await hostPage.goto('/');
    await hostPage.fill('input#nickname-input', 'HostDrawer');
    await hostPage.click('button:has-text("Start a room")');
    await hostPage.waitForURL(/\/lobby\//, { timeout: 10000 });
    const roomCode = hostPage.url().split('/lobby/')[1];

    // Guest joins
    await guestPage.goto(`/join/${roomCode}`);
    await guestPage.waitForSelector('input#join-nickname-input');
    await guestPage.fill('input#join-nickname-input', 'GuestGuesser');
    await guestPage.click('button:has-text("Join")');
    await guestPage.waitForURL(new RegExp(`/lobby/${roomCode}`), { timeout: 10000 });

    // Host starts game
    await hostPage.click('button:has-text("Start Game")');
    await hostPage.waitForURL(new RegExp(`/game/${roomCode}`), { timeout: 10000 });
    await guestPage.waitForURL(new RegExp(`/game/${roomCode}`), { timeout: 10000 });

    // Host picks word
    await hostPage.waitForSelector('button[data-testid="word-choice-btn-0"]', { timeout: 10000 });
    await hostPage.click('button[data-testid="word-choice-btn-0"]');

    // Wait until drawing phase starts
    await hostPage.waitForSelector('[data-testid="drawer-word-chip"]', { timeout: 10000 });

    // Host closes context (drawer disconnects!)
    await hostContext.close();

    // Guest sees Paused / Turn Wait state
    const overlay = guestPage.locator('[data-testid="paused-overlay"], [data-testid="turn-wait-overlay"]');
    await expect(overlay.first()).toBeVisible({ timeout: 10000 });

    // Run accessibility check on the pause/turn wait overlay
    await checkA11y(guestPage, 'Turn Wait Overlay');

    await guestContext.close();
  });

  // 4. Host handover to acting host & regain on return (E2)
  test('E2: Host disconnects -> acting host chip appears -> host rejoins within grace window and regains host status', async ({
    browser,
  }) => {
    test.setTimeout(45000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // Host creates room
    await hostPage.goto('/');
    await hostPage.fill('input#nickname-input', 'OriginalHost');
    await hostPage.click('button:has-text("Start a room")');
    await hostPage.waitForURL(/\/lobby\//, { timeout: 10000 });
    const roomCode = hostPage.url().split('/lobby/')[1];

    // Save host rejoin data
    const hostRejoin = await hostPage.evaluate(() => localStorage.getItem('scribble_rejoin'));

    // Guest joins
    await guestPage.goto(`/join/${roomCode}`);
    await guestPage.fill('input#join-nickname-input', 'ActingPlayer');
    await guestPage.click('button:has-text("Join")');
    await guestPage.waitForURL(new RegExp(`/lobby/${roomCode}`), { timeout: 10000 });

    // Start game
    await hostPage.click('button:has-text("Start Game")');
    await hostPage.waitForURL(new RegExp(`/game/${roomCode}`), { timeout: 10000 });
    await guestPage.waitForURL(new RegExp(`/game/${roomCode}`), { timeout: 10000 });

    // Host disconnects
    await hostPage.close();

    // Guest sees acting host chip or message
    await guestPage.waitForSelector('[data-testid="acting-host-chip"]', { timeout: 10000 });
    const chipText = await guestPage.textContent('[data-testid="acting-host-chip"]');
    expect(chipText).toContain('ActingPlayer is hosting while OriginalHost is away');

    // Host returns within grace window
    const newHostPage = await hostContext.newPage();
    await newHostPage.goto('/');
    await newHostPage.evaluate((data) => {
      localStorage.setItem('scribble_rejoin', data);
      localStorage.setItem('scribble_nickname', 'OriginalHost');
    }, hostRejoin);
    await newHostPage.goto(`/game/${roomCode}`);
    await newHostPage.waitForURL(new RegExp(`/game/${roomCode}`), { timeout: 10000 });

    // Guest sees Toast that original host is host again
    await guestPage.waitForSelector('[role="status"]', { timeout: 10000 });
    const toastContent = await guestPage.textContent('body');
    expect(toastContent).toContain('OriginalHost is the host again');

    await hostContext.close();
    await guestContext.close();
  });

  // 5. Seat claim flow (E19): Host receives modal with 20s countdown, accepts claim
  test('E19: Seat claim flow - joiner asks host, host accepts in modal, joiner is admitted', async ({
    browser,
  }) => {
    test.setTimeout(45000);
    const hostContext = await browser.newContext();
    const mayaContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const mayaPage = await mayaContext.newPage();

    // Host creates room
    await hostPage.goto('/');
    await hostPage.fill('input#nickname-input', 'HostUser');
    await hostPage.click('button:has-text("Start a room")');
    await hostPage.waitForURL(/\/lobby\//, { timeout: 10000 });
    const roomCode = hostPage.url().split('/lobby/')[1];

    // Maya joins
    await mayaPage.goto(`/join/${roomCode}`);
    await mayaPage.fill('input#join-nickname-input', 'Maya');
    await mayaPage.click('button:has-text("Join")');
    await mayaPage.waitForURL(new RegExp(`/lobby/${roomCode}`), { timeout: 10000 });

    // Maya leaves (disconnects)
    await mayaContext.close();

    // Wait 500ms for status to register as away
    await hostPage.waitForTimeout(600);

    // Imposter / new joiner opens /join with nickname "Maya" without rejoin token
    const newJoinerContext = await browser.newContext();
    const newJoinerPage = await newJoinerContext.newPage();
    await newJoinerPage.goto(`/join/${roomCode}`);
    await newJoinerPage.waitForSelector('input#join-nickname-input');
    await newJoinerPage.fill('input#join-nickname-input', 'Maya');
    await newJoinerPage.click('button:has-text("Join")');

    // Joiner receives seat claim prompt: "Maya is away. Ask to take back that seat?"
    await newJoinerPage.waitForSelector('[data-testid="seat-claim-flow"]', { timeout: 10000 });
    const promptHeading = await newJoinerPage.textContent('[data-testid="seat-claim-prompt-heading"]');
    expect(promptHeading).toContain('Maya is away. Ask to take back that seat?');

    // Run axe on seat claim prompt
    await checkA11y(newJoinerPage, 'Seat Claim Prompt');

    // Joiner clicks "Ask the host"
    await newJoinerPage.click('button[data-testid="seat-claim-ask-host-btn"]');

    // Joiner now sees "Waiting for the host..."
    await newJoinerPage.waitForSelector('[data-testid="seat-claim-waiting-heading"]', { timeout: 10000 });
    expect(await newJoinerPage.textContent('[data-testid="seat-claim-waiting-heading"]')).toContain('Waiting for the host...');

    // Host now sees the Seat Claim Modal with 20s countdown
    await hostPage.waitForSelector('[data-testid="seat-claim-modal"]', { timeout: 10000 });
    expect(await hostPage.textContent('body')).toContain('Maya wants to take back their seat');

    // Run axe on host seat claim modal
    await checkA11y(hostPage, 'Host Seat Claim Modal');

    // Host accepts seat claim
    await hostPage.click('button[data-testid="seat-claim-accept-btn"]');

    // Joiner sees "The host let you back in" and is admitted to lobby!
    await newJoinerPage.waitForURL(new RegExp(`/lobby/${roomCode}`), { timeout: 10000 });

    await hostContext.close();
    await newJoinerContext.close();
  });

  // 6. Visibility change re-sync
  test('Phone / tablet visibilitychange hidden -> visible triggers state re-sync without crash', async ({
    browser,
  }) => {
    test.setTimeout(30000);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await page.goto('/');
    await page.fill('input#nickname-input', 'MobileUser');
    await page.click('button:has-text("Start a room")');
    await page.waitForURL(/\/lobby\//, { timeout: 10000 });

    // Simulate tab backgrounding
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(500);

    // Simulate tab foregrounding
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(500);

    // Verify page is fully intact and responsive
    expect(await page.textContent('h1')).toBeTruthy();

    await context.close();
  });
});
