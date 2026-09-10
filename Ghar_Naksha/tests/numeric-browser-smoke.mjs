import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Real Chrome regression: native constraint validation and committed model values.
// Run against npm run dev with: node tests/numeric-browser-smoke.mjs
const url = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const output = path.resolve('test-results/numeric-browser-smoke');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1512, height: 1080 },
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const storageKey = 'ghar-naksha-project-v1';
const project = (target = page) =>
  target.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const saved = (target = page) =>
  expect(target.locator('.save-indicator')).toHaveText('All changes saved');
const field = (label, scope = page) =>
  scope.getByRole('spinbutton', { name: label, exact: true });
const validity = async (scope) => {
  const invalid = await scope
    .locator('input[type="number"]:not(:disabled)')
    .evaluateAll((inputs) =>
      inputs
        .filter((input) => !input.validity.valid)
        .map((input) => ({
          label: input.getAttribute('aria-label'),
          value: input.value,
          min: input.min,
          step: input.step,
          message: input.validationMessage,
          stepMismatch: input.validity.stepMismatch,
        })),
    );
  expect(invalid).toEqual([]);
};
const edit = async (label, value, scope = page, method = 'enter') => {
  const input = field(label, scope);
  await input.fill(String(value));
  expect(await input.evaluate((node) => node.validity.stepMismatch)).toBe(
    false,
  );
  if (method === 'enter') await input.press('Enter');
  else await input.press('Tab');
};
const step = async (name, action) => {
  await action();
  console.log(`PASS ${name}`);
};
const useUnits = async (units, target = page) => {
  const opposite = target.getByRole('button', {
    name: units === 'ft' ? 'Units: Meters' : 'Units: Feet',
  });
  if (await opposite.count()) await opposite.click();
  await expect(
    target.getByRole('button', {
      name: units === 'ft' ? 'Units: Feet' : 'Units: Meters',
    }),
  ).toBeVisible();
};

try {
  await page.goto(url);
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  await step(
    'feet 29.00 and arbitrary decimal floor sides pass native form validation',
    async () => {
      await page
        .getByRole('button', { name: 'Create new project', exact: true })
        .click();
      const form = page.locator('form.floor-new-form');
      await form
        .getByLabel('Project name', { exact: true })
        .fill('Decimal input regression');
      await page
        .getByLabel('New project units', { exact: true })
        .selectOption('ft');
      await validity(form);
      await edit('Side A–B', '29.00', form);
      await expect(form).toBeVisible(); // Enter commits; it does not submit a stale form.
      await expect(field('Side C–D', form)).toHaveValue('29.00');
      await edit('Wall height', '8.743', form, 'blur');
      await edit('Wall thickness', '0.164042', form);
      await validity(form);
      await field('Side B–C', form).fill('31.017');
      expect(await form.evaluate((node) => node.checkValidity())).toBe(true);
      await form
        .getByRole('button', { name: 'Create floor plan', exact: true })
        .click();
      await expect(form).toHaveCount(0);
      await saved();
      const result = await project();
      const xs = result.floorPlan.outline.map((p) => p[0]),
        zs = result.floorPlan.outline.map((p) => p[1]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(29 / 3.28084, 5);
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(
        31.017 / 3.28084,
        5,
      );
      expect(result.floorPlan.wallThickness).toBeCloseTo(0.05, 6);
    },
  );
  await step(
    'custom floor corners commit decimal coordinates and preserve values on untouched blur',
    async () => {
      await useUnits('ft');
      const inspector = page.locator('.floor-inspector');
      await inspector
        .getByRole('button', { name: 'Edit corner coordinates', exact: true })
        .click();
      await edit('Corner A X', '-14.417', inspector);
      await field('Corner A Z', inspector).fill('-15.417');
      await validity(inspector);
      await inspector
        .getByRole('button', { name: 'Apply floor changes', exact: true })
        .click();
      await saved();
      expect((await project()).floorPlan.outline[0][0] * 3.28084).toBeCloseTo(
        -14.417,
        5,
      );
      expect((await project()).floorPlan.outline[0][1] * 3.28084).toBeCloseTo(
        -15.417,
        5,
      );
      const before = (await project()).floorPlan;
      await field('Side A–B', inspector).focus();
      await field('Side A–B', inspector).press('Tab');
      await inspector
        .getByRole('button', {
          name: /^(Apply floor changes|Floor plan updated)$/,
        })
        .click();
      await saved();
      expect((await project()).floorPlan).toEqual(before);
    },
  );
  await step(
    'room form accepts decimal feet, commits last focused input on submit, and validates all coordinates',
    async () => {
      await useUnits('ft');
      await page
        .getByRole('button', {
          name: 'Add a room inside this floor',
          exact: true,
        })
        .click();
      const form = page.locator('form.new-room-form');
      await form.getByLabel('Room name', { exact: true }).fill('Decimal room');
      await edit('Room width', '9.137', form);
      await edit('Room depth', '11.283', form, 'blur');
      await form
        .getByLabel('Room placement mode', { exact: true })
        .selectOption('manual');
      await edit('Room X position', '.123', form);
      await field('Room Z position', form).fill('-.237');
      await validity(form);
      await form.getByRole('button', { name: 'Add room', exact: true }).click();
      await expect(form).toHaveCount(0);
      await saved();
      const room = (await project()).rooms.find(
        (room) => room.name === 'Decimal room',
      );
      expect(room.width * 3.28084).toBeCloseTo(9.137, 4);
      expect(room.depth * 3.28084).toBeCloseTo(11.283, 4);
      expect(room.center[0] * 3.28084).toBeCloseTo(0.123, 4);
      expect(room.center[1] * 3.28084).toBeCloseTo(-0.237, 4);
      await validity(page.locator('.inspector'));
    },
  );
  await step(
    'rejected ranges and geometry edits never masquerade as saved values; Escape restores the model',
    async () => {
      const before = (await project()).rooms.find(
        (room) => room.name === 'Decimal room',
      );
      const input = field('Room width');
      const display = await input.inputValue();
      await input.fill('9999');
      await input.press('Enter');
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert')).toContainText('Enter a value from');
      expect(
        (await project()).rooms.find((room) => room.id === before.id).width,
      ).toBe(before.width);
      await input.press('Escape');
      await expect(input).toHaveValue(display);
      expect(await input.evaluate((node) => node.validity.valid)).toBe(true);
      await input.fill('150');
      await input.press('Enter');
      await saved();
      expect(
        (await project()).rooms.find((room) => room.id === before.id).width,
      ).toBe(before.width);
      await expect(input).toHaveValue(display);
      await expect(page.locator('.numeric-field-error')).toContainText(
        'not applied',
      );
      await input.focus();
      await input.press('Escape');
    },
  );
  await step(
    'generic element dimensions preserve decimals in metres and feet with undo and no-op blur',
    async () => {
      await useUnits('ft');
      await page
        .getByRole('button', { name: 'Open element library', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Search element library' })
        .fill('Linen sofa');
      await page.getByTitle('Add Linen sofa', { exact: true }).click();
      await page.getByRole('button', { name: 'Units: Feet' }).click();
      await edit('Width', '2.137');
      await saved();
      let element = (await project()).elements
        .filter((e) => e.kind === 'sofa')
        .at(-1);
      expect(element.dimensions.width).toBeCloseTo(2.137, 7);
      await expect(field('Width')).toHaveValue('2.137');
      await field('Width').fill('2.731');
      await field('Width').press('Escape');
      await expect(field('Width')).toHaveValue('2.137');
      await page.getByRole('button', { name: 'Units: Meters' }).click();
      const stored = element.dimensions.width;
      await field('Width').focus();
      await field('Width').press('Tab');
      await saved();
      expect(
        (await project()).elements.find((e) => e.id === element.id).dimensions
          .width,
      ).toBe(stored);
      await edit('Width', '7.237');
      await saved();
      element = (await project()).elements.find((e) => e.id === element.id);
      expect(element.dimensions.width * 3.28084).toBeCloseTo(7.237, 4);
      await validity(page.locator('.inspector'));
      await page.getByTitle('Undo', { exact: true }).click();
      await saved();
      expect(
        (await project()).elements.find((e) => e.id === element.id).dimensions
          .width,
      ).toBe(stored);
    },
  );
  await step(
    'all staircase dimensions and helpers are native-valid in feet and metres',
    async () => {
      await useUnits('ft');
      await page
        .getByRole('button', { name: 'Open element library', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Search element library' })
        .fill('Spiral');
      await page.getByTitle('Add Spiral stair', { exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Stair design', exact: true }),
      ).toHaveClass(/active/);
      await validity(page.locator('.stair-inspector'));
      await edit('Stair footprint width', '8.317');
      await edit('Stair footprint depth', '8.119');
      await edit('Floor-to-floor rise', '9.137');
      await edit('Flight width', '2.917');
      await edit('Inner radius', '.437');
      await edit('Tread thickness', '.137');
      await edit('Nosing', '.071');
      await edit('Railing height', '3.137');
      await edit('Spiral turns', '.817');
      await edit('Target riser', '.571');
      await saved();
      await validity(page.locator('.stair-inspector'));
      const stair = (await project()).elements
        .filter((e) => e.kind === 'stairs')
        .at(-1);
      expect(stair.stairs.spiralTurns).toBe(0.817);
      expect(stair.dimensions.width * 3.280839895).toBeCloseTo(8.317, 6);
      const count = field('Step count');
      await count.fill('16.5');
      await count.press('Enter');
      await expect(count).toHaveAttribute('aria-invalid', 'true');
      expect(
        (await project()).elements.find((e) => e.id === stair.id).stairs.steps,
      ).toBe(16);
      await count.press('Escape');
      await expect(count).toHaveValue('16');
      await page.getByRole('button', { name: 'Units: Feet' }).click();
      await validity(page.locator('.stair-inspector'));
      await edit('Tread thickness', '.037');
      await edit('Target riser', '.175');
      await validity(page.locator('.stair-inspector'));
    },
  );
  await step(
    'stair-specific fields accept every valid dimension from generic Properties',
    async () => {
      await useUnits('m');
      const prior = (await project()).elements
        .filter((e) => e.kind === 'stairs')
        .at(-1).dimensions;
      await page
        .getByRole('button', { name: 'Properties', exact: true })
        .click();
      await edit('Width', '.02');
      await edit('Depth', '42.137');
      await edit('Floor rise', '24.017');
      await saved();
      await page
        .getByRole('button', { name: 'Stair design', exact: true })
        .click();
      await expect(field('Stair footprint width')).toHaveValue('0.020');
      await expect(field('Stair footprint depth')).toHaveValue('42.137');
      await expect(field('Floor-to-floor rise')).toHaveValue('24.017');
      await validity(page.locator('.stair-inspector'));
      await edit('Stair footprint width', prior.width);
      await edit('Stair footprint depth', prior.depth);
      await edit('Floor-to-floor rise', prior.height);
      await saved();
      await validity(page.locator('.stair-inspector'));
    },
  );
  await page.screenshot({
    path: path.join(output, 'stair-numeric-controls.png'),
  });
  await step(
    'utility diameter and route coordinates accept decimals across unit systems',
    async () => {
      const utilityContext = await browser.newContext({
        viewport: { width: 1512, height: 1080 },
      });
      const utility = await utilityContext.newPage();
      utility.setDefaultTimeout(15_000);
      utility.on('pageerror', (error) => errors.push(error.message));
      await utility.goto(url);
      await utility
        .getByRole('button', { name: 'Open utility connections', exact: true })
        .click();
      await utility
        .getByRole('button', { name: 'Add electrical connection', exact: true })
        .click();
      await edit('Conduit diameter', '20.5', utility);
      await saved(utility);
      await utility.getByRole('button', { name: /^Add bend/ }).click();
      await edit('Bend 1 X', '-2.137', utility);
      await edit('Bend 1 Y', '.173', utility);
      await edit('Bend 1 Z', '3.217', utility);
      await validity(utility.locator('.connections-editor'));
      await utility.getByRole('button', { name: 'Units: Meters' }).click();
      await validity(utility.locator('.connections-editor'));
      await edit('Bend 1 X', '2.137', utility);
      await edit('Bend 1 Y', '1.237', utility);
      await edit('Bend 1 Z', '-3.117', utility);
      await saved(utility);
      const route = (await project(utility)).connections.at(-1);
      expect(route.size).toBe(20.5);
      expect(route.waypoints[0][0] * 3.28084).toBeCloseTo(2.137, 6);
      expect(route.waypoints[0][1] * 3.28084).toBeCloseTo(1.237, 6);
      expect(route.waypoints[0][2] * 3.28084).toBeCloseTo(-3.117, 6);
      const input = field('Bend 1 Y', utility);
      await edit('Bend 1 Y', '-2', utility);
      await saved(utility);
      expect(
        (await project(utility)).connections.at(-1).waypoints[0][1] * 3.28084,
      ).toBeCloseTo(-2, 6);
      const prior = await input.inputValue();
      await input.fill('-999');
      await input.press('Enter');
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await input.press('Escape');
      await expect(input).toHaveValue(prior);
      await validity(utility.locator('.connections-editor'));
      await utility.screenshot({
        path: path.join(output, 'utility-numeric-controls.png'),
      });
      await utility
        .getByRole('button', { name: 'Add electrical connection', exact: true })
        .click();
      await saved(utility);
      const firstFreshRoute = (await project(utility)).connections.at(-1);
      await utility
        .getByRole('button', { name: 'Add electrical connection', exact: true })
        .click();
      await saved(utility);
      const diameter = field('Conduit diameter', utility);
      await diameter.fill('999');
      await diameter.press('Enter');
      await expect(diameter).toHaveAttribute('aria-invalid', 'true');
      await utility
        .locator('.connection-row-main')
        .filter({
          has: utility.getByText(firstFreshRoute.name, { exact: true }),
        })
        .click();
      await expect(diameter).toHaveValue('20.00');
      await expect(diameter).not.toHaveAttribute('aria-invalid', 'true');
      await validity(utility.locator('.connections-editor'));
      expect(
        (await project(utility)).connections.find(
          (connection) => connection.id === firstFreshRoute.id,
        ).size,
      ).toBe(20);
      console.log(
        'PASS switching routes with identical numeric values clears invalid draft state',
      );
      await utilityContext.close();
    },
  );
  expect(errors).toEqual([]);
  console.log(
    'All numeric browser regressions passed with no JavaScript errors.',
  );
} catch (error) {
  console.error(error);
  await page
    .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(output, 'errors.json'),
    JSON.stringify(errors, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
