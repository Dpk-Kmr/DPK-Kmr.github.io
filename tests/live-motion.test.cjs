const test = require("node:test");
const assert = require("node:assert/strict");
const worlds = require("../src/scripts/live-worlds-motion.js");
const runtime = require("../src/scripts/live-runtime.js");
const palette = {
  bg: "#07111e",
  surface: "#112033",
  text: "#edf6ff",
  muted: "#8aadc7",
  accent: "#b5f65f",
  cyan: "#55dded",
  amber: "#ffc96b",
  purple: "#b99bff",
  danger: "#ff657a",
};
function environment(family, variant = 0, level = 0) {
  let time = 0,
    score = 0,
    health = 100;
  const metrics = {};
  return {
    w: 960,
    h: 540,
    level,
    mission: { family, variant, duration: 90 },
    palette,
    random: runtime.seeded(42),
    time: () => time,
    emit() {},
    award(n) {
      assert.ok(Number.isFinite(n) && n > 0);
      score += n;
    },
    damage(n) {
      assert.ok(Number.isFinite(n) && n > 0);
      health -= n;
    },
    metric(k, v) {
      metrics[k] = v;
    },
    finish() {},
    snapshot: () => ({ time, score, health, metrics }),
    tick: (dt) => (time += dt),
  };
}
function finite(observation) {
  for (const [key, value] of Object.entries(observation.player))
    if (typeof value === "number")
      assert.ok(Number.isFinite(value), key + " remains finite");
}
function advance(game, frames, input) {
  for (let i = 0; i < frames; i++)
    game.update(
      1 / 60,
      typeof input === "function" ? input(game.observe()) : input || {},
    );
}
function drawingContext() {
  const calls = [];
  const noop = (...args) => {
    for (const value of args)
      if (typeof value === "number")
        assert.ok(Number.isFinite(value), "canvas coordinate is finite");
    calls.push(args);
  };
  const gradient = { addColorStop: noop };
  const methods = [
    "save",
    "restore",
    "beginPath",
    "closePath",
    "rect",
    "roundRect",
    "fill",
    "stroke",
    "fillRect",
    "strokeRect",
    "moveTo",
    "lineTo",
    "arc",
    "ellipse",
    "translate",
    "rotate",
    "setLineDash",
    "fillText",
  ];
  const ctx = Object.fromEntries(methods.map((name) => [name, noop]));
  ctx.createLinearGradient = () => gradient;
  return { ctx, calls };
}

test("five factories implement the complete live world interface without browser globals", () => {
  assert.deepEqual(Object.keys(worlds).sort(), [
    "arena",
    "drone",
    "grapple",
    "racer",
    "runner",
  ]);
  for (const family of Object.keys(worlds)) {
    const game = worlds[family](environment(family));
    for (const method of ["update", "draw", "observe", "act"])
      assert.equal(typeof game[method], "function");
    assert.equal(game.observe().family, family);
  }
});
test("all 75 world/variant/difficulty combinations remain finite and live bots earn actual scores", () => {
  const report = [];
  for (const family of Object.keys(worlds))
    for (let variant = 0; variant < 5; variant++)
      for (let level = 0; level < 3; level++) {
        const sim = runtime.createSimulation(
          worlds,
          {
            id: family + "-" + variant,
            family,
            variant,
            duration: 90,
            seed: 42 + variant * 3 + level,
          },
          level,
          { palette },
        );
        sim.start();
        sim.setAI(true);
        let frames = 0;
        while (sim.state.phase === "running" && frames++ < 60 * 91) {
          sim.step(1 / 60);
          if (frames % 60 === 0) finite(sim.observe());
        }
        assert.equal(
          sim.state.phase,
          "ended",
          family + " reaches a real outcome",
        );
        assert.ok(
          sim.state.score > 0,
          family + " " + variant + " " + level + " earns score",
        );
        assert.ok(Object.keys(sim.state.metrics).length <= 3);
        assert.equal(sim.state.assisted, true);
        report.push({
          family,
          variant,
          level,
          score: sim.state.score,
          won: sim.state.result.won,
        });
      }
  assert.equal(report.length, 75);
  assert.ok(
    report.filter((row) => row.won).length >= 60,
    "reactive agents navigate most seeded missions",
  );
});
test("runner jumps under gravity and dashing changes movement instead of relocating the actor", () => {
  const a = worlds.runner(environment("runner")),
    b = worlds.runner(environment("runner"));
  advance(a, 14, { action: true });
  advance(b, 14, {});
  assert.ok(a.observe().player.y < b.observe().player.y - 40);
  const x = a.observe().player.x;
  a.update(1 / 60, { secondary: true });
  assert.ok(a.observe().player.x - x < 15);
  assert.ok(a.observe().player.dash > 0);
  assert.ok(a.observe().player.cooldown > 0);
});
test("grapple attaches, reels, and releases while preserving velocity", () => {
  const g = worlds.grapple(environment("grapple"));
  g.update(1 / 60, { pressed: { action: true } });
  const attached = g.observe();
  assert.notEqual(attached.player.anchor, null);
  const length = attached.player.length;
  g.update(1 / 60, { up: true, pressed: { up: true } });
  assert.notEqual(
    g.observe().player.anchor,
    null,
    "Up reels; it must not trigger attachment toggles",
  );
  assert.ok(g.observe().player.length < length);
  const before = g.observe().player;
  g.update(1 / 60, { pressed: { action: true } });
  const after = g.observe().player;
  assert.equal(after.anchor, null);
  assert.ok(Math.abs(after.x - before.x) < 12);
  assert.ok(Math.hypot(after.vx, after.vy) > 10);
});
test("braking takes precedence over throttle and sensor pulses have a cooldown", () => {
  const g = worlds.racer(environment("racer", 4));
  advance(g, 60, { up: true });
  const before = g.observe().player.speed;
  g.update(1 / 60, { up: true, down: true, action: true });
  assert.ok(g.observe().player.speed < before);
  assert.ok(g.observe().sensor > 0);
  assert.ok(g.observe().sensorCooldown > 0);
  advance(g, 150, { action: true });
  assert.equal(
    g.observe().sensor,
    0,
    "holding scan cannot reveal the course permanently",
  );
});
test("drone inertia, moving-pad velocity, and relative-velocity controller are observable", () => {
  const g = worlds.drone(environment("drone", 4));
  advance(g, 30, { right: true });
  const before = g.observe();
  assert.ok(before.player.vx > 30);
  assert.ok(Number.isFinite(before.target.vx));
  const x = before.player.x;
  g.update(1 / 60, {});
  assert.ok(g.observe().player.x > x, "releasing thrust retains momentum");
  const act = g.act({
    ...g.observe(),
    player: { ...g.observe().player, x: g.observe().target.x, vx: 0 },
    target: { ...g.observe().target, vx: 60 },
  });
  assert.equal(act.right, true, "controller feeds forward target velocity");
});
test("arena firing, polarity switching, heat and enemy adaptation are live state changes", () => {
  const shield = worlds.arena(environment("arena", 1));
  shield.update(1 / 60, { secondary: true });
  assert.equal(shield.observe().player.polarity, 1);
  const heat = worlds.arena(environment("arena", 4));
  advance(heat, 100, { action: true });
  assert.ok(heat.observe().player.heat > 0.2);
  heat.update(1 / 60, { secondary: true });
  assert.ok(heat.observe().player.heat < 0.5);
  const swarm = worlds.arena(environment("arena", 2));
  advance(swarm, 180, { action: true });
  assert.ok(swarm.observe().adaptation > 0);
});
test("all 25 visual variants render finite canvas geometry and preserve palette changes", () => {
  for (const family of Object.keys(worlds))
    for (let variant = 0; variant < 5; variant++) {
      const env = environment(family, variant);
      const game = worlds[family](env);
      advance(game, 120, (o) => game.act(o));
      const { ctx, calls } = drawingContext();
      game.draw(ctx);
      assert.ok(calls.length > 70, family + " has a real scene");
      env.palette = {
        ...palette,
        bg: "#f4f6fa",
        surface: "#dde7ef",
        text: "#132232",
        muted: "#4f6374",
        accent: "#285714",
        cyan: "#00677d",
        amber: "#885300",
        purple: "#6b4194",
        danger: "#aa2634",
      };
      game.draw(ctx);
    }
});
test("same seed and controller reproduce trajectories; drawing does not advance physics", () => {
  for (const family of Object.keys(worlds)) {
    const a = worlds[family](environment(family)),
      b = worlds[family](environment(family));
    advance(a, 100, (o) => a.act(o));
    advance(b, 100, (o) => b.act(o));
    assert.deepEqual(a.observe(), b.observe());
    const before = JSON.stringify(a.observe());
    a.draw(drawingContext().ctx);
    assert.equal(JSON.stringify(a.observe()), before);
  }
});

function engineeringRun(family, variant, preset, duration = 75) {
  const registry = {
    [family]: (env) => {
      const game = worlds[family](env);
      return {
        ...game,
        act: (observation) => ({
          ...game.act(observation),
          ...(preset === "adaptive" ? {} : { setting: preset }),
        }),
      };
    },
  };
  const sim = runtime.createSimulation(
    registry,
    { id: `${family}-${variant}`, family, variant, duration, seed: 48 },
    1,
    { palette },
  );
  sim.start();
  sim.setAI(true);
  let frames = 0,
    totalOutcome = 0,
    samples = 0;
  while (sim.state.phase === "running" && frames++ < 60 * (duration + 1)) {
    sim.step(1 / 60);
    if (frames % 60 === 0) {
      totalOutcome += sim.state.engineering.outcome;
      samples++;
    }
  }
  return {
    state: sim.state,
    observation: sim.observe(),
    meanOutcome: totalOutcome / Math.max(1, samples),
  };
}

test("all 25 missions publish finite engineering measurements and throttled observed consequences", () => {
  for (const family of Object.keys(worlds))
    for (let variant = 0; variant < 5; variant++) {
      const { state, observation } = engineeringRun(
        family,
        variant,
        "adaptive",
      );
      assert.ok(
        observation.engineering,
        `${family} exposes public engineering state`,
      );
      assert.ok([0, 1, 2].includes(observation.engineering.setting));
      assert.ok(state.engineering.formula.length > 15);
      assert.ok(state.engineering.explanation.length > 30);
      assert.ok(
        ["good", "warning", "danger"].includes(state.engineering.status),
      );
      for (const key of ["signal", "setting", "outcome"])
        assert.ok(Number.isFinite(state.engineering[key]), `${family} ${key}`);
      assert.ok(
        state.evidence.length > 0,
        `${family} records a measured outcome`,
      );
      for (let i = 0; i < state.evidence.length; i++) {
        const e = state.evidence[i];
        assert.ok(e.quality >= 0 && e.quality <= 1);
        assert.ok(e.decision.length > 5 && e.consequence.length > 10);
        if (i)
          assert.ok(
            e.time - state.evidence[i - 1].time >= 1.9,
            "evidence is spaced at least two simulated seconds apart",
          );
      }
      assert.ok(
        new Set(state.controlHistory.map((e) => e.setting)).size >= 2,
        `${family} ${variant} adapts to measured conditions`,
      );
    }
});

test("adaptive engineering decisions outperform fixed unsuitable settings in measured world outcomes", () => {
  const runnerGood = engineeringRun("runner", 1, "adaptive"),
    runnerWrong = engineeringRun("runner", 1, 2);
  assert.equal(runnerGood.state.result.won, true);
  assert.equal(
    runnerWrong.state.result.won,
    false,
    "constant maximum sampling exhausts the acquisition battery",
  );
  assert.ok(runnerGood.meanOutcome > runnerWrong.meanOutcome + 25);
  assert.ok(runnerGood.state.score > runnerWrong.state.score);

  const cableGood = engineeringRun("grapple", 0, "adaptive"),
    cableWrong = engineeringRun("grapple", 0, 0);
  assert.ok(
    cableGood.state.health > cableWrong.state.health + 30,
    "undersized cable incurs actual overload damage",
  );
  assert.ok(cableGood.state.score > cableWrong.state.score);
  assert.ok(
    cableWrong.state.evidence.some((e) => e.event === "Tether overloaded"),
  );

  const tractionGood = engineeringRun("racer", 1, "adaptive"),
    tractionWrong = engineeringRun("racer", 1, 2);
  assert.equal(tractionGood.state.result.won, true);
  assert.equal(
    tractionWrong.state.result.won,
    false,
    "excess gain scrubs speed under tire saturation",
  );
  assert.ok(tractionGood.state.score > tractionWrong.state.score * 1.5);

  const filterGood = engineeringRun("drone", 4, "adaptive"),
    filterWrong = engineeringRun("drone", 4, 2);
  assert.ok(
    filterGood.meanOutcome < filterWrong.meanOutcome * 0.5,
    "adaptive filtering reduces measured relative-motion uncertainty",
  );
  assert.notEqual(
    filterGood.state.elapsed,
    filterWrong.state.elapsed,
    "sampled velocity estimates change actual landing trajectories",
  );

  const classifierGood = engineeringRun("arena", 3, "adaptive"),
    classifierWrong = engineeringRun("arena", 3, 2);
  assert.equal(classifierGood.state.result.won, true);
  assert.equal(classifierWrong.state.result.won, false);
  assert.ok(classifierGood.state.score > classifierWrong.state.score);
  assert.ok(
    classifierWrong.observation.engineering.falseNegatives > 0,
    "the fire interlock rejects real approaching threats",
  );
});

test("sampling settings change acquisition energy before changing the identical physical route", () => {
  const records = [];
  for (const setting of [0, 1, 2]) {
    const env = environment("runner", 0, 0),
      game = worlds.runner(env);
    for (let i = 0; i < 300; i++) game.update(1 / 60, { right: true, setting });
    records.push({ o: game.observe(), state: env.snapshot() });
  }
  assert.equal(records[0].o.player.x, records[2].o.player.x);
  assert.equal(records[0].o.player.y, records[2].o.player.y);
  assert.ok(
    records[0].o.engineering.battery > records[1].o.engineering.battery,
  );
  assert.ok(
    records[1].o.engineering.battery > records[2].o.engineering.battery + 20,
  );
  assert.equal(
    records[0].o.engineering.quality,
    1,
    "8 Hz resolves the initial 3 Hz signal without unnecessary power",
  );
});

test("the same physical input produces different cable, tire, filter, and classifier consequences", () => {
  for (const family of ["grapple", "racer", "drone", "arena"]) {
    const runs = [];
    for (const setting of [0, 2]) {
      const env = environment(family, 0, 0),
        game = worlds[family](env);
      for (let frame = 0; frame < 600; frame++)
        game.update(1 / 60, {
          setting,
          right: family === "grapple" || family === "racer",
          up: family === "racer",
          secondary: family === "drone",
          action: family === "arena",
          pressed: { action: family === "grapple" && frame === 0 },
        });
      runs.push({ o: game.observe(), state: env.snapshot() });
    }
    if (family === "arena") {
      assert.ok(
        runs[0].o.engineering.truePositives >
          runs[1].o.engineering.truePositives,
      );
      assert.ok(
        runs[1].o.engineering.blockedShots > runs[0].o.engineering.blockedShots,
      );
    } else if (family === "racer") {
      assert.notEqual(runs[0].o.player.energy, runs[1].o.player.energy);
      assert.notEqual(runs[0].o.player.speed, runs[1].o.player.speed);
    } else {
      assert.notEqual(
        runs[0].o.player.x,
        runs[1].o.player.x,
        `${family} setting changes physical state`,
      );
      if (family === "drone")
        assert.notEqual(
          runs[0].o.engineering.estimateX,
          runs[1].o.engineering.estimateX,
        );
    }
  }
});
