import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('test-results/scene-level-gestures');
await mkdir(output, { recursive: true });
const floorPlan = {
  outline: [
    [-5, -4],
    [5, -4],
    [5, 4],
    [-5, 4],
  ],
  wallHeight: 2.7,
  wallThickness: 0.15,
};
const item = (id, levelId, position) => ({
  id,
  levelId,
  name: id,
  kind: 'sofa',
  roomId: '__floor__',
  position,
  rotation: 0,
  dimensions: { width: 2.6, height: 0.85, depth: 1 },
  color: '#d0c9bc',
  material: 'fabric',
  visible: true,
  locked: false,
});
const fixture = {
  version: 1,
  name: 'Upper floor editing',
  floorPlan,
  activeLevelId: 'ground-floor',
  levels: [
    { id: 'ground-floor', name: 'Ground floor', elevation: 0, floorPlan },
    { id: 'upper-floor', name: 'Upper floor', elevation: 3.2, floorPlan },
  ],
  rooms: [],
  elements: [
    item('ground-sofa', 'ground-floor', [-3, 0, 2]),
    item('upper-sofa', 'upper-floor', [0, 0.25, 0]),
  ],
  connections: [],
};
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1500, height: 1000 },
});
await context.addInitScript(
  (value) =>
    localStorage.setItem('ghar-naksha-project-v1', JSON.stringify(value)),
  fixture,
);
const page = await context.newPage(),
  errors = [];
page.setDefaultTimeout(15000);
page.on('pageerror', (error) => errors.push(error.message));
const model = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('ghar-naksha-project-v1')),
  );
const saved = () =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const itemState = async (id) =>
  (await model()).elements.find((element) => element.id === id);
const frame = async (callback) => page.evaluate(callback);
const handle = async (mode, axis, distance) =>
  page.evaluate(
    async ({ mode, axis, distance }) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { scene, camera, gl } = window.levelGestureStore.getState();
      scene.updateMatrixWorld(true);
      let control;
      scene.traverse((object) => {
        if (object.isTransformControls) control = object;
      });
      if (!control)
        throw new Error(
          'Selected upper-floor object has no transform control.',
        );
      const mesh = control.gizmo.gizmo[mode].children.find(
        (object) => object.name === axis && object.isMesh && object.visible,
      );
      if (!mesh) throw new Error(`Missing ${mode} ${axis} handle`);
      const origin = control.object.getWorldPosition(new THREE.Vector3());
      const start = new THREE.Box3()
        .setFromObject(mesh)
        .getCenter(new THREE.Vector3());
      const delta = new THREE.Vector3(
        axis === 'X' ? distance : 0,
        axis === 'Y' ? distance : 0,
        axis === 'Z' ? distance : 0,
      );
      if (mode === 'scale') delta.applyQuaternion(control.object.quaternion);
      const rect = gl.domElement.getBoundingClientRect();
      const project = (point) => {
        point.project(camera);
        return {
          x: rect.x + ((point.x + 1) * rect.width) / 2,
          y: rect.y + ((1 - point.y) * rect.height) / 2,
        };
      };
      return {
        start: project(start.clone()),
        end: project(start.clone().add(delta)),
        handleWorld: start.toArray(),
        anchorWorld: origin.toArray(),
        controlParent: control.parent?.name,
      };
    },
    { mode, axis, distance },
  );
const drag = async (points) => {
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 12 });
  await page.mouse.up();
  await saved();
};
const undo = async () => {
  await page.getByRole('button', { name: /^Undo \(/ }).click();
  await saved();
};
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: '3D view', exact: true }).click();
  await expect(page.locator('.scene-container canvas')).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole('button', { name: 'Entire building', exact: true })
    .click();
  await page.waitForTimeout(2200);
  await frame(async () => {
    const { _roots } = await import(
      '/node_modules/.vite/deps/@react-three_fiber.js'
    );
    window.levelGestureStore = [..._roots.values()][0].store;
  });
  const target = await frame(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { scene, camera, gl } = window.levelGestureStore.getState();
    const object = scene.getObjectByName('upper-sofa');
    if (!object)
      throw new Error('Upper floor sofa is missing from building view.');
    const point = object
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, 0.5, 0.3))
        .project(camera),
      rect = gl.domElement.getBoundingClientRect();
    return {
      x: rect.x + ((point.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - point.y) * rect.height) / 2,
    };
  });
  await page.mouse.click(target.x, target.y);
  await expect(
    page.getByRole('combobox', { name: 'Active floor', exact: true }),
  ).toHaveValue('upper-floor');
  await expect(
    page.getByRole('textbox', { name: 'Element name', exact: true }),
  ).toHaveValue('upper-sofa');
  await expect(page.locator('.scene-transform-hint')).toHaveAttribute(
    'data-mode',
    'translate',
  );
  console.log(
    'PASS clicking an upper-floor object in the entire building activates its floor and inspector',
  );
  await page.waitForTimeout(1200);
  const before = await itemState('upper-sofa'),
    ground = await itemState('ground-sofa');
  const translation = await handle('translate', 'X', 0.7);
  await writeFile(
    path.join(output, 'gizmo-coordinates.json'),
    JSON.stringify(translation, null, 2),
  );
  expect(translation.anchorWorld[1]).toBeCloseTo(3.45, 3);
  expect(translation.handleWorld[1]).toBeCloseTo(translation.anchorWorld[1], 2);
  await drag(translation);
  expect((await itemState('upper-sofa')).position[0]).toBeGreaterThan(
    before.position[0] + 0.4,
  );
  expect((await itemState('upper-sofa')).position[1]).toBe(0.25);
  expect(await itemState('ground-sofa')).toEqual(ground);
  await undo();
  expect(await itemState('upper-sofa')).toEqual(before);
  console.log(
    'PASS upper-floor move gizmo uses correct world elevation and saves floor-local coordinates',
  );
  await page
    .getByRole('button', { name: 'Resize element (R)', exact: true })
    .click();
  await expect(page.locator('.scene-transform-hint')).toHaveAttribute(
    'data-mode',
    'scale',
  );
  await drag(await handle('scale', 'X', 0.65));
  const resized = await itemState('upper-sofa');
  expect(resized.dimensions.width).toBeGreaterThan(before.dimensions.width);
  expect(resized.dimensions.height).toBe(before.dimensions.height);
  expect(resized.position).toEqual(before.position);
  await undo();
  expect(await itemState('upper-sofa')).toEqual(before);
  console.log(
    'PASS upper-floor resize preserves local position, elevation, and one-step undo',
  );
  expect(errors).toEqual([]);
  await page.screenshot({
    path: path.join(output, 'upper-floor-controls.png'),
  });
  console.log('PASS no browser errors');
} catch (error) {
  await page
    .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(output, 'errors.json'),
    JSON.stringify(errors, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
