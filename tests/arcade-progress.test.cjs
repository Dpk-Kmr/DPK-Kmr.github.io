const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../src/scripts/arcade-progress.js");
const ids = ["mean-mixer", "packet-router"];
test("progress tolerates blocked, missing, and corrupt browser storage", () => {
  for (const storage of [
    undefined,
    {
      getItem() {
        throw Error("denied");
      },
    },
    { getItem: () => "{broken" },
    { getItem: () => "null" },
  ])
    assert.deepEqual(p.read(storage, ids), {});
});
test("only valid catalog scores survive storage normalization", () => {
  assert.deepEqual(
    p.normalize(
      {
        "mean-mixer": { best: 700, runs: 2 },
        "packet-router": { best: 1001 },
        unknown: { best: 1000 },
      },
      ids,
    ),
    { "mean-mixer": { best: 700, runs: 2 } },
  );
  for (const best of [NaN, Infinity, -1, "800", null])
    assert.deepEqual(p.normalize({ "mean-mixer": { best } }, ids), {});
});
test("replays preserve best score without inflating total points", () => {
  let progress = p.record({}, ids[0], 800, ids);
  progress = p.record(progress, ids[0], 400, ids);
  assert.deepEqual(progress[ids[0]], { best: 800, runs: 2 });
  progress = p.record(progress, ids[1], 1000, ids);
  assert.deepEqual(p.totals(progress), {
    played: 2,
    score: 1800,
    stars: 5,
    mastered: 1,
  });
});
test("zero-score completion counts as played and new best replaces only that game", () => {
  const first = p.record({}, ids[0], 0, ids);
  const second = p.record(first, ids[0], 900, ids);
  assert.equal(p.totals(first).played, 1);
  assert.equal(first[ids[0]].best, 0);
  assert.equal(second[ids[0]].best, 900);
  assert.deepEqual(
    [399, 400, 699, 700, 899, 900, 1000].map(p.stars),
    [0, 1, 1, 2, 2, 3, 3],
  );
});
test("invalid scores and unknown games cannot be recorded", () => {
  for (const score of [-1, 1001, NaN, Infinity, "500"])
    assert.throws(() => p.record({}, ids[0], score, ids), RangeError);
  assert.throws(() => p.record({}, "unknown", 1000, ids), RangeError);
});
