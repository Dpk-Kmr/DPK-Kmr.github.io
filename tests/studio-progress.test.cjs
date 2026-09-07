const test = require("node:test"),
  assert = require("node:assert/strict"),
  p = require("../src/scripts/studio-progress.js");
const ids = ["mean-mixer", "packet-router"];
test("independent bests produce difficulty-weighted XP; replay does not farm XP", () => {
  let s = p.record(p.empty(), ids[0], "foundation", 1000, false, ids, 1);
  s = p.record(s, ids[0], "expert", 800, false, ids, 2);
  s = p.record(s, ids[0], "expert", 200, false, ids, 3);
  assert.equal(s.results[ids[0]].expert.runs, 2);
  assert.deepEqual(p.totals(s), {
    played: 2,
    mastered: 1,
    xp: 3400,
    stars: 5,
    practiced: 0,
  });
});
test("AI assisted sessions retain practice scores without changing personal best or XP", () => {
  let s = p.record(p.empty(), ids[1], "applied", 400, false, ids);
  s = p.record(s, ids[1], "applied", 1000, true, ids);
  assert.equal(s.results[ids[1]].applied.best, 400);
  assert.equal(s.results[ids[1]].applied.practiceBest, 1000);
  assert.equal(p.totals(s).xp, 800);
});
test("corrupt or blocked storage fails safely; old scores remain a separate legacy record", () => {
  assert.deepEqual(
    p.read(
      {
        getItem() {
          throw Error();
        },
      },
      ids,
    ),
    p.empty(),
  );
  const s = p.read(
    {
      getItem: (key) =>
        key === p.KEY ? null : JSON.stringify({ "mean-mixer": { best: 900 } }),
    },
    ids,
  );
  assert.equal(s.legacy["mean-mixer"].best, 900);
  assert.equal(p.totals(s).xp, 0);
  assert.deepEqual(
    p.normalize(
      {
        results: { "mean-mixer": { expert: { best: 1001, runs: 2 } } },
        favorites: ["unknown"],
      },
      ids,
    ),
    p.empty(),
  );
});
test("merge retains better results from another tab and preserves current favorites", () => {
  const a = p.record(p.empty(), ids[0], "expert", 700, false, ids),
    b = p.record(p.empty(), ids[0], "expert", 900, false, ids);
  a.favorites = [ids[1]];
  assert.equal(p.merge(a, b, ids).results[ids[0]].expert.best, 900);
  assert.deepEqual(p.merge(a, b, ids).favorites, [ids[1]]);
});
test("normalized level scores use all rounds and reject impossible results", () => {
  assert.equal(p.levelScore(600, 3), 1000);
  assert.equal(p.levelScore(400, 3), 667);
  assert.equal(p.levelScore(0, 3), 0);
  for (const args of [
    [601, 3],
    [0, 0],
    [NaN, 3],
    [-1, 3],
  ])
    assert.throws(() => p.levelScore(...args), RangeError);
  assert.throws(
    () => p.record(p.empty(), ids[0], "unknown", 1000, false, ids),
    RangeError,
  );
});
