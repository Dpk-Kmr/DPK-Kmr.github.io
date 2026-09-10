#!/usr/bin/env node
// Publish a static build while keeping the complete source project in this repo.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(site, 'Ghar_Naksha');
const output = path.join(site, 'ghar-naksha');
const dist = path.join(project, 'dist');
const base = '/ghar-naksha/';
assert.ok(
  fs.existsSync(path.join(project, 'node_modules/vite/bin/vite.js')),
  'Run npm ci in Ghar_Naksha before building the website copy.',
);
if (fs.existsSync(output)) {
  assert.ok(
    !fs.lstatSync(output).isSymbolicLink(),
    'Output must not be a symlink.',
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(output, 'web-build.json'), 'utf8'))
      .name,
    'ghar-naksha-studio',
    'Refusing to replace an unrecognized output directory.',
  );
}
const run = spawnSync('npm', ['run', 'build', '--', `--base=${base}`], {
  cwd: project,
  env: { ...process.env, CI: '1' },
  stdio: 'inherit',
});
if (run.error) throw run.error;
assert.equal(
  run.status,
  0,
  'Production build failed; previous website copy was preserved.',
);
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
assert.ok(
  html.includes(`${base}assets/`),
  'Production scripts need the /ghar-naksha/ base path.',
);
assert.ok(
  html.includes(`${base}favicon.svg`),
  'Production favicon needs the app base path.',
);
assert.ok(
  !html.includes('/src/main.tsx'),
  'Cannot publish the development entry point.',
);

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : [];
  });
}
const dependencies = path.join(project, 'node_modules');
const notices = filesIn(dependencies).filter((file) =>
  /^(?:LICEN[CS]E|NOTICE|COPYING)(?:[._-][\w.-]+)?$/i.test(path.basename(file)),
);
fs.writeFileSync(
  path.join(dist, 'software-licenses.txt'),
  [
    'Ghar Naksha — dependency license notices',
    'Includes supplied development-tool notices as well as browser runtime library notices.',
    ...notices
      .sort()
      .map(
        (file) =>
          `\n--- ${path.relative(dependencies, file)} ---\n${fs.readFileSync(file, 'utf8')}`,
      ),
  ].join('\n'),
);
const packageInfo = JSON.parse(
  fs.readFileSync(path.join(project, 'package.json'), 'utf8'),
);
const files = filesIn(dist).filter(
  (file) => path.basename(file) !== 'web-build.json',
);
const inventory = files.map((file) => {
  const bytes = fs.readFileSync(file);
  assert.ok(
    !/\.(?:map|pem|key|p12|p8)$/i.test(file),
    'Private files or source maps must not be published.',
  );
  return {
    path: path.relative(dist, file).split(path.sep).join('/'),
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
});
fs.writeFileSync(
  path.join(dist, 'web-build.json'),
  `${JSON.stringify(
    {
      name: packageInfo.name,
      version: packageInfo.version,
      base,
      generatedAt: new Date().toISOString(),
      source: 'Ghar_Naksha/',
      backendRequired: false,
      files: inventory,
      totalBytes: inventory.reduce((sum, file) => sum + file.bytes, 0),
    },
    null,
    2,
  )}\n`,
);

// A failed copy keeps the existing published app available.
const staging = fs.mkdtempSync(path.join(site, '.ghar-naksha-stage-'));
const backup = path.join(staging, 'previous');
try {
  const next = path.join(staging, 'next');
  fs.cpSync(dist, next, { recursive: true });
  if (fs.existsSync(output)) fs.renameSync(output, backup);
  try {
    fs.renameSync(next, output);
  } catch (error) {
    if (fs.existsSync(backup)) fs.renameSync(backup, output);
    throw error;
  }
  fs.closeSync(fs.openSync(path.join(site, '.nojekyll'), 'a'));
  console.log(`Published ${inventory.length + 1} static files to ${output}.`);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
