const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const ai = require("../src/scripts/game-ai.js");
const engine = require("../src/scripts/game-engine.js");
const guides = require("../src/data/game-ai-guides.js");
const oldCatalog = require("../src/data/games.js");
const ref = (field) => ({ ref: field });
const op = (operation, ...args) => ({ op: operation, args });
const named = (ids) => ids.map((id) => ({ id, label: id }));
const fixture = [
  {
    solver: "formula",
    type: "tune",
    model: {
      data: { readings: [4, 8, 12], weight: 2 },
      outputs: { value: op("mean", ref("readings")) },
    },
    controls: [
      { id: "value", label: "Mean", min: 0, max: 20, step: 1, initial: 0 },
    ],
    targets: { value: 8 },
  },
  {
    solver: "filter",
    type: "grid",
    model: {
      rows: [
        { id: "a", x: 2 },
        { id: "b", x: 5 },
        { id: "c", x: 9 },
      ],
      predicate: op("gt", ref("x"), 4),
    },
    columns: 3,
    cells: [
      { id: "a", value: 2 },
      { id: "b", value: 5 },
      { id: "c", value: 9 },
    ],
    answer: ["b", "c"],
  },
  {
    solver: "classify",
    type: "classify",
    model: {
      rows: [
        { id: "a", amount: 0 },
        { id: "b", amount: 4 },
        { id: "c", amount: 9 },
      ],
      rules: [{ bucket: "low", when: op("lt", ref("amount"), 5) }],
      defaultBucket: "high",
    },
    items: named(["a", "b", "c"]),
    buckets: named(["low", "high"]),
    answers: { a: "low", b: "low", c: "high" },
  },
  {
    solver: "sort",
    type: "sort",
    model: {
      rows: [
        { id: "a", duration: 8 },
        { id: "b", duration: 2 },
        { id: "c", duration: 5 },
      ],
      key: ref("duration"),
      direction: "asc",
    },
    items: named(["a", "b", "c"]),
    answer: ["b", "c", "a"],
  },
  {
    solver: "match",
    type: "match",
    model: {
      leftRows: [
        { id: "a", lengthCM: 100 },
        { id: "b", lengthCM: 250 },
      ],
      rightRows: [
        { id: "x", lengthM: 2.5 },
        { id: "y", lengthM: 1 },
      ],
      leftKey: op("div", ref("lengthCM"), 100),
      rightKey: ref("lengthM"),
    },
    left: named(["a", "b"]),
    right: named(["x", "y"]),
    pairs: { a: "y", b: "x" },
  },
  {
    solver: "select",
    type: "select",
    model: {
      data: { favorable: 3, total: 4 },
      expression: op("div", ref("favorable"), ref("total")),
      options: [
        { id: "a", value: 0.25 },
        { id: "b", value: 0.75 },
        { id: "c", value: 1 },
      ],
    },
    options: named(["a", "b", "c"]),
    multiple: false,
    answer: ["b"],
  },
  {
    solver: "knapsack",
    type: "grid",
    model: {
      capacity: 7,
      rows: [
        { id: "a", weight: 3, value: 5 },
        { id: "b", weight: 4, value: 7 },
        { id: "c", weight: 6, value: 9 },
      ],
    },
    columns: 3,
    cells: [
      { id: "a", value: 5 },
      { id: "b", value: 7 },
      { id: "c", value: 9 },
    ],
    answer: ["a", "b"],
  },
  {
    solver: "toposort",
    type: "sort",
    model: {
      rows: [
        { id: "c", requires: ["b"] },
        { id: "a", requires: [] },
        { id: "b", requires: ["a"] },
      ],
    },
    items: named(["c", "b", "a"]),
    answer: ["a", "b", "c"],
  },
  {
    solver: "route",
    type: "route",
    model: {},
    nodes: named(["a", "b", "c", "d"]).map((n, i) => ({
      ...n,
      x: i,
      y: i % 2,
    })),
    edges: [
      ["a", "b"],
      ["b", "d"],
      ["b", "c"],
    ],
    start: "a",
    end: "d",
    blocked: [],
    required: ["c"],
  },
];

function assertClose(actual, expected, message) {
  if (typeof actual === "number" && typeof expected === "number") {
    assert.ok(
      Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)),
      message + `: ${actual} != ${expected}`,
    );
    return;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, message);
    actual.forEach((value, index) =>
      assertClose(value, expected[index], message),
    );
    return;
  }
  if (
    actual &&
    expected &&
    typeof actual === "object" &&
    typeof expected === "object"
  ) {
    assert.deepEqual(
      Object.keys(actual).sort(),
      Object.keys(expected).sort(),
      message,
    );
    Object.keys(actual).forEach((key) =>
      assertClose(actual[key], expected[key], message),
    );
    return;
  }
  assert.deepEqual(actual, expected, message);
}
function runPython(solutions) {
  const completed = spawnSync("python3", ["-"], {
    input: solutions.map((solution) => solution.code).join("\n"),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 90000,
  });
  assert.equal(
    completed.status,
    0,
    completed.stderr || String(completed.error),
  );
  return completed.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
function withoutGradingKeys(round) {
  const publicRound = {};
  for (const key of Object.keys(round))
    if (!["answer", "targets", "pairs", "answers"].includes(key))
      publicRound[key] = round[key];
  for (const key of ["answer", "targets", "pairs", "answers"])
    Object.defineProperty(publicRound, key, {
      get() {
        throw new Error("Solver accessed grading key " + key);
      },
      enumerable: true,
    });
  return publicRound;
}

test("all nine solver families independently compute perfect responses", () => {
  for (const round of fixture) {
    const solution = ai.solve(withoutGradingKeys(round));
    assert.equal(
      engine.evaluateRound(round, solution.response).score,
      200,
      round.solver,
    );
    assert.equal(solution.trained, false);
    assert.ok(solution.steps.length);
    assert.equal(typeof solution.algorithm, "string");
    assert.ok(solution.code.includes("def solve(problem):"));
  }
});
test("generated Python runs the same algorithm and input as browser fixtures", () => {
  const solutions = fixture.map((round) => ai.solve(round));
  const outputs = runPython(solutions);
  outputs.forEach((output, index) =>
    assertClose(output, solutions[index].response, fixture[index].solver),
  );
});
test("formulas support arrays, robust statistics, nested references, and lazy conditionals", () => {
  const scope = { values: [9, 1, 7, 3, 5], nested: { factor: 2 }, zero: 0 };
  assert.equal(
    ai.evaluateExpression(
      op("mean", op("slice", op("sort", ref("values")), 1, 4)),
      scope,
    ),
    5,
  );
  assert.equal(ai.evaluateExpression(op("variance", [2, 4, 6]), scope), 8 / 3);
  assert.equal(
    ai.evaluateExpression(
      op("if", op("eq", ref("zero"), 0), 8, op("div", 1, 0)),
      scope,
    ),
    8,
  );
  assert.equal(
    ai.evaluateExpression(op("and", false, op("div", 1, 0)), scope),
    false,
  );
  assert.equal(
    ai.evaluateExpression(op("or", true, op("div", 1, 0)), scope),
    true,
  );
  assert.equal(
    ai.evaluateExpression(op("mul", ref("nested.factor"), 3), scope),
    6,
  );
  assert.equal(ai.evaluateExpression(op("bitcount", "001011"), scope), 3);
  assert.equal(ai.evaluateExpression(op("round", -1.25, 1), scope), -1.2);
  const model = {
    data: scope,
    outputs: {
      value: op("mean", op("slice", op("sort", ref("values")), 1, 4)),
      robust: op("if", op("eq", ref("zero"), 0), 8, op("div", 1, 0)),
    },
  };
  const solved = ai.solve({ solver: "formula", model });
  assertClose(
    runPython([solved])[0],
    solved.response,
    "array/lazy Python parity",
  );
});
test("waypoint BFS includes required detours and grading rejects skipped checkpoints", () => {
  const round = fixture.find((r) => r.solver === "route");
  const solved = ai.solve(round);
  assert.deepEqual(solved.response, ["a", "b", "c", "b", "d"]);
  assert.deepEqual(engine.shortestPath(round), solved.response);
  assert.equal(engine.evaluateRound(round, ["a", "b", "d"]).complete, false);
  assert.equal(engine.validResponse(round, ["a", "b", "c", "b", "d"]), true);
  assert.equal(engine.validResponse(round, ["a", "d"]), false);
  assert.equal(
    engine.validResponse({ ...round, blocked: ["c"] }, solved.response),
    false,
  );
});
test("programmatic response validation accepts partial playback but rejects malformed inputs", () => {
  assert.equal(engine.validResponse(fixture[0], {}), true);
  assert.equal(engine.validResponse(fixture[0], { value: 8 }), true);
  assert.equal(engine.validResponse(fixture[0], { value: Infinity }), false);
  assert.equal(engine.validResponse(fixture[0], { value: 21 }), false);
  assert.equal(engine.validResponse(fixture[1], ["b"]), true);
  assert.equal(engine.validResponse(fixture[1], ["b", "b"]), false);
  assert.equal(engine.validResponse(fixture[2], { a: "low" }), true);
  assert.equal(engine.validResponse(fixture[2], { unknown: "low" }), false);
  assert.equal(engine.validResponse(fixture[3], ["a"]), false);
  assert.equal(engine.validResponse(fixture[4], { a: "x", b: "x" }), false);
  assert.equal(engine.validResponse(fixture[5], ["a", "b"]), false);
});
test("public input changes alter the result without changing grading data", () => {
  const original = fixture[0];
  const edited = {
    ...original,
    model: { ...original.model, data: { readings: [10, 20, 30], weight: 2 } },
  };
  assert.equal(ai.solve(original).response.value, 8);
  assert.equal(ai.solve(edited).response.value, 20);
  assert.equal(original.targets.value, 8);
});
test("unsafe or oversized public models fail with a clear error", () => {
  assert.equal(ai.validateModel({ solver: "unknown", model: {} }).valid, false);
  assert.equal(
    ai.validateModel({
      solver: "formula",
      model: { data: { bad: Infinity }, outputs: { value: 1 } },
    }).valid,
    false,
  );
  assert.equal(
    ai.validateModel({
      solver: "knapsack",
      model: {
        capacity: 4,
        rows: Array.from({ length: 19 }, (_, i) => ({
          id: String(i),
          weight: 1,
          value: 1,
        })),
      },
    }).valid,
    false,
  );
  assert.equal(
    ai.validateModel({
      solver: "formula",
      model: { data: { readings: Array(1001).fill(1) }, outputs: { value: 1 } },
    }).valid,
    false,
  );
  let nested = 1;
  for (let i = 0; i < 70; i++) nested = op("add", nested, 1);
  assert.equal(
    ai.validateModel({
      solver: "formula",
      model: { outputs: { value: nested } },
    }).valid,
    false,
  );
  assert.throws(
    () => ai.evaluateExpression({ ref: "__proto__.secret" }, {}),
    /Missing public input/,
  );
  assert.throws(
    () => ai.evaluateExpression(op("div", 1, 0)),
    /Division by zero/,
  );
  assert.throws(
    () =>
      ai.solve({
        ...fixture[4],
        model: {
          ...fixture[4].model,
          rightRows: [
            { id: "x", lengthM: 1 },
            { id: "y", lengthM: 1 },
          ],
        },
      }),
    /no complete solution/,
  );
  assert.throws(() => ai.solve({ ...fixture[8], blocked: ["c"] }), /No route/);
  const cycle = {};
  cycle.self = cycle;
  assert.equal(
    ai.validateModel({
      solver: "formula",
      model: { data: cycle, outputs: { value: 1 } },
    }).valid,
    false,
  );
});
test("all fifty games have substantive, distinct guide fields", () => {
  assert.equal(Object.keys(guides.games).length, 50);
  for (const field of [
    "approach",
    "why",
    "learning",
    "limitations",
    "experiment",
  ]) {
    const texts = oldCatalog.games.map(
      (game) => guides.games[game.id]?.[field],
    );
    assert.ok(
      texts.every((text) => typeof text === "string" && text.length > 50),
      field,
    );
    assert.equal(new Set(texts).size, 50, field + " is topic-specific");
  }
});
test("solving is repeatable and does not mutate the model", () => {
  for (const round of fixture) {
    const before = JSON.stringify(round);
    assert.deepEqual(ai.solve(round), ai.solve(round));
    assert.equal(JSON.stringify(round), before);
  }
});

test("all 450 level challenges solve without grading-key access and reproduce in Python", () => {
  const curriculum = require("../src/data/game-curriculum.js");
  const all = Object.values(curriculum.games).flatMap((game) =>
    Object.values(game.levels).flatMap((level) => level.rounds),
  );
  assert.equal(all.length, 450);
  const solutions = all.map((round) => {
    const validation = ai.validateModel(round);
    assert.equal(
      validation.valid,
      true,
      round.id + ": " + validation.errors.join("; "),
    );
    const solution = ai.solve(withoutGradingKeys(round));
    const outcome = engine.evaluateRound(round, solution.response);
    assert.equal(outcome.score, 200, round.id + " solved score");
    assert.equal(outcome.correct, true, round.id + " correctness");
    for (const step of solution.steps)
      if (step.state?.response)
        assert.equal(
          engine.validResponse(round, step.state.response),
          true,
          round.id + " valid playback response",
        );
    return solution;
  });
  const outputs = runPython(solutions);
  assert.equal(outputs.length, 450);
  outputs.forEach((output, index) =>
    assertClose(
      output,
      solutions[index].response,
      all[index].id + " Python result",
    ),
  );
});
