// Run against the checked-in static website, locally or on GitHub Pages.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(site, 'Ghar_Naksha');
const require = createRequire(path.join(source, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = new URL(process.env.SITE_TEST_URL || 'http://127.0.0.1:4173')
  .origin;
const output = path.join(source, 'test-results/website');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [],
  requests = [],
  external = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.protocol.startsWith('http')) {
    requests.push(url.pathname);
    if (url.origin !== origin) {
      external.push(url.href);
      return route.abort();
    }
  }
  return route.continue();
});
try {
  for (const entry of ['products', 'learn']) {
    await page.goto(`${origin}/pages/${entry}.html`, {
      waitUntil: 'networkidle',
    });
    const card = page.locator('#ghar-naksha');
    await expect(
      card.getByRole('link', { name: /Open Ghar Naksha/ }),
    ).toHaveAttribute('href', '../ghar-naksha/');
    if (entry === 'learn') {
      await expect(
        page
          .locator('#little-sprout')
          .getByRole('link', { name: /Play Little Sprout/ }),
      ).toBeVisible();
      await expect(page.locator('[data-game-grid] > *').first()).toBeVisible();
    }
  }
  assert.ok(
    !requests.some((url) => url.startsWith('/ghar-naksha/')),
    'App must load only after launch.',
  );
  await page
    .locator('#ghar-naksha')
    .getByRole('link', { name: /Open Ghar Naksha/ })
    .click();
  await expect(page).toHaveURL(`${origin}/ghar-naksha/`);
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  assert.ok(
    requests.some((url) => /^\/ghar-naksha\/fonts\/.+\.ttf$/.test(url)),
    'Local app fonts should use the subpath.',
  );
  assert.ok(
    !requests.some((url) => /\/assets\/Scene-.*\.js$/.test(url)),
    '3D must remain lazy-loaded.',
  );
  await expect(
    page.getByRole('link', { name: 'Ghar Naksha home', exact: true }),
  ).toHaveAttribute('href', '/ghar-naksha/');
  await expect(
    page.getByRole('link', { name: 'Back to Atriksha products' }),
  ).toHaveAttribute('href', '../pages/products.html');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `App overflows at ${width}px.`,
    );
    for (const name of ['Ghar Naksha home', 'Back to Atriksha products']) {
      const box = await page
        .getByRole('link', { name, exact: true })
        .boundingBox();
      assert.ok(
        box && box.x >= 0 && box.x + box.width <= width,
        `${name} outside ${width}px header.`,
      );
    }
    for (const name of ['Share project', 'Export project']) {
      const box = await page
        .getByRole('button', { name, exact: true })
        .boundingBox();
      assert.ok(
        box && box.x >= 0 && box.x + box.width <= width,
        `${name} outside ${width}px header.`,
      );
    }
  }
  await page.screenshot({ path: path.join(output, 'mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '3D view', exact: true }).click();
  await expect(page.locator('.scene-container canvas')).toBeVisible({
    timeout: 30000,
  });
  assert.ok(
    requests.some((url) => /\/ghar-naksha\/assets\/Scene-.*\.js$/.test(url)),
    '3D chunk needs the app subpath.',
  );
  await page.screenshot({ path: path.join(output, 'desktop-3d.png') });
  await page
    .getByRole('link', { name: 'Ghar Naksha home', exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/ghar-naksha/`);
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Atriksha products' }).click();
  await expect(page).toHaveURL(`${origin}/pages/products.html`);
  await page
    .locator('#ghar-naksha')
    .getByRole('link', { name: /Open Ghar Naksha/ })
    .click();
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  assert.deepEqual(errors, [], 'No missing assets or page errors.');
  assert.deepEqual(
    external,
    [],
    'No external requests needed by the site or app.',
  );
  console.log(
    'PASS Products/Learn launches, Little Sprout/arcade entries, subpath fonts and lazy 3D, 320–1440px app navigation, return/reopen, no missing or external requests.',
  );
} finally {
  await browser.close();
}
