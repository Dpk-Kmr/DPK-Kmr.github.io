const test = require("node:test"),
  assert = require("node:assert/strict"),
  lib = require("../src/scripts/game-library.js"),
  p = require("../src/scripts/studio-progress.js");
const categories = [
  { id: "data", name: "Data science" },
  { id: "iot", name: "IoT" },
];
const games = [
  {
    id: "a",
    title: "Alpha",
    concept: "Robust mean",
    category: "data",
    minutes: 2,
  },
  {
    id: "b",
    title: "Beta",
    concept: "Network routing",
    category: "iot",
    minutes: 4,
  },
  {
    id: "c",
    title: "Gamma",
    concept: "Feature scaling",
    category: "data",
    minutes: 3,
  },
];
const curriculum = {
  games: Object.fromEntries(
    games.map((g) => [
      g.id,
      {
        objective: g.concept,
        prerequisites: ["Math"],
        levels: ["foundation", "applied", "expert"].map((id) => ({
          id,
          description: id,
          rounds: [{ type: g.id === "b" ? "route" : "tune" }],
        })),
      },
    ]),
  ),
};
let state = p.record(
  p.empty(),
  "a",
  "foundation",
  950,
  false,
  ["a", "b", "c"],
  1,
);
state.favorites = ["a", "b"];
test("multiple filters combine topics, words, mechanism, duration and favorites", () => {
  const out = lib.query(games, categories, curriculum, state, {
    query: "mean math",
    topics: ["data"],
    mechanic: "tune",
    duration: "quick",
    level: "foundation",
    favoritesOnly: true,
  });
  assert.deepEqual(
    out.map((x) => x.game.id),
    ["a"],
  );
});
test("progress and score sorting apply to chosen level, not a different achievement", () => {
  assert.deepEqual(
    lib
      .query(games, categories, curriculum, state, {
        level: "foundation",
        status: "mastered",
      })
      .map((x) => x.game.id),
    ["a"],
  );
  assert.equal(
    lib.query(games, categories, curriculum, state, {
      level: "expert",
      status: "mastered",
    }).length,
    0,
  );
  assert.equal(
    lib.query(games, categories, curriculum, state, {
      level: "foundation",
      sort: "score",
    })[0].game.id,
    "a",
  );
});
test("recommended level moves forward after mastery while explicit selection stays available", () => {
  assert.equal(lib.chooseLevel(games[0], curriculum, state).id, "applied");
  assert.equal(
    lib.chooseLevel(games[0], curriculum, state, "foundation").id,
    "foundation",
  );
});
test("duration and alphabetical sorts are deterministic", () => {
  assert.deepEqual(
    lib
      .query(games, categories, curriculum, state, {
        level: "foundation",
        sort: "shortest",
      })
      .map((x) => x.game.id),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    lib
      .query(games, categories, curriculum, state, {
        level: "expert",
        duration: "deep",
        sort: "title",
      })
      .map((x) => x.game.id),
    ["b", "c"],
  );
});
test("any-level progress filters find earlier mastery after recommendation advances", () => {
  assert.deepEqual(
    lib
      .query(games, categories, curriculum, state, {
        level: "any",
        status: "mastered",
      })
      .map((x) => [x.game.id, x.level.id]),
    [["a", "foundation"]],
  );
  assert.equal(
    lib.query(games, categories, curriculum, state, {
      level: "any",
      sort: "score",
    })[0].record.best,
    950,
  );
});
