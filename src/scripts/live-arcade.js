(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    catalog = window.ATRIKSHA_LIVE_GAMES,
    learning = window.ATRIKSHA_LIVE_LEARNING,
    worlds = window.AtrikshaWorlds,
    R = window.AtrikshaLiveRuntime,
    P = window.AtrikshaLiveProgress;
  if (!catalog || !learning || !worlds || !R || !P) {
    $("[data-result-count]").textContent =
      "The worlds could not load. Refresh to try again.";
    return;
  }
  const esc = (v) =>
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
  const { games, families, categories } = catalog,
    ids = games.map((g) => g.id),
    familyMap = Object.fromEntries(families.map((f) => [f.id, f])),
    levelNames = ["Foundation", "Applied", "Expert"],
    levelIds = ["foundation", "applied", "expert"],
    symbols = {
      runner: "⌁",
      grapple: "⤴",
      racer: "⇈",
      drone: "⌘",
      arena: "◎",
      factory: "⚙",
      network: "◇",
      swarm: "⋮",
      ecosystem: "✳",
      orbit: "◌",
    };
  let storage;
  try {
    storage = localStorage;
  } catch {}
  let progress = P.read(storage, ids),
    family = "all",
    topics = new Set(),
    shown = 12,
    current = null,
    difficulty = 0,
    runtime = null,
    sound = false,
    phase = "",
    savedRun = false,
    focusBack = null,
    inspectorAt = 0,
    previewIndex = 2,
    previewSim = null,
    previewFrame = 0,
    previewPrevious = 0,
    previewResetAt = 0,
    previewVisible = true;
  const dialog = $(".live-dialog"),
    canvas = $("[data-game-canvas]"),
    thumbCache = new Map();
  function persist() {
    try {
      storage.setItem(P.KEY, JSON.stringify(progress));
      $("[data-storage-note]").textContent = "Progress saved on this browser";
    } catch {
      $("[data-storage-note]").textContent = "Progress saved for this visit";
    }
  }
  function merge() {
    progress = P.merge(progress, P.read(storage, ids), ids);
  }
  function showProgress() {
    const t = P.totals(progress);
    $("[data-total-played]").innerHTML = t.played + " <small>/ 50</small>";
    $("[data-total-runs]").textContent = t.runs.toLocaleString("en-IN");
    $("[data-total-xp]").textContent = t.xp.toLocaleString("en-IN");
  }
  function filters() {
    return {
      family,
      topics: [...topics],
      q: $("#live-search").value.trim().toLowerCase(),
      level: Number($("#live-level").value),
      duration: $("#live-duration").value,
      status: $("#live-progress-filter").value,
      sort: $("#live-sort").value,
      saved: $("#live-saved").checked,
    };
  }
  function syncURL(hash = location.hash) {
    const f = filters(),
      q = new URLSearchParams();
    if (f.family !== "all") q.set("world", f.family);
    if (f.topics.length) q.set("topics", f.topics.join(","));
    if (f.q) q.set("q", f.q);
    if (f.level) q.set("level", levelIds[f.level]);
    if (f.duration !== "any") q.set("duration", f.duration);
    if (f.status !== "all") q.set("status", f.status);
    if (f.sort !== "recommended") q.set("sort", f.sort);
    if (f.saved) q.set("saved", "1");
    try {
      history.replaceState(
        null,
        "",
        location.pathname + (q.toString() ? "?" + q : "") + hash,
      );
    } catch {}
  }
  function readURL() {
    const p = new URLSearchParams(location.search);
    family = familyMap[p.get("world")] ? p.get("world") : "all";
    topics = new Set(
      (p.get("topics") || "")
        .split(",")
        .filter((t) => categories.some((c) => c.id === t)),
    );
    $("#live-search").value = (p.get("q") || "").slice(0, 160);
    $("#live-level").value = String(
      Math.max(0, levelIds.indexOf(p.get("level"))),
    );
    for (const [id, key] of [
      ["live-duration", "duration"],
      ["live-progress-filter", "status"],
      ["live-sort", "sort"],
    ])
      if ([...$("#" + id).options].some((o) => o.value === p.get(key)))
        $("#" + id).value = p.get(key);
    $("#live-saved").checked = p.get("saved") === "1";
  }
  function selection() {
    const f = filters();
    return games
      .filter((g) => {
        const e = progress.results[g.id]?.[f.level],
          haystack = [
            learning.games[g.id]?.domain,
            learning.games[g.id]?.concept,
            learning.games[g.id]?.application,
            g.title,
            g.concept,
            g.description,
            g.objective,
            g.twist,
            familyMap[g.family].name,
            ...g.tags,
          ]
            .join(" ")
            .toLowerCase();
        return (
          (f.family === "all" || g.family === f.family) &&
          (!f.topics.length || f.topics.includes(g.category)) &&
          (!f.q || f.q.split(/\s+/).every((t) => haystack.includes(t))) &&
          (!f.saved || progress.favorites.includes(g.id)) &&
          (f.duration === "any" ||
            (f.duration === "short" ? g.duration <= 90 : g.duration > 90)) &&
          (f.status === "all" ||
            (f.status === "new" && !e?.runs) ||
            (f.status === "played" && e?.runs) ||
            (f.status === "practice" && e?.practiceRuns))
        );
      })
      .sort((a, b) => {
        const ar = progress.results[a.id]?.[f.level],
          br = progress.results[b.id]?.[f.level];
        const compares = {
          title: () => a.title.localeCompare(b.title),
          shortest: () => a.duration - b.duration,
          longest: () => b.duration - a.duration,
          score: () => (br?.best || 0) - (ar?.best || 0),
          recent: () => (br?.updated || 0) - (ar?.updated || 0),
          recommended: () =>
            a.variant - b.variant ||
            families.findIndex((x) => x.id === a.family) -
              families.findIndex((x) => x.id === b.family),
        };
        return (
          (compares[f.sort] || compares.recommended)() ||
          a.title.localeCompare(b.title)
        );
      });
  }
  function palette() {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        "bg",
        "surface",
        "text",
        "muted",
        "accent",
        "cyan",
        "amber",
        "purple",
        "danger",
      ].map((k) => [k, s.getPropertyValue("--" + k).trim()]),
    );
  }
  function thumbnail(node, g) {
    const key =
      g.id +
      "-" +
      $("#live-level").value +
      "-" +
      document.documentElement.dataset.theme;
    if (thumbCache.has(key)) {
      const image = new Image();
      image.onload = () => {
        if (node.isConnected)
          node.getContext("2d").drawImage(image, 0, 0, node.width, node.height);
      };
      image.src = thumbCache.get(key);
      return;
    }
    try {
      const sim = R.createSimulation(
          worlds,
          g,
          Number($("#live-level").value),
          { palette: palette() },
        ),
        ctx = node.getContext("2d");
      sim.start();
      sim.setAI(true);
      for (let i = 0; i < 45; i++) sim.step(1 / 60);
      ctx.scale(node.width / 960, node.height / 540);
      sim.world.draw(ctx);
      thumbCache.set(key, node.toDataURL());
      sim.dispose();
    } catch {
      node.getContext("2d").fillText(familyMap[g.family].name, 15, 30);
    }
  }
  function render() {
    const list = selection(),
      f = filters(),
      visible = list.slice(0, shown);
    $("[data-game-grid]").innerHTML = visible
      .map((g) => {
        const fam = familyMap[g.family],
          e = progress.results[g.id]?.[f.level],
          fav = progress.favorites.includes(g.id);
        return `<article class="live-game-card"><div class="live-card-scene"><canvas width="480" height="270" data-scene="${g.id}" aria-hidden="true"></canvas><span class="live-card-badge">${esc(fam.genre)}</span><button type="button" class="live-card-favorite" data-favorite="${g.id}" aria-pressed="${fav}" aria-label="${fav ? "Unsave" : "Save"} ${esc(g.title)}">${fav ? "♥" : "♡"}</button></div><div class="live-card-copy"><span class="live-card-topic">${esc(categories.find((c) => c.id === g.category)?.name || g.category)}</span><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><div class="live-card-concept">Control · ${esc(learning.games[g.id].control.label)}</div><div class="live-card-meta"><span>${levelNames[f.level]} · ${g.duration}s</span><span>${esc(fam.name)}</span></div></div><div class="live-card-footer"><span>${e?.runs ? "Best " + e.best.toLocaleString("en-IN") : "Mission " + String(g.variant + 1).padStart(2, "0") + " / 05"}</span><button type="button" data-play="${g.id}">Play mission <span aria-hidden="true">↗</span></button></div></article>`;
      })
      .join("");
    for (const node of $$("[data-scene]"))
      thumbnail(
        node,
        games.find((g) => g.id === node.dataset.scene),
      );
    $("[data-result-count]").textContent =
      `${visible.length} of ${list.length} missions`;
    $("[data-empty]").hidden = !!list.length;
    $("[data-load-more]").hidden = visible.length >= list.length;
    $$("[data-reset-filters]").forEach(
      (b) =>
        (b.hidden = !(
          f.family !== "all" ||
          f.q ||
          f.topics.length ||
          f.duration !== "any" ||
          f.status !== "all" ||
          f.saved ||
          f.level ||
          f.sort !== "recommended"
        )),
    );
    $$("[data-world]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.world === family)),
    );
    $$("[data-topic]").forEach(
      (b) => (b.checked = topics.has(b.dataset.topic)),
    );
    const count =
      f.topics.length +
      Number(f.duration !== "any") +
      Number(f.status !== "all") +
      Number(f.saved) +
      Number(f.level > 0);
    $("[data-filter-badge]").textContent = count
      ? String(count) + " active"
      : "";
    showProgress();
  }
  function resetFilters() {
    family = "all";
    topics.clear();
    $("#live-search").value = "";
    $("#live-level").value = "0";
    $("#live-duration").value = "any";
    $("#live-progress-filter").value = "all";
    $("#live-sort").value = "recommended";
    $("#live-saved").checked = false;
    shown = 12;
    syncURL();
    render();
    $("#live-search").focus();
  }
  function setPanel(id, focus = false) {
    $$("[data-panel]").forEach((b) => {
      const active = b.dataset.panel === id;
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    $("#mission-panel").hidden = id !== "mission";
    $("#ai-panel").hidden = id !== "ai";
    if (focus) $("#" + id + "-tab").focus();
    if (id === "ai") inspect();
  }
  function brief() {
    const f = familyMap[current.family];
    const lesson = learning.games[current.id];
    $("[data-game-world]").textContent = f.name + " / " + f.genre;
    $("#live-game-title").textContent = current.title;
    $("[data-game-levels]").innerHTML = current.levels
      .map(
        (l, i) =>
          `<button type="button" data-difficulty="${i}" aria-pressed="${i === difficulty}">${levelNames[i]}</button>`,
      )
      .join("");
    $("[data-mission-objective]").textContent = current.objective;
    $("[data-mission-twist]").textContent = current.twist;
    $("[data-level-note]").textContent = current.levels[difficulty].description;
    $("[data-controls-list]").innerHTML = f.controls
      .map((c) => `<dt>${esc(c.key)}</dt><dd>${esc(c.action)}</dd>`)
      .join("");
    $("[data-game-rules]").innerHTML =
      `<ul>${f.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><p>${esc(f.scoring)}</p><p>Successful actions build a combo up to 3×. Damage breaks it. Only independent personal bests contribute to arcade XP.</p>`;
    $("[data-game-science]").textContent = lesson.concept;
    $("[data-learning-loop]").innerHTML = [
      ["Observe", lesson.observe],
      ["Control", lesson.act],
      ["Consequence", lesson.consequence],
    ]
      .map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`)
      .join("");
    $("[data-engineering-formula]").textContent = lesson.formula;
    $("[data-engineering-application]").textContent = lesson.application;
    $("[data-engineering-references]").innerHTML = (lesson.references || [])
      .map(
        (reference) =>
          `<a href="${esc(reference.url)}" target="_blank" rel="noopener noreferrer">${esc(reference.label)} ↗</a>`,
      )
      .join("");
    $("[data-engineering-explanation]").textContent = lesson.consequence;
    $("[data-engineering-domain]").textContent = lesson.domain;
    $("[data-engineering-control]").textContent = lesson.control.label;
    $("[data-engineering-settings]").setAttribute(
      "aria-label",
      lesson.control.label,
    );
    $("[data-engineering-settings]").innerHTML = lesson.control.options
      .map(
        (option, index) =>
          `<button type="button" data-engineering-setting="${index}" aria-pressed="${index === lesson.control.initial}" title="${esc(option.description || option.label)}">${esc(option.label)}</button>`,
      )
      .join("");
    $("[data-engineering-readout]").textContent = lesson.observe;
    $("[data-engineering-status]").textContent = "Ready";
    $("[data-engineering-console]").dataset.status = "ready";
    $("[data-ai-name]").textContent = f.ai.name;
    $("[data-ai-summary]").textContent = f.ai.summary;
    $("[data-ai-steps]").innerHTML = f.ai.steps
      .map((s) => `<li>${esc(s)}</li>`)
      .join("");
    $("[data-ai-code]").textContent = f.ai.code;
    $("[data-ai-limits]").textContent = f.ai.limitations;
    $("[data-code-status]").textContent = "";
    $("[data-control-line]").textContent = f.controls
      .map(
        (c) =>
          c.key + " · " + (c.key === "Z / X" ? lesson.control.label : c.action),
      )
      .join("   /   ");
    const actionLabels = {
      runner: ["Jump", "Dash"],
      grapple: ["Attach / release", "Burst"],
      racer: [current.variant === 4 ? "Scan" : "Grip assist", "Boost"],
      drone: ["Scan", "Brake / land"],
      arena: [
        "Aim & fire",
        current.variant === 1
          ? "Swap color"
          : current.variant === 4
            ? "Vent heat"
            : "Shield",
      ],
      factory: ["Rotate belt", "Repair / vent"],
      network: ["Build / upgrade", "Repair / purge"],
      swarm: ["Attract", "Repel"],
      ecosystem: ["Plant / water", "Harvest / clear"],
      orbit: ["Boost", "Brake / dock"],
    };
    $("[data-action-label]").textContent = actionLabels[current.family][0];
    $("[data-secondary-label]").textContent = actionLabels[current.family][1];
    $("[data-game-canvas]").setAttribute(
      "aria-label",
      current.title +
        ". " +
        f.controls.map((c) => c.key + ": " + c.action).join(". "),
    );
  }
  function openGame(id, level = Number($("#live-level").value)) {
    const g = games.find((g) => g.id === id);
    if (!g) return;
    focusBack = document.activeElement;
    runtime?.destroy();
    current = g;
    difficulty = Math.max(0, Math.min(2, Number(level) || 0));
    savedRun = false;
    phase = "";
    $("[data-game-status]").textContent = "";
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("live-game-open");
    dialog.scrollTop = 0;
    setPanel("mission");
    brief();
    syncURL("#" + id + "/" + levelIds[difficulty]);
    createGame();
    $("#live-game-title").focus({ preventScroll: true });
  }
  function createGame() {
    runtime?.destroy();
    savedRun = false;
    phase = "";
    $("[data-run-learning]").hidden = true;
    $("[data-run-learning]").replaceChildren();
    $("[data-engineering-readout]").textContent =
      learning.games[current.id].observe;
    $("[data-engineering-console]").dataset.status = "ready";
    $("[data-engineering-status]").textContent = "Ready";
    $("[data-ai-toggle]").textContent = "Watch AI play →";
    $("[data-practice-tag]").hidden = true;
    $("[data-ai-observation]").textContent =
      "Open this panel during a run to inspect the agent’s world.";
    $("[data-ai-action]").textContent = "";
    try {
      runtime = R.mount(canvas, worlds, current, difficulty, {
        controls: $("[data-touch-controls]"),
        onState: updateHUD,
        onFinish: finish,
        onError: (e) => {
          $("[data-game-status]").textContent =
            "The game stopped: " + e.message;
        },
      });
      runtime.setSound(sound);
      runtime.setSetting(learning.games[current.id].control.initial);
      updateHUD(runtime.snapshot());
    } catch (e) {
      $("[data-game-status]").textContent = e.message;
    }
  }
  function updateHUD(s) {
    if (!current) return;
    $("[data-run-score]").textContent = s.score.toLocaleString("en-IN");
    $("[data-run-combo]").textContent = s.combo + "×";
    $("[data-run-health]").textContent = Math.ceil(s.health);
    $("[data-run-time]").textContent =
      Math.max(0, Math.ceil(s.duration - s.elapsed)) + "s";
    $("[data-live-metrics]").innerHTML = Object.entries(s.metrics)
      .map(([k, v]) => `<span>${esc(k)} <strong>${esc(v)}</strong></span>`)
      .join("");
    $$("[data-engineering-setting]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.engineeringSetting) === s.control),
      );
      button.disabled = !!s.ai || s.phase === "ended";
    });
    if (s.engineering) {
      const reading = s.engineering;
      $("[data-engineering-console]").dataset.status = reading.status;
      $("[data-engineering-status]").textContent = {
        good: "In range",
        warning: "Watch",
        danger: "Out of range",
      }[reading.status];
      if (s.control !== s.appliedControl)
        $("[data-engineering-status]").textContent = "Queued";
      $("[data-engineering-readout]").textContent = reading.readout;
      $("[data-engineering-explanation]").textContent =
        reading.explanation || learning.games[current.id].consequence;
      $("[data-engineering-formula]").textContent =
        reading.formula || learning.games[current.id].formula;
    }
    $("[data-practice-tag]").hidden = !s.assisted;
    $("[data-pause]").disabled = !["running", "paused"].includes(s.phase);
    $("[data-review-run]").hidden = s.phase !== "ended";
    $("[data-pause]").textContent =
      s.phase === "paused" ? "Resume ▷" : "Pause Ⅱ";
    $$("[data-difficulty]").forEach(
      (b) => (b.disabled = ["running", "paused"].includes(s.phase)),
    );
    $("[data-ai-toggle]").textContent = s.ai
      ? "Take the controls →"
      : "Watch AI play →";
    if (phase !== s.phase) {
      phase = s.phase;
      const cover = $("[data-stage-cover]");
      cover.hidden = s.phase === "running";
      if (s.phase === "ready")
        $("[data-stage-message]").innerHTML =
          `<span class="live-overlay-kicker">${esc(familyMap[current.family].genre)} · ${levelNames[difficulty]}</span><h3>Enter the world.</h3><p>${esc(current.objective)}</p><button type="button" class="button button-primary" data-start-run>Play now →</button><button type="button" class="button button-secondary" data-start-ai>Watch AI</button>`;
      if (s.phase === "paused")
        $("[data-stage-message]").innerHTML =
          '<span class="live-overlay-kicker">WORLD PAUSED</span><h3>Catch your breath.</h3><button type="button" class="button button-primary" data-resume>Resume play →</button>';
      if (s.phase === "ended") resultOverlay(s.result);
    }
    if (
      !$("#ai-panel").hidden &&
      $(".live-ai-inspector").open &&
      performance.now() - inspectorAt > 600
    )
      inspect();
  }
  function resultOverlay(r) {
    if (!r) return;
    const best = progress.results[current.id]?.[difficulty];
    $("[data-stage-message]").innerHTML =
      `<span class="live-overlay-kicker">${r.assisted ? "AI PRACTICE" : r.won ? "MISSION COMPLETE" : "RUN COMPLETE"}</span><h3>${esc(r.reason)}</h3><div class="live-overlay-score">${r.score.toLocaleString("en-IN")} <small>pts</small></div><p>${r.assisted ? "Practice recorded. Your independent best is unchanged." : "Personal best: " + (best?.best || 0).toLocaleString("en-IN") + " · " + r.elapsed + "s in the world."}</p><button class="button button-primary" type="button" data-replay>Play again ↺</button><button class="button button-secondary" type="button" data-next-mission>Next mission →</button>`;
  }
  function finish(result) {
    if (savedRun) return;
    savedRun = true;
    merge();
    progress = P.record(progress, current.id, difficulty, result, ids);
    persist();
    showProgress();
    renderLearning(result);
    $("[data-game-status]").textContent =
      (result.assisted ? "AI practice" : "Independent run") +
      " · " +
      result.score +
      " points · " +
      result.reason;
  }
  function renderLearning(result) {
    const lesson = learning.games[current.id],
      events = result.evidence || [],
      section = $("[data-run-learning]");
    section.hidden = false;
    section.innerHTML = `<div class="run-learning-heading"><div><p class="eyebrow">OBSERVED OUTCOMES${result.assisted ? " · AI PRACTICE" : ""}</p><h3 id="run-learning-title" tabindex="-1">${esc(lesson.concept)}</h3></div><button type="button" class="button button-secondary" data-download-learning>Save run notes ↓</button></div><p class="run-learning-summary">${result.controlChanges || 0} manual setting changes · ${(result.engineeringHistory || []).length} instrument samples</p>${
      events.length
        ? `<ol class="run-learning-events">${events
            .slice(-4)
            .map(
              (event) =>
                `<li data-quality="${event.quality >= 0.7 ? "good" : event.quality < 0.35 ? "danger" : "neutral"}"><span class="run-event-time">${event.time}s · ${esc(lesson.control.options[event.setting]?.label || "")}</span><h4>${esc(event.event)}</h4><p>${esc(event.decision)}</p><p class="run-event-consequence">${esc(event.consequence)}</p></li>`,
            )
            .join("")}</ol>`
        : `<p class="run-learning-summary">No technical outcome was recorded in this short run. ${esc(lesson.act)}</p>`
    }<div class="run-learning-next"><span>Takeaway</span><p>${esc(lesson.transfer)}</p></div>`;
  }
  function downloadLearning() {
    const result = runtime?.snapshot().result;
    if (!result) return;
    const lesson = learning.games[current.id];
    const report = {
      mission: current.title,
      difficulty: levelNames[difficulty],
      domain: lesson.domain,
      concept: lesson.concept,
      control: lesson.control,
      model: lesson.formula,
      application: lesson.application,
      run: result,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = current.id + "-run-notes.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function start(ai = false) {
    runtime?.setAI(ai);
    runtime?.start();
    updateHUD(runtime.snapshot());
  }
  function inspect() {
    if (!runtime) return;
    inspectorAt = performance.now();
    try {
      const trace = runtime.policy();
      $("[data-ai-observation]").textContent = JSON.stringify(
        trace.observation,
        null,
        2,
      ).slice(0, 20000);
      $("[data-ai-action]").textContent = JSON.stringify(trace.action, null, 2);
    } catch (e) {
      $("[data-ai-observation]").textContent = e.message;
    }
  }
  function close() {
    if (document.fullscreenElement === $(".live-player-frame"))
      document.exitFullscreen().catch(() => {});
    dialog.close();
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([familyMap[current.family].ai.code], {
        type: "text/x-python;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = current.family + "-agent.py";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(familyMap[current.family].ai.code);
      $("[data-code-status]").textContent = "Python policy copied.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents($("[data-ai-code]"));
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(range);
      $("[data-code-status]").textContent =
        "Code selected. Use your browser’s Copy command.";
    }
  }
  function setPreview(index) {
    previewIndex = (index + families.length) % families.length;
    previewSim?.dispose();
    const fam = families[previewIndex],
      g = games.find((g) => g.family === fam.id && g.variant === 0);
    if (!g) return;
    previewSim = R.createSimulation(worlds, g, 0, { palette: palette() });
    previewSim.start();
    previewSim.setAI(true);
    previewResetAt = 0;
    $("[data-preview-genre]").textContent = fam.genre;
    $("[data-preview-concept]").textContent = g.concept;
    $("[data-preview-title]").textContent = fam.name;
    $("[data-preview-play]").setAttribute("aria-label", "Play " + g.title);
    $$("[data-preview-index]").forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.previewIndex) === previewIndex),
      ),
    );
    drawPreview();
  }
  function drawPreview() {
    if (!previewSim) return;
    const c = $("[data-attract]"),
      ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 960, 540);
    previewSim.world.draw(ctx);
  }
  function animatePreview(now) {
    if (
      !document.hidden &&
      !dialog.open &&
      previewVisible &&
      document.documentElement.dataset.motion !== "paused" &&
      !matchMedia("(prefers-reduced-motion:reduce)").matches
    ) {
      const dt = previewPrevious
        ? Math.min((now - previewPrevious) / 1000, 1 / 30)
        : 1 / 60;
      if (previewSim?.state.phase === "ended") {
        if (!previewResetAt) previewResetAt = now;
        if (now - previewResetAt > 2200) setPreview(previewIndex);
      } else previewSim?.step(dt);
      drawPreview();
    }
    previewPrevious = now;
    previewFrame = requestAnimationFrame(animatePreview);
  }
  $("[data-world-filters]").innerHTML =
    `<button type="button" data-world="all" aria-pressed="true">All worlds <span>10</span></button>` +
    families
      .map(
        (f) =>
          `<button type="button" data-world="${f.id}" aria-pressed="false"><span aria-hidden="true">${symbols[f.id]}</span>${esc(f.genre)}</button>`,
      )
      .join("");
  $("[data-topic-filters]").innerHTML = categories
    .map(
      (c) =>
        `<label><input type="checkbox" data-topic="${c.id}">${esc(c.name)}</label>`,
    )
    .join("");
  $("[data-preview-picker]").innerHTML = families
    .map(
      (f, i) =>
        `<button type="button" data-preview-index="${i}" aria-pressed="${i === previewIndex}" aria-label="Preview ${esc(f.name)}"></button>`,
    )
    .join("");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-world")) {
      family = b.dataset.world;
      shown = 12;
      syncURL();
      render();
      return;
    }
    if (b.hasAttribute("data-favorite")) {
      merge();
      const id = b.dataset.favorite;
      progress.favorites = progress.favorites.includes(id)
        ? progress.favorites.filter((x) => x !== id)
        : [...progress.favorites, id];
      persist();
      render();
      $(`[data-favorite="${id}"]`)?.focus();
      return;
    }
    if (b.hasAttribute("data-play")) {
      openGame(b.dataset.play);
      return;
    }
    if (b.hasAttribute("data-preview-index")) {
      setPreview(Number(b.dataset.previewIndex));
      return;
    }
    if (b.hasAttribute("data-preview-play")) {
      openGame(
        games.find(
          (g) => g.family === families[previewIndex].id && g.variant === 0,
        ).id,
      );
      return;
    }
    if (b.hasAttribute("data-surprise")) {
      const list = selection();
      if (list.length)
        openGame(list[Math.floor(Math.random() * list.length)].id);
      return;
    }
    if (b.hasAttribute("data-load-more")) {
      shown += 12;
      render();
      return;
    }
    if (b.hasAttribute("data-reset-filters")) {
      resetFilters();
      return;
    }
    if (!current || !dialog.open) return;
    if (b.hasAttribute("data-engineering-setting")) {
      runtime?.setSetting(Number(b.dataset.engineeringSetting));
      if (runtime?.snapshot().phase === "running")
        canvas.focus({ preventScroll: true });
    } else if (b.hasAttribute("data-download-learning")) downloadLearning();
    else if (b.hasAttribute("data-review-run")) {
      const showNotes = () => {
        $("[data-run-learning]").scrollIntoView({ block: "start" });
        $("#run-learning-title")?.focus({ preventScroll: true });
      };
      if (document.fullscreenElement === $(".live-player-frame"))
        document.exitFullscreen().then(showNotes).catch(showNotes);
      else showNotes();
    } else if (b.hasAttribute("data-close-game")) close();
    else if (b.hasAttribute("data-start-run")) start();
    else if (b.hasAttribute("data-start-ai")) {
      setPanel("ai");
      start(true);
    } else if (b.hasAttribute("data-pause")) runtime?.togglePause();
    else if (b.hasAttribute("data-resume")) runtime?.resume();
    else if (b.hasAttribute("data-replay")) {
      createGame();
      start();
    } else if (b.hasAttribute("data-restart")) {
      createGame();
      start();
    } else if (b.hasAttribute("data-next-mission")) {
      const next = games.find(
        (g) =>
          g.family === current.family &&
          g.variant === (current.variant + 1) % 5,
      );
      openGame(next.id, difficulty);
    } else if (b.hasAttribute("data-difficulty")) {
      difficulty = Number(b.dataset.difficulty);
      brief();
      syncURL("#" + current.id + "/" + levelIds[difficulty]);
      createGame();
    } else if (b.hasAttribute("data-panel")) setPanel(b.dataset.panel);
    else if (b.hasAttribute("data-ai-toggle")) {
      const on = !runtime.snapshot().ai;
      runtime.setAI(on);
      if (["ready", "paused"].includes(runtime.snapshot().phase))
        runtime.start();
      else if (runtime.snapshot().phase === "ended") {
        createGame();
        start(on);
      }
      canvas.focus({ preventScroll: true });
    } else if (b.hasAttribute("data-sound")) {
      sound = !sound;
      runtime?.setSound(sound);
      b.setAttribute("aria-pressed", String(sound));
      b.textContent = sound ? "Sound on" : "Sound off";
    } else if (b.hasAttribute("data-fullscreen")) {
      const task = document.fullscreenElement
        ? document.exitFullscreen()
        : $(".live-player-frame").requestFullscreen?.();
      if (task)
        task.catch(() => {
          $("[data-game-status]").textContent =
            "Fullscreen is unavailable in this browser.";
        });
      else
        $("[data-game-status]").textContent =
          "Fullscreen is unavailable in this browser.";
    } else if (b.hasAttribute("data-coach-toggle")) {
      runtime?.pause();
      const showCoach = () => {
        setPanel("ai");
        $(".live-companion").scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
        $("#ai-tab").focus({ preventScroll: true });
      };
      if (document.fullscreenElement === $(".live-player-frame"))
        document.exitFullscreen().then(showCoach).catch(showCoach);
      else showCoach();
    } else if (b.hasAttribute("data-refresh-observation")) inspect();
    else if (b.hasAttribute("data-download-code")) download();
    else if (b.hasAttribute("data-copy-code")) copy();
  });
  $$(
    "#live-search,#live-level,#live-duration,#live-progress-filter,#live-sort,#live-saved",
  ).forEach((el) =>
    el.addEventListener(el.type === "search" ? "input" : "change", () => {
      shown = 12;
      syncURL();
      render();
    }),
  );
  $$("[data-topic]").forEach((el) =>
    el.addEventListener("change", () => {
      if (el.checked) topics.add(el.dataset.topic);
      else topics.delete(el.dataset.topic);
      shown = 12;
      syncURL();
      render();
    }),
  );
  $$("[data-panel]").forEach((b) =>
    b.addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        setPanel(
          e.key === "Home"
            ? "mission"
            : e.key === "End"
              ? "ai"
              : b.dataset.panel === "ai"
                ? "mission"
                : "ai",
          true,
        );
      }
    }),
  );
  $(".live-ai-inspector").addEventListener("toggle", () => {
    if ($(".live-ai-inspector").open) inspect();
  });
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    runtime?.destroy();
    runtime = null;
    current = null;
    document.body.classList.remove("live-game-open");
    syncURL("");
    render();
    if (focusBack?.isConnected) focusBack.focus({ preventScroll: true });
    else $("[data-play]")?.focus({ preventScroll: true });
  });
  function readHash() {
    const parts = location.hash.slice(1).split("/"),
      g = games.find((g) => g.id === parts[0]);
    if (
      g &&
      (!dialog.open ||
        current?.id !== g.id ||
        difficulty !== Math.max(0, levelIds.indexOf(parts[1])))
    )
      openGame(g.id, Math.max(0, levelIds.indexOf(parts[1])));
  }
  window.addEventListener("hashchange", readHash);
  document.addEventListener("fullscreenchange", () => {
    $("[data-fullscreen]").textContent = document.fullscreenElement
      ? "Exit fullscreen ⛶"
      : "Fullscreen ⛶";
  });
  window.addEventListener("storage", (e) => {
    if (e.key !== P.KEY) return;
    const remote = P.read(storage, ids);
    progress = P.merge(progress, remote, ids);
    progress.favorites = remote.favorites;
    if (!dialog.open) render();
    else showProgress();
  });
  window.addEventListener("atriksha:theme", () => {
    thumbCache.clear();
    render();
    if (previewSim) {
      Object.assign(previewSim.env.palette, palette());
      drawPreview();
    }
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) runtime?.pause();
    else runtime?.destroy();
    cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    if (!event.persisted) previewSim?.dispose();
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    previewPrevious = 0;
    if (!previewFrame) previewFrame = requestAnimationFrame(animatePreview);
    merge();
    showProgress();
    if (runtime) updateHUD(runtime.snapshot());
  });
  readURL();
  render();
  setPreview(previewIndex);
  previewFrame = requestAnimationFrame(animatePreview);
  if ("IntersectionObserver" in window)
    new IntersectionObserver(
      (entries) => {
        previewVisible = entries[0].isIntersecting;
      },
      { rootMargin: "50px" },
    ).observe($("[data-attract]"));
  readHash();
})();
