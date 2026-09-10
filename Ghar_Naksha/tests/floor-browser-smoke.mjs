import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const output = 'test-results/floor-smoke';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const project = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('ghar-naksha-project-v1')),
  );
const saved = () =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const field = (name) => page.getByRole('spinbutton', { name, exact: true });
const edit = async (input, value) => {
  await input.fill(String(value));
  await input.press('Enter');
};
const step = async (name, action) => {
  await action();
  console.log(`PASS ${name}`);
};

try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173');
  await step(
    'floor-first wizard with paired side lengths and alternative outlines',
    async () => {
      await page
        .getByRole('button', { name: 'Create new project', exact: true })
        .click();
      const modal = page.getByRole('dialog');
      await modal
        .getByRole('textbox', { name: 'Project name', exact: true })
        .fill('Perimeter test');
      await edit(
        modal.getByRole('spinbutton', { name: 'Side A–B', exact: true }),
        14,
      );
      await expect(
        modal.getByRole('spinbutton', { name: 'Side C–D', exact: true }),
      ).toHaveValue('14.00');
      await modal
        .getByRole('button', { name: 'L-shaped', exact: true })
        .click();
      await expect(
        modal.getByRole('spinbutton', { name: 'Side F–A', exact: true }),
      ).toBeVisible();
      await modal
        .getByRole('button', { name: 'Rectangle', exact: true })
        .click();
      await modal
        .getByRole('button', { name: 'Create floor plan', exact: true })
        .click();
      await expect(page.locator('svg.plan-canvas')).toBeVisible();
      await saved();
      const state = await project();
      expect(state.rooms).toHaveLength(0);
      expect(state.elements).toHaveLength(4);
      expect(state.floorPlan.outline).toEqual([
        [-7, -5],
        [7, -5],
        [7, 5],
        [-7, 5],
      ]);
      expect(
        state.elements.every(
          (element) => element.floorEdge !== undefined && !element.locked,
        ),
      ).toBe(true);
    },
  );
  await step('multiple rooms remain inside a fixed overall floor', async () => {
    for (const name of ['Living area', 'Bedroom']) {
      await page
        .getByRole('button', { name: 'Add room to floor', exact: true })
        .click();
      const modal = page.getByRole('dialog');
      await modal
        .getByRole('textbox', { name: 'Room name', exact: true })
        .fill(name);
      await modal
        .getByRole('button', { name: 'Add room', exact: true })
        .click();
      await expect(
        page.getByRole('textbox', { name: 'Room name', exact: true }),
      ).toHaveValue(name);
    }
    await saved();
    const state = await project();
    expect(state.rooms).toHaveLength(2);
    expect(state.floorPlan.outline[1][0]).toBe(7);
    expect(
      state.rooms.every(
        (room) =>
          Math.abs(room.center[0]) + room.width / 2 <= 7 &&
          Math.abs(room.center[1]) + room.depth / 2 <= 5,
      ),
    ).toBe(true);
    await edit(field('Room width'), 30);
    await expect(page.getByRole('status')).toContainText(
      'inside the total floor plan',
    );
    expect((await project()).rooms[1].width).toBe(4);
    await expect(field('Room width')).toHaveValue('4.00');
  });
  await step(
    'floor edits preserve sizes or scale the entire layout by choice',
    async () => {
      await page
        .getByRole('button', { name: 'Edit total floor outline', exact: true })
        .click();
      await edit(field('Side A–B'), 18);
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await saved();
      expect((await project()).floorPlan.outline[1][0]).toBe(9);
      expect((await project()).rooms[0].width).toBe(4);
      await edit(field('Side A–B'), 12);
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await expect(page.getByRole('status')).toContainText('cut through');
      expect((await project()).floorPlan.outline[1][0]).toBe(9);
      await page.getByLabel('When the outline changes').selectOption('scale');
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await saved();
      expect((await project()).floorPlan.outline[1][0]).toBe(6);
      expect((await project()).rooms[0].width).toBeCloseTo((4 * 12) / 18);
    },
  );
  await step(
    'custom corners reject collapsed edges without losing the current floor',
    async () => {
      await page.getByRole('button', { name: 'Custom', exact: true }).click();
      await page
        .getByRole('button', { name: 'Edit corner coordinates', exact: true })
        .click();
      await edit(field('Corner B X'), -6);
      await expect(page.getByRole('alert')).toContainText('at least 0.1');
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      expect((await project()).floorPlan.outline[1][0]).toBe(6);
      await page
        .getByRole('button', { name: 'Rectangle', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await saved();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.getByRole('button', { name: 'Custom', exact: true }).click();
      // A saved quadrilateral must retain its independent corners on later edits.
      if (!(await field('Corner B X').isVisible())) {
        await page
          .getByRole('button', { name: 'Edit corner coordinates', exact: true })
          .click();
      }
      await edit(field('Corner B X'), 5);
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await saved();
      await edit(field('Side A–B'), 11.5);
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await saved();
      expect((await project()).floorPlan.outline[1][0]).toBe(5.5);
      expect((await project()).floorPlan.outline[2][0]).toBe(6);
      await page
        .getByRole('button', { name: 'Split side A', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await saved();
      expect((await project()).floorPlan.outline).toHaveLength(5);
    },
  );
  await step(
    'removing the final room preserves the editable total floor',
    async () => {
      for (const name of ['Living area', 'Bedroom']) {
        await page.getByTitle('Rooms & floor', { exact: true }).click();
        await page
          .locator('.room-tree')
          .getByRole('button', { name: new RegExp(name) })
          .click();
        await page
          .getByRole('button', { name: 'Remove room & elements', exact: true })
          .click();
      }
      await saved();
      expect((await project()).rooms).toHaveLength(0);
      expect((await project()).floorPlan.outline).toHaveLength(5);
      await page
        .getByRole('button', { name: 'Undo (⌘/Ctrl Z)', exact: true })
        .click();
      await saved();
      expect((await project()).rooms).toHaveLength(1);
      await page.screenshot({ path: `${output}/edited-outline.png` });
    },
  );
  await step('mobile floor creation controls remain accessible', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .locator('.workspace-nav')
      .getByRole('button', { name: 'Spaces', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Create new project', exact: true })
      .click();
    await edit(
      page
        .getByRole('dialog')
        .getByRole('spinbutton', { name: 'Side A–B', exact: true }),
      10,
    );
    await page
      .getByRole('button', { name: 'Create floor plan', exact: true })
      .click();
    await saved();
    expect((await project()).rooms).toHaveLength(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    await page.screenshot({ path: `${output}/mobile-floor.png` });
  });
  expect(errors).toEqual([]);
  console.log('Floor authoring checks passed with no browser errors.');
} catch (error) {
  console.error(error);
  await page.screenshot({ path: `${output}/failure.png` });
  process.exitCode = 1;
} finally {
  await browser.close();
}
