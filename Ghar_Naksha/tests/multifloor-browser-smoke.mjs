import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
const output = 'test-results/multifloor';
await mkdir(output, { recursive: true });
const element = (id, kind, patch = {}) => ({
  id,
  kind,
  name: id,
  roomId: 'living',
  position: [0, 0, 0],
  rotation: 0,
  dimensions: { width: 1, height: 1, depth: 1 },
  color: '#aaaaaa',
  material: 'wood',
  visible: true,
  locked: false,
  ...patch,
});
const fixture = {
  version: 1,
  name: 'Multi-floor browser QA',
  floorPlan: {
    outline: [
      [-5, -5],
      [5, -5],
      [5, 5],
      [-5, 5],
    ],
    wallHeight: 2.7,
    wallThickness: 0.15,
  },
  rooms: [
    {
      id: 'living',
      name: 'Living room',
      subtitle: '',
      center: [0, 0],
      width: 6,
      depth: 6,
      color: '#eeece6',
    },
  ],
  elements: [
    element('QA sofa', 'sofa', {
      position: [-1, 0, 1],
      dimensions: { width: 2, height: 0.8, depth: 0.9 },
    }),
    element('QA panel', 'electrical-panel', { position: [-2, 1, -2] }),
    element('QA socket', 'socket', { position: [2, 0.5, -2] }),
    element('QA stairs', 'stairs', {
      position: [0, 0, -1],
      dimensions: { width: 1, height: 2.7, depth: 4 },
    }),
  ],
  connections: [
    {
      id: 'cable',
      name: 'Ground circuit',
      fromId: 'QA panel',
      toId: 'QA socket',
      system: 'electrical',
      waypoints: [],
      enabled: true,
      size: 20,
      label: '',
    },
  ],
};
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  acceptDownloads: true,
});
page.setDefaultTimeout(14000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.addInitScript((value) => {
  if (!localStorage.getItem('ghar-naksha-project-v1'))
    localStorage.setItem('ghar-naksha-project-v1', JSON.stringify(value));
}, fixture);
const button = (name) => page.getByRole('button', { name, exact: true });
const model = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('ghar-naksha-project-v1')),
  );
const saved = () =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const number = async (name, value) => {
  const input = page.getByRole('spinbutton', { name, exact: true });
  await input.fill(String(value));
  await input.press('Enter');
};
const text = async (name, value) => {
  const input = page.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
};
const step = async (name, task) => {
  await task();
  console.log(`PASS ${name}`);
};
let upperId, copyId, copiedSocket, copiedPanel, crossId;
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', {
    waitUntil: 'domcontentloaded',
  });
  await saved();
  await step(
    'migrate, add a floor, rename it and edit its elevation',
    async () => {
      expect((await model()).levels).toHaveLength(1);
      await button('Manage floors').click();
      await button('Add floor').click();
      await text('Floor name', 'Upper suite');
      await number('Floor elevation', 3.4);
      await saved();
      const full = await model();
      upperId = full.activeLevelId;
      expect(full.levels).toHaveLength(2);
      expect(full.levels.find((level) => level.id === upperId)).toMatchObject({
        name: 'Upper suite',
        elevation: 3.4,
      });
      expect(full.rooms).toHaveLength(1);
      expect(full.rooms[0].levelId).toBe('ground-floor');
    },
  );
  await step(
    'copy a furnished floor with fresh IDs and independent data',
    async () => {
      await button('Edit floor Ground floor').click();
      await button('Copy floor').click();
      await text('Floor name', 'Copied plan');
      await number('Floor elevation', 6.2);
      await saved();
      const full = await model();
      copyId = full.activeLevelId;
      expect(full.levels).toHaveLength(3);
      const copied = full.elements.filter(
        (element) => element.levelId === copyId,
      );
      expect(copied).toHaveLength(fixture.elements.length);
      expect(
        copied.every(
          (element) =>
            !fixture.elements.some((original) => original.id === element.id),
        ),
      ).toBe(true);
      copiedSocket = copied.find((element) => element.kind === 'socket').id;
      copiedPanel = copied.find(
        (element) => element.kind === 'electrical-panel',
      ).id;
      expect(full.connections).toHaveLength(2);
      await page.screenshot({ path: `${output}/floor-manager.png` });
      await button('Close dialog').click();
    },
  );
  await step(
    'edit a copied room and outline independently, with undo and redo',
    async () => {
      await page
        .getByRole('button', { name: 'Select room Living room', exact: true })
        .press('Enter');
      await number('Room width', 5.5);
      await saved();
      let full = await model();
      expect(full.rooms.find((room) => room.levelId === copyId).width).toBe(
        5.5,
      );
      expect(
        full.rooms.find((room) => room.levelId === 'ground-floor').width,
      ).toBe(6);
      await button('Select overall floor outline').press('Enter');
      await number('Side A–B', 12);
      await button('Apply floor changes').click();
      await saved();
      full = await model();
      expect(
        full.levels.find((level) => level.id === copyId).floorPlan
          .outline[1][0] -
          full.levels.find((level) => level.id === copyId).floorPlan
            .outline[0][0],
      ).toBe(12);
      expect(
        full.levels.find((level) => level.id === 'ground-floor').floorPlan
          .outline,
      ).toEqual(fixture.floorPlan.outline);
      await button('Undo').click();
      await saved();
      full = await model();
      expect(
        full.levels.find((level) => level.id === copyId).floorPlan.outline,
      ).toEqual(fixture.floorPlan.outline);
      await button('Redo').click();
      await saved();
      expect(
        (await model()).floorPlan.outline[1][0] -
          (await model()).floorPlan.outline[0][0],
      ).toBe(12);
    },
  );
  await step('link stairs to the upper floor and fit their rise', async () => {
    await page
      .getByRole('combobox', { name: 'Active floor', exact: true })
      .selectOption('ground-floor');
    await page.locator('[data-element-id="QA stairs"]').first().press('Enter');
    await page
      .getByRole('combobox', { name: 'Stair destination floor', exact: true })
      .selectOption(upperId);
    await saved();
    expect(
      (await model()).elements.find((element) => element.id === 'QA stairs'),
    ).toMatchObject({
      connectsToLevelId: upperId,
      dimensions: { height: 3.4 },
    });
  });
  await step(
    'manual stair rise unlinks its destination, while base-height edits preserve a fitted link',
    async () => {
      await button('Stair design').click();
      await number('Floor-to-floor rise', 3.2);
      await saved();
      let stair = (await model()).elements.find((element) => element.id === 'QA stairs');
      expect(stair.dimensions.height).toBe(3.2);
      expect(stair.connectsToLevelId).toBeUndefined();
      await page.getByRole('combobox', { name: 'Stair destination floor', exact: true }).selectOption(upperId);
      await button('Properties').click();
      await number('Y position', 0.3);
      await saved();
      stair = (await model()).elements.find((element) => element.id === 'QA stairs');
      expect(stair.connectsToLevelId).toBe(upperId);
      expect(stair.position[1]).toBe(0.3);
      expect(stair.dimensions.height).toBeCloseTo(3.1);
      await number('Y position', 0);
      await saved();
      stair = (await model()).elements.find((element) => element.id === 'QA stairs');
      expect(stair.connectsToLevelId).toBe(upperId);
      expect(stair.dimensions.height).toBe(3.4);
    },
  );
  await step(
    'create cross-floor routes, edit bends and preserve their world position when changing source',
    async () => {
      await button('Open utility connections').click();
      await button('Add electrical connection').click();
      await text('Connection name', 'Cross-floor QA');
      const from = page.getByRole('combobox', {
        name: 'Connection source',
        exact: true,
      });
      const to = page.getByRole('combobox', {
        name: 'Connection destination',
        exact: true,
      });
      expect(await to.locator('option').allTextContents()).toContain(
        'QA socket · Copied plan',
      );
      await from.selectOption('QA panel');
      await to.selectOption(copiedSocket);
      await number('Conduit diameter', 32.5);
      await page.getByRole('button', { name: /^Add bend/ }).click();
      await number('Bend 1 Y', -0.25);
      await saved();
      let full = await model();
      let route = full.connections.find(
        (route) => route.name === 'Cross-floor QA',
      );
      crossId = route.id;
      expect(route.waypoints[0][1]).toBe(-0.25);
      await from.selectOption(copiedPanel);
      await saved();
      route = (await model()).connections.find((route) => route.id === crossId);
      expect(route.waypoints[0][1]).toBeCloseTo(-6.45);
      await from.selectOption('QA panel');
      await saved();
      route = (await model()).connections.find((route) => route.id === crossId);
      expect(route.waypoints[0][1]).toBeCloseTo(-0.25);
      await page
        .getByRole('combobox', { name: 'Route floor filter' })
        .selectOption('cross');
      await expect(
        page.getByRole('button', { name: /Cross-floor QA/ }),
      ).toBeVisible();
      await expect(
        page.locator(`[data-connection-id="${crossId}"]`),
      ).toHaveCount(0);
      await page.getByRole('button', { name: /Cross-floor QA/ }).click();
      await button('Inspect destination element').click();
      await saved();
      expect((await model()).activeLevelId).toBe(copyId);
    },
  );
  await step(
    'export and reimport all floors, persist active view on reload, delete a floor and undo',
    async () => {
      const before = await model();
      await page
        .getByRole('button', { name: 'Export project', exact: true })
        .click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /Editable project/ }).click();
      const download = await downloadPromise;
      const filepath = `${output}/building.json`;
      await download.saveAs(filepath);
      expect(JSON.parse(await readFile(filepath, 'utf8'))).toEqual(before);
      await page
        .getByLabel('Import project file', { exact: true })
        .setInputFiles(filepath);
      await saved();
      expect(await model()).toEqual(before);
      await page.reload();
      await saved();
      expect((await model()).activeLevelId).toBe(copyId);
      expect((await model()).levels).toHaveLength(3);
      await button('Manage floors').click();
      await button('Remove this floor').click();
      await saved();
      let full = await model();
      expect(full.levels).toHaveLength(2);
      expect(full.elements.some((element) => element.levelId === copyId)).toBe(
        false,
      );
      expect(full.connections.some((route) => route.id === crossId)).toBe(
        false,
      );
      expect(full.rooms.find((room) => room.id === 'living').width).toBe(6);
      await button('Close dialog').click();
      await button('Undo').click();
      await saved();
      full = await model();
      expect(full.levels).toHaveLength(3);
      expect(full.connections.some((route) => route.id === crossId)).toBe(true);
      await page.screenshot({ path: `${output}/restored-building.png` });
    },
  );
  expect(errors).toEqual([]);
  console.log(
    'Multi-floor and cross-floor utility browser checks passed without console errors.',
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  console.error(error);
  console.error('Browser errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
