(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaGameLibrary = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const LEVELS = ["foundation", "applied", "expert"];
  function chooseLevel(game, curriculum, state, selected = "any") {
    const levels = curriculum.games[game.id].levels;
    return (
      levels.find((l) => l.id === selected) ||
      levels.find((l) => (state.results[game.id]?.[l.id]?.best ?? -1) < 900) ||
      levels[levels.length - 1]
    );
  }
  function query(games, categories, curriculum, state, filters = {}) {
    const text = String(filters.query || "")
        .trim()
        .toLowerCase(),
      topics = filters.topics || [],
      favoriteSet = new Set(state.favorites),
      items = [];
    for (const [index, game] of games.entries()) {
      const definition = curriculum.games[game.id],
        favorite = favoriteSet.has(game.id);
      if (
        (topics.length && !topics.includes(game.category)) ||
        (filters.favoritesOnly && !favorite)
      )
        continue;
      const haystack = [
        game.title,
        game.concept,
        definition.objective,
        ...(definition.prerequisites || []),
        categories.find((c) => c.id === game.category)?.name,
        ...definition.levels.map((l) => l.description),
      ]
        .join(" ")
        .toLowerCase();
      if (text && !text.split(/\s+/).every((word) => haystack.includes(word)))
        continue;
      let candidates = definition.levels.map((level) => ({
        game,
        level,
        record: state.results[game.id]?.[level.id],
        mechanics: [...new Set(level.rounds.map((r) => r.type))],
        minutes: game.minutes + LEVELS.indexOf(level.id) * 2,
        favorite,
        rank:
          (index % 10) * categories.length +
          categories.findIndex((c) => c.id === game.category),
      }));
      candidates = candidates.filter(
        (x) =>
          (!filters.level ||
            filters.level === "any" ||
            x.level.id === filters.level) &&
          (!filters.mechanic ||
            filters.mechanic === "any" ||
            x.mechanics.includes(filters.mechanic)) &&
          (!filters.duration ||
            filters.duration === "any" ||
            (filters.duration === "quick" && x.minutes <= 3) ||
            (filters.duration === "medium" &&
              x.minutes >= 4 &&
              x.minutes <= 6) ||
            (filters.duration === "deep" && x.minutes >= 7)) &&
          (!filters.status ||
            filters.status === "all" ||
            (filters.status === "unplayed" && !x.record?.runs) ||
            (filters.status === "played" && x.record?.runs) ||
            (filters.status === "mastered" && x.record?.best >= 900) ||
            (filters.status === "practice" && x.record?.practiceRuns)),
      );
      if (!candidates.length) continue;
      const preferred = chooseLevel(game, curriculum, state, filters.level);
      if (filters.sort === "score")
        candidates.sort(
          (a, b) => (b.record?.best ?? -1) - (a.record?.best ?? -1),
        );
      else if (filters.sort === "recent")
        candidates.sort(
          (a, b) => (b.record?.updated ?? 0) - (a.record?.updated ?? 0),
        );
      else if (filters.sort === "shortest")
        candidates.sort((a, b) => a.minutes - b.minutes);
      else if (filters.sort === "longest")
        candidates.sort((a, b) => b.minutes - a.minutes);
      else
        candidates.sort(
          (a, b) =>
            Number(b.level.id === preferred.id) -
            Number(a.level.id === preferred.id),
        );
      items.push(candidates[0]);
    }
    const sorts = {
      recommended: (a, b) => a.rank - b.rank,
      title: (a, b) => a.game.title.localeCompare(b.game.title),
      shortest: (a, b) => a.minutes - b.minutes,
      longest: (a, b) => b.minutes - a.minutes,
      score: (a, b) => (b.record?.best ?? -1) - (a.record?.best ?? -1),
      recent: (a, b) => (b.record?.updated ?? 0) - (a.record?.updated ?? 0),
    };
    return items.sort(
      (a, b) =>
        (sorts[filters.sort] || sorts.recommended)(a, b) ||
        a.game.title.localeCompare(b.game.title),
    );
  }
  return { chooseLevel, query };
});
