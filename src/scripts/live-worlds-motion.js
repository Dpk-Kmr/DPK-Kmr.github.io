/* Continuous worlds. Physics and reactive controllers share only visible observations. */
(function (root, factory) {
  const worlds = factory();
  if (typeof module === "object" && module.exports) module.exports = worlds;
  else Object.assign((root.AtrikshaWorlds ||= {}), worlds);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const held = (input) => ({
    left: !!input?.left,
    right: !!input?.right,
    up: !!input?.up,
    down: !!input?.down,
    action: !!input?.action,
    secondary: !!input?.secondary,
    setting: Number.isInteger(input?.setting) ? clamp(input.setting, 0, 2) : 1,
    pointer: input?.pointer || {},
    pressed: input?.pressed || {},
  });
  const control = (fields) => ({
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    secondary: false,
    ...fields,
  });
  function setup(env) {
    const w = env.w || 960,
      h = env.h || 540,
      level = clamp(env.level || 0, 0, 2),
      variant = clamp(env.mission?.variant || 0, 0, 4),
      random = env.random || Math.random;
    const emit = (type, x, y, color) => env.emit?.(type, x, y, color);
    const award = (points, label) => env.award?.(points, label);
    const metric = (name, value) => env.metric?.(name, value);
    return { w, h, level, variant, random, emit, award, metric };
  }
  function rounded(ctx, x, y, w, h, r = 7) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function panel(ctx, x, y, w, h, color, alpha = 0.15) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    rounded(ctx, x, y, w, h);
    ctx.fill();
    ctx.restore();
  }
  function text(ctx, value, x, y, color, size = 12, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${size}px "IBM Plex Mono", monospace`;
    ctx.textAlign = align;
    ctx.fillText(String(value), x, y);
  }
  function glow(ctx, color, blur = 12) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function background(ctx, p, w, h, t, offset = 0, style = 0) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.surface);
    g.addColorStop(1, p.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.strokeStyle = p.cyan;
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const x =
        ((((i * 93 - offset * 0.15) % (w + 90)) + w + 90) % (w + 90)) - 45;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = style ? 30 : h * 0.53; y < h; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = p.purple;
    for (let i = 0; i < 13; i++) {
      const x =
        ((((i * 137 - offset * 0.08) % (w + 140)) + w + 140) % (w + 140)) - 70;
      const height = 45 + ((i * 37) % 110);
      ctx.fillRect(x, h * 0.64 - height, 65, height);
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = p.muted;
    for (let i = 0; i < 26; i++) {
      const x = (i * 197 + 29) % w,
        y = (i * 83 + 13) % (h * 0.5);
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t + i);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }
  function diamond(ctx, x, y, r, color, filled = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    glow(ctx, color, 8);
    if (filled) ctx.fillRect(-r / 2, -r / 2, r, r);
    else ctx.strokeRect(-r / 2, -r / 2, r, r);
    ctx.restore();
  }
  function ring(ctx, x, y, r, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  function arrow(ctx, x, y, angle, color, size = 11) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.6);
    ctx.lineTo(-size * 0.35, 0);
    ctx.lineTo(-size * 0.7, size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Evidence records a measured decision/outcome, never a claim of learning.
  function engineeringChannel(env) {
    let latest = null,
      lastEvidence = -Infinity;
    return {
      publish(data) {
        latest = data;
        env.engineering?.(data);
      },
      evidence(t, data) {
        if (t - lastEvidence < 2) return;
        lastEvidence = t;
        env.evidence?.({ ...data, quality: clamp(data.quality, 0, 1) });
      },
      draw(ctx, c, width) {
        if (!latest) return;
        const x = width - 375,
          y = 15;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = c.bg;
        rounded(ctx, x, y, 355, 86, 8);
        ctx.fill();
        const color =
          latest.status === "good"
            ? c.accent
            : latest.status === "danger"
              ? c.danger
              : c.amber;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        text(ctx, latest.settingLabel, x + 12, y + 21, color, 13);
        const lines = latest.display || [latest.readout];
        lines
          .slice(0, 2)
          .forEach((line, i) =>
            text(ctx, line, x + 12, y + 42 + i * 18, c.text, 11),
          );
        ctx.restore();
      },
    };
  }

  function runner(env) {
    const { w, h, level, variant, random, emit, award, metric } = setup(env);
    const instrument = engineeringChannel(env),
      rates = [8, 16, 32];
    let setting = 1,
      battery = 100,
      signalFrequency = 3,
      aliasFrequency = 3,
      sampleQuality = 1,
      capturedQuality = 0;
    const engineeringState = () => ({
      setting,
      rates: [...rates],
      frequency: signalFrequency,
      aliasFrequency,
      sampleRate: rates[setting],
      battery,
      quality: sampleQuality,
    });
    let t = 0,
      camera = 0,
      nextId = 0,
      progressMark = 0,
      collected = 0,
      missed = 0,
      done = false;
    const p = {
      x: 110,
      y: 396,
      vx: 185,
      vy: 0,
      r: 16,
      grounded: true,
      dash: 0,
      cooldown: 0,
      invulnerable: 0,
    };
    const platforms = [{ id: nextId++, x: -200, y: 430, width: 880, belt: 0 }],
      orbs = [],
      gates = [];
    let generated = 680;
    const goal = env.mission?.goal || 35 + level * 7;
    function generate() {
      while (generated < p.x + w * 1.7) {
        const gap =
            variant === 4
              ? 105 + random() * 85
              : 45 + random() * (60 + level * 14),
          width = 180 + random() * 170;
        const y = clamp(415 + (random() - 0.5) * 90, 350, 455),
          x = generated + gap;
        const belt = variant === 2 ? (nextId % 2 ? 70 : -55) : 0;
        platforms.push({ id: nextId++, x, y, width, belt });
        for (let k = 0; k < 3; k++)
          orbs.push({
            x: x + 38 + (k * (width - 75)) / 2,
            y: y - 35 - (k === 1 ? 55 : 0),
            noise: k === 1 && random() < 0.22 + level * 0.06,
            phase: random() * 6.28,
            collected: false,
            missed: false,
          });
        if (variant === 3 && nextId % 2 === 0)
          gates.push({
            x: x + width * 0.66,
            y: y - 102,
            height: 102,
            phase: random() * 5,
          });
        generated = x + width;
      }
      while (
        platforms.length > 3 &&
        platforms[0].x + platforms[0].width < p.x - w
      )
        platforms.shift();
      while (orbs.length && orbs[0].x < p.x - w) orbs.shift();
      while (gates.length && gates[0].x < p.x - w) gates.shift();
    }
    orbs.push(
      { x: 280, y: 390, noise: false, phase: 0, collected: false },
      { x: 400, y: 330, noise: false, phase: 0, collected: false },
      { x: 550, y: 390, noise: false, phase: 0, collected: false },
    );
    generate();
    const active = (orb) =>
      variant !== 1 || Math.sin(t * 3.2 + orb.phase) > 0.05;
    function hit(amount) {
      if (p.invulnerable > 0) return;
      p.invulnerable = 1.3;
      env.damage?.(amount);
      emit("hit", p.x - camera, p.y, env.palette.danger);
    }
    function update(dt, raw) {
      if (done) return;
      const input = held(raw);
      dt = Math.min(dt, 0.04);
      t += dt;
      setting = input.setting;
      const phase = Math.floor(t / (8 - level)) % 3;
      // Conveyor spacing and belt velocity produce a temporal inspection signal.
      signalFrequency =
        variant === 2
          ? (Math.abs(p.vx) + 40 + phase * 100) / 42
          : [3, 6, 12][phase] + (variant === 4 ? 0.6 : variant === 1 ? 0.3 : 0);
      const rate = rates[setting];
      aliasFrequency = Math.abs(
        signalFrequency - Math.round(signalFrequency / rate) * rate,
      );
      sampleQuality =
        rate > 2 * signalFrequency && battery > 0
          ? 1
          : clamp(aliasFrequency / signalFrequency, 0, 0.45);
      // Sensor acquisition plus processing cost rises quadratically with rate. Captures recharge it.
      battery = clamp(
        battery - (rate / 8) ** 2 * (variant === 3 ? 1.15 : 1) * dt,
        0,
        100,
      );
      instrument.publish({
        concept: "Sampling and aliasing",
        readout: `Signal ${signalFrequency.toFixed(1)} Hz; sampled at ${rate} Hz; apparent ${aliasFrequency.toFixed(1)} Hz; battery ${battery.toFixed(0)}%`,
        settingLabel: `${rate} Hz sampling`,
        status: sampleQuality === 1 ? "good" : "danger",
        explanation:
          sampleQuality === 1
            ? "The sample rate resolves this signal. Higher rates consume more battery."
            : "Undersampling changes the reconstructed frequency; these captures cannot be credited as accurate data.",
        formula:
          "f_alias = |f − round(f / f_s) × f_s|; unaliased when f_s > 2f; sensor drain ∝ f_s²",
        signal: signalFrequency,
        setting: rate,
        outcome: sampleQuality * 100,
        outcomeLabel: "Accurate reconstruction",
        unit: "%",
        display: [
          `Signal ${signalFrequency.toFixed(1)} Hz → observed ${aliasFrequency.toFixed(1)} Hz`,
          `Quality ${Math.round(sampleQuality * 100)}% · sensor ${Math.round(battery)}%`,
        ],
      });
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.dash = Math.max(0, p.dash - dt);
      if (input.secondary && p.cooldown === 0) {
        p.dash = 0.26;
        p.cooldown = 2.1;
        emit("boost", p.x - camera, p.y, env.palette.accent);
      }
      const floor = platforms.find(
        (s) =>
          p.x >= s.x && p.x <= s.x + s.width && Math.abs(p.y + p.r - s.y) < 5,
      );
      const speed =
        178 +
        level * 28 +
        (input.right ? 60 : 0) -
        (input.left ? 70 : 0) +
        (p.dash > 0 ? 240 : 0) +
        (floor?.belt || 0);
      p.vx += (speed - p.vx) * Math.min(1, dt * 8);
      if (input.action && p.grounded) {
        p.vy = variant === 4 ? -390 : -505;
        p.grounded = false;
        emit("trail", p.x - camera, p.y + p.r, env.palette.cyan);
      }
      const previous = p.y + p.r;
      p.vy += (variant === 4 ? 590 : 1330) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.grounded = false;
      for (const s of platforms)
        if (
          p.x + p.r > s.x &&
          p.x - p.r < s.x + s.width &&
          previous <= s.y + 5 &&
          p.y + p.r >= s.y &&
          p.vy >= 0
        ) {
          p.y = s.y - p.r;
          p.vy = 0;
          p.grounded = true;
          break;
        }
      camera = Math.max(0, p.x - 190);
      for (const orb of orbs) {
        if (orb.collected) continue;
        if (!orb.missed && orb.x < p.x - 35) {
          orb.missed = true;
          if (!orb.noise) missed++;
        }
        if (active(orb) && Math.hypot(orb.x - p.x, orb.y - p.y) < p.r + 14) {
          orb.collected = true;
          if (orb.noise) {
            hit(8);
            emit("hit", orb.x - camera, orb.y, env.palette.danger);
          } else {
            if (sampleQuality === 1) collected++;
            capturedQuality += sampleQuality;
            battery = clamp(
              battery +
                (sampleQuality === 1
                  ? variant === 4
                    ? 12
                    : variant === 1
                      ? 10
                      : variant === 2
                        ? 9
                        : 7
                  : 1),
              0,
              100,
            );
            award(
              Math.max(1, Math.round(sampleQuality === 1 ? 45 : 1)),
              sampleQuality === 1 ? "Verified sample" : "Aliased sample",
            );
            instrument.evidence(t, {
              concept: "Sampling and aliasing",
              event: "Signal captured",
              decision: `${rate} Hz sampling for ${signalFrequency.toFixed(1)} Hz signal`,
              consequence:
                sampleQuality === 1
                  ? "Reconstruction was unaliased; one verified capture credited."
                  : `Aliasing changed the frequency to ${aliasFrequency.toFixed(1)} Hz; no verified capture credited.`,
              quality: sampleQuality,
            });
            emit("collect", orb.x - camera, orb.y, env.palette.cyan);
          }
        }
      }
      for (const gate of gates)
        if (
          Math.sin(t * 2.3 + gate.phase) > 0.05 &&
          Math.abs(p.x - gate.x) < p.r + 5 &&
          p.y + p.r > gate.y &&
          p.y - p.r < gate.y + gate.height &&
          p.dash <= 0
        )
          hit(12);
      if (p.y > h + 80) {
        hit(18);
        const s =
          platforms.find((s) => s.x + s.width > p.x + 30) || platforms.at(-1);
        p.x = Math.max(s.x + 35, Math.min(p.x, s.x + s.width - 35));
        p.y = s.y - p.r;
        p.vy = 0;
        p.grounded = true;
      }
      if (p.x > progressMark + 300) {
        progressMark = p.x;
        award(12, "Distance");
      }
      generate();
      metric("Data", `${collected}/${goal}`);
      metric("Ground speed", `${Math.round(p.vx)} px/s`);
      metric(
        variant === 4 ? "Gravity" : "Capture rate",
        variant === 4
          ? "590 px/s²"
          : `${Math.round((collected / Math.max(1, collected + missed)) * 100)}%`,
      );
      if (collected >= goal) {
        done = true;
        env.finish?.(true, "Data route complete");
      }
    }
    function observe() {
      const floor = platforms.find(
        (s) =>
          p.x >= s.x && p.x <= s.x + s.width && Math.abs(p.y + p.r - s.y) < 6,
      );
      return {
        family: "runner",
        variant,
        level,
        player: { ...p },
        engineering: engineeringState(),
        support:
          platforms.find((s) => p.x >= s.x && p.x <= s.x + s.width) || null,
        overGap: !platforms.some((s) => p.x >= s.x && p.x <= s.x + s.width),
        edge: floor ? floor.x + floor.width - p.x : 0,
        nextPlatform: platforms.find((s) => s.x > p.x) || null,
        orbs: orbs
          .filter((o) => !o.collected && o.x > p.x - 30 && o.x < p.x + 400)
          .map((o) => ({ x: o.x, y: o.y, noise: o.noise, active: active(o) })),
        gates: gates
          .filter((g) => g.x > p.x - 20 && g.x < p.x + 300)
          .map((g) => ({ x: g.x, active: Math.sin(t * 2.3 + g.phase) > 0.05 })),
      };
    }
    function act(o) {
      const high = o.orbs.find(
        (a) =>
          !a.noise &&
          a.active &&
          a.x > o.player.x &&
          a.x - o.player.x < 90 &&
          a.y < o.player.y - 25,
      );
      const noise = o.orbs.find(
        (a) =>
          a.noise &&
          a.active &&
          a.x - o.player.x > 0 &&
          a.x - o.player.x < 90 &&
          Math.abs(a.y - o.player.y) < 40,
      );
      const landingX =
          o.player.x + o.player.vx * (o.variant === 4 ? 1.32 : 0.76),
        safeJump =
          (!!o.support && landingX < o.support.x + o.support.width - 15) ||
          (!!o.nextPlatform &&
            landingX > o.nextPlatform.x + 15 &&
            landingX < o.nextPlatform.x + o.nextPlatform.width - 15);
      return control({
        setting: (() => {
          const index = o.engineering.rates.findIndex(
            (rate) => rate > 2 * o.engineering.frequency,
          );
          return index < 0 ? 2 : index;
        })(),
        right: true,
        action:
          o.player.grounded &&
          (o.edge < (o.variant === 4 ? 95 : 65) ||
            (safeJump && (!!high || !!noise))),
        secondary:
          o.gates.some((g) => g.active && g.x - o.player.x < 80) ||
          (o.overGap &&
            !o.player.grounded &&
            o.player.vy > 0 &&
            o.nextPlatform &&
            o.nextPlatform.x - o.player.x > 65),
      });
    }
    function draw(ctx) {
      const c = env.palette;
      background(ctx, c, w, h, t, camera);
      ctx.save();
      ctx.strokeStyle = c.purple;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 260; i++) {
        const x = 30 + i,
          y = 135 - Math.sin((i / 260) * signalFrequency * Math.PI * 2) * 22;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = sampleQuality === 1 ? c.cyan : c.danger;
      for (let n = 0; n <= rates[setting]; n++) {
        const x = 30 + (n / rates[setting]) * 260,
          y =
            135 -
            Math.sin((n / rates[setting]) * signalFrequency * Math.PI * 2) * 22;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      ctx.restore();
      text(ctx, "1 SECOND · ANALOG WAVE + SAMPLES", 30, 178, c.muted, 10);
      text(
        ctx,
        [
          "CYAN DATA · RED NOISE",
          "CAPTURE THE LIT PULSES",
          "MOVING CONVEYOR BELTS",
          "DASH THROUGH LIVE FIREWALLS",
          "LOW GRAVITY · LONGER FLIGHT",
        ][variant],
        30,
        37,
        c.muted,
        12,
      );
      for (const s of platforms) {
        const x = s.x - camera;
        if (x > w || x + s.width < 0) continue;
        ctx.fillStyle = c.surface;
        rounded(ctx, x, s.y, s.width, h - s.y + 40, 8);
        ctx.fill();
        ctx.strokeStyle = c.cyan;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, s.y);
        ctx.lineTo(x + s.width, s.y);
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = c.muted;
        for (let a = x + 12; a < x + s.width; a += 26) {
          ctx.beginPath();
          ctx.moveTo(a, s.y + 12);
          ctx.lineTo(a + 15, s.y + 27);
          ctx.stroke();
        }
        ctx.restore();
        if (s.belt)
          for (let a = x + 30; a < x + s.width - 15; a += 48)
            arrow(ctx, a, s.y + 15, s.belt > 0 ? 0 : Math.PI, c.amber, 7);
      }
      for (const orb of orbs)
        if (!orb.collected && orb.x - camera > -30 && orb.x - camera < w + 30) {
          const x = orb.x - camera;
          ctx.save();
          ctx.globalAlpha = active(orb) ? 1 : 0.15;
          if (orb.noise) {
            ctx.strokeStyle = c.danger;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x - 8, orb.y - 8);
            ctx.lineTo(x + 8, orb.y + 8);
            ctx.moveTo(x + 8, orb.y - 8);
            ctx.lineTo(x - 8, orb.y + 8);
            ctx.stroke();
            ring(ctx, x, orb.y, 15, c.danger, 0.4);
          } else {
            diamond(
              ctx,
              x,
              orb.y + Math.sin(t * 5 + orb.phase) * 3,
              14,
              c.cyan,
            );
            ring(ctx, x, orb.y, 23, c.cyan, 0.12);
          }
          ctx.restore();
        }
      for (const gate of gates) {
        const live = Math.sin(t * 2.3 + gate.phase) > 0.05,
          x = gate.x - camera;
        ctx.save();
        ctx.globalAlpha = live ? 0.95 : 0.2;
        ctx.strokeStyle = c.danger;
        ctx.lineWidth = live ? 5 : 1;
        glow(ctx, c.danger, live ? 18 : 0);
        ctx.beginPath();
        ctx.moveTo(x, gate.y);
        ctx.lineTo(x, gate.y + gate.height);
        ctx.stroke();
        ctx.restore();
      }
      const x = p.x - camera;
      ctx.save();
      ctx.translate(x, p.y);
      if (p.invulnerable > 0 && Math.floor(t * 15) % 2) ctx.globalAlpha = 0.4;
      if (p.dash > 0) {
        for (let i = 1; i < 5; i++)
          panel(ctx, -i * 15 - 13, -12, 25, 25, c.accent, 0.22 / i);
      }
      glow(ctx, c.accent, 15);
      ctx.fillStyle = c.accent;
      rounded(ctx, -14, -16, 28, 30, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = c.bg;
      ctx.fillRect(2, -9, 10, 5);
      ctx.strokeStyle = c.cyan;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-7, 13);
      ctx.lineTo(-10 + Math.sin(t * 18) * 4, 21);
      ctx.moveTo(7, 13);
      ctx.lineTo(9 - Math.sin(t * 18) * 4, 21);
      ctx.stroke();
      ctx.restore();
      panel(ctx, 30, h - 46, 145, 26, c.surface, 0.92);
      text(
        ctx,
        `DASH ${p.cooldown > 0 ? p.cooldown.toFixed(1) + "s" : "READY"}`,
        42,
        h - 28,
        p.cooldown > 0 ? c.muted : c.accent,
        11,
      );
      instrument.draw(ctx, c, w);
    }
    return { update, draw, observe, act };
  }

  function grapple(env) {
    const { w, h, level, variant, random, emit, award, metric } = setup(env);
    const instrument = engineeringChannel(env),
      ratings = [950, 1650, 2800],
      ropeMass = [0, 9, 27];
    let setting = 1,
      tension = 0,
      load = 12,
      overload = 0,
      safety = 2,
      predictedTensions = [0, 0, 0];
    const engineeringState = () => ({
      setting,
      ratings: [...ratings],
      ropeMass: [...ropeMass],
      tension,
      payload: load,
      safety,
      predictedTensions: [...predictedTensions],
      overload,
    });
    let t = 0,
      camera = 0,
      generated = 0,
      serial = 0,
      collected = 0,
      travel = 0,
      done = false;
    const p = {
      x: 120,
      y: 310,
      vx: 140,
      vy: 0,
      r: 13,
      anchor: null,
      length: 0,
      attachedFor: 0,
      cooldown: 0,
      invulnerable: 0,
    };
    const anchors = [],
      cargo = [];
    const goal = env.mission?.goal || 12 + level * 3;
    function generate() {
      while (generated < p.x + w * 1.5) {
        generated += 230 + random() * (50 + level * 12);
        const y = 95 + random() * 85;
        anchors.push({
          id: serial++,
          x: generated,
          y,
          baseY: y,
          phase: random() * 6.28,
          expired: false,
        });
        cargo.push({
          x: generated + 25,
          y: y + 220 + random() * 25,
          collected: false,
        });
      }
      while (anchors.length > 7 && anchors[0].x < p.x - w) anchors.shift();
      while (cargo.length && cargo[0].x < p.x - w) cargo.shift();
    }
    generate();
    function anchorPosition(a) {
      return {
        x: a.x,
        y: a.baseY + (variant === 1 ? Math.sin(t * 1.4 + a.phase) * 45 : 0),
      };
    }
    function nearest() {
      return anchors
        .filter((a) => !a.expired && a.x > p.x - 70)
        .map((a) => ({ ...a, ...anchorPosition(a) }))
        .filter((a) => distance(a, p) < 325 && a.y < p.y - 30)
        .sort(
          (a, b) => Math.abs(a.x - p.x - 110) - Math.abs(b.x - p.x - 110),
        )[0];
    }
    function update(dt, raw) {
      if (done) return;
      const input = held(raw);
      dt = Math.min(0.04, dt);
      t += dt;
      setting = input.setting;
      load = [12, 45, 85][Math.floor(t / (10 - level)) % 3];
      const anchor = anchors.find((a) => a.id === p.anchor),
        lengthM = Math.max(2, (p.length || 240) / 40);
      const cosTheta = anchor
        ? clamp((p.y - anchor.y) / Math.max(1, distance(p, anchor)), 0, 1)
        : 1;
      const v = Math.hypot(p.vx, p.vy) / 40;
      const gustAcceleration =
        variant === 4
          ? Math.abs(Math.sin(t * 1.1) * 110 + Math.sin(t * 2.7) * 40) / 40
          : 0;
      const anchorAcceleration =
        variant === 1 && anchor
          ? Math.abs(Math.sin(t * 1.4 + anchor.phase) * 45 * 1.4 * 1.4) / 40
          : 0;
      const acceleration =
        ((470 + level * 32) / 40) * cosTheta +
        (v * v) / lengthM +
        gustAcceleration +
        anchorAcceleration;
      predictedTensions = ropeMass.map((m) => (45 + load + m) * acceleration);
      tension = anchor ? predictedTensions[setting] : 0;
      const rating =
        ratings[setting] *
        (variant === 3 ? Math.max(0.65, 1 - p.attachedFor * 0.15) : 1);
      safety = rating / Math.max(1, tension);
      overload =
        anchor && safety < 1 ? overload + dt : Math.max(0, overload - dt * 2);
      if (overload > 0.4) {
        p.anchor = null;
        overload = 0;
        if (p.invulnerable === 0) {
          env.damage?.(10);
          p.invulnerable = 1.5;
        }
        emit("hit", p.x - camera, p.y, env.palette.danger);
        instrument.evidence(t, {
          concept: "Cable load and safety factor",
          event: "Tether overloaded",
          decision: `${rating.toFixed(0)} N cable under ${tension.toFixed(0)} N demand`,
          consequence: "The cable released and the rig lost hull integrity.",
          quality: 0,
        });
      }
      instrument.publish({
        concept: "Cable load and safety factor",
        readout: `Payload ${load} kg; estimated cable load ${tension.toFixed(0)} N; rating ${rating.toFixed(0)} N; factor ${Math.min(9.99, safety).toFixed(2)}`,
        settingLabel: ["Light 950 N", "Balanced 1650 N", "Reinforced 2800 N"][
          setting
        ],
        status: safety >= 1.15 ? "good" : safety >= 1 ? "warning" : "danger",
        explanation:
          "A stronger cable carries more load, but its added mass reduces pumping and reel acceleration. Overload for 0.4 s releases the tether.",
        formula:
          "T_est = m(g_model cos θ + v²/L + |a_gust| + |a_anchor|); g_model=(470+32×level)/40 m/s²; safety factor = rating/T_est",
        signal: tension,
        setting: rating,
        outcome: Math.min(9.99, safety),
        outcomeLabel: "Safety factor",
        display: [
          `Payload ${load} kg · est. load ${Math.round(tension)} N`,
          `Safety ${Math.min(9.99, safety).toFixed(2)} · cable mass ${ropeMass[setting]} kg`,
        ],
      });
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      for (const a of anchors) Object.assign(a, anchorPosition(a));
      if (input.pressed.action) {
        if (p.anchor !== null) {
          p.anchor = null;
          emit("boost", p.x - camera, p.y, env.palette.cyan);
        } else {
          const a = nearest();
          if (a) {
            p.anchor = a.id;
            p.length = clamp(distance(a, p), 90, 310);
            p.attachedFor = 0;
            emit("collect", a.x - camera, a.y, env.palette.cyan);
          }
        }
      }
      if (input.secondary && p.cooldown === 0) {
        p.vx += 120;
        p.vy -= 85;
        p.cooldown = 3.2;
        emit("boost", p.x - camera, p.y, env.palette.accent);
      }
      const wind =
        variant === 4 ? Math.sin(t * 1.1) * 110 + Math.sin(t * 2.7) * 40 : 0;
      p.vx +=
        ((input.right ? 1 : 0) - (input.left ? 1 : 0)) *
          (p.anchor !== null ? 220 : 130) *
          (1 / (1 + ropeMass[setting] / 90)) *
          dt +
        wind * dt;
      p.vy += (470 + level * 32) * dt;
      p.vx *= Math.exp(-0.1 * dt);
      const oldX = p.x,
        oldY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = anchors.find((a) => a.id === p.anchor);
      if (a) {
        p.attachedFor += dt;
        p.length = clamp(
          p.length +
            ((((input.down ? 1 : 0) - (input.up ? 1 : 0)) * 80) /
              (1 + ropeMass[setting] / 90)) *
              dt,
          150,
          310,
        );
        const dx = p.x - a.x,
          dy = p.y - a.y,
          len = Math.max(1, Math.hypot(dx, dy));
        if (variant === 2) {
          const stretch = Math.max(0, len - p.length),
            radial = (p.vx * dx + p.vy * dy) / len,
            tension = Math.max(0, stretch * 18 + radial * 4);
          p.vx -= (dx / len) * tension * dt;
          p.vy -= (dy / len) * tension * dt;
        } else {
          p.x = a.x + (dx / len) * p.length;
          p.y = a.y + (dy / len) * p.length;
          const radial = (p.vx * dx + p.vy * dy) / (len * len);
          p.vx -= radial * dx;
          p.vy -= radial * dy;
        }
        if (variant === 3 && p.attachedFor > 1.25 - level * 0.13) {
          a.expired = true;
          p.anchor = null;
          emit("hit", a.x - camera, a.y, env.palette.amber);
        }
      }
      p.vx = clamp(p.vx, -330, 520);
      p.vy = clamp(p.vy, -620, 620);
      if (p.y < 30) {
        p.y = 30;
        p.vy = Math.abs(p.vy) * 0.3;
      }
      if (p.y > h + 60) {
        if (p.invulnerable === 0) {
          env.damage?.(18);
          p.invulnerable = 1.5;
          emit("hit", p.x - camera, h - 20, env.palette.danger);
        }
        const a =
          anchors.find((a) => a.x > p.x && !a.expired) || anchors.at(-1);
        p.x = a.x - 100;
        p.y = 220;
        p.vx = 140;
        p.vy = 0;
        p.anchor = null;
      }
      camera = Math.max(0, p.x - 240);
      for (const item of cargo)
        if (!item.collected && distance(item, p) < 58) {
          item.collected = true;
          collected++;
          const quality = clamp(safety, 0, 1) * (1 - setting * 0.12);
          award(Math.round(90 * quality), "Load delivered");
          instrument.evidence(t, {
            concept: "Cable load and safety factor",
            event: "Payload delivered",
            decision: `${ratings[setting]} N tether with ${ropeMass[setting]} kg cable mass`,
            consequence: `Payload reached the station with ${Math.min(9.99, safety).toFixed(2)} safety factor.`,
            quality,
          });
          emit("collect", item.x - camera, item.y, env.palette.accent);
        }
      if (p.x > travel + 250) {
        travel = p.x;
        award(20, "Network span");
      }
      generate();
      const speed = Math.hypot(p.vx, p.vy);
      metric("Relays", `${collected}/${goal}`);
      metric("Speed", `${Math.round(speed)} px/s`);
      metric(
        variant === 2 ? "Stretch" : "Tether",
        a
          ? variant === 2
            ? `${Math.max(0, Math.round(distance(a, p) - p.length))} px`
            : `${Math.round(p.length)} px`
          : "FREE",
      );
      if (collected >= goal) {
        done = true;
        env.finish?.(true, "Relay chain complete");
      }
    }
    function observe() {
      return {
        family: "grapple",
        variant,
        level,
        player: { ...p },
        engineering: engineeringState(),
        anchors: anchors
          .filter((a) => a.x > p.x - 180 && a.x < p.x + 600)
          .map((a) => ({ ...a })),
        target: nearest() || null,
        wind:
          variant === 4 ? Math.sin(t * 1.1) * 110 + Math.sin(t * 2.7) * 40 : 0,
      };
    }
    function act(o) {
      const a = o.anchors.find((a) => a.id === o.player.anchor);
      const release =
        !!a &&
        ((o.player.x > a.x + 90 && o.player.vx > 90 && o.player.vy < -55) ||
          (o.variant === 3 && o.player.attachedFor > 1));
      const attach = !a && !!o.target;
      const stress =
        !!a &&
        o.engineering.predictedTensions[2] > o.engineering.ratings[2] / 1.15;
      const stalled =
        o.variant === 2 &&
        !!a &&
        o.player.attachedFor > 2 &&
        Math.hypot(o.player.vx, o.player.vy) < 90;
      return control({
        setting: (() => {
          const i = o.engineering.ratings.findIndex(
            (r, j) =>
              r *
                (o.variant === 3
                  ? Math.max(0.65, 1 - o.player.attachedFor * 0.15)
                  : 1) >=
              o.engineering.predictedTensions[j] *
                (o.variant === 2 ? 1.7 : 1.2),
          );
          return i < 0 ? 2 : i;
        })(),
        right: o.player.vx < 290 && !stress,
        left: o.player.vx > 355 || (stress && o.player.vx > 60),
        up: !!a && o.player.length > 225 && !stress,
        down: stress,
        secondary: (o.player.y > 390 && !a) || stalled,
        action: attach || release,
        pressed: { action: attach || release },
      });
    }
    function draw(ctx) {
      const c = env.palette;
      background(ctx, c, w, h, t, camera, 1);
      text(
        ctx,
        [
          "SPACE TO LINK / RELEASE",
          "ANCHORS MOVE · KEEP MOMENTUM",
          "ELASTIC TETHERS STORE ENERGY",
          "FRAGILE ANCHORS · KEEP MOVING",
          "GUSTS PUSH THE SWING",
        ][variant],
        30,
        36,
        c.muted,
        12,
      );
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = c.danger;
      ctx.fillRect(0, h - 24, w, 24);
      for (let x = -((camera * 0.3) % 50); x < w; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 25, h - 25);
        ctx.lineTo(x + 50, h);
        ctx.fill();
      }
      ctx.restore();
      for (const item of cargo)
        if (!item.collected) {
          diamond(
            ctx,
            item.x - camera,
            item.y + Math.sin(t * 3 + item.x) * 4,
            21,
            c.accent,
          );
          ring(ctx, item.x - camera, item.y, 31, c.accent, 0.12);
        }
      const linked = anchors.find((a) => a.id === p.anchor);
      if (linked) {
        ctx.save();
        ctx.strokeStyle =
          variant === 3 && p.attachedFor > 0.7 ? c.amber : c.cyan;
        ctx.lineWidth = 2;
        glow(ctx, ctx.strokeStyle, 9);
        ctx.beginPath();
        ctx.moveTo(linked.x - camera, linked.y);
        if (variant === 2) {
          for (let i = 1; i < 18; i++) {
            const f = i / 18;
            ctx.lineTo(
              linked.x - camera + (p.x - linked.x) * f + (i % 2 ? 6 : -6),
              linked.y + (p.y - linked.y) * f,
            );
          }
        }
        ctx.lineTo(p.x - camera, p.y);
        ctx.stroke();
        ctx.restore();
      }
      for (const a of anchors) {
        const x = a.x - camera;
        if (x < -50 || x > w + 50) continue;
        ctx.save();
        ctx.globalAlpha = a.expired ? 0.2 : 1;
        ring(ctx, x, a.y, 20, a.id === p.anchor ? c.accent : c.cyan);
        ring(ctx, x, a.y, 29, c.cyan, 0.15);
        diamond(ctx, x, a.y, 11, c.cyan);
        ctx.strokeStyle = c.muted;
        ctx.globalAlpha *= 0.3;
        ctx.beginPath();
        ctx.moveTo(x, a.y - 30);
        ctx.lineTo(x, -10);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(p.x - camera, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx) * 0.3);
      glow(ctx, c.accent, 16);
      ctx.fillStyle = c.accent;
      rounded(ctx, -15, -12, 30, 25, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = c.bg;
      ctx.fillRect(3, -6, 8, 4);
      ctx.restore();
      arrow(ctx, p.x - camera, p.y + 34, Math.atan2(p.vy, p.vx), c.cyan, 9);
      if (variant === 4)
        text(
          ctx,
          `WIND ACCEL ${Math.round(Math.sin(t * 1.1) * 110 + Math.sin(t * 2.7) * 40)} px/s²`,
          w - 30,
          122,
          c.amber,
          12,
          "right",
        );
      instrument.draw(ctx, c, w);
    }
    return { update, draw, observe, act };
  }

  function racer(env) {
    const { w, h, level, variant, random, emit, award, metric } = setup(env);
    const instrument = engineeringChannel(env),
      gains = [0.8, 1.5, 2.6];
    let setting = 1,
      friction = 1,
      crossTrack = 0,
      requestedAcceleration = 0,
      slip = 0,
      trackingQuality = 1;
    const engineeringState = () => ({
      setting,
      gains: [...gains],
      friction,
      crossTrack,
      requestedAcceleration,
      slip,
      trackingQuality,
      responseDistance: p.speed / (gains[setting] * 3.3),
    });
    let t = 0,
      distanceRun = 0,
      nextZ = 160,
      progress = 0,
      passed = 0,
      done = false,
      sensor = 0,
      sensorCooldown = 0;
    const p = {
      x: w / 2,
      y: h - 112,
      vx: 0,
      speed: 80,
      energy: 100,
      boost: 0,
      cooldown: 0,
      invulnerable: 0,
    };
    const objects = [];
    const goal =
      env.mission?.goal ||
      Math.round((env.mission?.duration || 90) * (190 + level * 20));
    const center = (y) =>
      w / 2 + Math.sin((distanceRun + (h - y) * 1.6) / 650) * (75 + level * 15);
    const half = (y) => 125 + clamp(y / h, 0, 1) * 110;
    function project(o) {
      const y = h - (o.z - distanceRun) * 0.88;
      return {
        x:
          center(y) +
          o.lane * half(y) * 0.63 +
          (variant === 3 && o.type === "barrier"
            ? Math.sin(t * 2.1 + o.phase) * 55
            : 0),
        y,
      };
    }
    function generate() {
      while (nextZ < distanceRun + 1000) {
        const lane = Math.floor(random() * 3) - 1,
          type =
            objects.length % 3 === 0
              ? "charge"
              : random() < 0.38
                ? "data"
                : "barrier";
        objects.push({
          z: nextZ,
          lane,
          type,
          phase: random() * 6.28,
          hit: false,
        });
        nextZ += 125 + random() * (95 - level * 20);
      }
      while (objects.length && objects[0].z < distanceRun - 100)
        objects.shift();
    }
    generate();
    function update(dt, raw) {
      if (done) return;
      const input = held(raw);
      dt = Math.min(0.04, dt);
      t += dt;
      setting = input.setting;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.boost = Math.max(0, p.boost - dt);
      sensor = Math.max(0, sensor - dt);
      sensorCooldown = Math.max(0, sensorCooldown - dt);
      if (input.secondary && p.cooldown === 0 && p.energy > 15) {
        p.boost = 1.3;
        p.cooldown = 4;
        p.energy -= 12;
        emit("boost", p.x, p.y, env.palette.accent);
      }
      if (variant === 4 && input.action && sensorCooldown === 0) {
        sensor = 2;
        sensorCooldown = 5;
        p.energy = Math.max(0, p.energy - 3);
      }
      const throttle = input.down ? -1 : input.up ? 1 : 0;
      const maxSpeed = 300 + level * 35 + (p.boost > 0 ? 130 : 0);
      p.speed +=
        ((throttle > 0 ? 155 : throttle < 0 ? -300 : -55) -
          (p.energy <= 0 ? 110 : 0)) *
        dt;
      p.speed = clamp(p.speed, 0, maxSpeed);
      const slick = variant === 1 && Math.sin(distanceRun / 270) > 0.15;
      friction = slick
        ? 0.27
        : clamp(0.65 + 0.33 * Math.sin(t * 0.42 + variant), 0.3, 1);
      let grip = friction;
      if (input.action && variant !== 4) {
        grip *= 1.8;
        p.speed = Math.max(0, p.speed - 25 * dt);
      }
      const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0),
        target = steer * (175 + p.speed * 0.35);
      requestedAcceleration = (target - p.vx) * gains[setting] * 3.3;
      const availableAcceleration = grip * 900;
      slip = Math.max(
        0,
        Math.abs(requestedAcceleration) - availableAcceleration,
      );
      p.vx +=
        clamp(
          requestedAcceleration,
          -availableAcceleration,
          availableAcceleration,
        ) * dt;
      // Tire saturation consumes energy and reduces longitudinal speed.
      p.speed = Math.max(0, p.speed - Math.min(45, slip * 0.035) * dt);
      p.energy = Math.max(
        0,
        p.energy -
          (0.06 * gains[setting] * gains[setting] + slip * 0.0008) * dt,
      );
      p.x += p.vx * dt;
      p.x = clamp(p.x, 35, w - 35);
      distanceRun += p.speed * dt;
      crossTrack = p.x - center(p.y);
      trackingQuality =
        clamp(1 - Math.abs(crossTrack) / (half(p.y) - 25), 0, 1) *
        clamp(1 - slip / 1800, 0, 1);
      instrument.publish({
        concept: "Feedback gain and traction limits",
        readout: `Cross-track error ${crossTrack.toFixed(0)} px; friction μ=${friction.toFixed(2)}; requested lateral acceleration ${requestedAcceleration.toFixed(0)} px/s²; saturation ${slip.toFixed(0)} px/s²`,
        settingLabel: `Steering gain ${gains[setting].toFixed(1)}`,
        status:
          slip > 250
            ? "danger"
            : Math.abs(crossTrack) > 100
              ? "warning"
              : "good",
        explanation:
          "Higher gain corrects faster but can request more force than the tires support. Saturation scrubs speed and battery; low gain responds slowly.",
        formula:
          "a_command = 3.3 K(v_target − v_x); |a_actual| ≤ μ × 900; response distance estimate = v/(3.3K)",
        signal: crossTrack,
        setting: gains[setting],
        outcome: trackingQuality * 100,
        outcomeLabel: "Tracking quality",
        unit: "%",
        display: [
          `Friction ${friction.toFixed(2)} · track error ${Math.round(crossTrack)} px`,
          `Tire saturation ${Math.round(slip)} px/s²`,
        ],
      });
      const offroad = Math.abs(p.x - center(p.y)) > half(p.y) - 25;
      if (offroad) {
        p.speed *= Math.exp(-1.7 * dt);
        if (p.invulnerable === 0) {
          env.damage?.(5);
          p.invulnerable = 0.8;
          emit("hit", p.x, p.y, env.palette.amber);
        }
      }
      p.energy = clamp(
        p.energy - (variant === 2 ? 1.1 + p.speed * 0.0018 : 0.14) * dt,
        0,
        100,
      );
      for (const o of objects) {
        if (o.hit) continue;
        const pos = project(o);
        if (
          Math.abs(pos.y - p.y) < 31 &&
          Math.abs(pos.x - p.x) < (o.type === "barrier" ? 38 : 37)
        ) {
          o.hit = true;
          if (o.type === "barrier") {
            if (p.invulnerable === 0) {
              env.damage?.(13);
              p.invulnerable = 1;
              p.speed *= 0.48;
              p.vx *= -0.4;
              emit("hit", p.x, p.y, env.palette.danger);
            }
          } else {
            p.energy = clamp(p.energy + (o.type === "charge" ? 25 : 4), 0, 100);
            passed++;
            award(
              o.type === "charge" ? 50 : 75,
              o.type === "charge" ? "Charge captured" : "Apex data",
            );
            emit("collect", pos.x, pos.y, env.palette.cyan);
          }
        }
      }
      if (distanceRun > progress + 250) {
        progress = distanceRun;
        award(
          Math.max(1, Math.round(30 * trackingQuality)),
          "Controlled distance",
        );
        instrument.evidence(t, {
          concept: "Feedback gain and traction limits",
          event: "Track segment completed",
          decision: `Gain ${gains[setting]} at friction ${friction.toFixed(2)}`,
          consequence: `Tracking error ${Math.abs(crossTrack).toFixed(0)} px; tire saturation ${slip.toFixed(0)} px/s²; ${Math.round(trackingQuality * 100)}% segment quality.`,
          quality: trackingQuality,
        });
      }
      generate();
      metric("Distance", `${Math.round(distanceRun)}/${goal} px`);
      metric("Speed", `${Math.round(p.speed)} px/s`);
      metric(
        variant === 1 ? "Traction" : "Battery",
        variant === 1
          ? slick
            ? "LOW GRIP"
            : "HIGH GRIP"
          : `${Math.round(p.energy)}%`,
      );
      if (distanceRun >= goal) {
        done = true;
        env.finish?.(true, "Finish line crossed");
      }
    }
    function observe() {
      return {
        family: "racer",
        variant,
        level,
        player: { ...p },
        engineering: engineeringState(),
        roadCenter: center(p.y),
        roadHalf: half(p.y),
        slick: variant === 1 && Math.sin(distanceRun / 270) > 0.15,
        objects: objects
          .filter((o) => !o.hit)
          .map((o) => ({ ...project(o), type: o.type }))
          .filter(
            (o) =>
              o.y > -20 &&
              o.y < h + 20 &&
              (variant !== 4 || sensor > 0 || o.y > 175),
          ),
        distance: distanceRun,
        sensor,
        sensorCooldown,
      };
    }
    function act(o) {
      const danger = o.objects
        .filter(
          (a) =>
            a.type === "barrier" &&
            a.y < o.player.y + 20 &&
            a.y > o.player.y - 190,
        )
        .sort((a, b) => b.y - a.y)[0];
      const charge = o.objects
        .filter(
          (a) =>
            a.type !== "barrier" && a.y < o.player.y && a.y > o.player.y - 200,
        )
        .sort((a, b) => b.y - a.y)[0];
      let target = o.roadCenter;
      if (danger && Math.abs(danger.x - o.player.x) < 80)
        target = danger.x + (o.player.x >= danger.x ? 115 : -115);
      else if (charge) target = charge.x;
      target = clamp(
        target,
        o.roadCenter - o.roadHalf + 50,
        o.roadCenter + o.roadHalf - 50,
      );
      const predicted = o.player.x + o.player.vx * 0.32,
        delta = target - predicted;
      return control({
        setting:
          o.engineering.friction < 0.6
            ? 0
            : Math.abs(o.engineering.crossTrack) > 85 &&
                o.engineering.friction > 0.82
              ? 2
              : 1,
        up: true,
        down:
          !!danger &&
          Math.abs(danger.x - o.player.x) < 50 &&
          danger.y > o.player.y - 85,
        left: delta < -14,
        right: delta > 14,
        action: o.slick || o.variant === 4,
        secondary: !danger && o.player.energy > 45,
      });
    }
    function draw(ctx) {
      const c = env.palette;
      background(ctx, c, w, h, t, distanceRun * 0.3, 1);
      ctx.fillStyle = c.surface;
      ctx.beginPath();
      for (let y = -20; y <= h + 20; y += 20) {
        const x = center(y) - half(y);
        if (y === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let y = h + 20; y >= -20; y -= 20)
        ctx.lineTo(center(y) + half(y), y);
      ctx.closePath();
      ctx.fill();
      for (const edge of [-1, 1]) {
        ctx.strokeStyle = c.cyan;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let y = 0; y <= h; y += 12) {
          const x = center(y) + half(y) * edge;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.save();
      ctx.strokeStyle = c.muted;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.setLineDash([24, 28]);
      ctx.lineDashOffset = -distanceRun * 0.88;
      for (const lane of [-0.33, 0.33]) {
        ctx.beginPath();
        for (let y = 0; y <= h; y += 15) {
          const x = center(y) + half(y) * lane;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      if (variant === 1 && Math.sin(distanceRun / 270) > 0.15) {
        panel(
          ctx,
          center(h / 2) - half(h / 2),
          0,
          half(h / 2) * 2,
          h,
          c.cyan,
          0.1,
        );
        text(ctx, "LOW-GRIP SURFACE", w / 2, 37, c.cyan, 12, "center");
      } else
        text(
          ctx,
          variant === 4 ? "SENSOR RALLY" : "FOLLOW THE LINE · AVOID BARRIERS",
          w / 2,
          37,
          c.muted,
          12,
          "center",
        );
      for (const o of objects) {
        if (o.hit) continue;
        const q = project(o);
        if (q.y < -30 || q.y > h + 40) continue;
        ctx.save();
        if (variant === 4 && sensor === 0)
          ctx.globalAlpha = q.y < 175 ? 0 : clamp((q.y - 150) / 120, 0.15, 1);
        if (o.type === "barrier") {
          ctx.fillStyle = c.danger;
          rounded(ctx, q.x - 26, q.y - 14, 52, 28, 5);
          ctx.fill();
          ctx.strokeStyle = c.bg;
          ctx.lineWidth = 4;
          for (let z = -18; z < 23; z += 15) {
            ctx.beginPath();
            ctx.moveTo(q.x + z, q.y - 9);
            ctx.lineTo(q.x + z + 10, q.y + 9);
            ctx.stroke();
          }
        } else {
          diamond(ctx, q.x, q.y, 24, o.type === "charge" ? c.accent : c.cyan);
          if (o.type === "charge")
            text(ctx, "+", q.x, q.y + 5, c.bg, 15, "center");
        }
        ctx.restore();
      }
      if (sensor > 0)
        ring(ctx, p.x, p.y, 170 + Math.sin(t * 5) * 12, c.cyan, 0.22);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(clamp(p.vx / 650, -0.32, 0.32));
      if (p.boost > 0) {
        ctx.fillStyle = c.cyan;
        glow(ctx, c.cyan, 18);
        ctx.beginPath();
        ctx.moveTo(-10, 24);
        ctx.lineTo(0, 57 + Math.sin(t * 35) * 12);
        ctx.lineTo(10, 24);
        ctx.fill();
      }
      if (p.invulnerable > 0 && Math.floor(t * 16) % 2) ctx.globalAlpha = 0.4;
      ctx.fillStyle = c.accent;
      glow(ctx, c.accent, 10);
      rounded(ctx, -19, -31, 38, 62, 10);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = c.bg;
      rounded(ctx, -13, -13, 26, 19, 5);
      ctx.fill();
      ctx.fillStyle = c.cyan;
      ctx.fillRect(-16, -28, 8, 4);
      ctx.fillRect(8, -28, 8, 4);
      ctx.fillStyle = c.muted;
      ctx.fillRect(-23, -19, 5, 16);
      ctx.fillRect(18, -19, 5, 16);
      ctx.fillRect(-23, 13, 5, 16);
      ctx.fillRect(18, 13, 5, 16);
      ctx.restore();
      panel(ctx, 25, h - 57, 160, 35, c.bg, 0.9);
      text(
        ctx,
        `E BOOST ${p.cooldown > 0 ? p.cooldown.toFixed(1) + "s" : "READY"}`,
        36,
        h - 35,
        c.accent,
        11,
      );
      instrument.draw(ctx, c, w);
    }
    return { update, draw, observe, act };
  }

  function drone(env) {
    const { w, h, level, variant, random, emit, award, metric } = setup(env);
    const instrument = engineeringChannel(env),
      modes = [
        { name: "Fast", hz: 30, alpha: 1, power: 1.5 },
        { name: "Balanced", hz: 15, alpha: 0.5, power: 0.8 },
        { name: "Filtered", hz: 6, alpha: 0.25, power: 0.35 },
      ];
    let setting = 1,
      noise = 3,
      sensorTick = 0,
      estimateX = 0,
      estimateY = 0,
      uncertainty = 3,
      latency = 0.0667;
    let options = modes.map((m) => ({ ...m, uncertainty: 3 }));
    const engineeringState = () => ({
      setting,
      noise,
      latency,
      uncertainty,
      estimateX,
      estimateY,
      options: options.map((m) => ({ ...m })),
    });
    let t = 0,
      delivered = 0,
      scanned = 0,
      target = 0,
      scan = 0,
      scanCooldown = 0,
      dwell = 0,
      done = false;
    const p = {
      x: 130,
      y: 180,
      vx: 0,
      vy: 0,
      r: 16,
      battery: 100,
      invulnerable: 0,
    };
    const pads = [
      { x: 765, y: 427, baseX: 765, width: 100 - level * 12 },
      { x: 205, y: 367, baseX: 205, width: 100 - level * 12 },
      { x: 620, y: 305, baseX: 620, width: 100 - level * 12 },
      { x: 340, y: 440, baseX: 340, width: 100 - level * 12 },
    ];
    const sensors = pads.map((pad, i) => ({
      x: pad.x,
      y: pad.y - 105,
      scanned: false,
      id: i,
    }));
    const goal = env.mission?.goal || 4 + level;
    let wind = 0;
    function hit(amount) {
      if (p.invulnerable > 0) return;
      p.invulnerable = 1.5;
      env.damage?.(amount);
      emit("hit", p.x, p.y, env.palette.danger);
    }
    function update(dt, raw) {
      if (done) return;
      const input = held(raw);
      dt = Math.min(0.04, dt);
      t += dt;
      setting = input.setting;
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      scan = Math.max(0, scan - dt);
      scanCooldown = Math.max(0, scanCooldown - dt);
      wind =
        (variant === 1
          ? Math.sin(t * 1.2) * 55 + Math.sin(t * 2.7) * 20
          : variant === 4
            ? Math.sin(t) * 18
            : 0) *
        (1 + level * 0.3);
      pads.forEach((pad, i) => {
        const frequency = 0.45 + level * 0.1;
        pad.x =
          pad.baseX + (variant === 4 ? Math.sin(t * frequency + i) * 90 : 0);
        pad.vx =
          variant === 4 ? Math.cos(t * frequency + i) * frequency * 90 : 0;
        sensors[i].x = pad.x;
      });
      // Deterministic measurement noise is passed through the actual sampled EMA.
      noise =
        [3, 12, 26][Math.floor(t / (7 - level)) % 3] +
        (variant === 1 ? Math.abs(wind) * 0.08 : 0);
      const sensorPad = pads[target % pads.length];
      options = modes.map((m) => {
        const lag = (1 - m.alpha) / (m.alpha * m.hz),
          sigma = noise * Math.sqrt(m.alpha / (2 - m.alpha));
        return {
          ...m,
          latency: lag,
          uncertainty: Math.hypot(
            sigma,
            Math.abs(p.vx - (sensorPad.vx || 0)) * lag,
          ),
        };
      });
      const mode = options[setting];
      latency = mode.latency;
      uncertainty = mode.uncertainty;
      sensorTick += dt;
      if (sensorTick >= 1 / mode.hz) {
        sensorTick %= 1 / mode.hz;
        estimateX +=
          mode.alpha * (p.vx + noise * Math.sin(t * 53.1) - estimateX);
        estimateY +=
          mode.alpha * (p.vy + noise * Math.cos(t * 47.7) - estimateY);
      }
      instrument.publish({
        concept: "Sensor filtering, noise and latency",
        readout: `Noise amplitude n=${noise.toFixed(1)} px/s; filter lag ${latency.toFixed(2)} s; modeled landing uncertainty ${uncertainty.toFixed(1)} px; permitted ${(sensorPad.width / 5).toFixed(1)} px`,
        settingLabel: `${mode.name}: ${mode.hz} Hz, α=${mode.alpha}`,
        status: uncertainty < sensorPad.width / 5 ? "good" : "danger",
        explanation:
          "The sampled velocity estimate drives the precision brake. Filtering reduces noise but delays tracking. The noise/lag model estimates landing uncertainty; it does not measure position error.",
        formula:
          "estimate ← α × measurement + (1−α) × estimate; lag=(1−α)/(αf_s); u_model=√[(n×τ)²α/(2−α)+(v_relative×lag)²], τ=1 s; a noise/lag approximation",
        signal: noise,
        setting: mode.alpha,
        outcome: uncertainty,
        outcomeLabel: "Modeled landing uncertainty",
        unit: "px",
        display: [
          `Noise n ${noise.toFixed(1)} px/s · lag ${latency.toFixed(2)} s`,
          `Est. uncertainty ${uncertainty.toFixed(1)} / ${(sensorPad.width / 5).toFixed(1)} px`,
        ],
      });
      if (input.action && scanCooldown === 0) {
        scan = 0.65;
        scanCooldown = 0.8;
        emit("boost", p.x, p.y, env.palette.cyan);
        for (const s of sensors)
          if (!s.scanned && distance(s, p) < 150) {
            s.scanned = true;
            scanned++;
            award(45, "Beacon scanned");
            emit("collect", s.x, s.y, env.palette.cyan);
          }
      }
      const power = p.battery > 0 ? 1 : 0.3,
        ax =
          ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 200 * power + wind,
        ay = 45 - (input.up ? 245 * power : 0) + (input.down ? 120 : 0);
      p.vx += ax * dt;
      p.vy += ay * dt;
      if (input.secondary) {
        p.vx -= estimateX * 4.8 * dt;
        p.vy -= estimateY * 3.8 * dt;
      } else {
        p.vx *= Math.exp(-0.45 * dt);
        p.vy *= Math.exp(-0.18 * dt);
      }
      p.vx = clamp(p.vx, -230, 230);
      p.vy = clamp(p.vy, -190, 190);
      const oldBottom = p.y + p.r;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 24 || p.x > w - 24) {
        p.x = clamp(p.x, 24, w - 24);
        p.vx *= -0.45;
        hit(5);
      }
      if (p.y < 38) {
        p.y = 38;
        p.vy = Math.max(20, Math.abs(p.vy) * 0.25);
      }
      if (p.y > h - 28) {
        p.y = h - 28;
        p.vy = -65;
        hit(9);
      }
      const pad = pads[target % pads.length],
        horizontal = Math.abs(p.x - pad.x) < pad.width / 2 - p.r * 0.5,
        nearFloor = oldBottom <= pad.y + 7 && p.y + p.r >= pad.y && p.vy >= 0;
      if (horizontal && nearFloor) {
        const safe =
          Math.abs(p.vx - (pad.vx || 0)) < 60 - level * 10 &&
          p.vy < 70 - level * 10;
        if (safe) {
          p.y = pad.y - p.r;
          p.vy = 0;
          p.vx += (pad.vx - p.vx) * 0.3;
          dwell += dt;
          if (uncertainty >= pad.width / 5) {
            dwell = 0;
            instrument.evidence(t, {
              concept: "Sensor filtering, noise and latency",
              event: "Landing held",
              decision: `${mode.name} at noise ${noise.toFixed(1)} and relative velocity ${(p.vx - (pad.vx || 0)).toFixed(1)} px/s`,
              consequence: `Modeled uncertainty ${uncertainty.toFixed(1)} px exceeded the ${(pad.width / 5).toFixed(1)} px landing limit; delivery was not credited.`,
              quality: 0,
            });
          } else if (variant === 2 && !sensors[target % pads.length].scanned) {
            dwell = 0;
          } else if (dwell > 0.3) {
            delivered++;
            const quality = clamp(1 - uncertainty / (pad.width * 0.5), 0.2, 1);
            award(
              Math.round(180 * quality),
              "Landing within modeled uncertainty",
            );
            instrument.evidence(t, {
              concept: "Sensor filtering, noise and latency",
              event: "Precision landing",
              decision: `${mode.name} filter at ${noise.toFixed(1)} noise`,
              consequence: `Modeled landing uncertainty ${uncertainty.toFixed(1)} px stayed below the ${(pad.width / 5).toFixed(1)} px limit; delivery credited.`,
              quality,
            });
            emit("collect", pad.x, pad.y, env.palette.accent);
            p.battery = clamp(p.battery + (variant === 3 ? 38 : 20), 0, 100);
            target++;
            dwell = 0;
            p.vy = -90;
            sensors[target % pads.length].scanned = false;
          }
        } else {
          hit(12);
          p.vy = -90;
          p.vx *= 0.45;
          dwell = 0;
        }
      } else dwell = 0;
      p.battery = clamp(
        p.battery -
          ((variant === 3 ? 2 : 0.4) + mode.power) *
            (input.up || input.left || input.right ? 1.4 : 1) *
            dt,
        0,
        100,
      );
      metric("Deliveries", `${delivered}/${goal}`);
      metric("Battery", `${Math.round(p.battery)}%`);
      metric(
        variant === 2
          ? "Survey"
          : variant === 4
            ? "Relative X"
            : "Vertical speed",
        variant === 2
          ? `${scanned} scanned`
          : variant === 4
            ? `${Math.round(p.vx - (pad.vx || 0))} px/s`
            : `${Math.round(p.vy)} px/s`,
      );
      if (delivered >= goal) {
        done = true;
        env.finish?.(true, "Delivery circuit complete");
      }
    }
    function observe() {
      const pad = pads[target % pads.length],
        s = sensors[target % pads.length];
      return {
        family: "drone",
        variant,
        level,
        player: { ...p },
        engineering: engineeringState(),
        target: { ...pad },
        beacon: { ...s },
        wind,
        scanCooldown,
        delivered,
      };
    }
    function act(o) {
      const needsScan = o.variant === 2 && !o.beacon.scanned,
        dx = o.target.x - o.player.x,
        cruise = Math.abs(dx) > 110 || o.player.y + o.player.r > o.target.y + 4,
        aim = needsScan
          ? o.beacon
          : { x: o.target.x, y: o.target.y - o.player.r + (cruise ? -75 : 8) };
      const dy = aim.y - o.player.y,
        desiredX = clamp(dx * 0.85 + (o.target.vx || 0), -150, 150),
        desiredY = clamp(dy * 0.95, -95, 55);
      return control({
        setting: o.engineering.options.reduce(
          (best, m, i, all) =>
            m.uncertainty + m.power * 0.8 <
            all[best].uncertainty + all[best].power * 0.8
              ? i
              : best,
          0,
        ),
        left: o.player.vx > desiredX + 10,
        right: o.player.vx < desiredX - 10,
        up: o.player.vy > desiredY + 8,
        down: o.player.vy < desiredY - 20,
        secondary: Math.abs(dx) < 110 && Math.abs(dy) < 120,
        action: needsScan && distance(o.player, o.beacon) < 145,
      });
    }
    function draw(ctx) {
      const c = env.palette;
      background(ctx, c, w, h, t, 0, 1);
      text(
        ctx,
        [
          "LAND SLOWLY ON THE LIT PAD",
          "COUNTER THE CROSSWIND",
          "SCAN THE BEACON · THEN LAND",
          "MANAGE THRUST AND BATTERY",
          "MATCH THE MOVING LANDING PAD",
        ][variant],
        30,
        36,
        c.muted,
        12,
      );
      ctx.fillStyle = c.surface;
      ctx.fillRect(0, h - 13, w, 13);
      ctx.strokeStyle = c.purple;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h - 14);
      ctx.lineTo(w, h - 14);
      ctx.stroke();
      pads.forEach((pad, i) => {
        const current = i === target % pads.length;
        ctx.save();
        ctx.strokeStyle = current ? c.accent : c.muted;
        ctx.fillStyle = c.surface;
        rounded(ctx, pad.x - pad.width / 2, pad.y, pad.width, 14, 5);
        ctx.fill();
        ctx.lineWidth = current ? 3 : 1;
        ctx.stroke();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(pad.x - pad.width * 0.3, pad.y + 14);
        ctx.lineTo(pad.x - pad.width * 0.3, h);
        ctx.moveTo(pad.x + pad.width * 0.3, pad.y + 14);
        ctx.lineTo(pad.x + pad.width * 0.3, h);
        ctx.stroke();
        ctx.restore();
        if (current) {
          ring(ctx, pad.x, pad.y - 8, 35 + Math.sin(t * 3) * 3, c.accent, 0.22);
          text(ctx, `PAD ${i + 1}`, pad.x, pad.y + 35, c.accent, 12, "center");
        }
      });
      if (variant === 2)
        for (const s of sensors) {
          diamond(ctx, s.x, s.y, 17, s.scanned ? c.accent : c.cyan, !s.scanned);
          ring(ctx, s.x, s.y, 28, s.scanned ? c.accent : c.cyan, 0.2);
        }
      if (scan > 0)
        ring(
          ctx,
          p.x,
          p.y,
          (1 - scan / 0.65) * 150,
          c.cyan,
          (scan / 0.65) * 0.5,
        );
      if (variant === 1 || variant === 4) {
        arrow(ctx, w - 95, 72, wind >= 0 ? 0 : Math.PI, c.amber, 18);
        text(
          ctx,
          `WIND ACCEL ${Math.abs(Math.round(wind))} px/s²`,
          w - 32,
          109,
          c.amber,
          11,
          "right",
        );
      }
      const pad = pads[target % pads.length];
      ctx.save();
      ctx.strokeStyle = c.accent;
      ctx.globalAlpha = 0.1;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(pad.x, pad.y - p.r);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(clamp(p.vx / 500, -0.27, 0.27));
      if (p.invulnerable > 0 && Math.floor(t * 14) % 2) ctx.globalAlpha = 0.4;
      ctx.strokeStyle = c.cyan;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-31, 0);
      ctx.lineTo(31, 0);
      ctx.stroke();
      for (const x of [-32, 32]) {
        ring(ctx, x, -3, 13, c.cyan, 0.7);
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 15, -3);
        ctx.lineTo(x + 15, -3);
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = c.cyan;
        ctx.beginPath();
        ctx.ellipse(x, -3, 20, 6, Math.sin(t * 65), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      glow(ctx, c.accent, 12);
      ctx.fillStyle = c.accent;
      rounded(ctx, -17, -10, 34, 21, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = c.bg;
      ctx.fillRect(-8, -6, 16, 6);
      ctx.fillStyle = c.amber;
      ctx.fillRect(-8, 12, 16, 11);
      ctx.restore();
      instrument.draw(ctx, c, w);
    }
    return { update, draw, observe, act };
  }

  function arena(env) {
    const { w, h, level, variant, random, emit, award, metric } = setup(env);
    const instrument = engineeringChannel(env),
      thresholds = [0.35, 0.55, 0.75];
    let setting = 1,
      bias = 0,
      falseNegatives = 0,
      truePositives = 0,
      blockedShots = 0,
      lastConfidence = 0.7;
    const engineeringState = () => ({
      setting,
      thresholds: [...thresholds],
      bias,
      threshold: thresholds[setting],
      falsePositives: friendlyHits,
      falseNegatives,
      truePositives,
      blockedShots,
      confidence: lastConfidence,
    });
    let t = 0,
      spawn = 0,
      serial = 0,
      kills = 0,
      friendlyHits = 0,
      done = false,
      adaptation = 0,
      lastFireX = 0,
      lastFireY = 0;
    const p = {
      x: w / 2,
      y: h * 0.63,
      vx: 0,
      vy: 0,
      r: 16,
      aim: -Math.PI / 2,
      cooldown: 0,
      secondaryCooldown: 0,
      shield: 0,
      polarity: 0,
      heat: 0,
      overheated: false,
      invulnerable: 0,
    };
    const enemies = [],
      bullets = [],
      core = { x: w / 2, y: h / 2, health: 100 };
    const goal = env.mission?.goal || 18 + level * 6;
    function create() {
      const side = Math.floor(random() * 4),
        friendly = serial % 6 === 4;
      let x = side === 0 ? 35 : side === 1 ? w - 35 : 50 + random() * (w - 100),
        y = side === 2 ? 35 : side === 3 ? h - 35 : 55 + random() * (h - 110);
      enemies.push({
        id: serial++,
        x,
        y,
        vx: 0,
        vy: 0,
        r: friendly ? 15 : 17 + level,
        shape: friendly ? "circle" : "triangle",
        hp: 2 + level,
        signature: friendly ? 0.12 + random() * 0.16 : 0.72 + random() * 0.16,
        confidence: friendly ? 0.18 : 0.8,
        shield: variant === 1 ? Math.floor(random() * 2) : -1,
        cooldown: 1.8 + random() * 1.8,
        phase: random() * 6.28,
      });
    }
    create();
    create();
    function hurt(amount, x = p.x, y = p.y) {
      if (p.invulnerable > 0) return;
      p.invulnerable = 0.55;
      env.damage?.(p.shield > 0 ? Math.ceil(amount * 0.2) : amount);
      emit("hit", x, y, env.palette.danger);
    }
    function update(dt, raw) {
      if (done) return;
      const input = held(raw);
      dt = Math.min(0.04, dt);
      t += dt;
      setting = input.setting;
      bias = [-0.2, 0, 0.2][
        Math.floor(t / (variant === 2 ? 5 : 8 - level)) % 3
      ];
      for (const e of enemies) {
        // This is a disclosed rule score, not a trained model or calibrated probability.
        const d = Math.max(1, distance(e, p));
        const closing = clamp(
          ((p.x - e.x) * e.vx + (p.y - e.y) * e.vy) / d / 90,
          0,
          1,
        );
        e.confidence = clamp(0.7 * e.signature + 0.3 * closing + bias, 0, 1);
      }
      instrument.publish({
        concept: "Decision thresholds and classification errors",
        readout: `Sensor bias ${bias >= 0 ? "+" : ""}${bias.toFixed(2)}; threshold ${thresholds[setting]}; false positives ${friendlyHits}; false negatives ${falseNegatives}; blocked shots ${blockedShots}`,
        settingLabel: `Threat threshold ${thresholds[setting].toFixed(2)}`,
        status:
          Math.abs(thresholds[setting] - (0.55 + bias)) < 0.11
            ? "good"
            : "warning",
        explanation:
          "Only tracks above the threshold pass the fire interlock. A low threshold admits friendlies; a high threshold can block approaching threats. The public rule score is not a trained probability.",
        formula:
          "score = clamp(0.7×emission signature + 0.3×normalized closing speed + sensor bias,0,1); fire when score ≥ threshold; IoU = TP/(TP+FP+FN)",
        signal: bias,
        setting: thresholds[setting],
        outcome:
          (truePositives /
            Math.max(1, truePositives + friendlyHits + falseNegatives)) *
          100,
        outcomeLabel: "Detection overlap (IoU)",
        unit: "%",
        display: [
          `Sensor bias ${bias >= 0 ? "+" : ""}${bias.toFixed(2)} · lock ≥ ${thresholds[setting]}`,
          `False + ${friendlyHits} · missed threats ${falseNegatives}`,
        ],
      });
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.secondaryCooldown = Math.max(0, p.secondaryCooldown - dt);
      p.shield = Math.max(0, p.shield - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.heat = Math.max(0, p.heat - dt * (variant === 4 ? 0.21 : 0.65));
      if (p.heat < 0.42) p.overheated = false;
      if (input.secondary && p.secondaryCooldown === 0) {
        if (variant === 1) {
          p.polarity = 1 - p.polarity;
          p.secondaryCooldown = 0.3;
        } else if (variant === 4) {
          p.heat = Math.max(0, p.heat - 0.7);
          p.overheated = false;
          p.secondaryCooldown = 3;
        } else {
          p.shield = 1.4;
          p.secondaryCooldown = 4;
        }
        emit("boost", p.x, p.y, env.palette.cyan);
      }
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0),
        my = (input.down ? 1 : 0) - (input.up ? 1 : 0),
        length = Math.max(1, Math.hypot(mx, my));
      p.vx += ((mx / length) * 240 - p.vx) * Math.min(1, dt * 10);
      p.vy += ((my / length) * 240 - p.vy) * Math.min(1, dt * 10);
      p.x = clamp(p.x + p.vx * dt, 28, w - 28);
      p.y = clamp(p.y + p.vy * dt, 45, h - 28);
      core.x = w / 2 + Math.cos(t * 0.3) * 95;
      core.y = h / 2 + Math.sin(t * 0.3) * 60;
      const hostile = enemies
        .filter((e) => e.confidence >= thresholds[setting])
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      const shooting = input.action || input.pointer.down;
      if (
        input.pointer.down &&
        Number.isFinite(input.pointer.x) &&
        Number.isFinite(input.pointer.y)
      )
        p.aim = Math.atan2(input.pointer.y - p.y, input.pointer.x - p.x);
      else if (hostile) p.aim = Math.atan2(hostile.y - p.y, hostile.x - p.x);
      const aimed = enemies
        .filter(
          (e) =>
            Math.abs(
              Math.atan2(
                Math.sin(Math.atan2(e.y - p.y, e.x - p.x) - p.aim),
                Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - p.aim),
              ),
            ) < 0.24,
        )
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      const fireAllowed = !!aimed && aimed.confidence >= thresholds[setting];
      if (aimed) lastConfidence = aimed.confidence;
      if (shooting && p.cooldown === 0 && !fireAllowed) {
        blockedShots++;
        p.cooldown = 0.15;
      }
      if (shooting && fireAllowed && p.cooldown === 0 && !p.overheated) {
        bullets.push({
          x: p.x + Math.cos(p.aim) * 20,
          y: p.y + Math.sin(p.aim) * 20,
          vx: Math.cos(p.aim) * 580,
          vy: Math.sin(p.aim) * 580,
          team: "player",
          life: 1.8,
          polarity: p.polarity,
        });
        p.cooldown = 0.15;
        p.heat += variant === 4 ? 0.15 : 0.035;
        if (p.heat >= 1) p.overheated = true;
        if (Math.hypot(p.x - lastFireX, p.y - lastFireY) < 45)
          adaptation = clamp(adaptation + 0.04, 0, 1);
        else adaptation = Math.max(0, adaptation - 0.1);
        lastFireX = p.x;
        lastFireY = p.y;
      }
      spawn -= dt;
      if (spawn <= 0 && enemies.length < 17) {
        create();
        spawn = Math.max(0.5, 1.3 - level * 0.22 - (variant === 4 ? 0.22 : 0));
      }
      for (const e of enemies) {
        const target =
          e.shape === "circle"
            ? {
                x: w / 2 + Math.cos(t + e.phase) * 350,
                y: h / 2 + Math.sin(t * 0.7 + e.phase) * 180,
              }
            : variant === 3
              ? core
              : p;
        let dx = target.x - e.x,
          dy = target.y - e.y,
          d = Math.max(1, Math.hypot(dx, dy));
        const speed = e.shape === "circle" ? 65 : 55 + level * 16;
        let sx = 0,
          sy = 0;
        if (variant === 2 && e.shape !== "circle") {
          sx = (-dy / d) * Math.sin(t * 3 + e.phase) * adaptation * 110;
          sy = (dx / d) * Math.sin(t * 3 + e.phase) * adaptation * 110;
        }
        e.vx = (dx / d) * speed + sx;
        e.vy = (dy / d) * speed + sy;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.cooldown -= dt;
        if (e.shape !== "circle" && e.cooldown <= 0) {
          const angle = Math.atan2(target.y - e.y, target.x - e.x);
          bullets.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * (155 + level * 25),
            vy: Math.sin(angle) * (155 + level * 25),
            team: "enemy",
            life: 4,
          });
          e.cooldown = 2.7 - level * 0.4;
        }
        if (
          e.shape !== "circle" &&
          distance(e, target) < e.r + (variant === 3 ? 26 : p.r)
        ) {
          e.hp = 0;
          if (e.confidence < thresholds[setting]) {
            falseNegatives++;
            instrument.evidence(t, {
              concept: "Decision thresholds and classification errors",
              event: "False negative",
              decision: `Threshold ${thresholds[setting]} rejected threat score ${e.confidence.toFixed(2)}`,
              consequence:
                "The unclassified threat reached the defended target and caused damage.",
              quality: 0,
            });
          }
          if (variant === 3) {
            core.health -= 8;
            env.damage?.(5);
            emit("hit", core.x, core.y, env.palette.danger);
          } else hurt(12);
        }
      }
      for (const b of bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.team === "player") {
          for (const e of enemies)
            if (e.hp > 0 && distance(b, e) < e.r + 5) {
              b.life = 0;
              if (e.shape === "circle") {
                e.hp = 0;
                friendlyHits++;
                hurt(variant === 3 ? 10 : 7, e.x, e.y);
                instrument.evidence(t, {
                  concept: "Decision thresholds and classification errors",
                  event: "False positive",
                  decision: `Threshold ${thresholds[setting]} admitted friendly score ${e.confidence.toFixed(2)}`,
                  consequence:
                    "A friendly track was intercepted; hull integrity was penalized.",
                  quality: 0,
                });
              } else if (e.shield < 0 || e.shield === b.polarity) {
                e.hp--;
                emit("hit", e.x, e.y, env.palette.cyan);
                if (e.hp <= 0) {
                  kills++;
                  truePositives++;
                  award(85, "Threat correctly classified");
                  instrument.evidence(t, {
                    concept: "Decision thresholds and classification errors",
                    event: "True positive",
                    decision: `Threshold ${thresholds[setting]} admitted threat score ${e.confidence.toFixed(2)}`,
                    consequence:
                      "A hostile track was correctly admitted and intercepted.",
                    quality: 1,
                  });
                  emit("collect", e.x, e.y, env.palette.accent);
                }
              } else emit("hit", e.x, e.y, env.palette.amber);
              break;
            }
        } else if (variant === 3 && distance(b, core) < 27) {
          b.life = 0;
          core.health -= 3;
          env.damage?.(2);
        } else if (distance(b, p) < p.r + 5) {
          b.life = 0;
          hurt(7);
        }
      }
      for (let i = bullets.length - 1; i >= 0; i--)
        if (
          bullets[i].life <= 0 ||
          bullets[i].x < -50 ||
          bullets[i].x > w + 50 ||
          bullets[i].y < -50 ||
          bullets[i].y > h + 50
        )
          bullets.splice(i, 1);
      for (let i = enemies.length - 1; i >= 0; i--)
        if (enemies[i].hp <= 0) enemies.splice(i, 1);
      metric("Intercepts", `${kills}/${goal}`);
      metric(
        variant === 1 ? "Weapon" : variant === 4 ? "Heat" : "Friendly hits",
        variant === 1
          ? p.polarity
            ? "AMBER"
            : "CYAN"
          : variant === 4
            ? `${Math.round(p.heat * 100)}%`
            : friendlyHits,
      );
      metric(
        variant === 3
          ? "Core"
          : variant === 2
            ? "Enemy adaptation"
            : variant === 1
              ? "Switch"
              : variant === 4
                ? "Vent"
                : "Shield",
        variant === 3
          ? `${Math.max(0, core.health)}%`
          : variant === 2
            ? `${Math.round(adaptation * 100)}%`
            : p.shield > 0
              ? "ACTIVE"
              : p.secondaryCooldown > 0
                ? `${p.secondaryCooldown.toFixed(1)}s`
                : "READY",
      );
      if (kills >= goal) {
        done = true;
        env.finish?.(true, "Sector defended");
      } else if (core.health <= 0) {
        done = true;
        env.finish?.(false, "Escort core lost");
      }
    }
    function observe() {
      return {
        family: "arena",
        variant,
        level,
        player: { ...p },
        engineering: engineeringState(),
        enemies: enemies.map((e) => ({
          id: e.id,
          x: e.x,
          y: e.y,
          vx: e.vx,
          vy: e.vy,
          shape: e.shape,
          shield: e.shield,
          signature: e.signature,
          confidence: e.confidence,
        })),
        bullets: bullets
          .filter((b) => b.team === "enemy")
          .map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
        core: { ...core },
        adaptation,
      };
    }
    function act(o) {
      const setting = o.engineering.thresholds.reduce(
        (best, value, i, all) =>
          Math.abs(value - (0.55 + o.engineering.bias)) <
          Math.abs(all[best] - (0.55 + o.engineering.bias))
            ? i
            : best,
        0,
      );
      const targets = o.enemies
        .filter((e) => e.confidence >= o.engineering.thresholds[setting])
        .sort((a, b) => distance(a, o.player) - distance(b, o.player));
      const enemy = targets[0];
      let dx = (480 - o.player.x) * 0.15,
        dy = (270 - o.player.y) * 0.15;
      if (enemy && distance(enemy, o.player) < 190) {
        dx += (o.player.x - enemy.x) * 2;
        dy += (o.player.y - enemy.y) * 2;
      }
      if (enemy) {
        dx += -(enemy.y - o.player.y) * 0.22;
        dy += (enemy.x - o.player.x) * 0.22;
      }
      const nearBullet = o.bullets.find((b) => distance(b, o.player) < 90);
      if (nearBullet) {
        dx += (o.player.x - nearBullet.x) * 3;
        dy += (o.player.y - nearBullet.y) * 3;
      }
      return control({
        setting,
        left: dx < -15,
        right: dx > 15,
        up: dy < -15,
        down: dy > 15,
        action: !!enemy,
        secondary:
          o.variant === 1
            ? !!enemy && enemy.shield !== o.player.polarity
            : o.variant === 4
              ? o.player.heat > 0.68
              : !!nearBullet || (!!enemy && distance(enemy, o.player) < 110),
        pointer: enemy
          ? {
              x: enemy.x + enemy.vx * 0.15,
              y: enemy.y + enemy.vy * 0.15,
              down: true,
            }
          : { x: o.player.x, y: o.player.y, down: false },
      });
    }
    function draw(ctx) {
      const c = env.palette;
      background(ctx, c, w, h, t, 0, 1);
      text(
        ctx,
        [
          "TRIANGLES = HOSTILE · CIRCLES = FRIENDLY",
          "MATCH WEAPON COLOR TO SHIELD · E TO SWITCH",
          "KEEP MOVING · THE SWARM ADAPTS",
          "PROTECT THE MOVING CORE",
          "HEAT LIMIT · E TO VENT",
        ][variant],
        30,
        32,
        c.muted,
        12,
      );
      ctx.save();
      ctx.strokeStyle = c.cyan;
      ctx.globalAlpha = 0.2;
      rounded(ctx, 18, 44, w - 36, h - 62, 22);
      ctx.stroke();
      ctx.restore();
      if (variant === 3) {
        ring(ctx, core.x, core.y, 37, c.accent, 0.35);
        diamond(ctx, core.x, core.y, 34, c.accent);
        text(
          ctx,
          `${Math.max(0, core.health)}%`,
          core.x,
          core.y + 54,
          c.accent,
          11,
          "center",
        );
      }
      for (const e of enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        const color = e.shape === "circle" ? c.cyan : c.danger;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        glow(ctx, color, 9);
        ctx.lineWidth = 2;
        if (e.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, e.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillRect(-6, -2, 12, 4);
          ctx.fillRect(-2, -6, 4, 12);
        } else {
          ctx.rotate(Math.atan2(e.vy, e.vx));
          ctx.beginPath();
          ctx.moveTo(e.r + 4, 0);
          ctx.lineTo(-e.r, -e.r * 0.8);
          ctx.lineTo(-e.r * 0.55, 0);
          ctx.lineTo(-e.r, e.r * 0.8);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        if (e.shield >= 0)
          ring(ctx, e.x, e.y, e.r + 8, e.shield ? c.amber : c.cyan, 0.8);
      }
      for (const b of bullets) {
        ctx.strokeStyle =
          b.team === "enemy" ? c.danger : b.polarity ? c.amber : c.cyan;
        ctx.lineWidth = b.team === "enemy" ? 3 : 4;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
        ctx.stroke();
      }
      if (p.shield > 0)
        ring(ctx, p.x, p.y, 33 + Math.sin(t * 9) * 2, c.cyan, 0.6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.aim);
      if (p.invulnerable > 0 && Math.floor(t * 18) % 2) ctx.globalAlpha = 0.4;
      glow(ctx, c.accent, 13);
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-13, -16);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-13, 16);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (variant === 4) {
        panel(ctx, p.x - 24, p.y + 28, 48, 5, c.muted, 0.3);
        ctx.fillStyle = p.overheated ? c.danger : c.amber;
        ctx.fillRect(p.x - 24, p.y + 28, 48 * clamp(p.heat, 0, 1), 5);
      }
      if (variant === 1)
        ring(ctx, p.x, p.y, 26, p.polarity ? c.amber : c.cyan, 0.7);
      for (const e of enemies)
        text(
          ctx,
          e.confidence.toFixed(2),
          e.x,
          e.y - e.r - 9,
          e.confidence >= thresholds[setting] ? c.accent : c.muted,
          11,
          "center",
        );
      instrument.draw(ctx, c, w);
    }
    return { update, draw, observe, act };
  }

  return Object.freeze({ runner, grapple, racer, drone, arena });
});
