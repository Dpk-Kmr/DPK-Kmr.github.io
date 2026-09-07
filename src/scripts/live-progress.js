(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaLiveProgress = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const KEY = "atriksha-live-v1";
  const empty = () => ({ version: 1, results: {}, favorites: [] });
  function normalize(raw, ids) {
    const out = empty();
    if (!raw || typeof raw !== "object") return out;
    out.favorites = Array.isArray(raw.favorites)
      ? [...new Set(raw.favorites.filter((id) => ids.includes(id)))]
      : [];
    for (const id of ids)
      for (let level = 0; level < 3; level++) {
        const e = raw.results?.[id]?.[level];
        if (!e || typeof e !== "object") continue;
        const count = (x) =>
          Number.isSafeInteger(x) && x > 0 ? Math.min(x, 1e6) : 0;
        const valid = (x) => Number.isFinite(x) && x >= 0 && x <= 1e8;
        const runs = count(e.runs),
          practiceRuns = count(e.practiceRuns);
        if (!runs && !practiceRuns) continue;
        (out.results[id] ||= {})[level] = {
          best: runs && valid(e.best) ? Math.round(e.best) : 0,
          runs,
          practiceBest:
            practiceRuns && valid(e.practiceBest)
              ? Math.round(e.practiceBest)
              : 0,
          practiceRuns,
          updated:
            Number.isSafeInteger(e.updated) && e.updated >= 0 ? e.updated : 0,
        };
      }
    return out;
  }
  function read(storage, ids) {
    try {
      return normalize(JSON.parse(storage.getItem(KEY)), ids);
    } catch {
      return empty();
    }
  }
  function merge(a, b, ids) {
    const out = normalize(a, ids),
      other = normalize(b, ids);
    for (const id of ids)
      for (let l = 0; l < 3; l++) {
        const y = other.results[id]?.[l];
        if (!y) continue;
        const x = out.results[id]?.[l];
        if (!x) {
          (out.results[id] ||= {})[l] = { ...y };
          continue;
        }
        for (const key of [
          "best",
          "runs",
          "practiceBest",
          "practiceRuns",
          "updated",
        ])
          x[key] = Math.max(x[key], y[key]);
      }
    return out;
  }
  function record(raw, id, level, result, ids, now = Date.now()) {
    if (
      !ids.includes(id) ||
      ![0, 1, 2].includes(level) ||
      !Number.isFinite(result.score) ||
      result.score < 0 ||
      result.score > 1e8
    )
      throw RangeError("Invalid run");
    const out = normalize(raw, ids),
      e = (out.results[id] ||= {})[level] || {
        best: 0,
        runs: 0,
        practiceBest: 0,
        practiceRuns: 0,
        updated: 0,
      },
      key = result.assisted ? "practiceBest" : "best",
      count = result.assisted ? "practiceRuns" : "runs";
    e[key] = Math.max(e[key], Math.round(result.score));
    e[count] = Math.min(1e6, e[count] + 1);
    e.updated = now;
    out.results[id][level] = e;
    return out;
  }
  function totals(state) {
    let runs = 0,
      xp = 0,
      played = 0;
    for (const levels of Object.values(state.results)) {
      let has = false;
      for (const [level, e] of Object.entries(levels)) {
        runs += e.runs;
        xp += e.best * (Number(level) + 1);
        has ||= e.runs > 0;
      }
      if (has) played++;
    }
    return { runs, xp, played };
  }
  return { KEY, empty, normalize, read, merge, record, totals };
});
