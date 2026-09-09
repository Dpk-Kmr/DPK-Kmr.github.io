// Run with the static website at http://127.0.0.1:4184.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(
  process.env.SPROUT_SOURCE || path.join(site, "../little-sprout"),
);
const require = createRequire(path.join(source, "package.json"));
const { chromium, expect } = require("@playwright/test");
const origin = process.env.SITE_TEST_URL || "http://127.0.0.1:4184";
const artifacts = path.join(source, "artifacts/website-sync");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [],
  external = [],
  responses = [],
  playedLanguages = [];
const key = "@little-sprout/local-data-v1";
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  responses.push({ url: response.url(), status: response.status() });
  if (response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (
    url.protocol.startsWith("http") &&
    url.origin !== new URL(origin).origin
  ) {
    external.push(url.href);
    return route.abort();
  }
  return route.continue();
});
await context.addInitScript(() => {
  const NativeAudio = window.Audio;
  window.__siteMedia = [];
  window.Audio = function (...args) {
    const audio = new NativeAudio(...args);
    audio.addEventListener("timeupdate", () => {
      if (audio.currentTime > 0.1 && !audio.paused) {
        window.__siteMedia.push({
          src: audio.currentSrc,
          time: audio.currentTime,
        });
      }
    });
    return audio;
  };
  window.Audio.prototype = NativeAudio.prototype;
});
const noOverflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
const readData = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
try {
  await mkdir(artifacts, { recursive: true });
  await page.goto(`${origin}/pages/learn.html`, { waitUntil: "networkidle" });
  const entry = page.locator("#little-sprout");
  await expect(
    entry.getByRole("heading", { name: "Meet Little Sprout." }),
  ).toBeVisible();
  await expect(page.locator("[data-game-grid] > *").first()).toBeVisible();
  assert.ok(
    !responses.some((response) =>
      new URL(response.url).pathname.startsWith("/little-sprout/"),
    ),
    "Learn & play must not preload the app or its media.",
  );
  for (const theme of ["midnight", "paper", "mist", "sand"]) {
    await page.locator("[data-theme-toggle]").click();
    await page.locator(`[data-theme-option="${theme}"]`).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    assert.ok(await noOverflow());
  }
  await entry.screenshot({
    path: path.join(artifacts, "learn-sprout-desktop.png"),
  });
  await page.setViewportSize({ width: 320, height: 780 });
  await entry.scrollIntoViewIfNeeded();
  assert.ok(await noOverflow(), "Learn & play overflows at 320px.");
  await entry.screenshot({
    path: path.join(artifacts, "learn-sprout-mobile.png"),
  });
  await entry.getByRole("link", { name: /Play Little Sprout/ }).click();
  await expect(page).toHaveURL(`${origin}/little-sprout/`);
  await expect(
    page.getByText("Let curiosity lead the way.", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Atriksha", exact: true })
      .getByRole("link", { name: /Learn & play/ }),
  ).toHaveAttribute("href", "../pages/learn.html");
  assert.ok(await noOverflow(), "The web app overflows at 320px.");
  await page.screenshot({ path: path.join(artifacts, "web-app-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page
    .getByRole("button", { name: /^Choose your teacher, currently / })
    .click();
  await page.getByRole("radio", { name: "Choose Pihu", exact: true }).click();
  const chooser = page.locator('[data-teacher-chooser="true"]');
  const languages = [
    ["en", "English"],
    ["hi", "Hindi"],
    ["ar", "Arabic"],
    ["es", "Spanish"],
    ["zh", "Mandarin Chinese"],
    ["ja", "Japanese"],
  ];
  for (const [language, name] of languages) {
    const target = chooser.getByRole("checkbox", { name, exact: true });
    if ((await target.getAttribute("aria-checked")) !== "true")
      await target.click();
    for (const [other, otherName] of languages) {
      const checkbox = chooser.getByRole("checkbox", {
        name: otherName,
        exact: true,
      });
      if (
        other !== language &&
        (await checkbox.getAttribute("aria-checked")) === "true"
      )
        await checkbox.click();
    }
    await page.evaluate(() => {
      window.__siteMedia = [];
    });
    await chooser
      .getByRole("button", { name: "Hear Pihu's voice", exact: true })
      .click();
    await expect(chooser).toHaveAttribute("data-preview-language", language);
    await page.waitForFunction(
      (language) =>
        window.__siteMedia.some(
          (event) =>
            new URL(event.src).pathname.startsWith("/little-sprout/") &&
            event.src.includes("/narration/") &&
            new RegExp(`/(?:female-|male-)?${language}-`).test(event.src),
        ),
      language,
    );
    await expect(chooser).toHaveAttribute("data-preview-error", "false");
    playedLanguages.push(language);
    const stop = chooser.getByRole("button", {
      name: "Stop teacher preview",
      exact: true,
    });
    if (await stop.isVisible()) await stop.click();
  }
  await chooser.getByRole("checkbox", { name: "English", exact: true }).click();
  await chooser
    .getByRole("button", { name: "Let's play with Pihu", exact: true })
    .click();
  await expect
    .poll(async () => (await readData())?.preferences.languages)
    .toEqual(["ja", "en"]);
  await page.getByRole("button", { name: "All games", exact: true }).click();
  const cards = page.getByRole("button", { name: /^Play .+, ages .+, / });
  const more = page.getByRole("button", { name: /More little adventures/ });
  while (await more.isVisible()) await more.click();
  await expect(cards).toHaveCount(100);
  await page
    .getByRole("button", { name: "Games for age 4", exact: true })
    .click();
  await expect(cards).toHaveCount(20);
  await page.getByRole("textbox", { name: "Search games" }).fill("Teddy Twins");
  await expect(cards).toHaveCount(1);
  await page
    .getByRole("button", { name: "Save Teddy Twins to favorites", exact: true })
    .click();
  await expect.poll(async () => (await readData())?.favorites.length).toBe(1);
  const saved = await readData();
  await page
    .getByRole("navigation", { name: "Atriksha", exact: true })
    .getByRole("link", { name: /Learn & play/ })
    .click();
  await expect(page).toHaveURL(`${origin}/pages/learn.html`);
  await page
    .locator("#little-sprout")
    .getByRole("link", { name: /Play Little Sprout/ })
    .click();
  await expect(
    page.getByText("Let curiosity lead the way.", { exact: true }),
  ).toBeVisible();
  assert.deepEqual(
    (await readData()).preferences.languages,
    saved.preferences.languages,
  );
  assert.equal(
    (await readData()).preferences.teacherId,
    saved.preferences.teacherId,
  );
  assert.deepEqual((await readData()).favorites, saved.favorites);
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.getByText("Let curiosity lead the way.", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await readData()).favorites, saved.favorites);
  await page.screenshot({ path: path.join(artifacts, "web-app-desktop.png") });
  await page
    .getByRole("navigation", { name: "Atriksha", exact: true })
    .getByRole("link", { name: "Credits" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const href of await page
    .locator('a[href*="licenses/"]')
    .evaluateAll((links) => links.map((link) => link.href))) {
    assert.equal((await page.request.get(href)).status(), 200, href);
  }
  assert.deepEqual(
    external,
    [],
    "The site must not fetch a remote app backend or media.",
  );
  assert.deepEqual(
    errors,
    [],
    "The static website must load without missing resources or JavaScript errors.",
  );
  assert.ok(
    responses.some((response) =>
      response.url.includes("/little-sprout/_expo/"),
    ),
  );
  assert.ok(responses.some((response) => /\.ttf(?:$|\?)/.test(response.url)));
  assert.ok(
    !responses.some((response) =>
      /^\/(?:_expo|assets)\//.test(new URL(response.url).pathname),
    ),
    "App resources escaped the /little-sprout/ subdirectory.",
  );
  await writeFile(
    path.join(artifacts, "browser-report.json"),
    JSON.stringify(
      {
        status: "passed",
        staticOrigin: origin,
        catalogueEntries: 100,
        spokenLanguagesPlayed: playedLanguages,
        browserProgressPreserved: true,
        widths: [320, 1280, 1440],
        themes: ["midnight", "paper", "mist", "sand"],
        externalRequests: external.length,
        resourceOrScriptErrors: errors.length,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: Learn & play launch/back links, static app assets, 100 activities, six real teacher voices, responsive layouts, theme entry styles, saved preferences/favorites, and credits.",
  );
} finally {
  await browser.close();
}
