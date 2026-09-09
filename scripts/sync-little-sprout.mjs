#!/usr/bin/env node
// Build a website copy without changing the original Expo project.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(
  process.argv[2] || path.join(site, "../little-sprout"),
);
const destination = path.join(site, "little-sprout");
const baseUrl = "/little-sprout";
assert.ok(
  fs.existsSync(path.join(source, "node_modules/expo/bin/cli")),
  "Install the original app's dependencies with npm ci before exporting.",
);
assert.notEqual(
  fs.realpathSync(source),
  path.resolve(destination),
  "The original Expo project must be separate from the published copy.",
);
for (const name of ["app.config.js", "app.config.ts"]) {
  assert.ok(
    !fs.existsSync(path.join(source, name)),
    `Review ${name} before updating the isolated export configuration.`,
  );
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "atriksha-sprout-web-"));
const exported = path.join(work, "web-export");
const oldCopy = path.join(work, "previous-website-copy");
const sourceFiles = new Map();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(filename);
    return entry.isFile() && entry.name !== ".DS_Store" ? [filename] : [];
  });
}
function remember(filename) {
  sourceFiles.set(filename, hash(fs.readFileSync(filename)));
}
function copyOriginal(relative) {
  const original = path.join(source, relative);
  if (!fs.existsSync(original)) return;
  const files = fs.statSync(original).isDirectory()
    ? filesIn(original)
    : [original];
  files.forEach(remember);
  fs.cpSync(original, path.join(work, relative), {
    recursive: true,
    mode: fs.constants.COPYFILE_FICLONE,
    filter: (filename) =>
      path.basename(filename) !== ".DS_Store" &&
      !fs.lstatSync(filename).isSymbolicLink(),
  });
}

try {
  console.log(
    "Copying app sources into a temporary build directory; original files stay intact.",
  );
  for (const relative of [
    "App.tsx",
    "index.ts",
    "package.json",
    "package-lock.json",
    "app.json",
    "tsconfig.json",
    "babel.config.js",
    "babel.config.cjs",
    "metro.config.js",
    "metro.config.cjs",
    "src",
    "assets",
  ])
    copyOriginal(relative);
  fs.cpSync(
    path.join(source, "node_modules"),
    path.join(work, "node_modules"),
    {
      recursive: true,
      verbatimSymlinks: true,
      mode: fs.constants.COPYFILE_FICLONE,
    },
  );

  const configFile = path.join(work, "app.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  config.expo.experiments = { ...config.expo.experiments, baseUrl };
  config.expo.web = {
    ...config.expo.web,
    output: "single",
    description:
      "100 playful learning activities for ages 3 and up, with cartoon teachers and instructions in six languages.",
  };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Exporting the production web app for ${baseUrl}/…`);
  const build = spawnSync(
    process.execPath,
    [
      path.join(work, "node_modules/expo/bin/cli"),
      "export",
      "--platform",
      "web",
      "--output-dir",
      exported,
      "--max-workers",
      "2",
    ],
    {
      cwd: work,
      env: {
        ...process.env,
        CI: "1",
        NODE_ENV: "production",
        EXPO_NO_TELEMETRY: "1",
      },
      stdio: "inherit",
    },
  );
  if (build.error) throw build.error;
  assert.equal(
    build.status,
    0,
    "Expo web export failed; existing website copy was preserved.",
  );

  const expectedAudio = [...sourceFiles.keys()].filter((filename) =>
    filename.endsWith(".m4a"),
  );
  const expectedHashes = new Set(
    expectedAudio.map((filename) => sourceFiles.get(filename)),
  );
  const publishedAudio = filesIn(exported).filter((filename) =>
    filename.endsWith(".m4a"),
  );
  const publishedHashes = new Set(
    publishedAudio.map((filename) => hash(fs.readFileSync(filename))),
  );
  assert.ok(expectedAudio.length > 0, "No source audio was found.");
  assert.deepEqual(
    publishedHashes,
    expectedHashes,
    "Published audio must match every source recording.",
  );

  const indexFile = path.join(exported, "index.html");
  let html = fs.readFileSync(indexFile, "utf8");
  assert.ok(
    html.includes(`${baseUrl}/_expo/`),
    "Script URLs must use the website subdirectory.",
  );
  assert.ok(
    html.includes(`${baseUrl}/favicon.ico`),
    "Favicon URL must use the website subdirectory.",
  );
  html = html.replace(
    "</head>",
    `<style id="atriksha-web-shell">
    body{display:flex;flex-direction:column;background:#fffcf5}
    #root{height:auto;min-height:0;flex:1}
    .sprout-site-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;padding:10px max(14px,env(safe-area-inset-right)) 10px max(14px,env(safe-area-inset-left));border-bottom:1px solid #dce8df;color:#244a3d;font:600 13px/1.4 system-ui,sans-serif}
    .sprout-site-nav a{color:inherit;text-decoration:underline;text-underline-offset:3px;padding:3px 0}
    .sprout-site-nav a:focus-visible{outline:3px solid #187e70;outline-offset:3px;border-radius:2px}
    @media(max-width:360px){.sprout-site-nav span{font-size:11px}}
  </style></head>`,
  );
  html = html.replace(
    /<body>/,
    `<body>\n<nav class="sprout-site-nav" aria-label="Atriksha"><a href="../pages/learn.html">← Learn &amp; play</a><a href="./credits.html">Credits</a></nav>`,
  );
  fs.writeFileSync(indexFile, html);
  for (const notice of [
    "Nunito-OFL.txt",
    "Expo-Vector-Icons.txt",
    "narration/Apache-2.0.txt",
    "narration/SILMA-MIT.txt",
    "narration/Vocos-MIT.txt",
  ]) {
    const target = path.join(exported, "licenses", notice);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, "assets/licenses", notice), target);
  }
  fs.copyFileSync(
    path.join(site, "docs/little-sprout-licenses/Feather-MIT.txt"),
    path.join(exported, "licenses/Feather-MIT.txt"),
  );
  fs.copyFileSync(
    path.join(site, "docs/little-sprout-credits.html"),
    path.join(exported, "credits.html"),
  );
  const dependencies = path.join(work, "node_modules");
  const notices = filesIn(dependencies).filter((filename) =>
    /^(?:LICEN[CS]E|COPYING|NOTICE)(?:[._-][\w.-]+)?$/i.test(
      path.basename(filename),
    ),
  );
  fs.writeFileSync(
    path.join(exported, "licenses/runtime-notices.txt"),
    [
      "Little Sprout — dependency license notices",
      "Includes notices supplied with build dependencies as well as browser runtime libraries.",
      ...notices
        .sort()
        .map(
          (filename) =>
            `\n--- ${path.relative(dependencies, filename)} ---\n${fs.readFileSync(filename, "utf8")}`,
        ),
    ].join("\n"),
  );

  // Do not expose development output, signing files, source maps or app-store binaries.
  for (const filename of filesIn(exported)) {
    assert.ok(
      !/\.(?:map|apk|aab|ipa|p12|p8|jks|keystore|key)$/i.test(filename),
      "Unexpected private/development artifact.",
    );
    assert.ok(
      fs.statSync(filename).size < 100 * 1024 * 1024,
      "A published file exceeds GitHub's file-size limit.",
    );
  }
  for (const [filename, originalHash] of sourceFiles) {
    assert.equal(
      hash(fs.readFileSync(filename)),
      originalHash,
      `Original source changed: ${path.relative(source, filename)}`,
    );
  }
  const packageInfo = JSON.parse(
    fs.readFileSync(path.join(work, "package.json"), "utf8"),
  );
  const publishedFiles = filesIn(exported);
  const report = {
    name: config.expo.name,
    version: config.expo.version,
    expo: packageInfo.dependencies.expo,
    baseUrl: `${baseUrl}/`,
    generatedAt: new Date().toISOString(),
    sourcePreserved: true,
    sourceAudioFiles: expectedAudio.length,
    publishedAudioFiles: publishedAudio.length,
    distinctAudioHashes: publishedHashes.size,
    files: publishedFiles.length + 1,
    bytes: publishedFiles.reduce(
      (total, filename) => total + fs.statSync(filename).size,
      0,
    ),
  };
  fs.writeFileSync(
    path.join(exported, "web-build.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  // Replace only this app's generated website copy, with rollback on copy failure.
  if (fs.existsSync(destination)) {
    assert.ok(
      !fs.lstatSync(destination).isSymbolicLink(),
      "Refusing to replace a symlink.",
    );
    assert.ok(
      fs.existsSync(path.join(destination, "web-build.json")),
      "Existing destination is not a managed web export; preserve and inspect it first.",
    );
    fs.renameSync(destination, oldCopy);
  }
  try {
    fs.cpSync(exported, destination, { recursive: true });
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    if (fs.existsSync(oldCopy)) fs.renameSync(oldCopy, destination);
    throw error;
  }
  fs.closeSync(fs.openSync(path.join(site, ".nojekyll"), "a"));
  console.log(`Copied ${report.files} static files into ${destination}.`);
  console.log(
    `Verified all ${report.sourceAudioFiles} audio files and unchanged original app sources.`,
  );
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
