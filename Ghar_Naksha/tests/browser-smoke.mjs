import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run with: node tests/browser-smoke.mjs (npm run dev must already be running).
const baseURL = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const output = path.resolve('test-results/browser-smoke');
const storageKey = 'ghar-naksha-project-v1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(12_000);
const errors = [];
page.on('pageerror', (error) => errors.push(`Page error: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error')
    errors.push(`Console error: ${message.text()}`);
});
const project = () =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || 'null'),
    storageKey,
  );
const saved = async () =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const width = () =>
  page.getByRole('spinbutton', { name: 'Width', exact: true });
const elementName = () =>
  page.getByRole('textbox', { name: 'Element name', exact: true });
const importInput = () => page.getByLabel('Import project file');
const step = async (name, task) => {
  await task();
  console.log(`PASS ${name}`);
};

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await step('2D startup and furnished model in 3D', async () => {
    await expect(page.locator('svg.plan-canvas')).toBeVisible();
    await page.getByRole('button', { name: '3D view', exact: true }).click();
    await expect(page.locator('.scene-container canvas')).toBeVisible({
      timeout: 30_000,
    });
    await expect(elementName()).toHaveValue('Linen sofa');
    await expect(width()).toHaveValue('2.60');
    await saved();
    expect((await project()).elements.length).toBeGreaterThan(50);
  });

  await step('2D numeric edit remains consistent in 3D', async () => {
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
    await expect(page.locator('svg.plan-canvas')).toBeVisible();
    await width().fill('3.2');
    await width().press('Enter');
    await expect(width()).toHaveValue('3.20');
    await expect(
      page.locator('svg.plan-canvas').getByText('3.20 m', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '3D view', exact: true }).click();
    await expect(page.locator('.scene-container canvas')).toBeVisible();
    await expect(
      page.locator('.scene-container').getByText('3.20 m', { exact: true }),
    ).toBeVisible();
    await saved();
    expect(
      (await project()).elements.find((element) => element.id === 'living-sofa')
        .dimensions.width,
    ).toBe(3.2);
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
  });

  await step('feet/metres agree between inspector and plan', async () => {
    await page.getByRole('button', { name: 'Units: Meters' }).click();
    await expect(width()).toHaveValue('10.50');
    await expect(
      page.locator('svg.plan-canvas').getByText('10.50 ft', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Units: Feet' }).click();
    await expect(width()).toHaveValue('3.20');
  });

  let addedId;
  await step('library addition, edit, move, undo, and redo', async () => {
    const beforeCount = (await project()).elements.length;
    await page
      .getByRole('button', { name: 'Open element library', exact: true })
      .click();
    await page
      .getByRole('textbox', { name: 'Search element library' })
      .fill('Wishbone');
    await page.getByTitle('Add Wishbone dining chair', { exact: true }).click();
    await expect(elementName()).toHaveValue('Wishbone dining chair');
    await elementName().fill('QA dining chair');
    await width().fill('0.7');
    await width().press('Enter');
    await page
      .getByRole('button', { name: 'Undo (⌘/Ctrl Z)', exact: true })
      .click();
    await expect(width()).toHaveValue('0.50');
    await page
      .getByRole('button', { name: 'Redo (⌘/Ctrl Shift Z)', exact: true })
      .click();
    await expect(width()).toHaveValue('0.70');
    await saved();
    const state = await project();
    expect(state.elements).toHaveLength(beforeCount + 1);
    const added = state.elements.find(
      (element) => element.name === 'QA dining chair',
    );
    addedId = added.id;
    const glyph = page
      .locator('svg.plan-canvas')
      .getByRole('button', { name: /^QA dining chair,/ });
    const position = await glyph.boundingBox();
    expect(position).not.toBeNull();
    await page.mouse.move(
      position.x + position.width / 2,
      position.y + position.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      position.x + position.width / 2 + 40,
      position.y + position.height / 2 + 20,
      { steps: 5 },
    );
    await page.mouse.up();
    await saved();
    expect(
      (await project()).elements.find((element) => element.id === addedId)
        .position,
    ).not.toEqual(added.position);
  });

  await step(
    'hide/show, lock protection, duplicate, delete, and undo',
    async () => {
      await page
        .getByRole('button', { name: 'Hide element', exact: true })
        .click();
      await expect(
        page
          .locator('svg.plan-canvas')
          .getByRole('button', { name: /^QA dining chair,/ }),
      ).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Show element', exact: true })
        .click();
      await expect(
        page
          .locator('svg.plan-canvas')
          .getByRole('button', { name: /^QA dining chair,/ }),
      ).toHaveCount(1);
      await page
        .getByRole('button', { name: 'Lock element', exact: true })
        .click();
      await expect(width()).toBeDisabled();
      await expect(
        page.getByRole('button', {
          name: 'Delete selected element',
          exact: true,
        }),
      ).toBeDisabled();
      await page
        .getByRole('button', { name: 'Unlock element', exact: true })
        .click();
      await expect(width()).toBeEnabled();
      await page
        .getByRole('button', { name: 'Duplicate', exact: true })
        .click();
      await expect(elementName()).toHaveValue('QA dining chair copy');
      await page
        .getByRole('button', { name: 'Delete selected element', exact: true })
        .click();
      await expect(elementName()).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Undo (⌘/Ctrl Z)', exact: true })
        .click();
      await expect(
        page
          .locator('svg.plan-canvas')
          .getByRole('button', { name: /^QA dining chair copy,/ }),
      ).toHaveCount(1);
      await saved();
      expect(
        (await project()).elements.filter((element) =>
          element.name.startsWith('QA dining chair'),
        ),
      ).toHaveLength(2);
    },
  );

  await step('local storage restores the edited design', async () => {
    await saved();
    const before = await project();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(width()).toHaveValue('3.20');
    await saved();
    expect(await project()).toEqual(before);
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
  });

  let backupPath;
  let exported;
  await step('editable JSON export and import round trip', async () => {
    await page
      .getByRole('button', { name: 'Export project', exact: true })
      .click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Editable project/ }).click();
    const download = await pending;
    backupPath = path.join(output, download.suggestedFilename());
    await download.saveAs(backupPath);
    exported = JSON.parse(await readFile(backupPath, 'utf8'));
    expect(exported.version).toBe(1);
    expect(
      exported.elements.find((element) => element.id === addedId),
    ).toBeTruthy();
    await width().fill('4.1');
    await width().press('Enter');
    await expect(width()).toHaveValue('4.10');
    await importInput().setInputFiles(backupPath);
    await expect(page.getByRole('status')).toContainText(
      `Opened ${exported.name}`,
    );
    await saved();
    expect(await project()).toEqual(exported);
  });

  await step('invalid import preserves the current project', async () => {
    await importInput().setInputFiles({
      name: 'bad-project.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":2}'),
    });
    await expect(page.getByRole('status')).toContainText(
      'Unsupported project version',
    );
    expect(await project()).toEqual(exported);
    await importInput().setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not-json'),
    });
    await expect(page.getByRole('status')).toContainText(
      /JSON|property name|Expected/,
    );
    expect(await project()).toEqual(exported);
  });

  await step('standalone SVG drawing export', async () => {
    await page
      .getByRole('button', { name: 'Export project', exact: true })
      .click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Floor plan drawing/ }).click();
    const download = await pending;
    const file = path.join(output, download.suggestedFilename());
    await download.saveAs(file);
    const svg = await readFile(file, 'utf8');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('QA dining chair');
    const preview = await context.newPage();
    await preview.goto(`file://${file}`);
    await expect(preview.locator('svg')).toBeVisible();
    await expect(preview.locator('parsererror')).toHaveCount(0);
    await preview.close();
  });

  await step('floor-first project, room authoring, and undo', async () => {
    await page.locator('.project-switcher').click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'New project', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Project name', exact: true })
      .fill('QA custom home');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Create floor plan', exact: true })
      .click();
    await saved();
    const emptyFloor = await project();
    expect(emptyFloor.rooms).toHaveLength(0);
    expect(emptyFloor.floorPlan.outline).toEqual([
      [-6, -5],
      [6, -5],
      [6, 5],
      [-6, 5],
    ]);
    expect(emptyFloor.elements).toHaveLength(4);
    expect(
      emptyFloor.elements.every((element) => element.kind === 'wall'),
    ).toBe(true);
    await expect(page.locator('svg.plan-canvas .plan-floor-side')).toHaveCount(
      4,
    );

    await page
      .getByRole('button', { name: 'Add room to floor', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Room name', exact: true })
      .fill('First room');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add room', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'Room name', exact: true }),
    ).toHaveValue('First room');
    // Move the automatically placed room inward before widening it.
    await page
      .getByRole('spinbutton', { name: 'Room X position', exact: true })
      .fill('-3');
    await page
      .getByRole('spinbutton', { name: 'Room X position', exact: true })
      .press('Enter');
    await page
      .getByRole('spinbutton', { name: 'Room width', exact: true })
      .fill('5');
    await page
      .getByRole('spinbutton', { name: 'Room width', exact: true })
      .press('Enter');
    await saved();
    expect((await project()).rooms[0].width).toBe(5);
    expect((await project()).elements).toHaveLength(9);
    expect((await project()).floorPlan).toEqual(emptyFloor.floorPlan);
    await page
      .getByRole('button', { name: 'Add room to floor', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Room name', exact: true })
      .fill('Study');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add room', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'Room name', exact: true }),
    ).toHaveValue('Study');
    await page
      .getByRole('spinbutton', { name: 'Room Z position', exact: true })
      .fill('1');
    await page
      .getByRole('spinbutton', { name: 'Room Z position', exact: true })
      .press('Enter');
    await saved();
    expect((await project()).rooms[1].center[1]).toBe(1);
    await page
      .getByRole('button', { name: 'Remove room & elements', exact: true })
      .click();
    await saved();
    expect((await project()).rooms).toHaveLength(1);
    await page
      .getByRole('button', { name: 'Undo (⌘/Ctrl Z)', exact: true })
      .click();
    await saved();
    expect((await project()).rooms).toHaveLength(2);
    expect((await project()).floorPlan).toEqual(emptyFloor.floorPlan);
    await importInput().setInputFiles(backupPath);
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
    await saved();
    expect(await project()).toEqual(exported);
  });

  await step('no browser JavaScript or console errors', async () =>
    expect(errors).toEqual([]),
  );
  await page.screenshot({ path: path.join(output, 'floor-plan.png') });
  console.log(`Browser smoke checks passed. Artifacts: ${output}`);
} catch (error) {
  await page
    .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(output, 'console-errors.json'),
    JSON.stringify(errors, null, 2),
  );
  console.error(error);
  if (errors.length) console.error('Captured browser errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
