import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('test-results/group-editing');
await mkdir(output, { recursive: true });
const floorPlan = {
  outline: [
    [-8, -6],
    [8, -6],
    [8, 6],
    [-8, 6],
  ],
  wallHeight: 2.7,
  wallThickness: 0.15,
};
const item = (id, name, position, patch = {}) => ({
  id,
  name,
  kind: 'sofa',
  roomId: '__floor__',
  levelId: 'ground-floor',
  position,
  rotation: 0,
  dimensions: { width: 2, height: 0.8, depth: 1 },
  color: '#d0d8e0',
  material: 'fabric',
  visible: true,
  locked: false,
  ...patch,
});
const fixture = {
  version: 1,
  name: 'Group studio',
  floorPlan,
  activeLevelId: 'ground-floor',
  levels: [
    { id: 'ground-floor', name: 'Ground floor', elevation: 0, floorPlan },
    { id: 'upper-floor', name: 'Upper floor', elevation: 3, floorPlan },
  ],
  rooms: [],
  elements: [
    item('sofa-a', 'Group sofa A', [-3, 0, 0]),
    item('sofa-b', 'Group sofa B', [1, 0, 0]),
    item('chair', 'Independent chair', [4, 0, 3], {
      kind: 'armchair',
      dimensions: { width: 1, height: 0.8, depth: 1 },
    }),
  ],
  connections: [],
};
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const errors = [],
  contexts = [];
let activePage;
const open = async (touch) => {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1050 },
    hasTouch: touch,
  });
  contexts.push(context);
  await context.addInitScript(
    (value) =>
      localStorage.setItem('ghar-naksha-project-v1', JSON.stringify(value)),
    fixture,
  );
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(12000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  await saved(page);
  return page;
};
const saved = (page) =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const model = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('ghar-naksha-project-v1')),
  );
const world = (page, point) =>
  page.locator('svg.plan-canvas').evaluate((node, point) => {
    const result = new DOMPoint(...point).matrixTransform(node.getScreenCTM());
    return { x: result.x, y: result.y };
  }, point);
const center = (locator) =>
  locator.evaluate((node) => {
    const result = new DOMPoint(0, 0).matrixTransform(node.getScreenCTM());
    return { x: result.x, y: result.y };
  });
const drag = async (page, start, end, preview) => {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  if (preview) await preview();
  await page.mouse.up();
  await saved(page);
};
const undo = async (page) => {
  await page.getByRole('button', { name: /^Undo \(/ }).click();
  await saved(page);
};
const selectPair = async (page) => {
  const a = await world(page, [-3, 0]),
    b = await world(page, [1, 0]);
  await page.mouse.click(a.x, a.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up('Shift');
  await expect(page.locator('[data-selection-count="2"]')).toBeVisible();
};
const step = async (name, callback) => {
  await callback();
  console.log(`PASS ${name}`);
};
try {
  const page = await open(false);
  await step(
    'Shift-click selects a group with shared dimensions and handles',
    async () => {
      await selectPair(page);
      await expect(
        page.locator('[data-transform-id="__selection__"]'),
      ).toHaveAttribute('data-preview-width', '6');
      expect(
        await page.locator('.plan-element[aria-pressed="true"]').count(),
      ).toBe(2);
    },
  );
  await step(
    'group movement previews without save and commits as one undo operation',
    async () => {
      const before = await model(page),
        start = await center(page.locator('[data-group-move]'));
      await drag(page, start, { x: start.x + 60, y: start.y + 30 }, async () =>
        expect((await model(page)).elements).toEqual(before.elements),
      );
      const after = await model(page),
        dx = after.elements[0].position[0] - before.elements[0].position[0],
        dz = after.elements[0].position[2] - before.elements[0].position[2];
      expect(Math.abs(dx)).toBeGreaterThan(0.1);
      expect(
        after.elements[1].position[0] - before.elements[1].position[0],
      ).toBeCloseTo(dx, 4);
      expect(
        after.elements[1].position[2] - before.elements[1].position[2],
      ).toBeCloseTo(dz, 4);
      expect(after.elements[2]).toEqual(before.elements[2]);
      await undo(page);
      expect((await model(page)).elements).toEqual(before.elements);
    },
  );
  await step(
    'group edge resize scales proportionally and keeps the opposite edge fixed',
    async () => {
      const before = await model(page),
        start = await center(
          page.locator(
            '[data-transform-owner="__selection__"][data-resize-handle="east"]',
          ),
        );
      await drag(page, start, { x: start.x + 70, y: start.y });
      const after = await model(page);
      const scale =
        after.elements[0].dimensions.width /
        before.elements[0].dimensions.width;
      expect(scale).toBeGreaterThan(1);
      expect(
        after.elements[1].dimensions.width /
          before.elements[1].dimensions.width,
      ).toBeCloseTo(scale, 4);
      expect(after.elements[0].dimensions.depth).toBeCloseTo(
        before.elements[0].dimensions.depth * scale,
        4,
      );
      expect(
        after.elements[0].position[0] - after.elements[0].dimensions.width / 2,
      ).toBeCloseTo(-4, 4);
      await undo(page);
      expect((await model(page)).elements).toEqual(before.elements);
    },
  );
  await step(
    'group rotation changes every orientation around the common center',
    async () => {
      const before = await model(page),
        start = await center(
          page.locator('[data-rotation-handle="__selection__"]'),
        ),
        origin = await world(page, [-1, 0]);
      const radius = origin.y - start.y;
      await drag(page, start, { x: origin.x + radius, y: origin.y });
      const after = await model(page);
      expect(after.elements[0].rotation).toBe(270);
      expect(after.elements[1].rotation).toBe(270);
      expect(after.elements[0].dimensions).toEqual(
        before.elements[0].dimensions,
      );
      await undo(page);
      expect((await model(page)).elements).toEqual(before.elements);
    },
  );
  await step(
    'copy/paste duplicates a complete group and one undo removes the entire paste',
    async () => {
      const before = await model(page);
      await page.keyboard.press('ControlOrMeta+c');
      await page.keyboard.press('ControlOrMeta+v');
      await saved(page);
      await expect
        .poll(async () => (await model(page)).elements.length)
        .toBe(5);
      const after = await model(page),
        clones = after.elements.slice(-2);
      expect(new Set(after.elements.map((item) => item.id)).size).toBe(5);
      expect(clones[1].position[0] - clones[0].position[0]).toBe(4);
      expect(clones[0].levelId).toBe('ground-floor');
      await expect(page.locator('[data-selection-count="2"]')).toBeVisible();
      await undo(page);
      expect((await model(page)).elements).toEqual(before.elements);
    },
  );
  await step(
    'cut and duplicate apply to the entire selection with one-step undo',
    async () => {
      await selectPair(page);
      const before = await model(page);
      await page
        .getByRole('button', { name: 'Cut selection', exact: true })
        .click();
      await expect
        .poll(async () => (await model(page)).elements.length)
        .toBe(1);
      await saved(page);
      await undo(page);
      expect((await model(page)).elements).toEqual(before.elements);
      await selectPair(page);
      await page
        .getByRole('button', { name: 'Duplicate selection', exact: true })
        .click();
      await expect
        .poll(async () => (await model(page)).elements.length)
        .toBe(5);
      await saved(page);
      await undo(page);
      expect((await model(page)).elements).toEqual(before.elements);
    },
  );
  await step(
    'group clipboard pastes into another storey and leaves the source intact',
    async () => {
      await selectPair(page);
      const before = await model(page);
      await page.keyboard.press('ControlOrMeta+c');
      await page
        .getByRole('combobox', { name: 'Active floor', exact: true })
        .selectOption('upper-floor');
      await page
        .getByRole('button', { name: 'Paste selection', exact: true })
        .click();
      await expect
        .poll(async () => (await model(page)).elements.length)
        .toBe(5);
      await saved(page);
      const after = await model(page);
      expect(after.activeLevelId).toBe('upper-floor');
      expect(
        after.elements.filter((element) => element.levelId === 'ground-floor'),
      ).toEqual(before.elements);
      expect(
        after.elements.filter((element) => element.levelId === 'upper-floor'),
      ).toHaveLength(2);
      await undo(page);
      expect((await model(page)).elements).toEqual(before.elements);
      await page
        .getByRole('combobox', { name: 'Active floor', exact: true })
        .selectOption('ground-floor');
    },
  );
  await step(
    'clipboard shortcuts never copy, cut, or duplicate elements while an edit field is focused',
    async () => {
      const before = await model(page);
      const sofa = await world(page, [-3, 0]);
      await page.mouse.click(sofa.x, sofa.y);
      const name = page.getByRole('textbox', {
        name: 'Element name',
        exact: true,
      });
      await name.focus();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('ControlOrMeta+c');
      await page.keyboard.press('ControlOrMeta+v');
      await page.keyboard.press('ControlOrMeta+d');
      expect((await model(page)).elements).toEqual(before.elements);
      await page.keyboard.press('Escape');
      await name.blur();
    },
  );
  await step(
    'Shift-drag rectangle selects enclosed elements without changing geometry',
    async () => {
      const before = await model(page),
        start = await world(page, [-5.5, -2]),
        end = await world(page, [2.8, 2]);
      await page.keyboard.down('Shift');
      await drag(page, start, end);
      await page.keyboard.up('Shift');
      await expect(page.locator('[data-selection-count="2"]')).toBeVisible();
      expect((await model(page)).elements).toEqual(before.elements);
    },
  );
  await step('Escape cancels an in-progress group transform', async () => {
    const before = await model(page),
      start = await center(page.locator('[data-group-move]'));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y + 40, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect((await model(page)).elements).toEqual(before.elements);
  });
  await page.screenshot({ path: path.join(output, 'group-controls.png') });
  const touchPage = await open(true);
  await touchPage
    .getByRole('button', { name: 'Select multiple elements', exact: true })
    .tap();
  const tapA = await world(touchPage, [-3, 0]),
    tapB = await world(touchPage, [1, 0]);
  await touchPage.touchscreen.tap(tapA.x, tapA.y);
  await touchPage.touchscreen.tap(tapB.x, tapB.y);
  await expect(touchPage.locator('[data-selection-count="2"]')).toBeVisible();
  console.log('PASS finger taps select multiple elements without a keyboard');
  const cdp = await touchPage.context().newCDPSession(touchPage);
  const touch = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, index) => ({
        x: point.x,
        y: point.y,
        id: index + 1,
        radiusX: 4,
        radiusY: 4,
        force: 1,
      })),
    });
  await step(
    'real finger movement and scaling commit the selected group together',
    async () => {
      const before = await model(touchPage),
        start = await center(touchPage.locator('[data-group-move]'));
      await touch('touchStart', [start]);
      for (let i = 1; i <= 8; i++)
        await touch('touchMove', [
          { x: start.x + (60 * i) / 8, y: start.y + (32 * i) / 8 },
        ]);
      await touch('touchEnd', []);
      await saved(touchPage);
      const after = await model(touchPage);
      expect(after.elements[0].position).not.toEqual(
        before.elements[0].position,
      );
      expect(
        after.elements[1].position[0] - after.elements[0].position[0],
      ).toBe(4);
      await undo(touchPage);
      expect((await model(touchPage)).elements).toEqual(before.elements);
      const resize = await center(
        touchPage.locator(
          '[data-transform-owner="__selection__"][data-resize-handle="southeast"]',
        ),
      );
      await touch('touchStart', [resize]);
      for (let i = 1; i <= 8; i++)
        await touch('touchMove', [
          { x: resize.x + (50 * i) / 8, y: resize.y + (20 * i) / 8 },
        ]);
      await touch('touchEnd', []);
      await saved(touchPage);
      expect(
        (await model(touchPage)).elements[0].dimensions.width,
      ).toBeGreaterThan(2);
      await undo(touchPage);
      expect((await model(touchPage)).elements).toEqual(before.elements);
    },
  );
  await touchPage.screenshot({
    path: path.join(output, 'finger-group-controls.png'),
  });
  expect(errors).toEqual([]);
  console.log('PASS no browser errors');
} catch (error) {
  await activePage
    ?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(output, 'errors.json'),
    JSON.stringify(errors, null, 2),
  );
  console.error(error);
  if (errors.length) console.error(errors);
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
