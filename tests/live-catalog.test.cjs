"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const vm = require("node:vm");
const catalog = require("../src/data/live-games.js");
const keys = ["left", "right", "up", "down", "action", "secondary"];
const levelIds = ["foundation", "applied", "expert"];
const nonempty = (value) =>
  typeof value === "string" && value.trim().length > 0;
const normalize = (value) => ({
  ...Object.fromEntries(keys.map((key) => [key, Boolean(value[key])])),
  ...value,
});

function runPython(code, observations) {
  const suffix = observations
    ? "\nimport sys\nprint(json.dumps([agent(o) for o in json.load(sys.stdin)]))\n"
    : "";
  const output = execFileSync("python3", ["-c", code + suffix], {
    input: observations ? JSON.stringify(observations) : "",
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
  });
  return JSON.parse(output.trim().split("\n").at(-1));
}

function assertAction(action) {
  assert.equal(typeof action, "object");
  assert.ok(
    Number.isInteger(action.setting) &&
      action.setting >= 0 &&
      action.setting <= 2,
    "engineering setting",
  );
  for (const key of keys) assert.equal(typeof action[key], "boolean", key);
  if (action.pointer) {
    assert.ok(Number.isFinite(action.pointer.x));
    assert.ok(Number.isFinite(action.pointer.y));
    assert.equal(typeof action.pointer.down, "boolean");
  }
  if (action.pressed) assert.equal(typeof action.pressed.action, "boolean");
}

test("catalog describes ten worlds and exactly five distinct missions per world", () => {
  assert.equal(catalog.families.length, 10);
  assert.equal(catalog.games.length, 50);
  assert.equal(new Set(catalog.families.map((f) => f.id)).size, 10);
  assert.equal(new Set(catalog.games.map((g) => g.id)).size, 50);
  assert.equal(new Set(catalog.games.map((g) => g.title)).size, 50);
  assert.equal(new Set(catalog.games.map((g) => g.concept)).size, 50);
  const expected = [
    "runner",
    "grapple",
    "racer",
    "drone",
    "arena",
    "factory",
    "network",
    "swarm",
    "ecosystem",
    "orbit",
  ];
  assert.deepEqual(
    catalog.families.map((f) => f.id),
    expected,
  );
  for (const family of catalog.families) {
    const missions = catalog.games.filter((g) => g.family === family.id);
    assert.deepEqual(
      missions.map((g) => g.variant),
      [0, 1, 2, 3, 4],
    );
    assert.equal(new Set(missions.map((g) => g.objective)).size, 5);
    assert.equal(new Set(missions.map((g) => g.twist)).size, 5);
  }
});

test("mission metadata uses valid topics, practical durations and all three selectable levels", () => {
  assert.equal(catalog.categories.length, 5);
  const categories = new Set(catalog.categories.map((c) => c.id));
  for (const game of catalog.games) {
    for (const field of [
      "id",
      "title",
      "family",
      "concept",
      "description",
      "objective",
      "twist",
    ])
      assert.ok(nonempty(game[field]), game.id + "." + field);
    assert.ok(categories.has(game.category), game.id);
    assert.ok(
      Number.isInteger(game.duration) &&
        game.duration >= 75 &&
        game.duration <= 120,
    );
    assert.ok(
      Number.isInteger(game.seed) && game.seed > 0 && game.seed <= 0xffffffff,
    );
    assert.ok(game.tags.length >= 2 && game.tags.every(nonempty));
    assert.deepEqual(
      game.levels.map((l) => l.id),
      levelIds,
    );
    assert.equal(new Set(game.levels.map((l) => l.description)).size, 3);
    for (const level of game.levels)
      assert.ok(nonempty(level.name) && nonempty(level.description));
  }
  assert.equal(new Set(catalog.games.map((g) => g.seed)).size, 50);
});

test("every world supplies controls, explicit gameplay rules and transparent policy teaching", () => {
  for (const family of catalog.families) {
    for (const field of ["name", "genre", "description", "scoring", "learning"])
      assert.ok(nonempty(family[field]));
    assert.ok(family.controls.length >= 3);
    assert.ok(family.controls.some((c) => c.key === "Space"));
    assert.ok(family.controls.some((c) => c.key === "E"));
    for (const control of family.controls)
      assert.ok(nonempty(control.key) && nonempty(control.action));
    assert.ok(
      family.rules.length >= 3 &&
        family.rules.length <= 5 &&
        family.rules.every(nonempty),
    );
    for (const field of ["name", "summary", "code", "limitations"])
      assert.ok(nonempty(family.ai[field]), family.id + ".ai." + field);
    assert.ok(family.ai.steps.length >= 3 && family.ai.steps.every(nonempty));
    assert.match(family.ai.code, /def agent\(o\):/);
    assert.match(family.ai.code, /example = json.loads/);
    assert.doesNotMatch(family.ai.code, /requests|urllib|openai|eval\(|exec\(/);
  }
});

test("browser UMD export has the same fifty missions as CommonJS", () => {
  const context = {};
  vm.runInNewContext(
    readFileSync(join(__dirname, "../src/data/live-games.js"), "utf8"),
    context,
  );
  assert.equal(context.ATRIKSHA_LIVE_GAMES.games.length, 50);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.ATRIKSHA_LIVE_GAMES)),
    catalog,
  );
});

for (const family of catalog.families) {
  test(`${family.id}: standalone Python example executes and returns usable controls`, () => {
    assertAction(runPython(family.ai.code));
  });
}

// These are integration checks for the teaching code, not copies of engine mechanics.
// Compare policy outputs from real snapshots across missions, difficulty and time.
const worlds = {
  ...require("../src/scripts/live-worlds-motion.js"),
  ...require("../src/scripts/live-worlds-systems.js"),
};
const palette = {
  bg: "#11151a",
  surface: "#1a2129",
  text: "#f2f5f7",
  muted: "#a7b1bc",
  accent: "#c9ee76",
  cyan: "#56cee8",
  amber: "#edbd68",
  purple: "#b5a3ff",
  danger: "#ed7381",
};
for (const family of catalog.families) {
  test(`${family.id}: Python agrees with the live controller on evolving observations`, () => {
    const observations = [],
      expected = [];
    for (const mission of catalog.games.filter((g) => g.family === family.id)) {
      for (let level = 0; level < 3; level++) {
        let state = mission.seed;
        const random = () =>
          (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
        const world = worlds[family.id]({
          w: 960,
          h: 540,
          level,
          mission,
          random,
          palette,
          emit() {},
          award() {},
          damage() {},
          metric() {},
          finish() {},
        });
        for (let frame = 0; frame <= 420; frame++) {
          const observation = world.observe(),
            action = world.act(observation);
          if (frame % 105 === 0) {
            observations.push(observation);
            expected.push(normalize(action));
          }
          world.update(1 / 60, action);
        }
      }
    }
    const actual = runPython(family.ai.code, observations);
    assert.equal(actual.length, 75);
    for (let i = 0; i < actual.length; i++) {
      assertAction(actual[i]);
      assert.deepEqual(
        actual[i],
        expected[i],
        `${family.id}, observation ${i}`,
      );
    }
    const decisions = new Set(actual.map((a) => JSON.stringify(a)));
    assert.ok(
      decisions.size > 1,
      "policy should react to changing observations",
    );
  });
}
