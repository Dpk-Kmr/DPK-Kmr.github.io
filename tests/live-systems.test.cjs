const test = require("node:test");
const assert = require("node:assert/strict");
const worlds = require("../src/scripts/live-worlds-systems.js");
function rng(seed = 123) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
function make(family, variant = 0, level = 0, seed = 123) {
  const events = {
    awards: 0,
    damage: 0,
    metrics: {},
    finished: null,
    engineering: null,
    evidence: [],
  };
  const world = worlds[family]({
    w: 960,
    h: 540,
    level,
    mission: { variant },
    random: rng(seed),
    award: (n) => (events.awards += n),
    damage: (n) => (events.damage += n),
    metric: (k, v) => (events.metrics[k] = v),
    engineering: (data) => (events.engineering = data),
    evidence: (data) => events.evidence.push(data),
    finish: (won, reason) => (events.finished = { won, reason }),
  });
  return { world, events };
}
function tick(world, frames, input = {}) {
  for (let i = 0; i < frames; i++)
    world.update(
      1 / 60,
      typeof input === "function" ? input(world.observe()) : input,
    );
}
function finite(value) {
  if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (value && typeof value === "object")
    Object.values(value).forEach(finite);
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("all 75 systems environments evolve autonomously with finite public state and at most three metrics", () => {
  for (const family of Object.keys(worlds))
    for (let variant = 0; variant < 5; variant++)
      for (let level = 0; level < 3; level++) {
        const { world, events } = make(family, variant, level),
          before = JSON.stringify(world.observe());
        tick(world, 180);
        const after = world.observe();
        finite(after);
        assert.notEqual(
          JSON.stringify(after),
          before,
          `${family}/${variant}/${level}`,
        );
        assert.ok(Object.keys(events.metrics).length <= 3);
        const external = world.observe(),
          x = external.player.x;
        external.player.x = -999;
        assert.equal(
          world.observe().player.x,
          x,
          "observations must not mutate the simulation",
        );
      }
});

test("reactive controllers use only the supplied immutable public observation", () => {
  for (const family of Object.keys(worlds))
    for (let variant = 0; variant < 5; variant++) {
      const a = make(family, variant, 1, 18).world,
        b = make(family, variant, 1, 934).world;
      tick(a, 90);
      const observation = freeze(a.observe());
      assert.deepEqual(
        a.act(observation),
        b.act(observation),
        `${family}/${variant} controller accessed hidden world state`,
      );
      finite(a.act(observation));
    }
});

test("conveyor rotation changes the physical grid and relay construction spends visible credits", () => {
  const f = make("factory").world,
    belt = f.observe().belts[0];
  f.update(1 / 60, { pointer: { ...belt, pressed: true, down: true } });
  assert.equal(f.observe().belts[0].dir, 1);
  const n = make("network").world,
    slot = n.observe().nodes.find((x) => !x.tier),
    credits = n.observe().credits;
  n.update(1 / 60, { pointer: { ...slot, pressed: true, down: true } });
  const after = n.observe();
  assert.equal(after.nodes[slot.id].tier, 1);
  assert.ok(after.credits < credits - 19);
});

test("attraction and repulsion produce different flock trajectories without replacing actors", () => {
  const a = make("swarm", 0).world,
    b = make("swarm", 0).world;
  tick(a, 120, { action: true });
  tick(b, 120, { secondary: true });
  assert.notDeepEqual(
    a.observe().boids.map((x) => [x.x, x.y]),
    b.observe().boids.map((x) => [x.x, x.y]),
  );
  assert.ok(a.observe().boids.length > 10 && b.observe().boids.length > 10);
});

test("harvesting preserves the living plant and starts another delayed growth cycle", () => {
  const { world, events } = make("ecosystem");
  tick(world, 1800);
  const ripe = world.observe().cells.find((c) => c.planted && c.growth >= 0.8);
  assert.ok(ripe);
  tick(world, 300, { pointer: { x: ripe.x, y: ripe.y, down: true } });
  world.update(1 / 60, { secondary: true });
  const harvested = world.observe().cells[ripe.id];
  assert.equal(world.observe().harvested, 1);
  assert.equal(harvested.planted, true);
  assert.ok(harvested.growth < 0.2);
  assert.ok(events.awards > 0);
  tick(world, 300);
  assert.ok(world.observe().cells[ripe.id].growth > harvested.growth);
});

test("rocket thrust changes momentum and the rocket keeps moving after release", () => {
  const coasting = make("orbit").world,
    thrusting = make("orbit").world;
  tick(coasting, 45);
  tick(thrusting, 45, { up: true });
  assert.notEqual(coasting.observe().player.vy, thrusting.observe().player.vy);
  const before = thrusting.observe().player;
  tick(thrusting, 30);
  const after = thrusting.observe().player;
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 10);
});

test("reactive practice can achieve a real environmental objective in each systems family", () => {
  for (const family of Object.keys(worlds)) {
    const { world, events } = make(family, 0, 0, 143);
    for (let i = 0; i < 90 * 60 && !events.finished && events.damage < 100; i++)
      world.update(1 / 60, world.act(world.observe()));
    assert.equal(events.finished?.won, true, family);
    assert.ok(events.awards > 0, family);
    finite(world.observe());
  }
});

test("every systems mission exposes measured engineering data and preserves preset zero", () => {
  for (const family of Object.keys(worlds))
    for (let variant = 0; variant < 5; variant++) {
      const low = make(family, variant, 1),
        high = make(family, variant, 1);
      tick(low.world, 90, { setting: 0, up: family === "orbit" });
      tick(high.world, 90, { setting: 2, up: family === "orbit" });
      for (const item of [low, high]) {
        const e = item.events.engineering;
        assert.ok(
          e.concept && e.formula && e.readout && e.explanation,
          `${family}/${variant}`,
        );
        assert.ok(["good", "warning", "danger"].includes(e.status));
        for (const k of ["signal", "setting", "outcome"])
          assert.ok(Number.isFinite(e[k]), `${family}/${variant}/${k}`);
        assert.deepEqual(item.world.observe().engineering, e);
        assert.ok(
          [0, 1, 2].includes(item.world.act(item.world.observe()).setting),
        );
      }
      assert.equal(low.world.observe().setting, 0);
      assert.equal(high.world.observe().setting, 2);
      assert.notEqual(
        low.events.engineering.setting,
        high.events.engineering.setting,
        `${family}/${variant} presets are cosmetic`,
      );
    }
});

function presetRun(family, variant, preset, seconds, control = {}) {
  const result = make(family, variant, 1);
  tick(result.world, seconds * 60, { ...control, setting: preset });
  return { ...result, observation: result.world.observe() };
}

test("surge feed can reduce accepted production points when the thermal interlock trips", () => {
  const balanced = presetRun("factory", 3, 1, 18),
    surge = presetRun("factory", 3, 2, 18);
  assert.ok(balanced.events.awards > surge.events.awards + 30);
  assert.ok(surge.observation.machines.some((m) => m.jammed));
  assert.match(surge.events.engineering.explanation, /interlock/);
});

test("additional relay service clears queues at a measurable operating-resource cost", () => {
  const eco = presetRun("network", 2, 0, 12),
    burst = presetRun("network", 2, 2, 12);
  const queued = (o) => o.nodes.reduce((n, x) => n + x.queue, 0);
  assert.ok(queued(eco.observation) > queued(burst.observation) + 5);
  assert.ok(eco.observation.meanLatency > burst.observation.meanLatency);
  assert.ok(burst.observation.energySpent > eco.observation.energySpent + 50);
  assert.ok(burst.events.evidence.some((e) => e.event === "Packet delivered"));
});

test("wider robot clearance reduces contacts while occupying more formation space", () => {
  const compact = presetRun("swarm", 0, 0, 6, { action: true }),
    wide = presetRun("swarm", 0, 2, 6, { action: true });
  assert.ok(compact.observation.contacts > wide.observation.contacts);
  assert.ok(
    wide.observation.minClearance > compact.observation.minClearance + 10,
  );
  assert.ok(wide.observation.spread > compact.observation.spread + 20);
  assert.ok(compact.events.damage > wide.events.damage);
});

test("excess irrigation spends more water and slows waterlogged crop growth", () => {
  const regulated = presetRun("ecosystem", 0, 1, 25),
    high = presetRun("ecosystem", 0, 2, 25);
  const growth = (o) =>
    o.cells.filter((c) => c.planted).reduce((n, c) => n + c.growth, 0);
  assert.ok(high.observation.waterUsed > regulated.observation.waterUsed + 15);
  assert.ok(high.observation.reservoir < regulated.observation.reservoir - 15);
  assert.ok(growth(high.observation) < growth(regulated.observation) - 0.4);
  assert.ok(
    high.events.evidence.some(
      (e) => e.event === "Waterlogging threshold crossed",
    ),
  );
});

test("thruster profiles produce different actual momentum and drive consumption", () => {
  const precise = presetRun("orbit", 0, 0, 0.5, { up: true }),
    strong = presetRun("orbit", 0, 2, 0.5, { up: true });
  assert.ok(strong.observation.fuelUsed > precise.observation.fuelUsed * 2.5);
  assert.ok(
    Math.abs(strong.observation.player.vy) >
      Math.abs(precise.observation.player.vy) + 30,
  );
  const p = strong.observation,
    expected = Math.max(0, p.closingVelocity) ** 2 / (2 * 170 * 0.9);
  assert.ok(Math.abs(p.stoppingDistance - expected) < 1e-9);
});

test("recorded engineering outcomes are bounded observations rather than unchecked claims", () => {
  for (const family of Object.keys(worlds)) {
    const run = make(family, 0, 0, 143);
    tick(run.world, 60 * 60, (o) => run.world.act(o));
    assert.ok(run.events.evidence.length > 0, family);
    assert.ok(run.events.evidence.length <= 31, family);
    for (const event of run.events.evidence) {
      assert.ok(
        event.concept && event.event && event.decision && event.consequence,
      );
      assert.ok(
        Number.isFinite(event.quality) &&
          event.quality >= 0 &&
          event.quality <= 1,
      );
    }
  }
});

test("changing engineering presets keeps run notes tied to the decision that produced each outcome", () => {
  const catalog = require("../src/data/live-games.js"),
    runtime = require("../src/scripts/live-runtime.js"),
    presetNames = {
      factory: ["Conservative", "Balanced", "Surge"],
      network: ["Eco", "Balanced", "Burst"],
      swarm: ["Compact", "Balanced", "Wide"],
      ecosystem: ["Water-saving", "Sensor regulated", "High irrigation"],
      orbit: ["Precision", "Cruise", "High thrust"],
    };
  for (const game of catalog.games.filter((game) => worlds[game.family])) {
    const sim = runtime.createSimulation(worlds, game, 0);
    sim.start();
    for (
      let frame = 0;
      frame < 2400 && sim.state.phase === "running";
      frame++
    ) {
      const movement = sim.world.act(sim.observe());
      sim.step(1 / 60, {
        ...runtime.policyInput(movement),
        setting: Math.floor(frame / 71) % 3,
      });
    }
    assert.ok(sim.state.evidence.length > 0, game.id);
    for (const event of sim.state.evidence) {
      assert.ok(
        event.decision.startsWith(presetNames[game.family][event.setting]),
        `${game.id} at ${event.time}s: preset ${event.setting} contradicts ${event.decision}`,
      );
      assert.equal(event.automatic, false);
    }
    sim.dispose();
  }
});
