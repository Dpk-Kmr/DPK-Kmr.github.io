const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const catalog = require("../src/data/games.js");
const engine = require("../src/scripts/game-engine.js");
const game = (id) => catalog.games.find((item) => item.id === id);
const rounds = catalog.games.flatMap((item) => item.rounds);
const selectedValues = (round) =>
  round.cells
    .filter((cell) => round.answer.includes(cell.id))
    .map((cell) => cell.value);
const exact = (actual, expected, label) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: ${actual} ≠ ${expected}`,
  );
const responses = (round) =>
  ({
    select: () => round.answer,
    grid: () => round.answer,
    sort: () => round.answer,
    tune: () => round.targets,
    match: () => round.pairs,
    classify: () => round.answers,
    route: () => engine.shortestPath(round),
  })[round.type]();

test("catalog contains 50 distinct games, five categories and 250 distinct rounds", () => {
  assert.equal(catalog.categories.length, 5);
  assert.equal(catalog.games.length, 50);
  assert.equal(rounds.length, 250);
  for (const field of ["id", "title", "concept"])
    assert.equal(
      new Set(catalog.games.map((g) => g[field])).size,
      50,
      `unique ${field}`,
    );
  assert.equal(new Set(rounds.map((r) => r.id)).size, 250);
  assert.equal(new Set(catalog.categories.map((c) => c.id)).size, 5);
  for (const category of catalog.categories)
    assert.equal(
      catalog.games.filter((g) => g.category === category.id).length,
      10,
      category.id,
    );
  for (const g of catalog.games) {
    assert.equal(g.rounds.length, 5, g.id);
    assert.ok(catalog.categories.some((c) => c.id === g.category));
    assert.ok(["Starter", "Builder", "Explorer"].includes(g.difficulty));
    assert.ok(Number.isInteger(g.minutes) && g.minutes >= 2 && g.minutes <= 5);
    assert.ok(g.concept.length > 20);
    assert.ok(g.rounds.every((r) => r.type === g.mechanic));
    const meaning = g.rounds.map(({ id, explanation, ...round }) =>
      JSON.stringify(round),
    );
    assert.equal(
      new Set(meaning).size,
      5,
      `${g.id} has five distinct challenges`,
    );
  }
});

test("mechanic distribution favors hands-on games over multiple choice", () => {
  const count = catalog.games.reduce(
    (out, g) => ((out[g.mechanic] = (out[g.mechanic] || 0) + 1), out),
    {},
  );
  assert.equal(Object.keys(count).length, 7);
  assert.ok(count.select <= 10);
  for (const [type, min] of Object.entries({
    tune: 8,
    sort: 6,
    match: 6,
    classify: 6,
    grid: 6,
    route: 4,
  }))
    assert.ok(count[type] >= min, `${type}: ${count[type]}`);
});

test("the catalog loads through the browser UMD export without runtime dependencies", () => {
  const context = vm.createContext({});
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../src/data/games.js"), "utf8"),
    context,
  );
  assert.equal(context.ATRIKSHA_GAMES.games.length, 50);
  assert.equal(
    context.ATRIKSHA_GAMES.categories[4].name,
    "Math & optimization",
  );
});

test("every curated round validates and its complete expected answer earns 200", () => {
  for (const r of rounds) {
    assert.ok(typeof r.prompt === "string" && r.prompt.length >= 35, r.id);
    assert.ok(
      typeof r.explanation === "string" && r.explanation.length >= 35,
      r.id,
    );
    const validation = engine.validateRound(r);
    assert.equal(
      validation.valid,
      true,
      `${r.id}: ${validation.errors.join("; ")}`,
    );
    const before = JSON.stringify(r),
      answer = responses(r);
    const score = engine.evaluateRound(r, answer);
    assert.equal(score.score, 200, `${r.id} exact-answer score`);
    assert.equal(score.correct, true, r.id);
    assert.equal(score.complete, true, r.id);
    assert.equal(
      JSON.stringify(r),
      before,
      "evaluation must not mutate the catalog",
    );
  }
});

test("sorting starts unsolved and slider targets are reachable on the stated steps", () => {
  for (const r of rounds) {
    if (r.type === "sort") {
      assert.notDeepEqual(
        r.items.map((x) => x.id),
        r.answer,
        r.id,
      );
      assert.equal(
        new Set(r.items.map((x) => x.label)).size,
        r.items.length,
        `${r.id} distinct labels`,
      );
    }
    if (r.type === "tune") {
      assert.ok(
        r.controls.some(
          (c) =>
            Math.abs(c.initial - r.targets[c.id]) > (r.tolerance?.[c.id] || 0),
        ),
        `${r.id} starts unsolved`,
      );
      for (const c of r.controls) {
        const steps = (r.targets[c.id] - c.min) / c.step;
        assert.ok(
          Math.abs(steps - Math.round(steps)) < 1e-8,
          `${r.id} target fits step`,
        );
        assert.ok(r.targets[c.id] >= c.min && r.targets[c.id] <= c.max);
      }
    }
  }
});

test("all route rounds have an unblocked shortest path of 3–6 hops", () => {
  for (const r of rounds.filter((r) => r.type === "route")) {
    const shortest = engine.shortestPath(r),
      hops = shortest.length - 1;
    assert.ok(hops >= 3 && hops <= 6, `${r.id}: ${hops} hops`);
    assert.ok(shortest.every((id) => !r.blocked.includes(id)));
    for (const node of r.nodes)
      assert.ok(node.x >= 0 && node.x <= 100 && node.y >= 0 && node.y <= 100);
    assert.ok(
      r.nodes.some((n) => n.id === r.start) &&
        r.nodes.some((n) => n.id === r.end),
    );
  }
});

test("mean, population variance and min–max normalization targets are mathematically correct", () => {
  const means = [10, 13, 18, 22, 30],
    fractions = [0.2, 0.4, 0.6, 0.8, 0.5];
  game("mean-mixer").rounds.forEach((r, i) => {
    exact(r.targets.value, means[i], r.id);
    const ys = r.context.points.map((p) => p.y);
    exact(ys.reduce((a, b) => a + b, 0) / ys.length, r.targets.value, r.id);
  });
  game("spread-lab").rounds.forEach((r, i) =>
    exact(r.targets.value, (i + 1) ** 2, r.id),
  );
  game("feature-scaler").rounds.forEach((r, i) =>
    exact(r.targets.value, fractions[i], r.id),
  );
});

test("thresholds and gradient updates use the stated decision and optimization rules", () => {
  game("threshold-tuner").rounds.forEach((r, i) => {
    exact(r.targets.value, 30 + i * 10, r.id);
    const ys = r.context.points.map((p) => p.y),
      t = r.targets.value;
    assert.ok(ys.slice(0, 2).every((y) => y < t));
    assert.ok(ys.slice(2).every((y) => y >= t));
  });
  game("gradient-step").rounds.forEach((r, i) =>
    exact(r.targets.value, 6 + i * 2, r.id),
  );
});

test("sampling, calibration, fit and OEE targets preserve their units and formulas", () => {
  game("signal-sampler").rounds.forEach((r, i) =>
    exact(r.targets.value, 20 * (i + 1), r.id),
  );
  game("sensor-calibration").rounds.forEach((r, i) =>
    exact(r.targets.value, i + 2, r.id),
  );
  const diameters = [9.8, 11.7, 15.6, 19.5, 24.4];
  game("tolerance-fit").rounds.forEach((r, i) =>
    exact(r.targets.value, diameters[i], r.id),
  );
  const oee = [80, 60, 60, 72, 36];
  game("oee-workshop").rounds.forEach((r, i) =>
    exact(r.targets.value, oee[i], r.id),
  );
});

test("Bayes and mixture targets independently reproduce the intended conditional and weighted probabilities", () => {
  const bayes = [50, 40, 80, 20, 64],
    mix = [1, 2, 4, 6, 8],
    concentrations = [12, 14, 18, 22, 26];
  game("bayes-booth").rounds.forEach((r, i) =>
    exact(r.targets.value, bayes[i], r.id),
  );
  game("mixture-balance").rounds.forEach((r, i) => {
    exact(r.targets.value, mix[i], r.id);
    exact(
      (30 * r.targets.value + 10 * (10 - r.targets.value)) / 10,
      concentrations[i],
      r.id,
    );
  });
});

test("outlier and quality grids handle their boundary conventions correctly", () => {
  game("outlier-radar").rounds.forEach((r, i) => {
    const lower = 4 + i * 5,
      upper = 20 + i * 5;
    const expected = r.cells
      .filter((c) => c.value < lower || c.value > upper)
      .map((c) => c.id);
    assert.deepEqual(new Set(r.answer), new Set(expected));
    for (const bound of [lower, upper])
      assert.ok(!selectedValues(r).includes(bound));
  });
  game("quality-gate").rounds.forEach((r, i) => {
    const target = 10 + i * 5,
      values = selectedValues(r);
    assert.ok(values.includes(target - 1) && values.includes(target + 1));
    assert.ok(values.every((v) => v >= target - 1 && v <= target + 1));
  });
});

test("zero is present data, window endpoints are half-open and parity uses the complete bit count", () => {
  game("missing-pieces").rounds.forEach((r) => {
    assert.ok(r.cells.some((c) => c.value === 0));
    assert.ok(selectedValues(r).every((v) => v === "NA" || v === "—"));
    assert.equal(
      r.answer.length,
      r.cells.filter((c) => c.value === "NA" || c.value === "—").length,
    );
  });
  game("sampling-windows").rounds.forEach((r, i) => {
    const start = i * 10,
      values = selectedValues(r);
    assert.ok(values.includes(start) && !values.includes(start + 10));
    assert.ok(values.every((v) => v >= start && v < start + 10));
  });
  game("packet-parity").rounds.forEach((r) => {
    for (const c of r.cells)
      assert.equal(
        r.answer.includes(c.id),
        (c.value.match(/1/g) || []).length % 2 === 1,
        `${r.id}: ${c.value}`,
      );
  });
});

test("confusion-matrix and nearest-centroid grids select exactly the intended cells", () => {
  game("confusion-matrix").rounds.forEach((r, i) => {
    const code = i % 2 === 0 ? "N/P" : "P/N";
    for (const c of r.cells)
      assert.equal(r.answer.includes(c.id), c.value === code);
  });
  game("cluster-pilot").rounds.forEach((r, i) => {
    const a = 10 + i * 5,
      b = a + 10;
    for (const c of r.cells)
      assert.equal(
        r.answer.includes(c.id),
        Math.abs(c.value - a) < Math.abs(c.value - b),
      );
  });
});

test("knapsack answers are unique global maxima over every feasible subset", () => {
  game("knapsack-grid").rounds.forEach((r, index) => {
    const capacity = 5 + index;
    const items = r.cells.map((c) => ({
      id: c.id,
      weight: Number(/weight (\d+)/.exec(c.value)[1]),
      value: Number(/value (\d+)/.exec(c.value)[1]),
    }));
    const candidates = [];
    for (let mask = 0; mask < 1 << items.length; mask++) {
      const chosen = items.filter((_, i) => mask & (1 << i));
      if (chosen.reduce((a, b) => a + b.weight, 0) <= capacity)
        candidates.push({
          ids: chosen.map((c) => c.id),
          value: chosen.reduce((a, b) => a + b.value, 0),
        });
    }
    const best = Math.max(...candidates.map((c) => c.value)),
      winners = candidates.filter((c) => c.value === best);
    assert.equal(winners.length, 1, r.id);
    assert.deepEqual(new Set(r.answer), new Set(winners[0].ids), r.id);
  });
});

test("constraint and PLC classifications reflect all stated conditions", () => {
  game("constraint-keeper").rounds.forEach((r, i) => {
    for (const item of r.items) {
      const [, x, y] = /x=(\d+), y=(\d+)/.exec(item.label).map(Number);
      assert.equal(
        r.answers[item.id],
        x >= i + 2 && x + y <= 8 + i * 2 ? "b0" : "b1",
      );
    }
  });
  const conditions = [
    (a, b) => a && b,
    (a, b) => a || b,
    (a, b) => a && !b,
    (a, b) => !a && b,
    (a, b, e) => (a || b) && !e,
  ];
  game("plc-logic").rounds.forEach((r, i) => {
    for (const item of r.items) {
      const values = [...item.label.matchAll(/=(\d)/g)].map((m) =>
        Number(m[1]),
      );
      assert.equal(r.answers[item.id], conditions[i](...values) ? "b1" : "b0");
    }
  });
});

test("selected probability and vector answers are exact, not approximate distractors", () => {
  const answersFor = (id) =>
    game(id).rounds.map(
      (r) => r.options.find((o) => o.id === r.answer[0]).label,
    );
  assert.deepEqual(answersFor("probability-deck"), [
    "3/5",
    "1/2",
    "1/6",
    "1/4",
    "3/4",
  ]);
  assert.deepEqual(answersFor("vector-voyager"), [
    "(2, 6)",
    "5",
    "5",
    "(5, −2)",
    "(0.6, 0.8)",
  ]);
  assert.deepEqual(answersFor("sensor-units"), [
    "2.5 s",
    "3.2 m",
    "750 mV",
    "4 kB",
    "50 Hz",
  ]);
});
