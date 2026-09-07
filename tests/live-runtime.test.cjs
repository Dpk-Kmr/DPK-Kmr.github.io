const test = require("node:test"),
  assert = require("node:assert/strict"),
  R = require("../src/scripts/live-runtime.js"),
  P = require("../src/scripts/live-progress.js");
const mission = { id: "sample", family: "test", duration: 1, seed: 4 };
function world(env) {
  let x = 0;
  return {
    update(dt, input) {
      x += input.right ? dt : 0;
      env.metric("Position", x);
      if (input.action) env.award(10, "Hit");
    },
    draw() {},
    observe: () => ({ x }),
    act: (o) => ({ right: o.x < 0.6, action: true }),
  };
}
test("seeded worlds replay deterministically and policy edges are derived from holds", () => {
  const a = R.seeded(9),
    b = R.seeded(9);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  const input = R.policyInput({ right: true, action: true });
  assert.equal(input.pressed.action, true);
  assert.equal(R.policyInput({ action: true }, input).pressed.action, false);
  assert.equal(
    R.policyInput({ action: true, pressed: { action: true } }, input).pressed
      .action,
    true,
  );
});
test("live simulation advances only while playing and stops exactly after its time limit", () => {
  const s = R.createSimulation({ test: world }, mission);
  s.step(1 / 60, { right: true });
  assert.equal(s.state.elapsed, 0);
  s.start();
  s.step(1 / 60, { right: true });
  const elapsed = s.state.elapsed;
  s.pause();
  s.step(1 / 60, { right: true });
  assert.equal(s.state.elapsed, elapsed);
  s.start();
  for (let i = 0; i < 70; i++) s.step(1 / 60, { right: true });
  assert.equal(s.state.phase, "ended");
  assert.equal(s.state.result.reason, "Time complete");
  assert.ok(s.observe().x <= 1.02);
});
test("AI acts through the same environment and permanently marks a run as assisted", () => {
  const s = R.createSimulation({ test: world }, mission);
  s.start();
  s.setAI(true);
  for (let i = 0; i < 10; i++) s.step(1 / 60);
  assert.ok(s.observe().x > 0);
  assert.ok(s.state.score > 0);
  s.setAI(false);
  assert.equal(s.state.assisted, true);
});
test("damage resets combos, death ends once, and ended games cannot award points", () => {
  let ends = 0;
  const s = R.createSimulation({ test: world }, mission, 0, {
    onFinish: () => ends++,
  });
  s.start();
  for (let i = 0; i < 6; i++) s.env.award(10);
  assert.ok(s.state.combo > 1);
  s.env.damage(15);
  assert.equal(s.state.combo, 1);
  s.env.damage(100);
  const score = s.state.score;
  s.env.award(100);
  s.finish(true, "late");
  assert.equal(s.state.score, score);
  assert.equal(ends, 1);
  assert.equal(s.state.health, 0);
});
test("live scores stay separate from exercises and assisted runs cannot raise independent XP", () => {
  let p = P.record(P.empty(), "sample", 2, { score: 120, assisted: false }, [
    "sample",
  ]);
  p = P.record(p, "sample", 2, { score: 10000, assisted: true }, ["sample"]);
  assert.equal(P.totals(p).xp, 360);
  assert.equal(p.results.sample[2].best, 120);
  assert.equal(p.results.sample[2].practiceBest, 10000);
  assert.notEqual(P.KEY, "atriksha-studio-v2");
});
test("live saves validate corrupt data and merge bests before updating favorites", () => {
  assert.deepEqual(
    P.read(
      {
        getItem() {
          throw Error();
        },
      },
      ["sample"],
    ),
    P.empty(),
  );
  const a = P.record(P.empty(), "sample", 0, { score: 10 }, ["sample"]),
    b = P.record(P.empty(), "sample", 0, { score: 30 }, ["sample"]);
  a.favorites = ["sample"];
  const m = P.merge(a, b, ["sample"]);
  assert.equal(m.results.sample[0].best, 30);
  assert.deepEqual(m.favorites, ["sample"]);
  assert.equal(
    P.normalize({ results: { sample: { 0: { best: Infinity, runs: 1 } } } }, [
      "sample",
    ]).results.sample[0].best,
    0,
  );
});

test("technical settings reach human and AI updates, survive pause, and preserve the zero preset", () => {
  const factory = (env) => {
    let value = 0;
    return {
      update(dt, input) {
        value += dt * [0.5, 1, 2][input.setting];
        env.engineering({
          concept: "Gain",
          readout: String(value),
          status: "good",
          signal: 1,
          setting: input.setting,
          outcome: value,
        });
      },
      draw() {},
      observe: () => ({ value }),
      act: () => ({ setting: 2 }),
    };
  };
  const a = R.createSimulation({ test: factory }, mission),
    b = R.createSimulation({ test: factory }, mission);
  assert.equal(a.setSetting(0), true);
  a.start();
  b.start();
  b.setAI(true);
  for (let i = 0; i < 12; i++) {
    a.step(1 / 60);
    b.step(1 / 60);
  }
  assert.equal(a.state.control, 0);
  assert.equal(b.state.control, 2);
  assert.ok(Math.abs(b.observe().value - a.observe().value * 4) < 1e-8);
  a.pause();
  a.setSetting(2);
  const value = a.observe().value;
  a.step(1 / 60);
  assert.equal(a.observe().value, value);
  a.start();
  a.step(1 / 60);
  assert.ok(a.observe().value > value);
  assert.equal(R.policyInput({ setting: 0 }, { setting: 2 }).setting, 0);
  assert.equal(R.policyInput({ setting: Infinity }, { setting: 2 }).setting, 2);
});

test("run notes capture bounded measured evidence rather than assigning learning credit", () => {
  const m = { ...mission, duration: 180 };
  const s = R.createSimulation({ test: world }, m);
  s.start();
  for (let i = 0; i < 6000; i++) {
    s.step(1 / 60);
    s.env.engineering({
      concept: "Observed process",
      readout: "Live",
      status: "good",
      signal: 5,
      outcome: i,
      setting: 2,
      formula: "y = 2x",
    });
    s.env.evidence({
      concept: "Observed process",
      event: "Measurement",
      decision: "Changed gain",
      consequence: "Output rose",
      quality: 0.8,
    });
  }
  assert.ok(s.state.engineeringHistory.length <= 120);
  assert.equal(s.state.evidence.length, 18);
  assert.ok(
    s.state.evidence.every(
      (x, i, a) => i === 0 || x.time - a[i - 1].time >= 1.4,
    ),
  );
  s.finish(false, "Time complete");
  const result = s.state.result;
  assert.equal(result.engineering.formula, "y = 2x");
  assert.equal(result.evidence.length, 18);
  const old = result.evidence[0].consequence;
  s.state.evidence[0].consequence = "changed";
  assert.equal(result.evidence[0].consequence, old);
  assert.equal(result.controlChanges, 0);
  assert.equal(result.learned, undefined);
});

test("invalid instrumentation is rejected and unfinished snapshots cannot add evidence", () => {
  const s = R.createSimulation({ test: world }, mission);
  s.env.evidence({ event: "premature", consequence: "invalid" });
  assert.equal(s.state.evidence.length, 0);
  s.env.engineering({
    readout: "x".repeat(1000),
    signal: Infinity,
    outcome: NaN,
    status: "unknown",
  });
  assert.equal(s.state.engineering.readout.length, 280);
  assert.equal(s.state.engineering.signal, undefined);
  assert.equal(s.state.engineering.outcome, undefined);
  assert.equal(s.setSetting(-1), false);
  assert.equal(s.setSetting(3), false);
  s.start();
  s.env.evidence({
    event: "Visible response",
    consequence: "Bounded signal",
    quality: 10,
  });
  assert.equal(s.state.evidence[0].quality, 1);
  s.finish(false, "Done");
  s.env.evidence({ event: "late", consequence: "none" });
  assert.equal(s.state.evidence.length, 1);
});
