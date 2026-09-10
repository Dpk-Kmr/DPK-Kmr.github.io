import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const key = 'ghar-naksha-project-v1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const contexts = [];
const open = async (url = base) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await expect(page.locator('svg.plan-canvas')).toBeVisible();
  return page;
};
const saved = async (page) => {
  await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
};
const rename = async (page, name) => {
  await page.locator('.project-switcher').click();
  await page
    .getByRole('textbox', { name: 'Project name', exact: true })
    .fill(name);
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await saved(page);
};
try {
  const owner = await open();
  await owner
    .getByRole('button', { name: 'Manage floors', exact: true })
    .click();
  await owner.getByRole('button', { name: 'Copy floor', exact: true }).click();
  const floorName = owner.getByRole('textbox', {
    name: 'Floor name',
    exact: true,
  });
  await floorName.fill('Upper floor');
  await floorName.press('Enter');
  await owner
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await rename(owner, 'Snapshot घर 🏠');
  const original = await saved(owner);
  expect(original.levels).toHaveLength(2);
  await owner
    .getByRole('button', { name: 'Share project', exact: true })
    .click();
  const linkField = owner.getByRole('textbox', {
    name: 'Project snapshot link',
    exact: true,
  });
  await expect(linkField).toHaveValue(/#home=gz\./);
  const link = await linkField.inputValue();
  expect(link.length).toBeLessThan(20000);
  await expect(
    owner.getByText('This app is running locally.', { exact: false }),
  ).toBeVisible();
  console.log('PASS generate compressed all-storey snapshot link');
  await owner
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await rename(owner, 'Owner changed after sharing');
  const recipient = await open(link);
  const imported = await saved(recipient);
  expect(imported).toEqual(original);
  await expect(
    recipient.getByRole('combobox', { name: 'Active floor', exact: true }),
  ).toHaveValue(original.activeLevelId);
  expect(new URL(recipient.url()).hash).toBe('');
  console.log(
    'PASS anonymous fresh-browser link restores every floor and fixed snapshot',
  );
  await rename(recipient, 'Recipient independent edits');
  await recipient.reload({ waitUntil: 'domcontentloaded' });
  expect((await saved(recipient)).name).toBe('Recipient independent edits');
  expect((await saved(owner)).name).toBe('Owner changed after sharing');
  const second = await open(link);
  expect((await saved(second)).name).toBe(original.name);
  console.log(
    'PASS recipient edits persist without modifying owner or shared snapshot',
  );
  await recipient.goto(`${base}/#home=gz.corrupted`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(recipient.locator('.toast')).toContainText(
    'could not be opened',
  );
  expect((await saved(recipient)).name).toBe('Recipient independent edits');
  console.log(
    'PASS in-page corrupted-link navigation preserves existing local design',
  );
  await recipient.goto(link, { waitUntil: 'domcontentloaded' });
  await expect(recipient.locator('.project-switcher')).toContainText(
    original.name,
  );
  expect((await saved(recipient)).name).toBe(original.name);
  console.log(
    'PASS valid snapshot opens during in-page hash navigation without a reload',
  );
  await owner
    .getByRole('button', { name: 'Share project', exact: true })
    .click();
  await owner
    .getByRole('textbox', { name: 'Website address for sharing', exact: true })
    .fill('https://homes.example/studio/');
  await expect(linkField).toHaveValue(
    /^https:\/\/homes\.example\/studio\/#home=gz\./,
  );
  await expect(
    owner.getByText('This app is running locally.', { exact: false }),
  ).toHaveCount(0);
  console.log('PASS public-host address produces portable self-contained link');
  await mkdir('test-results/sharing', { recursive: true });
  await owner.screenshot({ path: 'test-results/sharing/snapshot-dialog.png' });
  expect(errors).toEqual([]);
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
