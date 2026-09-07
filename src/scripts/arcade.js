(() => {
  "use strict";
  const catalog = window.ATRIKSHA_GAMES,
    curriculum = window.ATRIKSHA_CURRICULUM,
    engine = window.AtrikshaGamesEngine,
    AI = window.AtrikshaGameAI,
    guides = window.ATRIKSHA_AI_GUIDES,
    model = window.AtrikshaStudioProgress,
    library = window.AtrikshaGameLibrary;
  const $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  if (
    !catalog ||
    !curriculum ||
    !engine ||
    !AI ||
    !guides ||
    !model ||
    !library
  ) {
    $("[data-result-count]").textContent =
      "The learning studio could not load. Refresh this page to try again.";
    return;
  }
  const { games, categories } = catalog,
    ids = games.map((g) => g.id),
    levelNames = {
      foundation: "Foundation",
      applied: "Applied",
      expert: "Expert",
    },
    mechanics = {
      tune: "Tune & simulate",
      route: "Route & navigate",
      grid: "Scan & select",
      sort: "Order & sequence",
      match: "Connect & match",
      classify: "Classify & group",
      select: "Reason & decide",
    };
  const scoring = {
    tune: "Match the numerical target. Closer values earn more points; the allowed tolerance is specific to each control.",
    route:
      "Follow the drawn links and required waypoints, avoiding blocked nodes. A shortest valid route earns 200; each extra step loses 20.",
    grid: "Select all cells that satisfy the rule. Missed cells and false selections both reduce your score.",
    sort: "Arrange every item. Each correctly ordered pair contributes to your score.",
    match:
      "Match every item with a distinct partner. Points reflect the proportion of correct pairs.",
    classify:
      "Assign every item to a group. Points reflect the proportion of correct assignments.",
    select:
      "Choose the answer that follows from the data. For multi-select rounds, both missed and extra answers reduce your score.",
  };
  let storage;
  try {
    storage = window.localStorage;
  } catch {}
  let progress = model.read(storage, ids),
    topics = new Set(),
    visible = 12,
    current = null,
    level = null,
    roundIndex = 0,
    points = 0,
    roundScores = [],
    phase = "brief",
    assisted = false,
    mounted = null,
    returnFocus = null,
    pendingStorage = false,
    aiResult = null,
    aiIndex = 0,
    aiTimer = null,
    sandboxResult = null;
  const dialog = $(".game-dialog"),
    stage = $("[data-game-stage]"),
    feedback = $("[data-game-feedback]"),
    submit = $("[data-submit-game]"),
    results = $("[data-game-results]");
  const defaults = {
    level: "any",
    mechanic: "any",
    duration: "any",
    status: "all",
    sort: "recommended",
  };
  const controlIds = {
    level: "level-filter",
    mechanic: "mechanic-filter",
    duration: "duration-filter",
    status: "progress-filter",
    sort: "sort-games",
  };
  const art = (type) => {
    const grid =
      '<path class="art-grid" d="M15 20H175M15 45H175M15 70H175M15 95H175M30 10V100M70 10V100M110 10V100M150 10V100"/>';
    const shapes = {
      tune: '<path class="art-line art-dim" d="M20 90 50 65 80 72 110 35 140 42 170 15"/><path class="art-line" d="M20 90 170 20"/><g class="art-fill"><circle cx="50" cy="65" r="4"/><circle cx="80" cy="72" r="4"/><circle cx="110" cy="35" r="4"/><circle cx="140" cy="42" r="4"/></g><path class="art-line" d="M25 99h140"/><circle class="art-fill" cx="118" cy="99" r="5"/>',
      sort: '<g class="art-fill"><rect x="26" y="64" width="21" height="27" rx="3" opacity=".4"/><rect x="60" y="49" width="21" height="42" rx="3" opacity=".6"/><rect x="94" y="32" width="21" height="59" rx="3" opacity=".8"/><rect x="128" y="14" width="21" height="77" rx="3"/></g><path class="art-line" d="M23 100h131m-7-5 7 5-7 5"/>',
      match:
        '<g class="art-line"><rect x="25" y="16" width="30" height="19" rx="4"/><rect x="25" y="45" width="30" height="19" rx="4"/><rect x="25" y="74" width="30" height="19" rx="4"/><rect x="135" y="16" width="30" height="19" rx="4"/><rect x="135" y="45" width="30" height="19" rx="4"/><rect x="135" y="74" width="30" height="19" rx="4"/><path d="M55 25C94 25 94 84 135 84M55 54C95 54 95 25 135 25M55 83C95 83 95 54 135 54"/></g>',
      classify:
        '<g class="art-line"><path d="M95 21v25M35 65V46h120v19"/><rect x="22" y="67" width="28" height="27" rx="5"/><rect x="82" y="67" width="28" height="27" rx="5"/><rect x="142" y="67" width="28" height="27" rx="5"/></g><circle class="art-fill" cx="95" cy="20" r="9"/><circle class="art-fill" cx="35" cy="80" r="4"/><path class="art-fill" d="m96 74 6 10H90Z"/><rect class="art-fill" x="152" y="76" width="8" height="8"/>',
      grid: Array.from(
        { length: 15 },
        (_, i) =>
          `<rect x="${30 + (i % 5) * 27}" y="${18 + Math.floor(i / 5) * 26}" width="20" height="20" rx="3" class="${[1, 3, 7, 11, 14].includes(i) ? "art-fill" : "art-line art-dim"}"/>`,
      ).join(""),
      route:
        '<path class="art-line art-dim" d="M25 55 65 22 110 55 155 22M25 55 65 90 110 55 155 90M65 22 65 90M155 22 155 90"/><path class="art-line" d="M25 55 65 22 110 55 155 90"/><g class="art-fill"><circle cx="25" cy="55" r="6"/><circle cx="65" cy="22" r="6"/><circle cx="110" cy="55" r="6"/><circle cx="155" cy="90" r="6"/></g><g class="art-line"><circle cx="65" cy="90" r="6"/><circle cx="155" cy="22" r="6"/></g>',
      select:
        '<g class="art-line"><path d="M20 90h150M20 90V15"/><circle cx="52" cy="70" r="4"/><circle cx="64" cy="63" r="4"/><circle cx="85" cy="66" r="4"/><circle cx="109" cy="41" r="4"/><circle cx="124" cy="36" r="4"/><circle cx="142" cy="30" r="4"/></g><path class="art-line art-dim" d="M32 85 158 18"/><circle class="art-line" cx="109" cy="41" r="15"/>',
    };
    return `<svg viewBox="0 0 190 110" aria-hidden="true">${grid}${shapes[type] || shapes.select}</svg>`;
  };
  function persist() {
    try {
      storage.setItem(model.KEY, JSON.stringify(progress));
      $("[data-storage-note]").textContent = "Saved on this browser";
    } catch {
      $("[data-storage-note]").textContent = "Saved for this visit";
    }
  }
  function mergeSavedProgress() {
    try {
      const saved = model.normalize(
        JSON.parse(storage.getItem(model.KEY)),
        ids,
      );
      progress = model.merge(progress, saved, ids);
      // A game in progress defers storage events until its score is saved.
      if (pendingStorage) progress.favorites = saved.favorites;
    } catch {}
  }
  function showProgress() {
    const t = model.totals(progress);
    $("[data-total-played]").innerHTML = `${t.played} <small>/ 150</small>`;
    $("[data-total-score]").textContent = t.xp.toLocaleString("en-IN");
    $("[data-total-stars]").innerHTML = `${t.stars} <small>/ 450</small>`;
    $("[data-total-mastered]").textContent = t.mastered;
    const legacy = Object.entries(progress.legacy);
    $("[data-legacy-progress]").hidden = !legacy.length;
    $("[data-legacy-list]").innerHTML = legacy
      .map(
        ([id, e]) =>
          `<p>${esc(games.find((g) => g.id === id)?.title)} <strong>${e.best} / 1,000</strong></p>`,
      )
      .join("");
  }
  function filters() {
    return {
      query: $("#game-search").value,
      topics: [...topics],
      ...Object.fromEntries(
        Object.entries(controlIds).map(([key, id]) => [key, $("#" + id).value]),
      ),
      favoritesOnly: $("#favorites-filter").checked,
    };
  }
  function syncURL(hash = location.hash) {
    const f = filters(),
      q = new URLSearchParams();
    if (f.query.trim()) q.set("q", f.query.trim());
    if (f.topics.length) q.set("topics", f.topics.join(","));
    for (const key of Object.keys(defaults))
      if (f[key] !== defaults[key]) q.set(key, f[key]);
    if (f.favoritesOnly) q.set("saved", "1");
    const query = q.toString();
    try {
      history.replaceState(
        null,
        "",
        location.pathname + (query ? "?" + query : "") + hash,
      );
    } catch {}
  }
  function readFilters() {
    const q = new URLSearchParams(location.search);
    $("#game-search").value = (q.get("q") || "").slice(0, 160);
    topics = new Set(
      (q.get("topics") || "")
        .split(",")
        .filter((id) => categories.some((c) => c.id === id)),
    );
    for (const [key, id] of Object.entries(controlIds)) {
      const input = $("#" + id),
        value = q.get(key);
      input.value = [...input.options].some((o) => o.value === value)
        ? value
        : defaults[key];
    }
    $("#favorites-filter").checked = q.get("saved") === "1";
  }
  function renderCards() {
    const focus = document.activeElement?.closest(
        "[data-play],[data-favorite]",
      ),
      focusId = focus?.dataset.play || focus?.dataset.favorite,
      wasFavorite = !!focus?.dataset.favorite;
    const f = filters(),
      items = library.query(games, categories, curriculum, progress, f),
      shown = items.slice(0, visible);
    $("[data-game-grid]").innerHTML = shown
      .map((x) => {
        const g = x.game,
          c = categories.find((c) => c.id === g.category),
          done = Object.values(progress.results[g.id] || {}).filter(
            (e) => e.runs,
          ).length;
        return `<article class="game-card" data-color="${esc(c.color)}"><div class="game-art"><span class="game-card-number">${String(ids.indexOf(g.id) + 1).padStart(2, "0")} / 50</span><button type="button" class="game-favorite" data-favorite="${esc(g.id)}" aria-pressed="${x.favorite}" aria-label="${x.favorite ? "Unsave" : "Save"} ${esc(g.title)}">${x.favorite ? "♥" : "♡"}</button>${window.AtrikshaGameArt?.render(g.id) || art(x.level.rounds[0].type)}<span class="game-card-status">${done ? done + " / 3 levels scored" : "3 levels"}</span></div><div class="game-card-body"><p class="game-card-topic">${esc(c.name)}</p><h3>${esc(g.title)}</h3><p class="game-card-description">${esc(g.concept)}</p><div class="game-card-levels" aria-label="${done} of 3 levels scored">${model.LEVELS.map(
          (id) => {
            const r = progress.results[g.id]?.[id];
            return `<span class="${r?.best >= 900 ? "is-mastered" : r?.runs ? "is-complete" : ""}" title="${levelNames[id]}: ${r?.best ?? "not scored"}"></span>`;
          },
        ).join(
          "",
        )}</div><div class="game-card-meta"><span>${levelNames[x.level.id]} · ${x.minutes} min</span><span>${x.record?.runs ? "Best " + x.record.best : "3 challenges"}</span></div><p class="game-card-code"><span aria-hidden="true">⌘</span> ${esc(mechanics[x.level.rounds[0].type])} · AI guide</p></div><button class="game-card-play" type="button" data-play="${esc(g.id)}" data-level="${x.level.id}" aria-label="Open ${esc(g.title)}, ${levelNames[x.level.id]}"><span>Explore game</span><span aria-hidden="true">↗</span></button></article>`;
      })
      .join("");
    $("[data-result-count]").textContent = items.length
      ? `${shown.length} of ${items.length} games`
      : "No matching games";
    $("[data-empty]").hidden = !!items.length;
    $("[data-load-more]").hidden = shown.length >= items.length;
    const n =
      topics.size +
      Number(!!f.query.trim()) +
      Number(f.favoritesOnly) +
      ["level", "mechanic", "duration", "status"].filter(
        (k) => f[k] !== defaults[k],
      ).length;
    $("[data-filter-count]").textContent = n ? `${n} active` : "";
    $("[data-reset-filters]").hidden = !n && f.sort === "recommended";
    document
      .querySelectorAll("[data-category]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(
            b.dataset.category === "all"
              ? !topics.size
              : topics.has(b.dataset.category),
          ),
        ),
      );
    if (focusId)
      (
        document.querySelector(
          `[data-${wasFavorite ? "favorite" : "play"}="${focusId}"]`,
        ) || $("#game-search")
      ).focus({ preventScroll: true });
  }
  $("[data-categories]").innerHTML = [
    { id: "all", name: "All topics", color: "lime" },
    ...categories,
  ]
    .map(
      (c) =>
        `<button type="button" class="category-chip" data-category="${esc(c.id)}" data-color="${esc(c.color)}" aria-pressed="${c.id === "all"}"><i aria-hidden="true"></i>${esc(c.name)}<small>${c.id === "all" ? 50 : 10}</small></button>`,
    )
    .join("");
  function changedFilters() {
    visible = 12;
    renderCards();
    syncURL();
  }
  $("[data-categories]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-category]");
    if (!b) return;
    const id = b.dataset.category;
    if (id === "all") topics.clear();
    else topics.has(id) ? topics.delete(id) : topics.add(id);
    changedFilters();
  });
  for (const id of Object.values(controlIds))
    $("#" + id).addEventListener("change", changedFilters);
  $("#favorites-filter").addEventListener("change", changedFilters);
  $("#game-search").addEventListener("input", changedFilters);
  function clearFilters() {
    topics.clear();
    $("#game-search").value = "";
    $("#favorites-filter").checked = false;
    for (const [k, id] of Object.entries(controlIds))
      $("#" + id).value = defaults[k];
    changedFilters();
  }
  $("[data-reset-filters]").addEventListener("click", () => {
    clearFilters();
    $("#game-search").focus();
  });
  $("[data-clear-filters]").addEventListener("click", () => {
    clearFilters();
    $("#game-search").focus();
  });
  $("[data-load-more]").addEventListener("click", () => {
    const count = document.querySelectorAll(".game-card-play").length;
    visible += 12;
    renderCards();
    document
      .querySelectorAll(".game-card-play")
      [count]?.focus({ preventScroll: true });
  });
  function stopAI() {
    if (aiTimer !== null) clearInterval(aiTimer);
    aiTimer = null;
    const b = $("[data-ai-auto]");
    if (b) {
      const paused = document.documentElement.dataset.motion === "paused";
      b.disabled = paused;
      b.textContent = paused ? "Autoplay paused" : "Play steps";
      b.title = paused
        ? "Motion is paused. Use the arrows to explore each step."
        : "Play the solver steps automatically";
      b.setAttribute("aria-pressed", "false");
    }
  }
  function definition() {
    return curriculum.games[current.id];
  }
  function guide() {
    return guides.games[current.id];
  }
  function scoreCopy() {
    return "Each challenge offers 200 points, with partial credit for incomplete accuracy. Finish all three challenges to receive a level score: total points ÷ 600 × 1,000. Stars are earned at 400, 700 and 900. Your best independent score contributes 1×, 2× or 3× XP for Foundation, Applied or Expert. Replays add XP only when your best improves. AI practice is tracked separately.";
  }
  function renderBrief() {
    stopAI();
    mounted?.destroy();
    mounted = null;
    phase = "brief";
    dialog.classList.add("is-briefing");
    $("[data-play-workspace]").hidden = true;
    results.hidden = true;
    $("[data-game-brief]").hidden = false;
    $("[data-practice-indicator]").hidden = true;
    $("#game-title").textContent = current.title;
    $("[data-game-context]").textContent =
      `${current.title} · ${levelNames[level.id]}`;
    $("#game-prompt").textContent = definition().objective;
    dialog.setAttribute("aria-describedby", "game-prompt");
    $("[data-game-brief]").innerHTML =
      `<div class="level-picker" role="group" aria-label="Choose complexity level">${definition()
        .levels.map((l, i) => {
          const saved = progress.results[current.id]?.[l.id];
          return `<button type="button" class="level-option" data-select-level="${l.id}" aria-pressed="${l.id === level.id}"><span class="level-option-number">LEVEL 0${i + 1} · ${i + 1}× XP</span><strong>${levelNames[l.id]}</strong><p>${esc(l.title)}</p><small>${saved?.runs ? "Best " + saved.best + " / 1,000" : "Ready to play"}</small></button>`;
        })
        .join(
          "",
        )}</div><p class="brief-level-description">${esc(level.description)}</p><div class="brief-details-grid"><div><h3>How to play</h3><ol>${definition()
        .rules.map((r) => `<li>${esc(r)}</li>`)
        .join(
          "",
        )}</ol></div><div class="brief-concept"><h3>What you’ll learn</h3><p>${esc(current.concept)}</p><div class="prerequisite-tags">${(definition().prerequisites || []).map((p) => `<span class="tag">${esc(p)}</span>`).join("")}</div><p class="study-status">3 challenges · about ${current.minutes + model.LEVELS.indexOf(level.id) * 2} minutes</p></div></div><details class="brief-score"><summary>Scoring &amp; AI practice</summary><p>${scoreCopy()}</p></details><div class="brief-actions"><span>Every level is open to explore.</span><div><button type="button" class="button button-secondary" data-start-ai>Learn with AI <span aria-hidden="true">⌘</span></button><button type="button" class="button button-primary" data-start-level>Play ${levelNames[level.id]} <span aria-hidden="true">→</span></button></div></div>`;
    syncURL("#" + current.id + "/" + level.id);
    dialog.scrollTop = 0;
  }
  function openGame(id, levelId, trigger) {
    const g = games.find((g) => g.id === id);
    if (!g) return;
    stopAI();
    if (!dialog.open)
      returnFocus =
        trigger ||
        (document.activeElement === document.body
          ? null
          : document.activeElement);
    current = g;
    level = library.chooseLevel(
      g,
      curriculum,
      progress,
      levelId || filters().level,
    );
    $("[data-game-category]").textContent = categories.find(
      (c) => c.id === g.category,
    ).name;
    renderBrief();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("game-open");
    $("#game-title").focus({ preventScroll: true });
  }
  function setCoachTab(id, focus = false) {
    document.querySelectorAll("[data-coach-tab]").forEach((b) => {
      const active = b.dataset.coachTab === id;
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
      if (active && focus) b.focus();
    });
    $("#panel-rules").hidden = id !== "rules";
    $("#panel-ai").hidden = id !== "ai";
    if (id !== "ai") stopAI();
  }
  function renderCoach() {
    const round = level.rounds[roundIndex],
      g = guide();
    setCoachTab("rules");
    $("[data-rules-panel]").innerHTML =
      `<h3>${levelNames[level.id]} rules</h3><ol>${definition()
        .rules.map((r) => `<li>${esc(r)}</li>`)
        .join(
          "",
        )}</ol><div class="coach-meta"><span class="tag">${esc(mechanics[round.type])}</span><span class="tag">${model.LEVELS.indexOf(level.id) + 1}× XP</span></div><details class="coach-scoring" open><summary>Scoring this challenge</summary><p>${esc(scoring[round.type])}</p></details><details class="coach-scoring"><summary>Level score &amp; personal best</summary><p>${scoreCopy()}</p></details>`;
    $("[data-ai-intro]").innerHTML =
      `<p class="ai-algorithm"><span aria-hidden="true">⌘</span> ALGORITHM LAB</p><h3>${esc(g.approach)}</h3><p>${esc(g.why)}</p><details class="ai-guide-extra"><summary>What this teaches</summary><p>${esc(g.learning)}</p><p>${esc(g.limitations)}</p></details>`;
    $("[data-ai-output]").hidden = true;
    $("[data-ai-output]").replaceChildren();
    aiResult = null;
    aiIndex = 0;
    sandboxResult = null;
    $("[data-run-ai]").textContent = "Run the solver →";
  }
  function drawRound() {
    stopAI();
    mounted?.destroy();
    phase = "answer";
    const r = level.rounds[roundIndex];
    results.hidden = true;
    $("[data-play-workspace]").hidden = false;
    $("[data-game-brief]").hidden = true;
    dialog.classList.remove("is-briefing");
    $("#game-title").textContent = current.title;
    $("[data-game-context]").textContent =
      `${current.title} · ${levelNames[level.id]}`;
    $("#game-prompt").textContent = r.prompt;
    dialog.setAttribute("aria-describedby", "game-prompt");
    $("[data-round-label]").textContent =
      `${levelNames[level.id]} · ${roundIndex + 1} / ${level.rounds.length}`;
    $("[data-run-score]").textContent = points;
    $("[data-run-maximum]").textContent = level.rounds.length * 200;
    $("[data-round-progress]").innerHTML = level.rounds
      .map(
        (_, i) =>
          `<span class="${i < roundIndex ? "is-done" : i === roundIndex ? "is-active" : ""}"></span>`,
      )
      .join("");
    feedback.hidden = true;
    feedback.replaceChildren();
    submit.innerHTML = 'Check answer <span aria-hidden="true">→</span>';
    $("[data-round-reward]").textContent = "Up to 200 points";
    $("[data-practice-indicator]").hidden = !assisted;
    mounted = engine.mount(stage, JSON.parse(JSON.stringify(r)), {});
    renderCoach();
    dialog.scrollTop = 0;
  }
  function startLevel(practice = false) {
    points = 0;
    roundIndex = 0;
    roundScores = [];
    assisted = practice;
    drawRound();
    if (practice) {
      setCoachTab("ai");
      $("#tab-ai").focus({ preventScroll: true });
    } else $("#game-title").focus({ preventScroll: true });
  }
  function markAssisted() {
    if (phase === "answer") {
      assisted = true;
      $("[data-practice-indicator]").hidden = false;
    }
  }
  function traceState(state) {
    if (!state) return "";
    const copy = { ...state };
    delete copy.response;
    if (Object.keys(copy).length) return JSON.stringify(copy, null, 2);
    const round = level.rounds[roundIndex],
      response = state.response;
    if (response === undefined) return "";
    const label = (items, id) =>
      items?.find((item) => item.id === id)?.label ?? id;
    if (Array.isArray(response)) {
      const names = response.map((id) =>
        round.type === "grid"
          ? (round.cells.find((cell) => cell.id === id)?.value ?? id)
          : label(round.nodes || round.items || round.options, id),
      );
      return round.type === "route"
        ? names.join(" → ")
        : names.map((name, i) => `${i + 1}. ${name}`).join("\n");
    }
    return Object.entries(response)
      .map(([id, value]) => {
        if (round.type === "tune") {
          const control = round.controls.find((item) => item.id === id);
          return `${control?.label || id}: ${value}${control?.unit ? " " + control.unit : ""}`;
        }
        return `${label(round.left || round.items, id)} → ${label(round.right || round.buckets, value)}`;
      })
      .join("\n");
  }
  function renderStep() {
    const step = aiResult.steps[aiIndex];
    if (!step) return;
    const root = $("[data-ai-trace]");
    root.innerHTML = `<div class="ai-trace-kicker"><span>STEP ${aiIndex + 1} / ${aiResult.steps.length}</span><span>${esc(aiResult.complexity)}</span></div><h4>${esc(step.title)}</h4><p>${esc(step.detail)}</p>${step.state ? `<pre class="ai-trace-state" tabindex="0" aria-label="Algorithm state">${esc(traceState(step.state))}</pre>` : ""}`;
    if (phase === "answer") {
      mounted.reset();
      for (let i = aiIndex; i >= 0; i--) {
        const response = aiResult.steps[i].state?.response;
        if (response !== undefined) {
          mounted.setResponse(response);
          break;
        }
      }
    }
    $("[data-ai-prev]").disabled = aiIndex === 0;
    $("[data-ai-next]").disabled = aiIndex === aiResult.steps.length - 1;
  }
  function runAI() {
    if (!current || phase === "brief" || phase === "results") return;
    stopAI();
    try {
      aiResult = AI.solve(level.rounds[roundIndex]);
      markAssisted();
      aiIndex = 0;
      const g = guide();
      $("[data-ai-output]").innerHTML =
        `<div class="ai-trace" data-ai-trace aria-live="polite"></div><div class="ai-step-controls"><button type="button" data-ai-prev aria-label="Previous solver step">←</button><button type="button" class="ai-autoplay" data-ai-auto aria-pressed="false">Play steps</button><button type="button" data-ai-next aria-label="Next solver step">→</button></div><details class="ai-code-details"><summary>Build it in Python · ${esc(aiResult.algorithm)}</summary><div class="ai-code-toolbar"><span>Python 3 · runnable example</span><div><button type="button" data-copy-code>Copy</button><button type="button" data-download-code>Download .py</button></div></div><pre tabindex="0" aria-label="Python solver code"><code data-ai-code>${esc(aiResult.code)}</code></pre></details><p class="ai-status" data-code-status role="status"></p><details class="ai-sandbox"><summary>Experiment with the inputs</summary><p>${esc(g.experiment)}</p><label for="ai-model-input">Model input · JSON</label><textarea id="ai-model-input" spellcheck="false" maxlength="20000">${esc(JSON.stringify(level.rounds[roundIndex].model, null, 2))}</textarea><button type="button" class="button button-secondary" data-run-sandbox>Run experiment <span aria-hidden="true">→</span></button><p class="ai-sandbox-status" data-sandbox-status role="status"></p><div data-sandbox-result></div></details>`;
      $("[data-ai-output]").hidden = false;
      $("[data-run-ai]").textContent = "Restart solver →";
      stopAI();
      renderStep();
    } catch (error) {
      $("[data-ai-output]").hidden = false;
      $("[data-ai-output]").innerHTML =
        `<p class="study-status" role="alert">${esc(error.message)}</p>`;
    }
  }
  function stepAI(delta) {
    stopAI();
    if (!aiResult) return;
    aiIndex = Math.max(0, Math.min(aiResult.steps.length - 1, aiIndex + delta));
    renderStep();
  }
  function playAI() {
    if (aiTimer !== null) {
      stopAI();
      return;
    }
    if (!aiResult || document.documentElement.dataset.motion === "paused") {
      stopAI();
      return;
    }
    if (aiIndex === aiResult.steps.length - 1) aiIndex = 0;
    renderStep();
    const b = $("[data-ai-auto]");
    b.textContent = "Pause steps";
    b.setAttribute("aria-pressed", "true");
    aiTimer = setInterval(() => {
      if (
        document.hidden ||
        document.documentElement.dataset.motion === "paused"
      ) {
        stopAI();
        return;
      }
      if (aiIndex >= aiResult.steps.length - 1) {
        stopAI();
        return;
      }
      aiIndex++;
      renderStep();
    }, 1200);
  }
  async function copyCode() {
    if (!aiResult) return;
    try {
      await navigator.clipboard.writeText(aiResult.code);
      if ($("[data-code-status]"))
        $("[data-code-status]").textContent = "Python code copied.";
    } catch {
      const code = $("[data-ai-code]");
      if (code) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        $("[data-code-status]").textContent =
          "Code selected. Use your browser’s Copy command.";
      }
    }
  }
  function downloadCode(result = aiResult, suffix = "") {
    if (!result) return;
    const url = URL.createObjectURL(
        new Blob([result.code], { type: "text/x-python;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `${current.id}-${level.id}${suffix}.py`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function runSandbox() {
    const input = $("#ai-model-input");
    if (!input) return;
    try {
      if (input.value.length > 20000)
        throw Error("Use fewer than 20,000 characters.");
      const next = JSON.parse(input.value);
      sandboxResult = AI.solve({ ...level.rounds[roundIndex], model: next });
      $("[data-sandbox-status]").textContent =
        "Experiment complete. Your game board and score are unchanged.";
      $("[data-sandbox-result]").innerHTML =
        `<div class="ai-sandbox-result"><p>${esc(sandboxResult.algorithm)} · ${sandboxResult.steps.length} steps</p><pre>${esc(JSON.stringify(sandboxResult.response, null, 2))}</pre><button type="button" class="button button-secondary" data-download-sandbox>Download experiment code</button></div>`;
    } catch (error) {
      $("[data-sandbox-status]").textContent =
        "Cannot run this input: " + error.message;
      $("[data-sandbox-result]").replaceChildren();
      sandboxResult = null;
    }
  }
  function completeLevel() {
    stopAI();
    phase = "results";
    mounted?.destroy();
    mounted = null;
    const total = model.levelScore(points, level.rounds.length);
    mergeSavedProgress();
    const oldXP = model.totals(progress).xp;
    progress = model.record(
      progress,
      current.id,
      level.id,
      total,
      assisted,
      ids,
    );
    pendingStorage = false;
    persist();
    showProgress();
    renderCards();
    $("[data-play-workspace]").hidden = true;
    $("[data-game-brief]").hidden = true;
    dialog.classList.add("is-briefing");
    const saved = progress.results[current.id][level.id],
      stars = model.stars(total),
      gain = model.totals(progress).xp - oldXP,
      li = model.LEVELS.indexOf(level.id),
      next =
        li < 2
          ? {
              id: current.id,
              level: model.LEVELS[li + 1],
              label: "Try " + levelNames[model.LEVELS[li + 1]],
            }
          : {
              id: games[(ids.indexOf(current.id) + 1) % games.length].id,
              level: "foundation",
              label: "Explore another game",
            };
    results.innerHTML = `<p class="result-level-label">${levelNames[level.id]} · ${assisted ? "AI PRACTICE" : "INDEPENDENT RUN"}</p><div class="result-orbit"><strong>${total.toLocaleString("en-IN")}<small>of 1,000 points</small></strong></div><div class="result-stars" aria-label="${stars} of 3 stars">${"★".repeat(stars)}<span class="empty-star">${"☆".repeat(3 - stars)}</span></div><h3 id="game-result-title" tabindex="-1" aria-describedby="game-result-summary">${assisted ? "Algorithm explored." : total >= 900 ? "Level mastered." : total >= 600 ? "Ideas are connecting." : "Keep experimenting."}</h3><p id="game-result-summary">${assisted ? "Practice score saved. Your independent personal best and XP are unchanged." : `Your ${levelNames[level.id]} best is ${saved.best.toLocaleString("en-IN")} / 1,000.`}</p><div class="result-xp">${assisted ? "AI practice complete" : "+" + gain.toLocaleString("en-IN") + " mastery XP"}</div><div class="result-round-breakdown">${roundScores.map((n, i) => `<span>CHALLENGE ${i + 1}<strong>${n} / 200</strong></span>`).join("")}</div><div class="result-actions"><button type="button" class="button button-secondary" data-start-level>Play again ↺</button><button type="button" class="button button-primary" data-play="${next.id}" data-level="${next.level}">${next.label} →</button></div><button type="button" class="result-library" data-close-game>Back to all games</button>`;
    results.hidden = false;
    dialog.setAttribute("aria-describedby", "game-result-summary");
    $("#game-prompt").textContent = current.concept;
    dialog.scrollTop = 0;
    $("#game-result-title").focus({ preventScroll: true });
  }
  submit.addEventListener("click", () => {
    if (!current || !["answer", "feedback"].includes(phase)) return;
    if (phase === "feedback") {
      roundIndex++;
      if (roundIndex >= level.rounds.length) completeLevel();
      else {
        drawRound();
        $("#game-title").focus({ preventScroll: true });
      }
      return;
    }
    const result = mounted.evaluate();
    if (!result.complete) {
      feedback.innerHTML = `<strong>Finish your answer</strong><p>${esc(result.feedback)}</p>`;
      feedback.hidden = false;
      return;
    }
    stopAI();
    phase = "feedback";
    const earned = Math.max(0, Math.min(200, Math.round(result.score)));
    points += earned;
    roundScores.push(earned);
    mounted.setDisabled(true);
    $("[data-run-score]").textContent = points;
    $("[data-round-reward]").textContent =
      `+${earned} points${assisted ? " · AI practice" : ""}`;
    feedback.innerHTML = `<strong>${result.correct ? "Nicely solved." : "Here’s the idea."} +${earned} points</strong><p>${esc(result.feedback)}</p><small>${esc(level.rounds[roundIndex].explanation)}</small>`;
    feedback.hidden = false;
    submit.textContent =
      roundIndex === level.rounds.length - 1
        ? "See level score →"
        : "Next challenge →";
    feedback.scrollIntoView({ block: "nearest", behavior: "instant" });
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.play) openGame(t.dataset.play, t.dataset.level, t);
    if (t.dataset.favorite) {
      const id = t.dataset.favorite;
      mergeSavedProgress();
      progress.favorites = progress.favorites.includes(id)
        ? progress.favorites.filter((x) => x !== id)
        : [...progress.favorites, id];
      persist();
      showProgress();
      renderCards();
    }
    if (t.dataset.selectLevel) {
      level = definition().levels.find((l) => l.id === t.dataset.selectLevel);
      renderBrief();
      document
        .querySelector(`[data-select-level="${level.id}"]`)
        .focus({ preventScroll: true });
    }
    if (t.hasAttribute("data-start-level")) startLevel(false);
    if (t.hasAttribute("data-start-ai")) startLevel(true);
    if (t.hasAttribute("data-close-game")) dialog.close();
    if (t.hasAttribute("data-surprise")) {
      const pool = library.query(
        games,
        categories,
        curriculum,
        progress,
        filters(),
      );
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) openGame(pick.game.id, pick.level.id, t);
      else {
        clearFilters();
        const g = games[Math.floor(Math.random() * games.length)];
        openGame(g.id, "foundation", t);
      }
    }
    if (t.dataset.coachTab) setCoachTab(t.dataset.coachTab);
    if (t.hasAttribute("data-open-coach")) {
      setCoachTab("ai");
      $("#tab-ai").focus();
      $(".studio-coach").scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
    if (t.hasAttribute("data-run-ai")) runAI();
    if (t.hasAttribute("data-ai-prev")) stepAI(-1);
    if (t.hasAttribute("data-ai-next")) stepAI(1);
    if (t.hasAttribute("data-ai-auto")) playAI();
    if (t.hasAttribute("data-copy-code")) copyCode();
    if (t.hasAttribute("data-download-code")) downloadCode();
    if (t.hasAttribute("data-run-sandbox")) runSandbox();
    if (t.hasAttribute("data-download-sandbox"))
      downloadCode(sandboxResult, "-experiment");
  });
  $(".coach-tabs").addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      setCoachTab(
        e.key === "Home"
          ? "rules"
          : e.key === "End"
            ? "ai"
            : document.activeElement.dataset.coachTab === "rules"
              ? "ai"
              : "rules",
        true,
      );
    }
  });
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    stopAI();
    const id = returnFocus?.dataset?.play || current?.id;
    mounted?.destroy();
    mounted = null;
    current = null;
    document.body.classList.remove("game-open");
    syncURL("");
    if (pendingStorage) {
      pendingStorage = false;
      progress = model.read(storage, ids);
      showProgress();
      renderCards();
    }
    const target =
      returnFocus?.isConnected && returnFocus.getClientRects().length
        ? returnFocus
        : id
          ? document.querySelector(`.game-card-play[data-play="${id}"]`)
          : null;
    (target || $("#game-search")).focus({ preventScroll: true });
  });
  function readHash() {
    const [id, lid] = location.hash.slice(1).split("/");
    if (ids.includes(id) && (current?.id !== id || level?.id !== lid))
      openGame(id, model.LEVELS.includes(lid) ? lid : undefined);
    else if (!id && dialog.open) dialog.close();
  }
  window.addEventListener("hashchange", readHash);
  window.addEventListener("storage", (e) => {
    if (e.key !== model.KEY && e.key !== null) return;
    if (dialog.open) {
      pendingStorage = true;
      return;
    }
    progress = model.read(storage, ids);
    showProgress();
    renderCards();
  });
  window.addEventListener("atriksha:motion", stopAI);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAI();
  });
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = "coach-shortcut";
  shortcut.dataset.openCoach = "";
  shortcut.textContent = "Rules & AI companion ↗";
  $(".studio-play-layout").before(shortcut);
  const availableMechanics = new Set(
    Object.values(curriculum.games).flatMap((game) =>
      game.levels.flatMap((item) => item.rounds.map((round) => round.type)),
    ),
  );
  for (const option of [...$("#mechanic-filter").options]) {
    if (option.value !== "any" && !availableMechanics.has(option.value))
      option.remove();
  }
  readFilters();
  showProgress();
  renderCards();
  readHash();
  if (matchMedia("(max-width:580px)").matches)
    $(".studio-filters").open = false;
})();
