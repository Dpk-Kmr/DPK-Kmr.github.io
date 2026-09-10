import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'test-results/walkthrough';
await mkdir(output, { recursive: true });
const floor = {
  outline: [
    [-5, -5],
    [5, -5],
    [5, 5],
    [-5, 5],
  ],
  wallHeight: 2.7,
  wallThickness: 0.15,
};
const defaults = {
  roomId: '__floor__',
  position: [0, 0, 0],
  rotation: 0,
  color: '#a58055',
  material: 'wood',
  visible: true,
  locked: false,
};
const fixture = {
  version: 1,
  name: 'Two storey walkthrough',
  activeLevelId: 'ground-floor',
  floorPlan: floor,
  levels: [
    {
      id: 'ground-floor',
      name: 'Ground floor',
      elevation: 0,
      floorPlan: floor,
    },
    { id: 'upper', name: 'First floor', elevation: 2.8, floorPlan: floor },
  ],
  rooms: [
    {
      id: 'entry',
      levelId: 'ground-floor',
      name: 'Entry',
      subtitle: '',
      center: [0, 2.4],
      width: 2,
      depth: 1,
      color: '#d1d7c5',
    },
  ],
  elements: [
    {
      ...defaults,
      id: 'stair',
      levelId: 'ground-floor',
      connectsToLevelId: 'upper',
      kind: 'stairs',
      name: 'Connecting staircase',
      dimensions: { width: 1.1, height: 2.8, depth: 4.48 },
      stairs: {
        style: 'straight',
        steps: 16,
        flightWidth: 1.1,
        landingDepth: 1,
        turnDirection: 'right',
        railing: 'both',
        railingHeight: 0.9,
        treadThickness: 0.05,
        nosing: 0.025,
        risers: 'closed',
        stringer: 'solid',
        spiralTurns: 1,
        innerRadius: 0.18,
      },
    },
    {
      ...defaults,
      id: 'up-sofa',
      kind: 'sofa',
      name: 'Upstairs sofa',
      levelId: 'upper',
      position: [1.8, 0, -3.4],
      dimensions: { width: 2, height: 0.9, depth: 0.9 },
      material: 'fabric',
      color: '#c4b194',
    },
  ],
  connections: [],
};
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  hasTouch: true,
});
await context.addInitScript((project) => {
  localStorage.setItem('ghar-naksha-project-v1', JSON.stringify(project));
}, fixture);
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const hud = () =>
  page.getByRole('complementary', { name: 'Walkthrough person' });
const position = () =>
  hud().evaluate((node) => ({
    x: Number(node.dataset.walkX),
    y: Number(node.dataset.walkY),
    z: Number(node.dataset.walkZ),
    level: node.dataset.walkLevel,
    camera: node.dataset.walkCamera,
    seated: node.dataset.walkSeated === 'true',
  }));
const store = async () =>
  page.evaluate(async () => {
    const { _roots } = await import(
      '/node_modules/.vite/deps/@react-three_fiber.js'
    );
    window.walkQAStore = [..._roots.values()][0].store;
  });
const step = async (name, task) => {
  await task();
  console.log(`PASS ${name}`);
};
const moveTo = async (axis, target, tolerance = 0.07) => {
  for (let i = 0; i < 120; i++) {
    const p = await position(),
      difference = target - p[axis];
    if (Math.abs(difference) < tolerance) return;
    const key =
      axis === 'x' ? (difference > 0 ? 'd' : 'a') : difference > 0 ? 's' : 'w';
    await page.keyboard.down(key);
    await page.waitForTimeout(
      Math.max(30, Math.min(150, Math.abs(difference) * 350)),
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(180);
  }
  throw new Error(
    `Could not reach ${axis}=${target}: ${JSON.stringify(await position())}`,
  );
};
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', {
    waitUntil: 'networkidle',
  });
  await page.getByRole('button', { name: /^Walkthrough/ }).click();
  await expect(hud()).toBeVisible();
  await store();
  await step(
    'visible full-height person with follow/front/eye cameras',
    async () => {
      const initial = await position();
      expect(initial.z).toBeCloseTo(2.6, 1);
      expect(initial.y).toBe(0);
      const avatar = await page.evaluate(() => {
        const { scene } = window.walkQAStore.getState(),
          person = scene.getObjectByName('walkthrough-person');
        return {
          visible: person.visible,
          height: person.scale.y,
          feet: person.position.y,
        };
      });
      expect(avatar.visible).toBe(true);
      expect(avatar.height).toBe(1.75);
      expect(avatar.feet).toBe(0);
      await page.getByLabel('Walkthrough camera').selectOption('front');
      await expect(hud()).toHaveAttribute('data-walk-camera', 'front');
      expect(
        await page.evaluate(
          () => window.walkQAStore.getState().camera.position.z,
        ),
      ).toBeLessThan(initial.z);
      await page.screenshot({ path: `${output}/person-front.png` });
      await page.getByLabel('Walkthrough camera').selectOption('first');
      await expect(hud()).toHaveAttribute('data-walk-camera', 'first');
      await expect.poll(() => page.evaluate(() => window.walkQAStore.getState().scene.getObjectByName('walkthrough-person').visible)).toBe(false);
      const field = page.getByRole('spinbutton', {
        name: 'Person height',
        exact: true,
      });
      await field.fill('1.9');
      await field.press('Enter');
      await expect(hud()).toHaveAttribute('data-walk-height', '1.9');
      expect(
        await page.evaluate(
          () => window.walkQAStore.getState().camera.position.y,
        ),
      ).toBeCloseTo(1.786, 2);
      await page.getByLabel('Walkthrough camera').selectOption('follow');
      await expect(hud()).toHaveAttribute('data-walk-camera', 'follow');
    },
  );
  await step(
    'walks all stair treads to another floor without resetting position',
    async () => {
      await page.keyboard.down('w');
      await expect
        .poll(async () => (await position()).y, { timeout: 20_000 })
        .toBeGreaterThan(1);
      const middle = await position();
      expect(middle.y).toBeLessThan(2.8);
      await expect
        .poll(async () => (await position()).z, { timeout: 20_000 })
        .toBeLessThan(-2.45);
      await page.keyboard.up('w');
      await page.waitForTimeout(200);
      const upper = await position();
      expect(upper.y).toBe(2.8);
      expect(upper.level).toBe('upper');
      expect(upper.z).toBeLessThan(-2.45);
      await page.screenshot({ path: `${output}/upstairs-arrival.png` });
      const levels = await page.evaluate(() => {
        const { scene } = window.walkQAStore.getState();
        return [
          scene.getObjectByName('building-level-ground-floor').position.y,
          scene.getObjectByName('building-level-upper').position.y,
        ];
      });
      expect(levels).toEqual([0, 2.8]);
    },
  );
  await step(
    'sits on upstairs sofa and stands with mouse and keyboard',
    async () => {
      await moveTo('z', -2.55);
      await moveTo('x', 1.8);
      await expect(
        page.getByRole('button', { name: 'Sit on Upstairs sofa' }),
      ).toBeEnabled();
      await page.getByRole('button', { name: 'Sit on Upstairs sofa' }).click();
      await expect(hud()).toHaveAttribute('data-walk-seated', 'true');
      await expect
        .poll(async () =>
          page.evaluate(
            () =>
              window.walkQAStore
                .getState()
                .scene.getObjectByName('walkthrough-person').userData.seated,
          ),
        )
        .toBe(true);
      const pose = await page.evaluate(() => {
        const { scene } = window.walkQAStore.getState();
        const person = scene.getObjectByName('walkthrough-person');
        return { y: person.position.y, seated: person.userData.seated };
      });
      expect(pose.seated).toBe(true);
      expect(pose.y).toBeCloseTo(2.8 + 0.9 * 0.6 - 1.9 * 0.5, 2);
      await page.screenshot({ path: `${output}/seated.png` });
      await page.keyboard.press('e');
      await expect(hud()).toHaveAttribute('data-walk-seated', 'false');
      expect((await position()).y).toBe(2.8);
      // Sitting faces the sofa's front (+Z). Drag exactly 180° to restore movement heading toward -Z.
      const rect = await page.locator('.scene-canvas canvas').boundingBox();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        rect.x + rect.width / 2 + Math.PI / 0.003,
        rect.y + rect.height / 2,
        { steps: 20 },
      );
      await page.mouse.up();
    },
  );
  await step(
    'walks downstairs and retains original level elevation',
    async () => {
      await moveTo('z', -2.55);
      await moveTo('x', 0);
      await page.keyboard.down('s');
      await expect
        .poll(async () => (await position()).y, { timeout: 20_000 })
        .toBeLessThan(2);
      await expect
        .poll(async () => (await position()).z, { timeout: 20_000 })
        .toBeGreaterThan(2.45);
      await page.keyboard.up('s');
      await page.waitForTimeout(200);
      const lower = await position();
      expect(lower.y).toBe(0);
      expect(lower.level).toBe('ground-floor');
    },
  );
  await step('touch movement pad changes the person position', async () => {
    const before = await position();
    const right = page.getByRole('button', { name: 'Walk right', exact: true });
    const rect = await right.boundingBox();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 12 },
      ],
    });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(220);
    expect((await position()).x).toBeGreaterThan(before.x + 0.2);
  });
  expect(errors).toEqual([]);
  await writeFile(
    `${output}/result.json`,
    JSON.stringify({ passed: true, errors }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  console.error('PAGE ERRORS', errors);
  throw error;
} finally {
  await browser.close();
}
