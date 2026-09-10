import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run against Vite: node tests/scene-gestures.mjs
// Camera projection locates actual rendered handles; all gestures use browser pointer input.
const baseURL = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const output = path.resolve('test-results/scene-gestures');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);
page.on('pageerror', (error) => errors.push(error.message));
const project = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('ghar-naksha-project-v1')),
  );
const sofa = async () =>
  (await project()).elements.find((element) => element.id === 'living-sofa');
const saved = () =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const undo = async () => {
  await page.keyboard.press('Control+z');
  await saved();
};
const canvasStore = async () =>
  page.evaluate(async () => {
    const { _roots } = await import(
      '/node_modules/.vite/deps/@react-three_fiber.js'
    );
    window.sceneGestureStore = [..._roots.values()][0].store;
  });
const handle = async (mode, axis = 'X', distance = 0.65) =>
  page.evaluate(
    async ({ mode, axis, distance }) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { scene, camera, gl } = window.sceneGestureStore.getState();
      let control;
      scene.traverse((object) => {
        if (object.isTransformControls) control = object;
      });
      if (!control) throw new Error('Selected object has no transform gizmo.');
      scene.updateMatrixWorld(true);
      const rect = gl.domElement.getBoundingClientRect();
      const project = (point) => {
        point.project(camera);
        return {
          x: rect.x + ((point.x + 1) * rect.width) / 2,
          y: rect.y + ((1 - point.y) * rect.height) / 2,
        };
      };
      if (mode === 'rotate') {
        const marker = control.gizmo.gizmo.rotate.children.find(
          (object) => object.name === 'Y' && object.isMesh && object.visible,
        );
        if (!marker) throw new Error('No visible rotation marker.');
        const center = control.object.getWorldPosition(new THREE.Vector3());
        const start = new THREE.Box3()
          .setFromObject(marker)
          .getCenter(new THREE.Vector3());
        const delta = start
          .clone()
          .sub(center)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), distance);
        return {
          start: project(start),
          end: project(center.clone().add(delta)),
        };
      }
      const mesh = control.gizmo.gizmo[mode].children.find(
        (object) => object.name === axis && object.isMesh && object.visible,
      );
      if (!mesh) throw new Error(`No visible ${mode} ${axis} handle.`);
      const start = new THREE.Box3()
        .setFromObject(mesh)
        .getCenter(new THREE.Vector3());
      const delta = new THREE.Vector3(
        axis === 'X' ? distance : 0,
        axis === 'Y' ? distance : 0,
        axis === 'Z' ? distance : 0,
      );
      if (mode === 'scale') delta.applyQuaternion(control.object.quaternion);
      return { start: project(start.clone()), end: project(start.add(delta)) };
    },
    { mode, axis, distance },
  );
const mouseDrag = async (points) => {
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 10 });
};
const step = async (name, task) => {
  if (
    process.env.SCENE_GESTURE_FILTER &&
    !name.includes(process.env.SCENE_GESTURE_FILTER)
  )
    return;
  await task();
  console.log(`PASS ${name}`);
};

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '3D view', exact: true }).click();
  await expect(page.locator('.scene-container canvas')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.scene-transform-hint')).toHaveAttribute(
    'data-mode',
    'translate',
  );
  await page.waitForTimeout(1800);
  await canvasStore();
  await saved();

  await step(
    'default-select move gizmo commits once and undo restores position',
    async () => {
      const before = await sofa();
      await mouseDrag(await handle('translate', 'X', 0.7));
      await page.mouse.up();
      await saved();
      expect((await sofa()).position[0]).toBeGreaterThan(
        before.position[0] + 0.4,
      );
      await undo();
      expect((await sofa()).position).toEqual(before.position);
    },
  );
  await step(
    '3D resize previews locally and creates one undo entry',
    async () => {
      await page
        .getByRole('button', { name: 'Resize element (R)', exact: true })
        .click();
      await expect(page.locator('.scene-transform-hint')).toHaveAttribute(
        'data-mode',
        'scale',
      );
      const before = await sofa();
      await mouseDrag(await handle('scale', 'X', 0.7));
      expect((await sofa()).dimensions).toEqual(before.dimensions);
      await expect(page.locator('.scene-transform-hint')).toContainText(
        'Release to apply',
      );
      await page.mouse.up();
      await saved();
      expect((await sofa()).dimensions.width).toBeGreaterThan(
        before.dimensions.width,
      );
      expect((await sofa()).dimensions.height).toBe(before.dimensions.height);
      expect((await sofa()).dimensions.depth).toBe(before.dimensions.depth);
      await undo();
      expect((await sofa()).dimensions).toEqual(before.dimensions);
    },
  );
  await step(
    'Escape and pointer cancellation discard previews and unlock orbit',
    async () => {
      const before = await sofa();
      await mouseDrag(await handle('scale', 'X', 0.7));
      await expect(page.locator('.scene-transform-hint')).toContainText(
        'Release to apply',
      );
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect((await sofa()).dimensions).toEqual(before.dimensions);
      expect(
        await page.evaluate(
          () => window.sceneGestureStore.getState().controls.enabled,
        ),
      ).toBe(true);
      await expect(page.locator('.scene-transform-hint')).toHaveCount(1);
      await mouseDrag(await handle('scale', 'X', 0.6));
      await expect(page.locator('.scene-transform-hint')).toContainText(
        'Release to apply',
      );
      await page.evaluate(() =>
        window.dispatchEvent(
          new PointerEvent('pointercancel', {
            pointerId: 1,
            pointerType: 'mouse',
          }),
        ),
      );
      await page.mouse.up();
      expect((await sofa()).dimensions).toEqual(before.dimensions);
      expect(
        await page.evaluate(
          () => window.sceneGestureStore.getState().controls.enabled,
        ),
      ).toBe(true);
    },
  );
  await step(
    'vertical-axis rotation preserves headings beyond 90 degrees',
    async () => {
      const rotation = page.getByRole('spinbutton', {
        name: 'Rotation',
        exact: true,
      });
      await rotation.fill('150');
      await rotation.press('Enter');
      await saved();
      await page
        .getByRole('button', { name: 'Rotate element (E)', exact: true })
        .click();
      await expect(page.locator('.scene-transform-hint')).toHaveAttribute(
        'data-mode',
        'rotate',
      );
      await mouseDrag(await handle('rotate', 'Y', 0.45));
      await expect(page.locator('.scene-transform-hint')).toContainText(
        'Release to apply',
      );
      const preview = await page.evaluate(async () => {
        const THREE = await import('/node_modules/.vite/deps/three.js');
        const scene = window.sceneGestureStore.getState().scene;
        const heading = (object) => {
          const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
            object.quaternion,
          );
          return (
            ((THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z)) %
              360) +
              360) %
            360
          );
        };
        return {
          anchor: heading(
            scene.getObjectByName('transform-anchor-living-sofa'),
          ),
          preview: heading(scene.getObjectByName('living-sofa')),
        };
      });
      expect(preview.preview).toBeCloseTo(
        Math.round(preview.anchor / 15) * 15,
        0,
      );
      await page.mouse.up();
      await saved();
      expect((await sofa()).rotation).not.toBe(150);
      expect((await sofa()).rotation % 15).toBe(0);
      await undo();
      expect((await sofa()).rotation).toBe(150);
      await undo();
      expect((await sofa()).rotation).toBe(0);
    },
  );
  await step(
    'finger resize uses the same preview and commit path',
    async () => {
      await page
        .getByRole('button', { name: 'Resize element (R)', exact: true })
        .click();
      await expect(page.locator('.scene-transform-hint')).toHaveAttribute(
        'data-mode',
        'scale',
      );
      const before = await sofa();
      const points = await handle('scale', 'Z', 0.6);
      const cdp = await context.newCDPSession(page);
      const touch = (point) => ({
        x: point.x,
        y: point.y,
        radiusX: 7,
        radiusY: 7,
        force: 1,
        id: 7,
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [touch(points.start)],
      });
      for (let i = 1; i <= 8; i++)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            touch({
              x: points.start.x + ((points.end.x - points.start.x) * i) / 8,
              y: points.start.y + ((points.end.y - points.start.y) * i) / 8,
            }),
          ],
        });
      await expect(page.locator('.scene-transform-hint')).toContainText(
        'Release to apply',
      );
      expect((await sofa()).dimensions).toEqual(before.dimensions);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await saved();
      expect((await sofa()).dimensions.depth).toBeGreaterThan(
        before.dimensions.depth,
      );
      await undo();
      expect((await sofa()).dimensions).toEqual(before.dimensions);
      await cdp.detach();
    },
  );
  await step('locked selections hide manipulators', async () => {
    await page
      .getByRole('button', { name: 'Lock element', exact: true })
      .click();
    await expect(page.locator('.scene-transform-hint')).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        let count = 0;
        window.sceneGestureStore.getState().scene.traverse((object) => {
          if (object.isTransformControls) count++;
        });
        return count;
      }),
    ).toBe(0);
    await page
      .getByRole('button', { name: 'Unlock element', exact: true })
      .click();
    await expect(page.locator('.scene-transform-hint')).toHaveCount(1);
  });
  expect(errors).toEqual([]);
  await page.screenshot({ path: path.join(output, 'resize-controls.png') });
  console.log('Scene gesture regression checks passed without browser errors.');
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
