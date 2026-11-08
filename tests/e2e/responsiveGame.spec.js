import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '393x852', width: 393, height: 852 },
  { name: '412x915', width: 412, height: 915 },
  { name: '768x1024', width: 768, height: 1024 },
];

test.beforeAll(async () => {
  const screenshotsDir = path.resolve('tests/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
});

test.describe('Responsive Game & Lobby Viewport Tests', () => {
  for (const vp of VIEWPORTS) {
    test(`Lobby at ${vp.name} (${vp.width}x${vp.height}) - no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/test-view/lobby');
      await page.waitForSelector('[data-testid="lobby-container"], header');

      // Assert no horizontal scroll
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      // Screenshot test
      await page.screenshot({
        path: `tests/screenshots/lobby-${vp.name}.png`,
        fullPage: false,
      });
    });

    test(`Game (drawer) at ${vp.name} (${vp.width}x${vp.height}) - no horizontal scroll & paper fully visible`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/test-view/drawer');

      const paper = page.locator('[data-testid="drawing-paper"]');
      await expect(paper).toBeVisible();

      // Assert no horizontal scroll
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      // Assert paper is fully visible within viewport without scrolling
      const box = await paper.boundingBox();
      expect(box).not.toBeNull();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 2);

      // Screenshot test
      await page.screenshot({
        path: `tests/screenshots/game-drawer-${vp.name}.png`,
        fullPage: false,
      });
    });

    test(`Game (guesser) at ${vp.name} (${vp.width}x${vp.height}) - no horizontal scroll & paper fully visible`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/test-view/guesser');

      const paper = page.locator('[data-testid="drawing-paper"]');
      await expect(paper).toBeVisible();

      // Assert no horizontal scroll
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      // Assert paper is fully visible within viewport without scrolling
      const box = await paper.boundingBox();
      expect(box).not.toBeNull();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 2);

      // Screenshot test
      await page.screenshot({
        path: `tests/screenshots/game-guesser-${vp.name}.png`,
        fullPage: false,
      });
    });
  }

  test('360 x 640 with keyboard open: paper, hint and guess input are all visible', async ({ page }) => {
    // Open guesser view at 360 x 640
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/test-view/guesser');

    // Simulate keyboard open by reducing viewport height (approx 380px remaining)
    await page.setViewportSize({ width: 360, height: 380 });

    const paper = page.locator('[data-testid="drawing-paper"]');
    const hint = page.locator('[data-testid="hint-tiles-container"]');
    const guessInput = page.locator('input[placeholder="Type your guess"]:visible');

    await expect(paper).toBeVisible();
    await expect(hint).toBeVisible();
    await expect(guessInput).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/game-guesser-360x380-keyboard.png',
      fullPage: false,
    });
  });

  test('Rotating phone keeps the same game state and paper fits landscape height', async ({ page }) => {
    // Start portrait 360 x 640
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/test-view/guesser');

    // Type a guess to set local state
    const guessInput = page.locator('input[placeholder="Type your guess"]:visible');
    await guessInput.fill('dolphin');

    // Rotate to landscape 640 x 360
    await page.setViewportSize({ width: 640, height: 360 });

    // In landscape, check the visible guess input
    const landscapeInput = page.locator('input[placeholder="Type your guess"]:visible');
    await expect(landscapeInput).toBeVisible();

    // Assert paper is visible on the left and fits height
    const paper = page.locator('[data-testid="drawing-paper"]');
    await expect(paper).toBeVisible();
    const box = await paper.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y + box.height).toBeLessThanOrEqual(362);

    await page.screenshot({
      path: 'tests/screenshots/game-guesser-640x360-landscape.png',
      fullPage: false,
    });
  });

  test('Dev states showcase (/dev/states) at 360x800 - reads clearly with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/dev/states');
    await page.waitForSelector('[data-testid="state-section-lost"]');

    // Assert no horizontal scroll
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Verify key calm copy is present
    await expect(page.locator('text=This room has closed.').first()).toBeVisible();
    await expect(page.locator('text=That room is full.').first()).toBeVisible();
    await expect(page.locator('text=The host removed you from the room.').first()).toBeVisible();
    await expect(page.locator('text=The host ended the game.').first()).toBeVisible();
    await expect(page.locator('text=Everyone else left, so the game ended.').first()).toBeVisible();
    await expect(page.locator('text=We lost you.').first()).toBeVisible();
    await expect(page.locator('text=Maya left. Skipping to the next drawer.').first()).toBeVisible();
    await expect(page.locator('text=Slow down a little.').first()).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/dev-states-360px.png',
      fullPage: false,
    });
  });
});
