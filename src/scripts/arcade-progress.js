(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaProgress = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const KEY = "atriksha-arcade-v1";
  const stars = (score) =>
    score >= 900 ? 3 : score >= 700 ? 2 : score >= 400 ? 1 : 0;
  function normalize(value, ids) {
    const clean = {};
    if (!value || typeof value !== "object" || Array.isArray(value))
      return clean;
    for (const id of ids) {
      if (!Object.hasOwn(value, id)) continue;
      const entry = value[id];
      if (
        !entry ||
        typeof entry !== "object" ||
        !Number.isFinite(entry.best) ||
        entry.best < 0 ||
        entry.best > 1000
      )
        continue;
      clean[id] = {
        best: Math.round(entry.best),
        runs:
          Number.isSafeInteger(entry.runs) && entry.runs > 0
            ? Math.min(entry.runs, 1000000)
            : 1,
      };
    }
    return clean;
  }
  function read(storage, ids) {
    try {
      return normalize(JSON.parse(storage.getItem(KEY)), ids);
    } catch {
      return {};
    }
  }
  function record(progress, id, score, ids) {
    if (
      !ids.includes(id) ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1000
    )
      throw new RangeError("Invalid game result");
    const next = normalize(progress, ids);
    const previous = next[id];
    next[id] = {
      best: Math.max(previous?.best || 0, Math.round(score)),
      runs: Math.min((previous?.runs || 0) + 1, 1000000),
    };
    return next;
  }
  function totals(progress) {
    const entries = Object.values(progress);
    return {
      played: entries.length,
      score: entries.reduce((n, e) => n + e.best, 0),
      stars: entries.reduce((n, e) => n + stars(e.best), 0),
      mastered: entries.filter((e) => e.best >= 900).length,
    };
  }
  return { KEY, stars, normalize, read, record, totals };
});
