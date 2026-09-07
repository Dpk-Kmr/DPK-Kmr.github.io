"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const catalog = require("../src/data/live-games.js");
const learning = require("../src/data/live-learning.js");
const R = require("../src/scripts/live-runtime.js");
const worlds = {
  ...require("../src/scripts/live-worlds-motion.js"),
  ...require("../src/scripts/live-worlds-systems.js"),
};
const text = (value) => typeof value === "string" && value.trim().length > 0;
const close = (actual, expected, label) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} vs ${expected}`,
  );
function sample(game, level, setting, dt = 1 / 60) {
  const sim = R.createSimulation(worlds, game, level);
  sim.start();
  sim.step(dt, { ...R.neutral(), setting });
  const observation = sim.observe();
  sim.dispose();
  return observation;
}

test("all fifty missions have distinct actionable engineering learning objectives", () => {
  assert.equal(Object.keys(learning.games).length, 50);
  assert.deepEqual(
    Object.keys(learning.games).sort(),
    catalog.games.map((g) => g.id).sort(),
  );
  assert.equal(
    new Set(Object.values(learning.games).map((g) => g.concept)).size,
    50,
  );
  for (const game of catalog.games) {
    const entry = learning.games[game.id];
    for (const field of [
      "domain",
      "concept",
      "observe",
      "act",
      "consequence",
      "formula",
      "application",
      "transfer",
    ])
      assert.ok(text(entry[field]), game.id + "." + field);
    assert.equal(
      entry.concept,
      game.concept,
      "card and lesson objective must agree",
    );
    assert.ok(text(entry.control.label));
    assert.equal(entry.control.initial, 1);
    assert.equal(entry.control.options.length, 3);
    assert.equal(new Set(entry.control.options.map((o) => o.label)).size, 3);
    assert.equal(new Set(entry.control.options.map((o) => o.value)).size, 3);
    for (const option of entry.control.options) {
      assert.ok(text(option.label) && text(option.description));
      assert.ok(Number.isFinite(option.value));
    }
    for (const reference of entry.references || []) {
      assert.ok(text(reference.label));
      assert.equal(new URL(reference.url).protocol, "https:");
    }
  }
});

test("browser export and CommonJS expose the same curriculum", () => {
  const context = {};
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../src/data/live-games.js"), "utf8"),
    context,
  );
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../src/data/live-learning.js"), "utf8"),
    context,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.ATRIKSHA_LIVE_LEARNING)),
    learning,
  );
});

test("published preset values match live world settings across 450 mission-level-preset combinations", () => {
  for (const game of catalog.games)
    for (let level = 0; level < 3; level++)
      for (let setting = 0; setting < 3; setting++) {
        const o = sample(game, level, setting),
          e = o.engineering,
          value = learning.games[game.id].control.options[setting].value;
        assert.ok(
          e && typeof e === "object",
          game.id + " engineering snapshot",
        );
        assert.equal(
          o.setting ?? e.setting,
          setting,
          game.id + " selected preset",
        );
        const actual = {
          runner: () => e.sampleRate,
          grapple: () => e.ratings[setting],
          racer: () => e.gains[setting],
          drone: () => e.options[setting].hz,
          arena: () => e.threshold,
          factory: () =>
            (e.setting *
              (game.variant === 3 ? 0.76 : game.variant === 2 ? 1.4 : 1.05)) /
            (1 + level * 0.15),
          network: () => e.setting / 1.4,
          swarm: () => e.setting,
          ecosystem: () => e.setting / 100,
          orbit: () => e.setting,
        }[game.family]();
        close(actual, value, `${game.id}/${level}/${setting}`);
      }
});

test("sampling notes match alias folding, bandwidth rejection and quadratic battery cost", () => {
  const game = catalog.games.find((g) => g.id === "conveyor-works");
  const readings = [0, 1, 2].map(
    (setting) => sample(game, 0, setting).engineering,
  );
  for (const e of readings) {
    const alias = Math.abs(
      e.frequency - Math.round(e.frequency / e.sampleRate) * e.sampleRate,
    );
    close(e.aliasFrequency, alias, "aliased frequency");
    assert.equal(
      e.quality === 1,
      e.sampleRate > 2 * e.frequency,
      "strict sampling margin",
    );
  }
  assert.ok(readings[0].quality < 1 && readings[1].quality === 1);
  close(
    (100 - readings[1].battery) / (100 - readings[0].battery),
    4,
    "doubling rate quadruples game drain",
  );
  close(
    (100 - readings[2].battery) / (100 - readings[0].battery),
    16,
    "quadrupling rate multiplies drain by sixteen",
  );
  assert.match(learning.games[game.id].formula, /game.*fₛ²/);
});

test("steering command saturation follows available traction rather than unlimited controller gain", () => {
  const game = catalog.games.find((g) => g.id === "traction-lab");
  for (const setting of [0, 1, 2]) {
    const sim = R.createSimulation(worlds, game, 0);
    sim.start();
    sim.step(1 / 60, { ...R.neutral(), right: true, up: true, setting });
    const o = sim.observe(),
      e = o.engineering;
    close(
      e.slip,
      Math.max(0, Math.abs(e.requestedAcceleration) - e.friction * 900),
      "tire saturation",
    );
    assert.ok(
      Math.abs(o.player.vx) <= (e.friction * 900) / 60 + 1e-8,
      "actual acceleration is limited by traction",
    );
    sim.dispose();
  }
});

test("sensor uncertainty uses consistent units and a one-second velocity projection", () => {
  const game = catalog.games.find((g) => g.id === "moving-platforms");
  for (const setting of [0, 1, 2]) {
    const o = sample(game, 0, setting, 0),
      e = o.engineering,
      m = e.options[setting];
    const lag = (1 - m.alpha) / (m.alpha * m.hz);
    const velocityNoise = e.noise * Math.sqrt(m.alpha / (2 - m.alpha));
    const uncertainty = Math.hypot(
      velocityNoise * 1,
      Math.abs(o.player.vx - o.target.vx) * lag,
    );
    close(e.latency, lag, "EMA group delay approximation");
    close(e.uncertainty, uncertainty, "projected uncertainty");
  }
  assert.match(learning.games[game.id].formula, /1 s/);
});

test("ideal approach braking estimate uses positive closing speed and the actual counterthrust preset", () => {
  const game = catalog.games.find((g) => g.id === "rendezvous-dock");
  for (const setting of [0, 1, 2]) {
    const o = sample(game, 0, setting),
      acceleration =
        learning.games[game.id].control.options[setting].value * 0.9;
    close(
      o.stoppingDistance,
      Math.max(0, o.closingVelocity) ** 2 / (2 * acceleration),
      "ideal braking distance",
    );
  }
  assert.match(learning.games[game.id].formula, /ignores gravity/);
});

test("sampling and classification theory links remain separate from game-specific heuristics", () => {
  for (const game of catalog.games.filter((g) =>
    ["runner", "arena"].includes(g.family),
  )) {
    assert.equal(learning.games[game.id].references.length, 1);
  }
  assert.match(
    learning.games["signal-defender"].formula,
    /not a trained probability/,
  );
  assert.match(learning.games["signal-sprint"].formula, /game/);
  assert.match(learning.games["orbital-courier"].formula, /Estimated/);
});
