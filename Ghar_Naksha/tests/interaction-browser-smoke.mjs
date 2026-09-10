import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('test-results/direct-manipulation');
await mkdir(output, { recursive: true });
const fixture = {
  version: 1, name: 'Gesture studio',
  floorPlan: { outline: [[-8, -6], [8, -6], [8, 6], [-8, 6]], wallHeight: 2.7, wallThickness: .15 },
  rooms: [{ id: 'living', name: 'Living room', subtitle: '', center: [-3, 0], width: 4, depth: 5, color: '#e5dccb' }],
  elements: [
    { id: 'living-sofa', kind: 'sofa', name: 'Gesture sofa', roomId: 'living', position: [-3, 0, 0], rotation: 0, dimensions: { width: 2.6, height: .84, depth: .95 }, color: '#e4dfd1', material: 'fabric', visible: true, locked: false },
    { id: 'test-wall', kind: 'wall', name: 'Opening wall', roomId: '__floor__', position: [3, 0, -1], rotation: 0, dimensions: { width: 4, height: 2.7, depth: .15 }, color: '#eeeeee', material: 'plaster', visible: true, locked: false },
    { id: 'test-door', kind: 'door', name: 'Attached door', roomId: '__floor__', position: [3, 0, -1], rotation: 0, dimensions: { width: 1.2, height: 2.1, depth: .15 }, color: '#b69970', material: 'wood', visible: true, locked: false, wallAttachment: { wallId: 'test-wall', offset: 0 } },
  ], connections: [],
};
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const contexts = [];
const errors = [];
let activePage;
const openPage = async (touch = false) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: touch });
  contexts.push(context);
  await context.addInitScript(value => localStorage.setItem('ghar-naksha-project-v1', JSON.stringify(value)), fixture);
  const page = await context.newPage(); activePage = page;
  page.setDefaultTimeout(10_000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  await saved(page);
  return page;
};
const saved = page => expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const model = page => page.evaluate(() => JSON.parse(localStorage.getItem('ghar-naksha-project-v1')));
const element = async (page, id = 'living-sofa') => (await model(page)).elements.find(element => element.id === id);
const handle = (page, direction, id = 'living-sofa') => page.locator(`[data-transform-owner="${id}"][data-resize-handle="${direction}"]`);
const center = locator => locator.evaluate(node => { const point = new DOMPoint(0, 0).matrixTransform(node.getScreenCTM()); return { x: point.x, y: point.y }; });
const worldPoint = (page, point) => page.locator('svg.plan-canvas').evaluate((node, point) => { const result = new DOMPoint(...point).matrixTransform(node.getScreenCTM()); return { x: result.x, y: result.y }; }, point);
const mouseDrag = async (page, from, to, beforeRelease) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 12 }); if (beforeRelease) await beforeRelease(); await page.mouse.up(); await saved(page); };
const undo = async page => { await page.getByRole('button', { name: /^Undo \(/ }).click(); await saved(page); };
const step = async (name, task) => { await task(); console.log(`PASS ${name}`); };

try {
  const page = await openPage();
  await step('mouse edge resize previews locally and commits one undoable edit', async () => {
    const initial = await element(page);
    const start = await center(handle(page, 'east'));
    await mouseDrag(page, start, { x: start.x + 65, y: start.y }, async () => {
      const preview = Number(await page.locator('[data-transform-id="living-sofa"]').getAttribute('data-preview-width'));
      expect(preview).toBeGreaterThan(initial.dimensions.width);
      expect((await element(page)).dimensions.width).toBe(initial.dimensions.width);
    });
    const edited = await element(page);
    expect(edited.dimensions.width).toBeGreaterThan(initial.dimensions.width);
    expect(edited.position[0] - edited.dimensions.width / 2).toBeCloseTo(initial.position[0] - initial.dimensions.width / 2, 3);
    await undo(page);
    expect(await element(page)).toEqual(initial);
  });

  await step('mouse rotation handle changes orientation while preserving dimensions', async () => {
    const initial = await element(page), start = await center(page.locator('[data-rotation-handle="living-sofa"]'));
    const origin = await worldPoint(page, [initial.position[0], initial.position[2]]);
    const radius = origin.y - start.y;
    await mouseDrag(page, start, { x: origin.x + radius, y: origin.y });
    const rotated = await element(page);
    expect(rotated.rotation).toBe(270);
    expect(rotated.dimensions).toEqual(initial.dimensions);
    await undo(page);
    expect((await element(page)).rotation).toBe(0);
  });

  await step('dragging an object works in Select mode and Escape cancels a resize', async () => {
    const initial = await element(page), start = await worldPoint(page, [initial.position[0], initial.position[2]]);
    await mouseDrag(page, start, { x: start.x + 38, y: start.y + 28 });
    expect((await element(page)).position).not.toEqual(initial.position);
    await undo(page);
    const resize = await center(handle(page, 'southeast'));
    await page.mouse.move(resize.x, resize.y); await page.mouse.down(); await page.mouse.move(resize.x + 60, resize.y + 50, { steps: 8 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    expect(await element(page)).toEqual(initial);
    await expect(page.locator('[data-transform-id="living-sofa"]')).toHaveAttribute('data-preview-width', '2.6');
  });

  await step('room handles resize and move the room without camera jumps or furniture scaling', async () => {
    const beforeView = await page.locator('svg.plan-canvas').getAttribute('viewBox');
    const select = await worldPoint(page, [-4.5, -2]);
    await page.mouse.click(select.x, select.y);
    await expect(page.locator('[data-room-move="living"]')).toBeVisible();
    expect(await page.locator('svg.plan-canvas').getAttribute('viewBox')).toBe(beforeView);
    const start = await center(handle(page, 'southeast', 'living'));
    const before = (await model(page)).rooms[0], sofaBefore = await element(page);
    await mouseDrag(page, start, { x: start.x + 48, y: start.y + 35 });
    const after = (await model(page)).rooms[0];
    expect(after.width).toBeGreaterThan(before.width); expect(after.depth).toBeGreaterThan(before.depth);
    expect(after.center[0] - after.width / 2).toBeCloseTo(before.center[0] - before.width / 2, 3);
    expect((await element(page)).dimensions).toEqual(sofaBefore.dimensions);
    const move = await center(page.locator('[data-room-move="living"]'));
    await mouseDrag(page, move, { x: move.x + 20, y: move.y - 35 });
    expect((await model(page)).rooms[0].center).not.toEqual(after.center);
    await undo(page);
    expect((await model(page)).rooms[0]).toEqual(after);
  });

  await step('attached opening keeps its parent wall when resized', async () => {
    const doorPoint = await worldPoint(page, [3, -1]);
    await page.mouse.click(doorPoint.x, doorPoint.y);
    await expect(page.locator('[data-transform-id="test-door"]')).toBeVisible();
    const before = await element(page, 'test-door');
    const start = await center(handle(page, 'southeast', 'test-door'));
    await mouseDrag(page, start, { x: start.x + 25, y: start.y });
    const after = await element(page, 'test-door');
    expect(after.dimensions.width).toBeGreaterThan(before.dimensions.width);
    expect(after.wallAttachment.wallId).toBe('test-wall');
    expect(after.position[2]).toBe(-1);
  });

  await step('main-canvas floor side handles resize the outline with one commit and keep the camera fixed', async () => {
    const point = await worldPoint(page, [-7, -5]); await page.mouse.click(point.x, point.y);
    const floorHandle = page.locator('[data-floor-edge="1"]');
    await expect(floorHandle).toBeVisible();
    const before = (await model(page)).floorPlan;
    const camera = await page.locator('svg.plan-canvas').getAttribute('viewBox');
    const start = await center(floorHandle);
    await mouseDrag(page, start, { x: start.x + 35, y: start.y });
    expect((await model(page)).floorPlan.outline[1][0]).toBeGreaterThan(before.outline[1][0]);
    expect(await page.locator('svg.plan-canvas').getAttribute('viewBox')).toBe(camera);
    await undo(page); expect((await model(page)).floorPlan).toEqual(before);
  });

  await page.screenshot({ path: path.join(output, 'mouse-controls.png') });
  const touchPage = await openPage(true);
  const cdp = await touchPage.context().newCDPSession(touchPage);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((point, index) => ({ x: point.x, y: point.y, id: point.id ?? index + 1, radiusX: 3, radiusY: 3, force: 1 })) });
  await step('real finger resize commits once and touch cancellation restores the model', async () => {
    const initial = await element(touchPage), start = await center(handle(touchPage, 'southeast'));
    await touch('touchStart', [start]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: start.x + 48 * i / 8, y: start.y + 40 * i / 8 }]);
    expect((await element(touchPage)).dimensions).toEqual(initial.dimensions);
    await touch('touchEnd', []); await saved(touchPage);
    expect((await element(touchPage)).dimensions.width).toBeGreaterThan(initial.dimensions.width);
    await undo(touchPage); expect(await element(touchPage)).toEqual(initial);
    const cancel = await center(handle(touchPage, 'southeast'));
    await touch('touchStart', [cancel]); await touch('touchMove', [{ x: cancel.x + 50, y: cancel.y + 40 }]);
    await touch('touchCancel', []);
    expect(await element(touchPage)).toEqual(initial);
    await expect(touchPage.locator('[data-transform-id="living-sofa"]')).toHaveAttribute('data-preview-width', '2.6');
  });

  await step('finger rotation works through the visible rotation handle', async () => {
    const initial = await element(touchPage), start = await center(touchPage.locator('[data-rotation-handle="living-sofa"]'));
    const origin = await worldPoint(touchPage, [initial.position[0], initial.position[2]]);
    const radius = origin.y - start.y;
    await touch('touchStart', [start]);
    for (let i = 1; i <= 8; i++) { const angle = Math.PI * i / 16; await touch('touchMove', [{ x: origin.x + radius * Math.sin(angle), y: origin.y - radius * Math.cos(angle) }]); }
    await touch('touchEnd', []); await saved(touchPage);
    expect((await element(touchPage)).rotation).toBe(270);
    await undo(touchPage); expect(await element(touchPage)).toEqual(initial);
  });

  await step('two-finger pinch zoom changes only the viewport and cancels pending object movement', async () => {
    const before = await model(touchPage);
    const view = (await touchPage.locator('svg.plan-canvas').getAttribute('viewBox')).split(' ').map(Number);
    const origin = await worldPoint(touchPage, [-3, 0]);
    const left = { x: origin.x - 30, y: origin.y, id: 1 }, right = { x: origin.x + 30, y: origin.y, id: 2 };
    await touch('touchStart', [left]); await touch('touchStart', [left, right]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ ...left, x: left.x - 7 * i }, { ...right, x: right.x + 7 * i }]);
    await touch('touchEnd', []);
    const afterView = (await touchPage.locator('svg.plan-canvas').getAttribute('viewBox')).split(' ').map(Number);
    expect(afterView[2]).toBeLessThan(view[2] * .75);
    expect(await model(touchPage)).toEqual(before);
  });

  await step('small selected objects remain draggable by their center without hitting resize handles', async () => {
    const initial = await element(touchPage);
    const initialOrigin = await worldPoint(touchPage, [initial.position[0], initial.position[2]]);
    await touchPage.mouse.move(initialOrigin.x, initialOrigin.y); await touchPage.mouse.wheel(0, 1800);
    await expect.poll(async () => Number((await touchPage.locator('svg.plan-canvas').getAttribute('viewBox')).split(' ')[2])).toBeGreaterThan(45);
    const origin = await worldPoint(touchPage, [initial.position[0], initial.position[2]]);
    await touch('touchStart', [origin]); await touch('touchMove', [{ x: origin.x + 24, y: origin.y + 18 }]); await touch('touchEnd', []); await saved(touchPage);
    const moved = await element(touchPage);
    expect(moved.position).not.toEqual(initial.position);
    expect(moved.dimensions).toEqual(initial.dimensions);
  });
  await touchPage.screenshot({ path: path.join(output, 'touch-controls.png') });
  expect(errors).toEqual([]);
  console.log('PASS no browser errors');
} catch (error) {
  await activePage?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(output, 'errors.json'), JSON.stringify(errors, null, 2));
  console.error(error); if (errors.length) console.error(errors); process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
