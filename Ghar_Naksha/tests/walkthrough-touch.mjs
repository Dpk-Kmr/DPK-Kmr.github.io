import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await context.addInitScript(() => localStorage.setItem('ghar-naksha-project-v1', JSON.stringify({ version: 1, name: 'Touch walkthrough', floorPlan: { outline: [[-5, -5], [5, -5], [5, 5], [-5, 5]], wallHeight: 2.7, wallThickness: .15 }, rooms: [], elements: [], connections: [] })));
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Walkthrough', exact: true }).click();
  const hud = page.getByRole('complementary', { name: 'Walkthrough person' }); await expect(hud).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => { const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js'); window.touchWalkStore = [..._roots.values()][0].store; });
  const initial = await hud.evaluate(node => ({ x: Number(node.dataset.walkX), z: Number(node.dataset.walkZ) }));
  const pad = await page.getByRole('button', { name: 'Walk right', exact: true }).boundingBox();
  const canvas = await page.locator('.scene-canvas canvas').boundingBox();
  const cdp = await context.newCDPSession(page);
  const moving = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2, id: 11 };
  const looking = { x: canvas.x + canvas.width * .6, y: canvas.y + canvas.height * .6, id: 12 };
  const before = await page.evaluate(() => window.touchWalkStore.getState().camera.quaternion.toArray());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [moving] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [moving, looking] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [moving, { ...looking, x: looking.x + i * 10 }] }); await page.waitForTimeout(70); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(350);
  const after = await page.evaluate(() => window.touchWalkStore.getState().camera.quaternion.toArray());
  const final = await hud.evaluate(node => ({ x: Number(node.dataset.walkX), z: Number(node.dataset.walkZ) }));
  expect(Math.hypot(...after.map((n, i) => n - before[i]))).toBeGreaterThan(.08);
  expect(Math.hypot(final.x - initial.x, final.z - initial.z)).toBeGreaterThan(.2);
  await page.waitForTimeout(450); const stopped = await hud.evaluate(node => ({ x: Number(node.dataset.walkX), z: Number(node.dataset.walkZ) }));
  expect(stopped).toEqual(final); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mkdir('test-results/walkthrough', { recursive: true }); await page.screenshot({ path: 'test-results/walkthrough/phone-two-finger-walk.png' });
  console.log('PASS phone simultaneous two-finger movement/look, release stop, and no overflow');
} finally { await browser.close(); }
