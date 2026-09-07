const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/scripts/game-engine.js");

const items = (list) => list.map((id) => ({ id, label: id.toUpperCase() }));
const choice = {
  type: "select",
  options: items(["a", "b", "c"]),
  answer: ["b"],
  multiple: false,
};
const multi = { ...choice, answer: ["a", "c"], multiple: true };
const tuning = {
  type: "tune",
  controls: [
    { id: "slope", label: "Slope", min: 0, max: 10, step: 0.1, initial: 1 },
    {
      id: "intercept",
      label: "Intercept",
      min: -10,
      max: 10,
      step: 1,
      initial: -3,
    },
  ],
  targets: { slope: 4, intercept: 2 },
  tolerance: { slope: 0.1, intercept: 0.5 },
};
const sorting = {
  type: "sort",
  items: items(["b", "d", "a", "c"]),
  answer: ["a", "b", "c", "d"],
};
const matching = {
  type: "match",
  left: items(["a", "b", "c"]),
  right: items(["x", "y", "z"]),
  pairs: { a: "z", b: "x", c: "y" },
};
const classifying = {
  type: "classify",
  items: items(["a", "b", "c", "d"]),
  buckets: items(["x", "y"]),
  answers: { a: "x", b: "y", c: "x", d: "y" },
};
const grid = {
  type: "grid",
  columns: 2,
  cells: [
    { id: "a", value: 1 },
    { id: "b", value: 2 },
    { id: "c", value: 5 },
    { id: "d", value: 8 },
  ],
  answer: ["c", "d"],
};
const route = {
  type: "route",
  nodes: items(["a", "b", "c", "d", "e", "f"]).map((node, index) => ({
    ...node,
    x: index % 3,
    y: Math.floor(index / 3),
  })),
  edges: [
    ["a", "b"],
    ["b", "d"],
    ["a", "c"],
    ["c", "e"],
    ["e", "d"],
    ["a", "f"],
    ["f", "d"],
  ],
  start: "a",
  end: "d",
  blocked: ["f"],
};

test("all seven mechanically complete schemas are valid", () => {
  for (const round of [
    choice,
    tuning,
    sorting,
    matching,
    classifying,
    grid,
    route,
  ])
    assert.deepEqual(engine.validateRound(round), { valid: true, errors: [] });
  assert.equal(engine.types.length, 7);
});

test("single selection requires exactly one valid answer", () => {
  assert.equal(engine.evaluateRound(choice, ["b"]).score, 200);
  assert.equal(engine.evaluateRound(choice, ["b"]).correct, true);
  assert.equal(engine.evaluateRound(choice, ["a"]).score, 0);
  assert.equal(engine.evaluateRound(choice, []).complete, false);
  assert.equal(engine.evaluateRound(choice, ["b", "a"]).complete, false);
  assert.equal(engine.evaluateRound(choice, ["missing"]).score, 0);
});

test("multiple choice rewards F1 precision and recall without duplicate scoring", () => {
  assert.equal(engine.evaluateRound(multi, ["a", "c"]).score, 200);
  assert.equal(engine.evaluateRound(multi, ["a"]).score, 133);
  assert.equal(engine.evaluateRound(multi, ["a", "b", "c"]).score, 160);
  assert.equal(engine.evaluateRound(multi, ["a", "b", "c"]).correct, false);
  assert.equal(engine.evaluateRound(multi, ["b"]).score, 0);
  assert.equal(engine.evaluateRound(multi, ["a", "a", "c"]).score, 0);
});

test("tuning uses targets, tolerances, and normalized closeness", () => {
  assert.equal(
    engine.evaluateRound(tuning, { slope: 4, intercept: 2 }).score,
    200,
  );
  assert.equal(
    engine.evaluateRound(tuning, { slope: 4.05, intercept: 2.4 }).score,
    200,
  );
  assert.equal(
    engine.evaluateRound(tuning, { slope: 4.5, intercept: 2 }).score,
    180,
  );
  assert.equal(
    engine.evaluateRound(tuning, { slope: 4.5, intercept: 2 }).correct,
    true,
  );
  assert.equal(
    engine.evaluateRound(tuning, { slope: 6.1, intercept: 2 }).score,
    100,
  );
  assert.equal(
    engine.evaluateRound(tuning, { slope: 0, intercept: -10 }).score,
    0,
  );
  assert.equal(engine.evaluateRound(tuning, { slope: 4 }).complete, false);
  assert.equal(engine.evaluateRound(tuning, { slope: 4 }).score, 100);
});

test("nonfinite, nonnumeric, and out-of-range slider values never earn full credit", () => {
  for (const slope of [
    NaN,
    Infinity,
    -Infinity,
    "4",
    null,
    undefined,
    -1,
    11,
  ]) {
    const outcome = engine.evaluateRound(tuning, { slope, intercept: 2 });
    assert.equal(outcome.complete, false);
    assert.equal(outcome.score, 100);
    assert.equal(outcome.correct, false);
  }
});

test("sorting measures pairwise order and requires every unique step", () => {
  assert.equal(engine.evaluateRound(sorting, ["a", "b", "c", "d"]).score, 200);
  assert.equal(engine.evaluateRound(sorting, ["b", "a", "c", "d"]).score, 167);
  assert.equal(engine.evaluateRound(sorting, ["d", "c", "b", "a"]).score, 0);
  assert.equal(engine.evaluateRound(sorting, ["a", "b", "c"]).complete, false);
  assert.equal(engine.evaluateRound(sorting, ["a", "b", "c", "c"]).score, 0);
});

test("matching supports partial progress and one destination per source", () => {
  assert.equal(engine.evaluateRound(matching, matching.pairs).score, 200);
  assert.equal(engine.evaluateRound(matching, { a: "z" }).score, 67);
  assert.equal(engine.evaluateRound(matching, { a: "z" }).complete, false);
  assert.equal(
    engine.evaluateRound(matching, { a: "z", b: "y", c: "x" }).score,
    67,
  );
  assert.equal(
    engine.evaluateRound(matching, { a: "z", b: "z", c: "y" }).score,
    0,
  );
  assert.equal(
    engine.evaluateRound(matching, { a: "x", b: "y", c: "z" }).score,
    0,
  );
});

test("classification allows many-to-one groups with proportional partial credit", () => {
  assert.equal(
    engine.evaluateRound(classifying, classifying.answers).score,
    200,
  );
  assert.equal(
    engine.evaluateRound(classifying, { a: "x", b: "y" }).score,
    100,
  );
  assert.equal(
    engine.evaluateRound(classifying, { a: "x", b: "y" }).complete,
    false,
  );
  assert.equal(
    engine.evaluateRound(classifying, { a: "x", b: "x", c: "x", d: "y" }).score,
    150,
  );
  assert.equal(
    engine.evaluateRound(classifying, { a: "y", b: "x", c: "y", d: "x" }).score,
    0,
  );
  assert.equal(
    engine.evaluateRound(classifying, { a: "missing", b: "y", c: "x", d: "y" })
      .complete,
    false,
  );
});

test("heatmap selection penalizes false positives and missed targets", () => {
  assert.equal(engine.evaluateRound(grid, ["c", "d"]).score, 200);
  assert.equal(engine.evaluateRound(grid, ["c"]).score, 133);
  assert.equal(engine.evaluateRound(grid, ["a", "b", "c", "d"]).score, 133);
  assert.equal(engine.evaluateRound(grid, ["a", "b"]).score, 0);
  assert.equal(engine.evaluateRound(grid, []).complete, false);
  assert.equal(engine.evaluateRound(grid, ["c", "d", "d"]).score, 0);
});

test("routes score shortest paths and deduct points for extra edges", () => {
  assert.deepEqual(engine.shortestPath(route), ["a", "b", "d"]);
  assert.equal(engine.evaluateRound(route, ["a", "b", "d"]).score, 200);
  assert.equal(engine.evaluateRound(route, ["a", "c", "e", "d"]).score, 180);
  assert.equal(
    engine.evaluateRound(route, ["a", "c", "e", "d"]).correct,
    false,
  );
  assert.equal(
    engine.evaluateRound(route, ["a", "b", "a", "b", "d"]).score,
    160,
  );
  const longPath = ["a"];
  for (let i = 0; i < 10; i += 1) longPath.push("b", "a");
  longPath.push("b", "d");
  assert.equal(engine.evaluateRound(route, longPath).score, 20);
});

test("routes reject blocked, disconnected, incorrectly started, and incomplete paths", () => {
  for (const path of [
    ["a", "f", "d"],
    ["a", "d"],
    ["c", "e", "d"],
    ["a", "b"],
    [],
    ["a", "missing", "d"],
  ]) {
    const outcome = engine.evaluateRound(route, path);
    assert.equal(outcome.score, 0);
    assert.equal(outcome.complete, false);
    assert.equal(outcome.correct, false);
  }
});

test("route edges are undirected and unreachable routes fail validation", () => {
  const reversed = { ...route, edges: route.edges.map(([a, b]) => [b, a]) };
  assert.deepEqual(engine.shortestPath(reversed), ["a", "b", "d"]);
  assert.equal(engine.evaluateRound(reversed, ["a", "b", "d"]).score, 200);
  assert.equal(
    engine.validateRound({ ...route, blocked: ["b", "c", "f"] }).valid,
    false,
  );
  assert.equal(engine.validateRound({ ...route, blocked: ["a"] }).valid, false);
  assert.equal(engine.validateRound({ ...route, start: "d" }).valid, false);
});

test("evaluations are idempotent and never mutate response or round data", () => {
  for (const [round, response] of [
    [choice, ["b"]],
    [tuning, { slope: 4, intercept: 2 }],
    [sorting, ["a", "b", "c", "d"]],
    [matching, matching.pairs],
    [classifying, classifying.answers],
    [grid, ["c", "d"]],
    [route, ["a", "b", "d"]],
  ]) {
    const before = JSON.stringify({ round, response });
    const first = engine.evaluateRound(round, response);
    assert.deepEqual(engine.evaluateRound(round, response), first);
    assert.equal(JSON.stringify({ round, response }), before);
    assert.equal(first.score, 200);
  }
});

test("invalid schemas fail safely and never return NaN", () => {
  const malformed = [
    null,
    {},
    { type: "unknown" },
    { ...choice, answer: [] },
    { ...choice, options: [{ id: "a" }, { id: "a" }] },
    { ...grid, columns: 0 },
    { ...grid, answer: ["unknown"] },
    { ...tuning, targets: { slope: Infinity, intercept: 0 } },
    { ...tuning, tolerance: { slope: -1 } },
    { ...sorting, answer: ["a"] },
    { ...matching, pairs: { a: "x", b: "x", c: "y" } },
    { ...route, nodes: {} },
    { ...route, edges: [["a", "unknown"]] },
  ];
  for (const round of malformed) {
    assert.equal(engine.validateRound(round).valid, false);
    const scored = engine.evaluateRound(round, []);
    assert.equal(scored.score, 0);
    assert.equal(scored.correct, false);
  }
});

test("arbitrary response types are handled without throwing", () => {
  for (const round of [
    choice,
    tuning,
    sorting,
    matching,
    classifying,
    grid,
    route,
  ])
    for (const response of [
      null,
      undefined,
      "a",
      3,
      true,
      {},
      [],
      [null],
      { a: NaN },
    ]) {
      const score = engine.evaluateRound(round, response).score;
      assert.equal(Number.isFinite(score), true);
      assert.ok(score >= 0 && score <= 200);
    }
});
