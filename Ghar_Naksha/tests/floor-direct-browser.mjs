import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const output = 'test-results/floor-direct';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.setDefaultTimeout(12000);
const input = (label) =>
  page.getByRole('spinbutton', { name: label, exact: true });
const value = async (label) => Number(await input(label).inputValue());
const point = async (locator) => {
  const box = await locator.boundingBox();
  if (!box) throw Error('Missing handle');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const handle = (name) => page.getByRole('button', { name, exact: true });
const move = async (name, dx, dy, cancel = false) => {
  const start = await point(handle(name));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
};
const step = async (name, task) => {
  await task();
  console.log(`PASS ${name}`);
};
const project = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('ghar-naksha-project-v1')),
  );
const saved = () =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173');
  await handle('Create new project').click();
  await step(
    'floor corner and edge dragging updates lengths and keeps rectangle constraints',
    async () => {
      const beforeWidth = await value('Side A–B'),
        beforeDepth = await value('Side B–C');
      await move('Drag corner C', 35, 18);
      expect(await value('Side A–B')).toBeGreaterThan(beforeWidth);
      expect(await value('Side B–C')).toBeGreaterThan(beforeDepth);
      expect(await value('Side A–B')).toBe(await value('Side C–D'));
      expect(await value('Side B–C')).toBe(await value('Side D–A'));
      const depth = await value('Side B–C');
      await move('Drag side A–B', 0, -20);
      expect(await value('Side B–C')).toBeGreaterThan(depth);
    },
  );
  await step(
    'Escape cancels floor gestures without closing the project form',
    async () => {
      const width = await value('Side A–B'),
        depth = await value('Side B–C');
      await move('Drag corner C', 25, 25, true);
      expect(await value('Side A–B')).toBe(width);
      expect(await value('Side B–C')).toBe(depth);
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  );
  await step(
    'native touch drag and touch cancellation use the same floor controls',
    async () => {
      const cdp = await context.newCDPSession(page);
      const start = await point(handle('Drag corner B'));
      const before = await value('Side A–B');
      const touch = async (type, x, y) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints:
            type === 'touchEnd' || type === 'touchCancel'
              ? []
              : [{ x, y, id: 4, radiusX: 7, radiusY: 7, force: 1 }],
        });
      await touch('touchStart', start.x, start.y);
      for (let i = 1; i <= 6; i++)
        await touch('touchMove', start.x + 4 * i, start.y - 2 * i);
      await touch('touchEnd');
      expect(await value('Side A–B')).toBeGreaterThan(before);
      const current = await value('Side A–B');
      const next = await point(handle('Drag corner B'));
      await touch('touchStart', next.x, next.y);
      await touch('touchMove', next.x + 20, next.y);
      await touch('touchCancel');
      expect(await value('Side A–B')).toBe(current);
      await cdp.detach();
    },
  );
  await step(
    'last focused decimal field commits on create and unit preference survives reload',
    async () => {
      await page.getByLabel('New project units').selectOption('ft');
      await input('Side A–B').fill('29.017');
      expect(
        await page
          .locator('form.floor-new-form')
          .evaluate((el) => el.checkValidity()),
      ).toBe(true);
      await handle('Create floor plan').click();
      await saved();
      const floor = (await project()).floorPlan;
      expect((floor.outline[1][0] - floor.outline[0][0]) * 3.28084).toBeCloseTo(
        29.017,
        6,
      );
      await page.reload();
      await saved();
      await expect(
        page.getByRole('button', { name: 'Units: Feet' }),
      ).toBeVisible();
    },
  );
  await step(
    'phone and tablet palettes, numeric controls, and drawing tools remain reachable',
    async () => {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
      ]) {
        await page.setViewportSize(viewport);
        await handle('Open element library').click();
        await page
          .getByRole('textbox', { name: 'Search element library' })
          .fill('Linen sofa');
        await page.getByTitle('Add Linen sofa', { exact: true }).click();
        if (viewport.width <= 900) await handle('Open properties').click();
        await expect(input('Width')).toBeVisible();
        await input('Width').fill('6.137');
        await input('Width').press('Enter');
        await saved();
        expect(await value('Width')).toBeCloseTo(6.137, 3);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(viewport.width);
        if (viewport.width <= 900) await handle('Close properties').click();
        await expect(handle('Resize element (R)')).toBeVisible();
        await page.screenshot({
          path: `${output}/editor-${viewport.width}.png`,
        });
      }
    },
  );
  expect(errors).toEqual([]);
  console.log(
    'Floor pointer/touch and responsive checks passed without browser errors.',
  );
} catch (error) {
  console.error(error);
  await page.screenshot({ path: `${output}/failure.png` });
  process.exitCode = 1;
} finally {
  await browser.close();
}
