import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run against the development server: node tests/utility-browser-smoke.mjs
const output = path.resolve('test-results/utility-smoke');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: true,
});
page.setDefaultTimeout(12_000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const model = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('ghar-naksha-project-v1') || 'null'),
  );
const saved = () =>
  expect(page.locator('.save-indicator')).toHaveText('All changes saved');
const field = (name) => page.getByRole('spinbutton', { name, exact: true });
const changeNumber = async (name, value) => {
  await field(name).fill(String(value));
  await field(name).press('Enter');
};
const changeText = async (name, value) => {
  const input = page.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
};
const step = async (name, task) => {
  await task();
  console.log(`PASS ${name}`);
};
let routeId;

try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open utility connections', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Connection editor' }),
  ).toBeVisible();
  await saved();
  const initialCount = (await model()).connections.length;

  await step(
    'create a route and edit endpoints, diameter, name and drawing label',
    async () => {
      await page
        .getByRole('button', { name: 'Add electrical connection', exact: true })
        .click();
      await changeText('Connection name', 'QA editable circuit');
      await page
        .getByRole('combobox', { name: 'Connection source', exact: true })
        .selectOption('socket-tv');
      await page
        .getByRole('combobox', { name: 'Connection destination', exact: true })
        .selectOption('socket-kitchen');
      await changeNumber('Conduit diameter', 33);
      await changeText('Drawing label', 'Kitchen radial QA');
      await saved();
      const project = await model();
      expect(project.connections).toHaveLength(initialCount + 1);
      const route = project.connections.find(
        (route) => route.name === 'QA editable circuit',
      );
      routeId = route.id;
      expect(route).toMatchObject({
        fromId: 'socket-tv',
        toId: 'socket-kitchen',
        size: 33,
        label: 'Kitchen radial QA',
        enabled: true,
        waypoints: [],
      });
      const stroke = await page
        .locator(`[data-connection-id="${routeId}"]`)
        .getAttribute('stroke-width');
      expect(Number(stroke)).toBeCloseTo(33 / 700, 4);
      await expect(
        page
          .locator('svg.plan-canvas')
          .getByText('Kitchen radial QA', { exact: true }),
      ).toBeVisible();
    },
  );

  await step(
    'manual XYZ bends update the drawn polyline and Escape cancels numeric drafts',
    async () => {
      await page.getByRole('button', { name: /^Add bend/ }).click();
      await expect(field('Bend 1 X')).toBeVisible();
      await changeNumber('Bend 1 X', -2.3);
      await changeNumber('Bend 1 Y', 1.1);
      await changeNumber('Bend 1 Z', 3.8);
      await field('Conduit diameter').fill('99');
      await field('Conduit diameter').press('Escape');
      await expect(field('Conduit diameter')).toHaveValue('33.00');
      await saved();
      const route = (await model()).connections.find(
        (route) => route.id === routeId,
      );
      expect(route.waypoints[0]).toEqual([-2.3, 1.1, 3.8]);
      expect(route.size).toBe(33);
      expect(
        await page
          .locator(`[data-connection-id="${routeId}"]`)
          .getAttribute('points'),
      ).toContain('-2.3,3.8');
      await page.getByRole('button', { name: 'Units: Meters' }).click();
      await expect(field('Bend 1 X')).toHaveValue('-7.55');
      await page.getByRole('button', { name: 'Units: Feet' }).click();
      await expect(field('Bend 1 X')).toHaveValue('-2.30');
    },
  );

  await step(
    'endpoint edits move only live endpoints while bends remain fixed',
    async () => {
      await page
        .getByRole('button', {
          name: 'Inspect destination element',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('textbox', { name: 'Element name', exact: true }),
      ).toHaveValue('Kitchen appliance outlet');
      await changeNumber('X position', 5.4);
      await saved();
      expect(
        await page
          .locator(`[data-connection-id="${routeId}"]`)
          .getAttribute('points'),
      ).toContain('5.4,1.7');
      expect(
        (await model()).connections.find((route) => route.id === routeId)
          .waypoints[0],
      ).toEqual([-2.3, 1.1, 3.8]);
      await page
        .getByRole('button', { name: 'Open utility connections', exact: true })
        .click();
      await page.getByRole('button', { name: /^QA editable circuit / }).click();
    },
  );

  await step(
    'enabled state, automatic routing, system changes and deletion are reversible',
    async () => {
      const enabled = page.getByRole('checkbox', {
        name: 'Enable QA editable circuit',
        exact: true,
      });
      await enabled.uncheck();
      await expect(
        page.locator(`[data-connection-id="${routeId}"]`),
      ).toHaveCount(0);
      await enabled.check();
      await expect(
        page.locator(`[data-connection-id="${routeId}"]`),
      ).toHaveCount(1);
      await page
        .getByRole('button', { name: 'Automatic', exact: true })
        .click();
      await expect(field('Bend 1 X')).toHaveCount(0);
      await page
        .getByRole('combobox', { name: 'Connection system', exact: true })
        .selectOption('plumbing');
      await expect(field('Pipe diameter')).toHaveValue('25.00');
      await expect(
        page.locator(`[data-connection-id="${routeId}"]`),
      ).toHaveAttribute('stroke', '#559dad');
      await page
        .getByRole('button', { name: 'Delete connection', exact: true })
        .click();
      await expect(
        page.locator(`[data-connection-id="${routeId}"]`),
      ).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Undo (⌘/Ctrl Z)', exact: true })
        .click();
      await expect(
        page.locator(`[data-connection-id="${routeId}"]`),
      ).toHaveCount(1);
      await saved();
      const route = (await model()).connections.find(
        (route) => route.id === routeId,
      );
      expect(route).toMatchObject({
        system: 'plumbing',
        waypoints: [],
        size: 25,
        label: 'Kitchen radial QA',
      });
      await page.getByRole('button', { name: /^QA editable circuit / }).click();
      await page.getByRole('button', { name: /^Add bend/ }).click();
      await changeNumber('Bend 1 Y', 0.7);
      await saved();
    },
  );

  await step('edited routes survive export, reimport, and reload', async () => {
    const snapshot = await model();
    await page
      .getByRole('button', { name: 'Export project', exact: true })
      .click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Editable project/ }).click();
    const download = await downloading;
    const file = path.join(output, download.suggestedFilename());
    await download.saveAs(file);
    const exported = JSON.parse(await readFile(file, 'utf8'));
    expect(exported.connections).toEqual(snapshot.connections);
    await page
      .getByRole('button', { name: 'Delete connection', exact: true })
      .click();
    await page.getByLabel('Import project file').setInputFiles(file);
    await expect(page.getByRole('status')).toContainText(
      `Opened ${snapshot.name}`,
    );
    await saved();
    expect((await model()).connections).toEqual(snapshot.connections);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await saved();
    expect((await model()).connections).toEqual(snapshot.connections);
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
    await page
      .getByRole('button', { name: 'Open utility connections', exact: true })
      .click();
    await page.getByRole('button', { name: /^Water\s*\d*$/ }).click();
    await page.getByRole('button', { name: /^QA editable circuit / }).click();
    await expect(field('Bend 1 Y')).toHaveValue('0.70');
  });

  expect(errors).toEqual([]);
  await page.screenshot({ path: path.join(output, 'editable-routes.png') });
  console.log('PASS zero browser console or JavaScript errors');
} catch (error) {
  await page
    .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(output, 'errors.json'),
    JSON.stringify(errors, null, 2),
  );
  console.error(error);
  if (errors.length) console.error(errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
