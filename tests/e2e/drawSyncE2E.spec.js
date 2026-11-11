import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 1280, height: 800 };

async function createRoomWithGuest(browser, hostName = 'Drawer', guestName = 'WarmGuesser') {
  const hostContext = await browser.newContext({ viewport: VIEWPORT });
  const host = await hostContext.newPage();
  await host.goto('/');
  await host.waitForFunction(() => window.__scribble_socket?.connected);
  await host.fill('#player-nickname', hostName);
  await host.click('button:has-text("Start a room")');
  await host.waitForURL(/\/lobby\//);
  const roomCode = host.url().split('/lobby/')[1];

  const guestContext = await browser.newContext({ viewport: VIEWPORT });
  const guest = await guestContext.newPage();
  await guest.goto(`/join/${roomCode}`);
  await guest.waitForSelector('#join-nickname');
  await guest.fill('#join-nickname', guestName);
  await guest.click('button:has-text("Join")');
  await guest.waitForURL(new RegExp(`/lobby/${roomCode}`));

  return { host, guest, roomCode, contexts: [hostContext, guestContext] };
}

async function startTurnAsDrawer(host, guest) {
  await host.click('button:has-text("Start Game")');
  await host.waitForURL(/\/game\//, { timeout: 20000 });
  await guest.waitForURL(/\/game\//, { timeout: 20000 });
  await host.waitForSelector('button[data-testid="word-choice-card-0"]', { timeout: 20000 });
  await host.click('button[data-testid="word-choice-card-0"]');
  await host.waitForSelector('[data-testid="drawer-word-chip"]', { timeout: 20000 });
  await host.waitForTimeout(800);
}

async function drawStroke(page, offset = 0) {
  const box = await page.locator('[data-testid="canvas-element"]').boundingBox();
  const y = 0.25 + offset;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * y);
  await page.mouse.down();
  for (let i = 1; i <= 25; i++) {
    await page.mouse.move(box.x + box.width * (0.2 + 0.4 * (i / 25)), box.y + box.height * y);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
}

function countNonWhite(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="canvas-element"]');
    if (!canvas) return -1;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhite = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) nonWhite += 1;
    }
    return nonWhite;
  });
}

test.describe('Drawing sync on reload and late join', () => {
  test('reload mid-turn replays existing strokes and keeps live drawing in sync', async ({ browser }) => {
    test.setTimeout(90000);
    const { host, guest, contexts } = await createRoomWithGuest(browser);
    await startTurnAsDrawer(host, guest);

    await drawStroke(host, 0);
    await drawStroke(host, 0.3);
    await guest.waitForTimeout(800);
    const hostPixels = await countNonWhite(host);
    expect(hostPixels).toBeGreaterThan(1000);
    expect(await countNonWhite(guest)).toBe(hostPixels);

    await guest.reload();
    await guest.locator('[data-testid="canvas-element"]').waitFor({ state: 'visible', timeout: 20000 });
    await guest.waitForTimeout(1500);
    expect(await countNonWhite(guest)).toBe(hostPixels);

    await drawStroke(host, 0.6);
    await guest.waitForTimeout(800);
    const afterStroke = await countNonWhite(host);
    expect(afterStroke).toBeGreaterThan(hostPixels);
    expect(await countNonWhite(guest)).toBe(afterStroke);

    await Promise.all(contexts.map((context) => context.close()));
  });

  test('late joiner receives strokes already drawn this turn', async ({ browser }) => {
    test.setTimeout(90000);
    const { host, guest, roomCode, contexts } = await createRoomWithGuest(browser);
    await startTurnAsDrawer(host, guest);

    await drawStroke(host, 0);
    await drawStroke(host, 0.3);
    await host.waitForTimeout(800);
    const hostPixels = await countNonWhite(host);
    expect(hostPixels).toBeGreaterThan(1000);

    const lateContext = await browser.newContext({ viewport: VIEWPORT });
    const late = await lateContext.newPage();
    await late.goto(`/join/${roomCode}`);
    await late.waitForSelector('#join-nickname', { timeout: 15000 });
    await late.fill('#join-nickname', 'LateGuesser');
    await late.click('button:has-text("Join")');
    await late.waitForURL(new RegExp(`/game/${roomCode}`), { timeout: 20000 });
    await late.locator('[data-testid="canvas-element"]').waitFor({ state: 'visible', timeout: 20000 });
    await late.waitForTimeout(2000);

    expect(await countNonWhite(late)).toBe(hostPixels);
    expect(await late.textContent('body')).not.toContain('Welcome back');

    await Promise.all([...contexts, lateContext].map((context) => context.close()));
  });
});
