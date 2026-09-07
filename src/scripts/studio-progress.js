(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaStudioProgress = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const KEY = "atriksha-studio-v2",
    LEVELS = ["foundation", "applied", "expert"];
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const score = (v) => Number.isFinite(v) && v >= 0 && v <= 1000;
  const count = (v) =>
    Number.isSafeInteger(v) && v >= 0 ? Math.min(v, 1000000) : 0;
  const empty = () => ({
    version: 2,
    results: {},
    favorites: [],
    last: null,
    legacy: {},
  });
  function normalize(value, ids) {
    const out = empty();
    if (!value || typeof value !== "object") return out;
    for (const id of ids) {
      if (own(value.results, id))
        for (const level of LEVELS) {
          const e = value.results[id]?.[level];
          if (!e || typeof e !== "object") continue;
          const validBest = score(e.best) && count(e.runs) > 0,
            validPractice = score(e.practiceBest) && count(e.practiceRuns) > 0;
          if (!validBest && !validPractice) continue;
          (out.results[id] ||= {})[level] = {
            best: validBest ? Math.round(e.best) : null,
            runs: validBest ? count(e.runs) : 0,
            practiceBest: validPractice ? Math.round(e.practiceBest) : null,
            practiceRuns: validPractice ? count(e.practiceRuns) : 0,
            updated:
              Number.isSafeInteger(e.updated) && e.updated >= 0 ? e.updated : 0,
          };
        }
      if (own(value.legacy, id) && score(value.legacy[id]?.best))
        out.legacy[id] = { best: Math.round(value.legacy[id].best) };
    }
    out.favorites = Array.isArray(value.favorites)
      ? [...new Set(value.favorites.filter((id) => ids.includes(id)))]
      : [];
    if (
      ids.includes(value.last?.gameId) &&
      LEVELS.includes(value.last?.levelId)
    )
      out.last = { gameId: value.last.gameId, levelId: value.last.levelId };
    return out;
  }
  function read(storage, ids) {
    let raw;
    try {
      raw = JSON.parse(storage.getItem(KEY));
    } catch {}
    const out = normalize(raw, ids);
    if (!raw)
      try {
        const legacy = JSON.parse(storage.getItem("atriksha-arcade-v1"));
        for (const id of ids)
          if (own(legacy, id) && score(legacy[id]?.best))
            out.legacy[id] = { best: Math.round(legacy[id].best) };
      } catch {}
    return out;
  }
  function merge(a, b, ids) {
    const out = normalize(a, ids),
      other = normalize(b, ids);
    for (const id of ids)
      for (const level of LEVELS) {
        const x = out.results[id]?.[level],
          y = other.results[id]?.[level];
        if (!y) continue;
        if (!x) {
          (out.results[id] ||= {})[level] = y;
          continue;
        }
        for (const [best, runs] of [
          ["best", "runs"],
          ["practiceBest", "practiceRuns"],
        ]) {
          x[best] =
            x[best] === null
              ? y[best]
              : y[best] === null
                ? x[best]
                : Math.max(x[best], y[best]);
          x[runs] = Math.max(x[runs], y[runs]);
        }
        x.updated = Math.max(x.updated, y.updated);
      }
    return out;
  }
  function record(
    value,
    gameId,
    levelId,
    points,
    assisted,
    ids,
    now = Date.now(),
  ) {
    if (!ids.includes(gameId) || !LEVELS.includes(levelId) || !score(points))
      throw new RangeError("Invalid level result");
    const out = normalize(value, ids),
      e = (out.results[gameId] ||= {})[levelId] || {
        best: null,
        runs: 0,
        practiceBest: null,
        practiceRuns: 0,
        updated: 0,
      };
    const key = assisted ? "practiceBest" : "best",
      runs = assisted ? "practiceRuns" : "runs";
    e[key] = Math.max(e[key] ?? 0, Math.round(points));
    e[runs] = Math.min(e[runs] + 1, 1000000);
    e.updated = now;
    (out.results[gameId] ||= {})[levelId] = e;
    out.last = { gameId, levelId };
    return out;
  }
  function stars(points) {
    return points >= 900 ? 3 : points >= 700 ? 2 : points >= 400 ? 1 : 0;
  }
  function totals(state) {
    let played = 0,
      mastered = 0,
      xp = 0,
      earnedStars = 0,
      practiced = 0;
    for (const game of Object.values(state.results))
      for (const [level, e] of Object.entries(game)) {
        if (e.practiceRuns) practiced++;
        if (!e.runs) continue;
        played++;
        mastered += Number(e.best >= 900);
        earnedStars += stars(e.best);
        xp += e.best * (LEVELS.indexOf(level) + 1);
      }
    return { played, mastered, xp, stars: earnedStars, practiced };
  }
  function levelScore(points, rounds) {
    if (
      !Number.isFinite(points) ||
      points < 0 ||
      !Number.isInteger(rounds) ||
      rounds < 1 ||
      points > rounds * 200
    )
      throw new RangeError("Invalid challenge points");
    return Math.round((points / (rounds * 200)) * 1000);
  }
  return {
    KEY,
    LEVELS,
    empty,
    normalize,
    read,
    merge,
    record,
    stars,
    totals,
    levelScore,
  };
});
