(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaLiveRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const buttons = ["left", "right", "up", "down", "action", "secondary"];
  function seeded(seed) {
    let n = Number(seed) >>> 0;
    return () => {
      n += 0x6d2b79f5;
      let t = n;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const neutral = () => ({
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    secondary: false,
    pressed: {},
    pointer: { x: 480, y: 270, down: false, pressed: false },
  });
  function policyInput(next = {}, previous = {}) {
    const input = neutral();
    input.setting = [0, 1, 2].includes(next.setting)
      ? next.setting
      : [0, 1, 2].includes(previous.setting)
        ? previous.setting
        : 1;
    for (const key of buttons) {
      input[key] = !!next[key];
      input.pressed[key] =
        !!next.pressed?.[key] || (input[key] && !previous[key]);
    }
    if (next.pointer)
      input.pointer = {
        x: Math.max(0, Math.min(960, Number(next.pointer.x) || 0)),
        y: Math.max(0, Math.min(540, Number(next.pointer.y) || 0)),
        down: !!next.pointer.down,
        pressed:
          !!next.pointer.pressed ||
          (!!next.pointer.down && !previous.pointer?.down),
      };
    return input;
  }
  function createSimulation(worlds, mission, level = 0, options = {}) {
    if (!worlds[mission.family])
      throw Error("This game world could not load. Refresh to try again.");
    const state = {
      phase: "ready",
      score: 0,
      health: 100,
      elapsed: 0,
      duration: mission.duration || 90,
      combo: 1,
      streak: 0,
      assisted: false,
      metrics: {},
      control: 1,
      appliedControl: 1,
      controlChanges: 0,
      engineering: null,
      evidence: [],
      engineeringHistory: [],
      controlHistory: [],
      lastAward: "",
      result: null,
    };
    let lastReward = -10,
      lastEvidence = -10,
      lastEngineeringSample = -10,
      lastAI = {},
      world;
    const cleanText = (value, max = 280) => String(value ?? "").slice(0, max);
    function changeSetting(value, automatic = false) {
      if (![0, 1, 2].includes(value) || state.phase === "ended") return false;
      if (value === state.control) return true;
      state.control = value;
      if (state.elapsed > 0 && ["running", "paused"].includes(state.phase)) {
        if (!automatic) state.controlChanges++;
        state.controlHistory.push({
          time: Math.round(state.elapsed * 10) / 10,
          setting: value,
          automatic,
        });
        if (state.controlHistory.length > 120) state.controlHistory.shift();
      }
      return true;
    }
    const palette = options.palette || {
      bg: "#11151a",
      surface: "#1c252d",
      text: "#f2f5f7",
      muted: "#a7b3bf",
      accent: "#c7ed78",
      cyan: "#7bdded",
      amber: "#f0bc78",
      purple: "#c8a4ed",
      danger: "#ff788e",
    };
    function finish(won, reason) {
      if (state.phase === "ended") return;
      state.phase = "ended";
      state.result = {
        won: !!won,
        reason: String(reason || "Run complete"),
        score: state.score,
        health: Math.round(state.health),
        elapsed: Math.round(state.elapsed * 10) / 10,
        assisted: state.assisted,
        metrics: { ...state.metrics },
        controlChanges: state.controlChanges,
        engineering: state.engineering ? { ...state.engineering } : null,
        evidence: state.evidence.map((item) => ({ ...item })),
        engineeringHistory: state.engineeringHistory.map((item) => ({
          ...item,
        })),
        controlHistory: state.controlHistory.map((item) => ({ ...item })),
      };
      options.onFinish?.(state.result);
    }
    const env = {
      w: 960,
      h: 540,
      mission,
      level,
      random: seeded(options.seed ?? (mission.seed || 1) + level * 997),
      palette,
      time: () => state.elapsed,
      emit: (...args) => options.onEffect?.(...args),
      award: (points, label) => {
        if (
          state.phase !== "running" ||
          !Number.isFinite(points) ||
          points <= 0
        )
          return;
        state.streak++;
        state.combo = Math.min(3, 1 + Math.floor(state.streak / 5) * 0.25);
        state.score = Math.min(
          1e8,
          state.score + Math.round(Math.min(points, 10000) * state.combo),
        );
        state.lastAward = String(label || "");
        lastReward = state.elapsed;
        options.onAward?.(label);
      },
      damage: (amount) => {
        if (
          state.phase !== "running" ||
          !Number.isFinite(amount) ||
          amount <= 0
        )
          return;
        state.health = Math.max(0, state.health - amount);
        state.streak = 0;
        state.combo = 1;
        options.onDamage?.(amount);
        if (state.health <= 0) finish(false, "Hull depleted");
      },
      metric: (name, value) => {
        if (
          (typeof value === "string" || Number.isFinite(value)) &&
          (Object.hasOwn(state.metrics, name) ||
            Object.keys(state.metrics).length < 3)
        )
          state.metrics[String(name).slice(0, 40)] = String(value).slice(0, 80);
      },
      engineering: (sample) => {
        if (!sample || typeof sample !== "object" || state.phase === "ended")
          return;
        const packet = {};
        for (const key of [
          "concept",
          "readout",
          "explanation",
          "formula",
          "outcomeLabel",
          "unit",
        ])
          if (sample[key] !== undefined) packet[key] = cleanText(sample[key]);
        packet.status = ["good", "warning", "danger"].includes(sample.status)
          ? sample.status
          : "warning";
        for (const key of ["signal", "setting", "outcome"])
          if (Number.isFinite(sample[key])) packet[key] = sample[key];
        state.engineering = packet;
        if (
          state.phase === "running" &&
          state.elapsed - lastEngineeringSample >= 1
        ) {
          lastEngineeringSample = state.elapsed;
          state.engineeringHistory.push({
            time: Math.round(state.elapsed * 10) / 10,
            ...packet,
          });
          if (state.engineeringHistory.length > 120)
            state.engineeringHistory.shift();
        }
      },
      evidence: (item) => {
        if (
          state.phase !== "running" ||
          !item ||
          typeof item !== "object" ||
          state.elapsed - lastEvidence < 1.5
        )
          return;
        const event = {
          time: Math.round(state.elapsed * 10) / 10,
          setting: state.control,
          automatic: !!state.ai,
        };
        for (const key of ["concept", "event", "decision", "consequence"])
          event[key] = cleanText(item[key]);
        if (!event.event || !event.consequence) return;
        if (Number.isFinite(item.quality))
          event.quality = Math.max(0, Math.min(1, item.quality));
        state.evidence.push(event);
        if (state.evidence.length > 18) state.evidence.shift();
        lastEvidence = state.elapsed;
      },
      finish,
    };
    world = worlds[mission.family](env);
    if (
      !world ||
      typeof world.update !== "function" ||
      typeof world.draw !== "function" ||
      typeof world.observe !== "function" ||
      typeof world.act !== "function"
    )
      throw Error("Incomplete game world");
    return {
      state,
      env,
      world,
      start() {
        if (state.phase === "ready" || state.phase === "paused")
          state.phase = "running";
      },
      pause() {
        if (state.phase === "running") state.phase = "paused";
      },
      setAI(on) {
        state.ai = !!on;
        if (on) state.assisted = true;
        lastAI = {};
      },
      setSetting(value) {
        if (state.ai) return false;
        return changeSetting(value);
      },
      step(dt, input) {
        if (state.phase !== "running") return;
        dt = Math.min(1 / 30, Math.max(0, Number(dt) || 0));
        state.elapsed += dt;
        if (state.elapsed - lastReward > 5) {
          state.streak = 0;
          state.combo = 1;
        }
        let active = input || neutral();
        if (state.ai) {
          active = policyInput(world.act(world.observe()), {
            ...lastAI,
            setting: state.control,
          });
          lastAI = active;
        }
        if ([0, 1, 2].includes(active.setting))
          changeSetting(active.setting, !!state.ai);
        active = { ...active, setting: state.control };
        state.appliedControl = state.control;
        world.update(dt, active);
        if (state.elapsed >= state.duration && state.phase === "running")
          finish(false, "Time complete");
      },
      finish,
      observe: () => world.observe(),
      dispose: () => world.dispose?.(),
    };
  }
  function mount(canvas, worlds, mission, level, callbacks = {}) {
    const ctx = canvas.getContext("2d"),
      abort = new AbortController(),
      signal = abort.signal;
    let raf = 0,
      previous = 0,
      accumulator = 0,
      lastPublish = 0,
      destroyed = false,
      sound = false,
      audio = null,
      soundTime = 0,
      aiTrace = null;
    const input = neutral(),
      particles = [],
      floats = [];
    let shake = 0;
    function tone(freq = 500) {
      if (!sound || performance.now() - soundTime < 65) return;
      soundTime = performance.now();
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === "suspended") audio.resume().catch(() => {});
        const o = audio.createOscillator(),
          g = audio.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, audio.currentTime);
        o.frequency.exponentialRampToValueAtTime(
          freq * 0.6,
          audio.currentTime + 0.1,
        );
        g.gain.setValueAtTime(0.035, audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
        o.connect(g);
        g.connect(audio.destination);
        o.start();
        o.stop(audio.currentTime + 0.13);
      } catch {}
    }
    const reduced = () =>
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "paused";
    const sim = createSimulation(worlds, mission, level, {
      onFinish: (r) => {
        clearInputs();
        callbacks.onFinish?.(r);
      },
      onAward: (label) => {
        tone(720);
        if (label) floats.push({ text: String(label), life: 1.2 });
      },
      onDamage: () => {
        shake = reduced() ? 0 : 5;
        tone(130);
      },
      onEffect: (type, x, y, color) => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || reduced()) return;
        for (
          let i = 0;
          i < (type === "trail" ? 1 : 9) && particles.length < 180;
          i++
        )
          particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150,
            life: 0.3 + Math.random() * 0.4,
            color: color || sim.env.palette.accent,
          });
      },
    });
    function palette() {
      const s = getComputedStyle(document.documentElement);
      for (const k of [
        "bg",
        "surface",
        "text",
        "muted",
        "accent",
        "cyan",
        "amber",
        "purple",
        "danger",
      ])
        sim.env.palette[k] =
          s.getPropertyValue("--" + k).trim() || sim.env.palette[k];
      draw();
    }
    function clearInputs() {
      for (const k of buttons) {
        input[k] = false;
        input.pressed[k] = false;
      }
      input.pointer.down = input.pointer.pressed = false;
      callbacks.controls
        ?.querySelectorAll("[data-hold]")
        .forEach((b) => b.classList.remove("is-held"));
    }
    const keyMap = {
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
      ArrowUp: "up",
      KeyW: "up",
      ArrowDown: "down",
      KeyS: "down",
      Space: "action",
      KeyE: "secondary",
      ShiftLeft: "secondary",
      ShiftRight: "secondary",
    };
    function key(event, down) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        const mapped = keyMap[event.code];
        if (!down && mapped) input[mapped] = false;
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
        return;
      if (
        ["KeyZ", "KeyX", "BracketLeft", "BracketRight"].includes(event.code)
      ) {
        event.preventDefault();
        if (down && !event.repeat) {
          const delta = ["KeyZ", "BracketLeft"].includes(event.code) ? -1 : 1;
          setSetting(Math.max(0, Math.min(2, sim.state.control + delta)));
        }
        return;
      }
      if (event.code === "KeyP" && down && !event.repeat) {
        event.preventDefault();
        togglePause();
        return;
      }
      const k = keyMap[event.code];
      if (!k) return;
      if (event.target.closest?.("button") && event.code === "Space") return;
      event.preventDefault();
      if (down && !input[k]) input.pressed[k] = true;
      input[k] = down;
    }
    window.addEventListener("keydown", (e) => key(e, true), { signal });
    window.addEventListener("keyup", (e) => key(e, false), { signal });
    function position(event) {
      const r = canvas.getBoundingClientRect();
      input.pointer.x = ((event.clientX - r.left) / r.width) * 960;
      input.pointer.y = ((event.clientY - r.top) / r.height) * 540;
    }
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        canvas.focus({ preventScroll: true });
        position(e);
        input.pointer.down = input.pointer.pressed = true;
        canvas.setPointerCapture(e.pointerId);
      },
      { signal },
    );
    canvas.addEventListener("pointermove", (e) => position(e), { signal });
    canvas.addEventListener(
      "pointerup",
      (e) => {
        position(e);
        input.pointer.down = false;
      },
      { signal },
    );
    canvas.addEventListener(
      "pointercancel",
      () => {
        input.pointer.down = false;
        input.pointer.pressed = false;
      },
      { signal },
    );
    callbacks.controls?.querySelectorAll("[data-hold]").forEach((button) => {
      const k = button.dataset.hold;
      button.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          button.setPointerCapture(e.pointerId);
          input[k] = true;
          input.pressed[k] = true;
          button.classList.add("is-held");
        },
        { signal },
      );
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(
          event,
          () => {
            input[k] = false;
            button.classList.remove("is-held");
          },
          { signal },
        );
      button.addEventListener(
        "keydown",
        (e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!input[k]) input.pressed[k] = true;
            input[k] = true;
          }
        },
        { signal },
      );
      button.addEventListener(
        "keyup",
        (e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            input[k] = false;
          }
        },
        { signal },
      );
    });
    function togglePause() {
      if (sim.state.phase === "running") sim.pause();
      else if (sim.state.phase === "paused") sim.start();
      clearInputs();
      callbacks.onState?.(snapshot());
      if (sim.state.phase === "running") canvas.focus({ preventScroll: true });
    }
    function setSetting(value) {
      if (!sim.setSetting(value)) return;
      input.setting = sim.state.control;
      callbacks.onState?.(snapshot());
    }
    function pause() {
      sim.pause();
      clearInputs();
      callbacks.onState?.(snapshot());
    }
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) pause();
      },
      { signal },
    );
    window.addEventListener("blur", pause, { signal });
    window.addEventListener("atriksha:theme", palette, { signal });
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = 960 * dpr;
      canvas.height = 540 * dpr;
      draw();
    }
    window.addEventListener("resize", resize, { signal });
    function draw() {
      if (destroyed) return;
      const scale = canvas.width / 960;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, 960, 540);
      ctx.fillStyle = sim.env.palette.bg;
      ctx.fillRect(0, 0, 960, 540);
      ctx.save();
      if (shake > 0 && !reduced())
        ctx.translate(
          Math.sin(performance.now() * 0.1) * shake,
          Math.cos(performance.now() * 0.13) * shake,
        );
      try {
        sim.world.draw(ctx);
      } catch (error) {
        callbacks.onError?.(error);
        destroy();
        return;
      }
      ctx.restore();
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life * 1.7);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1;
      const f = floats.at(-1);
      if (f) {
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = sim.env.palette.accent;
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.fillText(f.text, 480, 48 - (1.2 - f.life) * 12);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      }
    }
    function snapshot() {
      return { ...sim.state, metrics: { ...sim.state.metrics } };
    }
    function frame(now) {
      if (destroyed) return;
      const delta = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
      previous = now;
      if (sim.state.phase === "running") {
        accumulator += delta;
        let n = 0;
        while (accumulator >= 1 / 60 && n++ < 6) {
          try {
            sim.step(1 / 60, input);
          } catch (error) {
            callbacks.onError?.(error);
            destroy();
            return;
          }
          accumulator -= 1 / 60;
          for (const k of buttons) input.pressed[k] = false;
          input.pointer.pressed = false;
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life -= delta;
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = floats.length - 1; i >= 0; i--) {
          floats[i].life -= delta;
          if (floats[i].life <= 0) floats.splice(i, 1);
        }
        shake = Math.max(0, shake - delta * 18);
      } else accumulator = 0;
      draw();
      if (now - lastPublish > 120) {
        lastPublish = now;
        callbacks.onState?.(snapshot());
      }
      raf = requestAnimationFrame(frame);
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      abort.abort();
      clearInputs();
      sim.dispose();
      if (audio) audio.close().catch(() => {});
    }
    resize();
    palette();
    raf = requestAnimationFrame(frame);
    return {
      start() {
        sim.start();
        canvas.focus({ preventScroll: true });
      },
      pause,
      resume() {
        sim.start();
        canvas.focus({ preventScroll: true });
      },
      togglePause,
      setAI: (on) => {
        sim.setAI(on);
        if (!on) input.setting = sim.state.control;
      },
      setSetting,
      setSound: (on) => {
        sound = on;
        if (on) tone();
      },
      snapshot,
      observe: () => sim.observe(),
      policy: () => {
        const observation = sim.observe();
        return { observation, action: sim.world.act(observation) };
      },
      destroy,
    };
  }
  return { seeded, neutral, policyInput, createSimulation, mount };
});
