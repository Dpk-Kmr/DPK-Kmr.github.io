import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const button = (name) => page.getByRole('button', { name, exact: true });
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  await mkdir('test-results/mobile-building', { recursive: true });
  await page.screenshot({ path: 'test-results/mobile-building/editor.png' });
  await button('Manage floors').tap();
  await button('Add floor').tap();
  await button('Close dialog').tap();
  await expect(
    page.getByLabel('Active floor', { exact: true }),
  ).not.toHaveValue('ground-floor');
  console.log('PASS phone adds and switches storeys with finger controls');
  await button('Share project').tap();
  await expect(page.getByLabel('Project snapshot link')).toHaveValue(/#home=/);
  await page.screenshot({ path: 'test-results/mobile-building/sharing.png' });
  await button('Close dialog').tap();
  console.log('PASS phone generates and displays snapshot link');
  await page.locator('.layers-button').tap();
  await button('Walls & openings').tap();
  await button('Furniture & decor').tap();
  await page.locator('.layers-button').tap();
  await button('Walkthrough').tap();
  await expect(page.locator('.scene-container canvas')).toBeVisible({
    timeout: 30000,
  });
  const person = page.getByRole('complementary', {
    name: 'Walkthrough person',
  });
  await expect(person).toBeVisible({ timeout: 30000 });
  await page.getByLabel('Person height').fill('1.83');
  await page.getByLabel('Person height').press('Enter');
  await expect(person).toHaveAttribute('data-walk-height', '1.83');
  await page.getByLabel('Walkthrough camera').selectOption('front');
  await expect(person).toHaveAttribute('data-walk-camera', 'front');
  for (const label of ['Person height', 'Walkthrough camera', 'Walk forward']) {
    const rect = await page.getByLabel(label, { exact: true }).boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(391);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: 'test-results/mobile-building/walkthrough.png',
  });
  console.log(
    'PASS phone person height, camera and movement controls fit the viewport',
  );
  await button('Floor plan').tap();
  await page.locator('.layers-button').tap();
  await expect(button('Walls & openings').locator('.checkbox')).toHaveClass(
    /checked/,
  );
  await expect(button('Furniture & decor').locator('.checkbox')).toHaveClass(
    /checked/,
  );
  console.log(
    'PASS entering walkthrough restores visible wall and furniture layers',
  );
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
