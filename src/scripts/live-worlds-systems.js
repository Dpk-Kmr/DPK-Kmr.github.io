/* Continuous systems simulations. Controllers consume only public observations. */
(function (root, factory) {
  const worlds = factory();
  if (typeof module === "object" && module.exports) module.exports = worlds;
  else Object.assign((root.AtrikshaWorlds ||= {}), worlds);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const nearest = (a, rows) =>
    rows.reduce(
      (best, row) =>
        !best || distance(a, row) < distance(a, best) ? row : best,
      null,
    );
  const move = (a, target, dead = 8) =>
    target
      ? {
          left: a.x > target.x + dead,
          right: a.x < target.x - dead,
          up: a.y > target.y + dead,
          down: a.y < target.y - dead,
        }
      : {};
  const copy = (rows) => rows.map((row) => ({ ...row }));
  function setup(env) {
    const e = { w: 960, h: 540, level: 0, ...env };
    e.level = clamp(Number(e.level) || 0, 0, 2);
    e.variant = clamp(Number(e.mission?.variant) || 0, 0, 4);
    e.random ||= Math.random;
    for (const key of [
      "emit",
      "award",
      "damage",
      "metric",
      "finish",
      "engineering",
      "evidence",
    ])
      e[key] ||= () => {};
    const p = () =>
      e.palette || {
        bg: "#11151a",
        surface: "#1a2129",
        text: "#f2f5f7",
        muted: "#a7b1bc",
        accent: "#c9ee76",
        cyan: "#56cee8",
        amber: "#edbd68",
        purple: "#b5a3ff",
        danger: "#ed7381",
      };
    let done = false,
      latest = null,
      lastEvidence = -Infinity;
    return {
      report(data) {
        latest = { ...data };
        e.engineering({ ...latest });
      },
      reading() {
        return latest ? { ...latest } : null;
      },
      record(data, time) {
        if (time - lastEvidence < 2) return;
        lastEvidence = time;
        e.evidence({ ...data, quality: clamp(data.quality ?? 0.5, 0, 1) });
      },
      instrument(ctx, colors) {
        if (latest)
          text(
            ctx,
            latest.readout,
            28,
            57,
            latest.status === "danger"
              ? colors.danger
              : latest.status === "warning"
                ? colors.amber
                : colors.cyan,
            11,
          );
      },
      e,
      p,
      finish(won, reason) {
        if (!done) {
          done = true;
          e.finish(won, reason);
        }
      },
      ended: () => done,
    };
  }
  function backdrop(ctx, e, p, caption) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, e.w, e.h);
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = p.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < e.w; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, e.h);
    }
    for (let y = 0; y < e.h; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(e.w, y);
    }
    ctx.stroke();
    ctx.restore();
    text(ctx, caption, 28, 34, p.muted, 12);
  }
  function text(ctx, value, x, y, color, size = 12, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${size}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), x, y);
  }
  function circle(ctx, x, y, r, color, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function agent(ctx, a, p, t, color = p.accent) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    circle(ctx, 0, 0, 12, p.surface, color);
    ctx.rotate(t * 0.8);
    ctx.strokeRect(-17, -17, 34, 34);
    ctx.rotate(-t * 0.8);
    circle(ctx, 0, 0, 4, color);
    ctx.restore();
  }
  function steer(a, input, dt, speed, e, pointer = false) {
    let x = Number(!!input.right) - Number(!!input.left),
      y = Number(!!input.down) - Number(!!input.up);
    if (
      pointer &&
      input.pointer?.down &&
      Math.hypot(input.pointer.x - a.x, input.pointer.y - a.y) > 10
    ) {
      x = input.pointer.x - a.x;
      y = input.pointer.y - a.y;
    }
    const n = Math.hypot(x, y);
    if (n) {
      a.x = clamp(a.x + (x / n) * speed * dt, 25, e.w - 25);
      a.y = clamp(a.y + (y / n) * speed * dt, 65, e.h - 25);
    }
  }

  const settingFrom = (input, current) =>
    Number.isInteger(input.setting) ? clamp(input.setting, 0, 2) : current;

  function factory(env) {
    const { e, p, finish, ended, report, reading, record, instrument } =
        setup(env),
      v = e.variant,
      l = e.level;
    const cols = 8,
      rows = 4,
      sx = 120,
      sy = 158,
      dx = 98,
      dy = 80;
    const belts = Array.from({ length: cols * rows }, (_, id) => ({
      id,
      c: id % cols,
      r: Math.floor(id / cols),
      x: sx + (id % cols) * dx,
      y: sy + Math.floor(id / cols) * dy,
      dir: 0,
    }));
    // The first line runs immediately; damaged parallel lines invite intervention.
    belts[10].dir = 1;
    belts[20].dir = 3;
    if (l > 0) belts[25].dir = 2;
    const machines = [];
    for (let r = 0; r < rows; r++)
      for (const c of v === 1 ? [3, 5] : [3])
        machines.push({
          c,
          r,
          x: sx + c * dx,
          y: sy + r * dy,
          heat: 15 + e.random() * 12,
          jammed: false,
        });
    const player = { x: sx + 2 * dx, y: 95 };
    let cargo = [],
      t = 0,
      spawn = 0.2,
      cool = 0,
      delivered = 0,
      lost = 0,
      serial = 0,
      setting = 1;
    const profiles = [
      { name: "Conservative", feed: 0.68, speed: 0.85, heat: 0.68 },
      { name: "Balanced", feed: 1, speed: 1, heat: 1 },
      { name: "Surge", feed: 1.48, speed: 1.18, heat: 1.8 },
    ];
    const target = (v === 1 ? 13 : v === 2 ? 12 : 18) + l * 4;
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    function observation() {
      return {
        family: "factory",
        variant: v,
        level: l,
        time: t,
        setting,
        engineering: reading(),
        player: { ...player },
        belts: copy(belts),
        machines: copy(machines),
        cargo: cargo.map((a) => ({
          x: a.x,
          y: a.y,
          c: a.c,
          r: a.r,
          goal: a.goal,
          stage: a.stages.length,
          waiting: a.wait,
          integrity: a.hp,
        })),
        delivered,
        target,
        lost,
      };
    }
    function act(o) {
      const peak = Math.max(...o.machines.map((m) => m.heat));
      const setting =
        peak > 70 || o.cargo.length > 22
          ? 0
          : peak < 40 && o.cargo.length < 14
            ? 2
            : 1;
      const hot = o.machines
        .filter((m) => m.jammed || m.heat > 64)
        .sort(
          (a, b) =>
            (b.jammed ? 100 : 0) + b.heat - ((a.jammed ? 100 : 0) + a.heat),
        )[0];
      if (hot)
        return {
          setting,
          ...move(o.player, hot),
          secondary: distance(o.player, hot) < 65,
        };
      const fixes = o.belts
        .map((b) => {
          const item = o.cargo.find((a) => a.c === b.c && a.r === b.r);
          let desired = 0;
          if (o.variant === 2 && b.c === 6 && item && item.goal !== b.r)
            desired = item.goal > b.r ? 1 : 3;
          return {
            setting,
            b,
            desired,
            priority:
              (item ? 200 + item.waiting * 10 : 0) -
              distance(o.player, b) * 0.08,
          };
        })
        .filter((x) => x.b.dir !== x.desired)
        .sort((a, b) => b.priority - a.priority);
      const fix = fixes[0];
      if (fix)
        return {
          setting,
          ...move(o.player, fix.b),
          action: distance(o.player, fix.b) < 51,
        };
      const warm = [...o.machines].sort((a, b) => b.heat - a.heat)[0];
      return {
        setting,
        ...move(o.player, warm),
        secondary: !!warm && distance(o.player, warm) < 65 && warm.heat > 25,
      };
    }
    function update(dt, input = {}) {
      if (ended()) return;
      dt = clamp(dt, 0, 0.05);
      t += dt;
      setting = settingFrom(input, setting);
      const profile = profiles[setting];
      cool -= dt;
      spawn -= dt;
      steer(player, input, dt, 220, e);
      for (const m of machines) {
        m.heat = Math.max(0, m.heat - dt * (v === 3 ? 1.9 : 3.7));
        if (m.heat > 94 && !m.jammed) {
          m.jammed = true;
          record(
            {
              concept: "Thermal production control",
              event: "Thermal interlock latched",
              decision: profile.name + " feed",
              consequence: `Machine heat reached ${m.heat.toFixed(0)}%; repair or vent is required before processing resumes.`,
              quality: 0,
            },
            t,
          );
        }
      }
      if (cool <= 0 && (input.action || input.pointer?.pressed)) {
        const b = nearest(
          input.pointer?.pressed ? input.pointer : player,
          belts,
        );
        if (b && (input.pointer?.pressed || distance(player, b) < 61)) {
          b.dir = (b.dir + 1) % 4;
          cool = 0.2;
          e.emit("trail", b.x, b.y, p().cyan);
        }
      }
      if (cool <= 0 && input.secondary) {
        const m = nearest(player, machines);
        if (m && distance(player, m) < 70) {
          m.heat = Math.max(0, m.heat - 48);
          m.jammed = false;
          cool = 0.7;
          e.emit("boost", m.x, m.y, p().cyan);
        }
      }
      if (spawn <= 0) {
        const r = serial % rows;
        cargo.push({
          id: serial++,
          c: 0,
          r,
          x: sx,
          y: sy + r * dy,
          goal: v === 2 ? (r === 0 ? 1 : r === 3 ? 2 : r) : r,
          stages: [],
          travel: null,
          wait: 0,
          age: 0,
          process: 0,
          hp: 1,
        });
        spawn =
          (v === 3 ? 0.76 : v === 2 ? 1.4 : 1.05) /
          ((1 + l * 0.15) * profile.feed);
      }
      for (const a of cargo) {
        a.age += dt;
        if (a.dead) continue;
        if (v === 4) {
          const hot = machines.find((m) => m.c === a.c && m.r === a.r);
          if (hot && hot.heat > 70) a.hp -= dt * 0.2;
          if (a.wait > 3) a.hp -= dt * 0.045;
        }
        if (a.hp <= 0 || a.age > (v === 4 ? 19 : v === 2 ? 36 : 28)) {
          a.dead = true;
          lost++;
          record(
            {
              concept: "Thermal production control",
              event: "Cargo rejected",
              decision: profile.name + " feed",
              consequence: `${a.hp <= 0 ? "Integrity exhausted" : "Residence-time limit exceeded"}; ${lost} rejected orders.`,
              quality: 0,
            },
            t,
          );
          e.damage(v === 4 ? 5 : 3);
          e.emit("hit", a.x, a.y, p().danger);
          continue;
        }
        if (a.travel) {
          const d = distance(a, a.travel),
            step = (v === 4 ? 105 : 135) * profile.speed * dt;
          if (d <= step) {
            a.x = a.travel.x;
            a.y = a.travel.y;
            a.c = a.travel.c;
            a.r = a.travel.r;
            a.travel = null;
            a.wait = 0;
          } else {
            a.x += ((a.travel.x - a.x) / d) * step;
            a.y += ((a.travel.y - a.y) / d) * step;
          }
          continue;
        }
        const m = machines.find((m) => m.c === a.c && m.r === a.r);
        if (m && !a.stages.includes(m.c)) {
          a.wait += dt;
          if (m.jammed) continue;
          a.process += dt;
          m.heat += dt * (v === 3 ? 19 : 12) * profile.heat;
          if (a.process < (v === 1 ? 0.75 : 0.55)) continue;
          a.process = 0;
          a.stages.push(m.c);
          m.heat += 6 * profile.heat;
          a.hp = Math.max(0, a.hp - Math.max(0, m.heat - 62) / 65);
          e.emit("trail", a.x, a.y, p().amber);
        }
        const b = belts[a.r * cols + a.c],
          dir = dirs[b.dir],
          nc = a.c + dir[0],
          nr = a.r + dir[1];
        if (
          nc === cols &&
          a.r === a.goal &&
          a.stages.includes(3) &&
          (v !== 1 || a.stages.includes(5))
        ) {
          a.dead = true;
          if (a.hp < 0.45) {
            lost++;
            e.damage(2);
            record(
              {
                concept: "Thermal production control",
                event: "Quality inspection failed",
                decision: profile.name + " feed",
                consequence: `Remaining integrity ${Math.round(a.hp * 100)}%; order rejected.`,
                quality: 0,
              },
              t,
            );
            continue;
          }
          delivered++;
          e.award((v === 4 ? 45 : 30) * a.hp, "Accepted production yield");
          record(
            {
              concept: "Thermal production control",
              event: "Order inspected and delivered",
              decision: profile.name + " feed",
              consequence: `Integrity ${Math.round(a.hp * 100)}%; accepted yield ${Math.round((delivered / Math.max(1, delivered + lost)) * 100)}%.`,
              quality: a.hp,
            },
            t,
          );
          e.emit("collect", a.x + 30, a.y, p().accent);
          continue;
        }
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) {
          a.wait += dt;
          continue;
        }
        if (
          cargo.some(
            (other) =>
              other !== a &&
              !other.dead &&
              distance(other, { x: sx + nc * dx, y: sy + nr * dy }) < 36,
          )
        ) {
          a.wait += dt;
          continue;
        }
        a.travel = { c: nc, r: nr, x: sx + nc * dx, y: sy + nr * dy };
      }
      cargo = cargo.filter((a) => !a.dead);
      e.metric("Orders", `${delivered} / ${target}`);
      e.metric(
        "Machine heat",
        `${Math.round(Math.max(...machines.map((m) => m.heat)))}%`,
      );
      e.metric("In transit", cargo.length);
      const peak = Math.max(...machines.map((m) => m.heat)),
        feed =
          ((1 + l * 0.15) * profile.feed) /
          (v === 3 ? 0.76 : v === 2 ? 1.4 : 1.05),
        yieldRate = delivered / Math.max(1, delivered + lost),
        jams = machines.filter((m) => m.jammed).length;
      report({
        time: t,
        concept: "Manufacturing · thermal process control",
        readout: `FEED ${feed.toFixed(2)} parts/s  |  PEAK HEAT ${peak.toFixed(0)}%  |  ACCEPTED ${Math.round(yieldRate * 100)}%  |  JAMS ${jams}`,
        status: jams || peak > 90 ? "danger" : peak > 70 ? "warning" : "good",
        explanation: jams
          ? "A thermal interlock is latched. Repair or vent the jammed machine; lower feed to prevent another shutdown."
          : peak > 70
            ? "Heat is degrading part integrity. Lower feed or vent the affected machine."
            : "Increasing feed raises processing heat; accepted integrity determines production points.",
        formula:
          "dH/dt = process heat × profile gain − cooling; yield = accepted / (accepted + rejected)",
        signal: peak,
        setting: feed,
        outcome: yieldRate * 100,
        outcomeLabel: "Accepted yield",
        unit: "%",
      });
      if (delivered >= target) finish(true, "Production target reached");
    }
    function draw(ctx) {
      const c = p();
      backdrop(
        ctx,
        e,
        c,
        [
          "FLOW FACTORY / throughput",
          "FLOW FACTORY / two-stage quality",
          "FLOW FACTORY / destination orders",
          "FLOW FACTORY / heat-limited rush",
          "FLOW FACTORY / fragile logistics",
        ][v],
      );
      instrument(ctx, c);
      for (const b of belts) {
        ctx.fillStyle = c.surface;
        ctx.fillRect(b.x - 42, b.y - 31, 84, 62);
        ctx.strokeStyle = c.muted;
        ctx.globalAlpha = 0.3;
        ctx.strokeRect(b.x - 42, b.y - 31, 84, 62);
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate((b.dir * Math.PI) / 2);
        ctx.strokeStyle = c.cyan;
        ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k++) {
          const q = ((((t * 32 + k * 22) % 65) + 65) % 65) - 32;
          ctx.beginPath();
          ctx.moveTo(q - 5, -6);
          ctx.lineTo(q + 1, 0);
          ctx.lineTo(q - 5, 6);
          ctx.stroke();
        }
        ctx.restore();
      }
      for (let r = 0; r < rows; r++) {
        text(ctx, "IN", 48, sy + r * dy, c.muted);
        text(
          ctx,
          `0${r + 1}`,
          922,
          sy + r * dy,
          v === 2 ? [c.cyan, c.purple, c.amber, c.accent][r] : c.accent,
          14,
          "right",
        );
      }
      for (const m of machines) {
        ctx.fillStyle = m.jammed ? c.danger : c.surface;
        ctx.fillRect(m.x - 28, m.y - 25, 56, 50);
        ctx.strokeStyle = m.jammed ? c.danger : c.amber;
        ctx.lineWidth = 2;
        ctx.strokeRect(m.x - 28, m.y - 25, 56, 50);
        text(
          ctx,
          m.jammed ? "JAM" : m.c === 3 ? "M1" : "M2",
          m.x,
          m.y - 4,
          m.jammed ? c.bg : c.text,
          13,
          "center",
        );
        ctx.fillStyle = c.muted;
        ctx.fillRect(m.x - 23, m.y + 15, 46, 4);
        ctx.fillStyle = m.heat > 70 ? c.danger : c.amber;
        ctx.fillRect(m.x - 23, m.y + 15, 46 * clamp(m.heat / 100, 0, 1), 4);
      }
      for (const a of cargo) {
        const col = [c.cyan, c.purple, c.amber, c.accent][a.goal];
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.fillStyle = col;
        ctx.fillRect(-9, -9, 18, 18);
        if (v === 4) {
          ctx.fillStyle = a.hp < 0.4 ? c.danger : c.text;
          ctx.fillRect(-9, 12, 18 * a.hp, 3);
        }
        ctx.strokeStyle = c.bg;
        ctx.strokeRect(-5, -5, 10, 10);
        if (a.stages.length) circle(ctx, 5, -6, 3, c.accent, c.bg);
        ctx.restore();
      }
      agent(ctx, player, c, t);
      text(ctx, "ROTATE CONVEYOR", 120, 480, c.cyan, 11);
      text(ctx, "REPAIR / VENT MACHINE", 485, 480, c.amber, 11);
      text(ctx, `DELIVERED ${delivered}`, 835, 480, c.accent, 12, "right");
    }
    return { update, draw, observe: observation, act };
  }

  function network(env) {
    const { e, p, finish, ended, report, reading, record, instrument } =
        setup(env),
      v = e.variant,
      l = e.level;
    const nodes = Array.from({ length: 12 }, (_, id) => ({
      id,
      c: Math.floor(id / 3),
      r: id % 3,
      x: 145 + Math.floor(id / 3) * 218,
      y: 145 + (id % 3) * 125,
      tier: id % 3 === 1 ? 1 : 0,
      hp: 100,
      heat: 0,
      offline: 0,
      queue: 0,
      fire: 0,
      service: 1,
    }));
    const links = [];
    for (const n of nodes)
      for (const m of nodes)
        if (m.id > n.id && Math.abs(n.c - m.c) + Math.abs(n.r - m.r) === 1)
          links.push([n.id, m.id]);
    let t = 0,
      spawn = 0.1,
      attack = 2,
      outage = 7,
      cool = 0,
      credits = 48,
      delivered = 0,
      priorityDelivered = 0,
      blocked = 0,
      serial = 0,
      packets = [],
      attackers = [],
      beams = [],
      setting = 1,
      energySpent = 0,
      meanLatency = 0;
    let arrivals = [],
      latencies = [];
    const profiles = [
      { name: "Eco", mu: 0.65, cost: 0 },
      { name: "Balanced", mu: 1, cost: 0.12 },
      { name: "Burst", mu: 1.6, cost: 1.4 },
    ];
    const player = { x: 145, y: 270 },
      target = 18 + l * 5;
    const active = (n) => n.tier > 0 && n.hp > 0 && n.offline <= 0;
    function route(start) {
      const costs = new Map([[start, 0]]),
        paths = new Map([[start, [start]]]),
        todo = [start],
        seen = new Set();
      while (todo.length) {
        todo.sort((a, b) => costs.get(a) - costs.get(b));
        const at = todo.shift();
        if (seen.has(at)) continue;
        seen.add(at);
        if (at === 10) return paths.get(at);
        for (const edge of links) {
          const next = edge[0] === at ? edge[1] : edge[1] === at ? edge[0] : -1;
          if (next < 0 || !active(nodes[next])) continue;
          const n = nodes[next],
            cost =
              costs.get(at) +
              1 +
              n.queue * 0.55 +
              (v === 4 ? n.heat * 0.07 : 0);
          if (cost < (costs.get(next) ?? Infinity)) {
            costs.set(next, cost);
            paths.set(next, [...paths.get(at), next]);
            todo.push(next);
          }
        }
      }
      return null;
    }
    function observe() {
      return {
        family: "network",
        variant: v,
        level: l,
        time: t,
        setting,
        engineering: reading(),
        energySpent,
        meanLatency,
        arrivalRate: arrivals.length / Math.min(8, Math.max(1, t)),
        player: { ...player },
        nodes: nodes.map(({ fire, ...n }) => ({ ...n })),
        links: links.map((a) => [...a]),
        credits,
        packets: packets.map((a) => ({
          x: a.x,
          y: a.y,
          node: a.node,
          priority: a.priority,
          age: a.age,
        })),
        attackers: copy(attackers),
        delivered,
        priorityDelivered,
        target,
        blocked,
      };
    }
    function act(o) {
      const queue = o.nodes.reduce((n, x) => n + x.queue, 0);
      const setting =
        o.credits < 16
          ? 0
          : queue > 6 || o.packets.some((p) => p.priority && p.age > 6)
            ? 2
            : 1;
      const urgent = o.nodes
        .filter((n) => n.tier && (n.hp < 65 || n.offline > 0 || n.heat > 70))
        .sort(
          (a, b) =>
            (b.offline ? 100 : 0) +
            b.heat +
            100 -
            b.hp -
            ((a.offline ? 100 : 0) + a.heat + 100 - a.hp),
        )[0];
      if (urgent)
        return {
          setting,
          ...move(o.player, urgent),
          secondary: distance(o.player, urgent) < 68,
        };
      const missing = o.nodes.find((n) => n.r === 1 && !n.tier);
      if (missing && o.credits >= 20)
        return {
          setting,
          ...move(o.player, missing),
          action: distance(o.player, missing) < 58,
        };
      const upgrade = o.nodes
        .filter((n) => n.tier > 0 && n.tier < 3)
        .sort(
          (a, b) =>
            b.queue * 20 +
            b.heat -
            b.tier * 12 -
            (a.queue * 20 + a.heat - a.tier * 12),
        )[0];
      if (upgrade && o.credits >= 20 + upgrade.tier * 9)
        return {
          setting,
          ...move(o.player, upgrade),
          action: distance(o.player, upgrade) < 58,
        };
      const build = o.nodes
        .filter((n) => !n.tier)
        .sort((a, b) => Math.abs(a.c - 1.5) - Math.abs(b.c - 1.5))[0];
      if (build && o.credits > 25)
        return {
          setting,
          ...move(o.player, build),
          action: distance(o.player, build) < 58,
        };
      return {
        setting,
        ...move(o.player, o.nodes[7]),
        secondary: o.nodes[7].heat > 35 && distance(o.player, o.nodes[7]) < 68,
      };
    }
    function update(dt, input = {}) {
      if (ended()) return;
      dt = clamp(dt, 0, 0.05);
      t += dt;
      setting = settingFrom(input, setting);
      const profile = profiles[setting];
      cool -= dt;
      spawn -= dt;
      attack -= dt;
      outage -= dt;
      const operatingCost =
        nodes.filter((n) => n.tier > 0).length * profile.cost * dt;
      energySpent += Math.min(credits, operatingCost);
      credits = clamp(credits + dt * (1.6 + l * 0.2) - operatingCost, 0, 150);
      const serviceFactor =
        profile.mu * (setting === 2 && credits < 1 ? 0.45 : 1);
      steer(player, input, dt, 245, e);
      for (const n of nodes) {
        n.offline = Math.max(0, n.offline - dt);
        n.heat = Math.max(0, n.heat - dt * (v === 4 ? 3 : 7));
        n.fire -= dt;
        n.service = Math.min(2, n.service + dt * 1.4 * n.tier * serviceFactor);
        n.queue = packets.filter(
          (a) => a.node === n.id && a.to === null,
        ).length;
      }
      if (cool <= 0 && (input.action || input.pointer?.pressed)) {
        const n = nearest(
            input.pointer?.pressed ? input.pointer : player,
            nodes,
          ),
          cost = 20 + n.tier * 9;
        if (
          n &&
          n.tier < 3 &&
          credits >= cost &&
          (input.pointer?.pressed || distance(player, n) < 64)
        ) {
          credits -= cost;
          n.tier++;
          n.hp = 100;
          cool = 0.5;
          e.emit("boost", n.x, n.y, p().cyan);
        }
      }
      if (cool <= 0 && input.secondary) {
        const n = nearest(player, nodes);
        if (n && n.tier && distance(player, n) < 72) {
          n.hp = Math.min(100, n.hp + 45);
          n.heat = Math.max(0, n.heat - 65);
          n.offline = 0;
          cool = 0.7;
          e.emit("boost", n.x, n.y, p().accent);
        }
      }
      if (v === 3 && outage <= 0) {
        const n = nodes[[4, 7, 3, 8][Math.floor(t / 9) % 4]];
        n.offline = 7 + l * 1.5;
        outage = 11 - l;
        e.emit("hit", n.x, n.y, p().danger);
      }
      if (spawn <= 0) {
        const priority = v === 2 && serial % 3 === 0;
        packets.push({
          id: serial++,
          node: 1,
          x: nodes[1].x,
          y: nodes[1].y,
          to: null,
          age: 0,
          wait: 0,
          priority,
        });
        arrivals.push(t);
        const surge = 1 + 0.65 * Math.pow(Math.sin(t * 0.22), 2);
        spawn =
          (v === 4 ? 0.68 : v === 2 ? 0.85 : 1.1) / ((1 + l * 0.12) * surge);
      }
      if (attack <= 0) {
        const side = e.random() < 0.5;
        attackers.push({
          x: 240 + e.random() * 560,
          y: side ? 65 : 505,
          hp: v === 1 ? 48 : 35,
          speed: 22 + l * 9 + (v === 1 ? 8 : 0),
          hit: 0,
        });
        attack = (v === 1 ? 2.8 : 4.1) / (1 + l * 0.16);
      }
      for (const n of nodes) {
        if (!active(n) || n.fire > 0) continue;
        const enemy = nearest(
          n,
          attackers.filter((a) => !a.dead),
        );
        if (enemy && distance(n, enemy) < 100 + n.tier * 36) {
          enemy.hp -= 12 + n.tier * 5;
          n.fire = 0.8 / n.tier;
          beams.push({ x: n.x, y: n.y, tx: enemy.x, ty: enemy.y, life: 0.12 });
          if (enemy.hp <= 0) {
            enemy.dead = true;
            blocked++;
            credits += 5;
            e.award(12, "Intrusion blocked");
            e.emit("hit", enemy.x, enemy.y, p().purple);
          }
        }
      }
      for (const a of attackers) {
        if (a.dead) continue;
        const n = nearest(a, nodes.filter(active));
        if (!n) {
          a.dead = true;
          continue;
        }
        const d = distance(a, n);
        if (d > 18) {
          a.x += ((n.x - a.x) / d) * a.speed * dt;
          a.y += ((n.y - a.y) / d) * a.speed * dt;
        } else {
          a.hit -= dt;
          if (a.hit <= 0) {
            n.hp -= 14 + l * 3;
            a.hit = 0.7;
            e.emit("hit", n.x, n.y, p().danger);
            if (n.hp <= 0) {
              n.hp = 0;
              n.offline = 9;
              n.tier = Math.max(1, n.tier);
              e.damage(9);
              a.dead = true;
            }
          }
        }
      }
      for (const a of packets) {
        a.age += dt;
        if (a.age > (a.priority ? 13 : 29)) {
          a.dead = true;
          e.damage(a.priority ? 5 : 2);
          record(
            {
              concept: "Network queue control",
              event: "Packet deadline missed",
              decision: profile.name + " service budget",
              consequence: `Latency ${a.age.toFixed(1)}s exceeded its deadline; ${Math.floor(credits)} credits remain.`,
              quality: 0,
            },
            t,
          );
          e.emit("hit", a.x, a.y, p().danger);
          continue;
        }
        if (a.to !== null) {
          const n = nodes[a.to],
            d = distance(a, n),
            speed = (a.priority ? 195 : 160) * dt;
          if (d <= speed) {
            a.x = n.x;
            a.y = n.y;
            a.node = n.id;
            a.to = null;
            a.wait = 0;
            n.heat += v === 4 ? 9 : 5;
            if (n.id === 10) {
              a.dead = true;
              delivered++;
              latencies.push(a.age);
              if (latencies.length > 12) latencies.shift();
              meanLatency =
                latencies.reduce((a, b) => a + b, 0) / latencies.length;
              record(
                {
                  concept: "Network queue control",
                  event: "Packet delivered",
                  decision: profile.name + " service budget",
                  consequence: `Transit ${a.age.toFixed(1)}s; ${energySpent.toFixed(1)} operating credits spent.`,
                  quality: clamp(1 - a.age / (a.priority ? 13 : 29), 0, 1),
                },
                t,
              );
              if (a.priority) priorityDelivered++;
              credits = Math.min(150, credits + 7);
              e.award(
                (a.priority ? 42 : 24) *
                  (setting === 0 ? 1.12 : setting === 2 ? 0.78 : 1),
                a.priority ? "Priority packet delivered" : "Packet delivered",
              );
              e.emit("collect", a.x, a.y, p().accent);
            }
          } else {
            a.x += ((n.x - a.x) / d) * speed;
            a.y += ((n.y - a.y) / d) * speed;
          }
          continue;
        }
        const n = nodes[a.node];
        a.wait += dt;
        if (!active(n) || n.heat > 95 || n.service < 1) continue;
        const path = route(a.node),
          next = path?.[1];
        if (next !== undefined && nodes[next].queue < 2 + nodes[next].tier) {
          a.to = next;
          n.service -= 1;
        }
      }
      packets = packets.filter((a) => !a.dead);
      attackers = attackers.filter((a) => !a.dead);
      beams = beams.filter((b) => (b.life -= dt) > 0);
      e.metric(
        v === 2 ? "Priority delivered" : "Delivered",
        v === 2
          ? `${priorityDelivered} / ${7 + l * 2}`
          : `${delivered} / ${target}`,
      );
      e.metric("Build credits", Math.floor(credits));
      e.metric("Threats blocked", blocked);
      arrivals = arrivals.filter((at) => t - at < 8);
      const lambda = arrivals.length / Math.min(8, Math.max(1, t)),
        path = route(1),
        mu = path
          ? Math.min(
              ...path
                .slice(0, -1)
                .map((id) => 1.4 * nodes[id].tier * serviceFactor),
            )
          : 0,
        rho = lambda / Math.max(0.01, mu);
      report({
        time: t,
        concept: "IoT · network service capacity",
        readout: `ARRIVAL ${lambda.toFixed(2)}/s  |  SERVICE ${mu.toFixed(2)}/s  |  LATENCY ${meanLatency.toFixed(1)}s  |  COST ${energySpent.toFixed(0)}`,
        status:
          rho > 1.1 || !path
            ? "danger"
            : rho > 0.85 || credits < 16
              ? "warning"
              : "good",
        explanation:
          rho > 1
            ? "Arrivals exceed the slowest route hop. Increase service or upgrade a bottleneck; burst operation consumes build credits."
            : "Spare capacity lowers queues, while a smaller service budget preserves operating credits.",
        formula:
          "rho = arrival rate / slowest route service rate; service = 1.4 × tier × preset; latency = arrival time − send time",
        signal: lambda,
        setting: mu,
        outcome: meanLatency,
        outcomeLabel: "Mean transit latency",
        unit: "s",
      });
      if (
        (v === 2 ? priorityDelivered >= 7 + l * 2 : delivered >= target) &&
        (v !== 1 || blocked >= 3 + l)
      )
        finish(true, "Network objective secured");
    }
    function draw(ctx) {
      const c = p();
      backdrop(
        ctx,
        e,
        c,
        [
          "NETWORK / packet transport",
          "NETWORK / active defense",
          "NETWORK / priority traffic",
          "NETWORK / outage recovery",
          "NETWORK / load-balancing mesh",
        ][v],
      );
      instrument(ctx, c);
      for (const [a, b] of links) {
        const n = nodes[a],
          m = nodes[b];
        ctx.strokeStyle = active(n) && active(m) ? c.cyan : c.muted;
        ctx.globalAlpha = active(n) && active(m) ? 0.4 : 0.15;
        ctx.lineWidth = active(n) && active(m) ? 3 : 1;
        ctx.setLineDash(active(n) && active(m) ? [] : [5, 7]);
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      for (const n of nodes) {
        if (!n.tier) {
          circle(ctx, n.x, n.y, 21, c.surface, c.muted);
          text(ctx, "+", n.x, n.y, c.muted, 25, "center");
          continue;
        }
        const col =
          n.offline || n.hp <= 0 ? c.danger : n.heat > 70 ? c.amber : c.cyan;
        circle(ctx, n.x, n.y, 25, c.surface, col);
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = col;
        ctx.strokeRect(-14, -14, 28, 28);
        ctx.restore();
        text(ctx, n.offline ? "!" : n.tier, n.x, n.y, c.text, 13, "center");
        ctx.fillStyle = c.muted;
        ctx.fillRect(n.x - 24, n.y + 34, 48, 3);
        ctx.fillStyle = col;
        ctx.fillRect(n.x - 24, n.y + 34, (48 * n.hp) / 100, 3);
        if (n.queue)
          text(ctx, `Q ${n.queue}`, n.x, n.y - 36, c.amber, 10, "center");
      }
      for (const a of packets) {
        circle(
          ctx,
          a.x,
          a.y,
          a.priority ? 6 : 4,
          a.priority ? c.amber : c.accent,
        );
        if (a.priority) circle(ctx, a.x, a.y, 10, null, c.amber);
      }
      for (const a of attackers) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(t * 1.7);
        ctx.fillStyle = c.danger;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 8);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (const b of beams) {
        ctx.strokeStyle = c.purple;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.tx, b.ty);
        ctx.stroke();
      }
      agent(ctx, player, c, t);
      text(ctx, "SOURCE", 145, 455, c.accent, 11, "center");
      text(ctx, "DESTINATION", 799, 455, c.accent, 11, "center");
      text(ctx, "BUILD / UPGRADE RELAY", 28, 503, c.cyan, 11);
      text(ctx, "REPAIR / PURGE HEAT", 930, 503, c.amber, 11, "right");
    }
    return { update, draw, observe, act };
  }

  function swarm(env) {
    const { e, p, finish, ended, report, reading, record, instrument } =
        setup(env),
      v = e.variant,
      l = e.level;
    let t = 0,
      captured = 0,
      lost = 0,
      pulse = 0,
      refill = 0,
      hatchSerial = 0,
      setting = 1,
      minClearance = 30,
      spread = 100,
      contacts = 0,
      contactCooldown = 0;
    const profiles = [
      { name: "Compact", radius: 17, gain: 85, cohesion: 0.6 },
      { name: "Balanced", radius: 29, gain: 165, cohesion: 0.36 },
      { name: "Wide", radius: 43, gain: 230, cohesion: 0.2 },
    ];
    const player = { x: 330, y: 270 },
      goals =
        v === 3
          ? [
              { x: 820, y: 155, r: 48, group: 0, captured: 0 },
              { x: 820, y: 400, r: 48, group: 1, captured: 0 },
            ]
          : [{ x: 820, y: 270, r: v === 4 ? 42 : 54, group: 0, captured: 0 }],
      target = 20 + l * 3;
    const obstacles =
      v === 4
        ? [
            { x: 475, y: 112, r: 70 },
            { x: 475, y: 442, r: 70 },
            { x: 575, y: 270, r: 43 },
          ]
        : v === 0 || v === 3
          ? []
          : [
              { x: 520, y: 175, r: 42 },
              { x: 610, y: 370, r: 50 },
            ];
    const boids = [],
      predators = [];
    function hatch() {
      const group = v === 3 ? hatchSerial++ % 2 : 0;
      boids.push({
        x: 105 + e.random() * 175,
        y: 120 + e.random() * 300,
        vx: 25 + e.random() * 20,
        vy: (e.random() - 0.5) * 35,
        group,
      });
    }
    for (let i = 0; i < 28 + l * 3; i++) hatch();
    const count = v === 1 ? 2 + l : v === 0 ? 0 : 1 + (l === 2 ? 1 : 0);
    for (let i = 0; i < count; i++)
      predators.push({
        x: 570 + e.random() * 180,
        y: 100 + i * 145,
        vx: 0,
        vy: 0,
        stun: 0,
      });
    function observe() {
      return {
        family: "swarm",
        variant: v,
        level: l,
        time: t,
        setting,
        engineering: reading(),
        minClearance,
        spread,
        contacts,
        player: { ...player },
        boids: copy(boids),
        goals: copy(goals),
        predators: copy(predators),
        obstacles: copy(obstacles),
        captured,
        target,
        lost,
        pulse,
      };
    }
    function act(o) {
      const setting =
        o.minClearance < 16 ? 2 : o.spread > 135 && o.minClearance > 25 ? 0 : 1;
      const choices = o.goals
          .filter((g) => o.boids.some((b) => b.group === g.group))
          .sort((a, b) => a.captured - b.captured),
        goal = choices[0];
      if (!goal) return { setting };
      const flock = o.boids.filter((b) => b.group === goal.group),
        center = {
          x: flock.reduce((n, b) => n + b.x, 0) / flock.length,
          y: flock.reduce((n, b) => n + b.y, 0) / flock.length,
        };
      const d = Math.max(1, distance(center, goal)),
        ahead = {
          x: center.x + ((goal.x - center.x) / d) * 85,
          y: center.y + ((goal.y - center.y) / d) * 85,
        };
      const threat = nearest(o.player, o.predators);
      return {
        setting,
        ...move(o.player, ahead, 6),
        action: true,
        secondary: !!threat && distance(o.player, threat) < 105 && o.pulse <= 0,
      };
    }
    function update(dt, input = {}) {
      if (ended()) return;
      dt = clamp(dt, 0, 0.05);
      t += dt;
      setting = settingFrom(input, setting);
      const profile = profiles[setting];
      contactCooldown = Math.max(0, contactCooldown - dt);
      pulse = Math.max(0, pulse - dt);
      refill -= dt;
      steer(player, input, dt, 205, e, true);
      if (v === 2) {
        goals[0].x = 790 + Math.sin(t * 0.42) * 60;
        goals[0].y = 270 + Math.sin(t * 0.63) * 155;
      }
      const repel = !!input.secondary;
      if (repel && pulse <= 0) {
        pulse = 1.1;
        e.emit("boost", player.x, player.y, p().purple);
        for (const a of predators) if (distance(a, player) < 150) a.stun = 1.3;
      }
      const snapshot = copy(boids);
      for (const b of boids) {
        let ax = 0,
          ay = 0,
          cx = 0,
          cy = 0,
          vx = 0,
          vy = 0,
          n = 0;
        for (const other of snapshot) {
          const d = distance(b, other);
          if (d < 0.01 || d > 82) continue;
          n++;
          cx += other.x;
          cy += other.y;
          vx += other.vx;
          vy += other.vy;
          if (d < profile.radius) {
            const force = profile.gain * (1 - d / profile.radius);
            ax += ((b.x - other.x) / d) * force;
            ay += ((b.y - other.y) / d) * force;
          }
        }
        if (n) {
          ax += (cx / n - b.x) * profile.cohesion + (vx / n - b.vx) * 0.8;
          ay += (cy / n - b.y) * profile.cohesion + (vy / n - b.vy) * 0.8;
        }
        const pd = distance(b, player);
        if (pd < 190 && input.action && !repel) {
          ax += (player.x - b.x) * 0.85;
          ay += (player.y - b.y) * 0.85;
        } else if (pd < (repel ? 165 : 43)) {
          const force = repel ? 210 : 100;
          ax += ((b.x - player.x) / Math.max(1, pd)) * force;
          ay += ((b.y - player.y) / Math.max(1, pd)) * force;
        }
        for (const predator of predators) {
          const d = distance(b, predator);
          if (d < 135) {
            ax += ((b.x - predator.x) / Math.max(1, d)) * (170 - d);
            ay += ((b.y - predator.y) / Math.max(1, d)) * (170 - d);
          }
        }
        for (const o of obstacles) {
          const d = distance(b, o);
          if (d < o.r + 56) {
            ax += ((b.x - o.x) / Math.max(1, d)) * (o.r + 56 - d) * 5;
            ay += ((b.y - o.y) / Math.max(1, d)) * (o.r + 56 - d) * 5;
          }
        }
        if (b.x < 65) ax += 140;
        if (b.x > 910) ax -= 140;
        if (b.y < 90) ay += 140;
        if (b.y > 485) ay -= 140;
        if (v === 4) {
          ax += 22 + Math.sin(t * 0.8) * 20;
          ay += Math.sin(t * 0.65 + b.x * 0.012) * (32 + l * 10);
        }
        b.vx += ax * dt;
        b.vy += ay * dt;
        const speed = Math.hypot(b.vx, b.vy),
          max = 70 + l * 5;
        if (speed > max) {
          b.vx = (b.vx / speed) * max;
          b.vy = (b.vy / speed) * max;
        }
        b.x = clamp(b.x + b.vx * dt, 35, 925);
        b.y = clamp(b.y + b.vy * dt, 70, 505);
        const goal = goals.find((g) => g.group === b.group);
        if (distance(b, goal) < goal.r) {
          b.dead = true;
          captured++;
          goal.captured++;
          e.award(
            35 * (1 - Math.min(contacts, 15) * 0.02),
            "Robot safely routed",
          );
          record(
            {
              concept: "Multi-robot collision avoidance",
              event: "Robot entered its destination",
              decision: profile.name + " formation clearance",
              consequence: `${captured} routed; ${contacts} contacts; nearest clearance ${minClearance.toFixed(1)} units.`,
              quality: clamp(1 - contacts * 0.04, 0, 1),
            },
            t,
          );
          e.emit("collect", b.x, b.y, b.group ? p().purple : p().accent);
        }
      }
      for (const a of predators) {
        a.stun = Math.max(0, a.stun - dt);
        const prey = nearest(
          a,
          boids.filter((b) => !b.dead),
        );
        if (!prey) continue;
        const d = Math.max(1, distance(a, prey)),
          speed = a.stun ? -105 : 50 + l * 8;
        a.vx = ((prey.x - a.x) / d) * speed;
        a.vy = ((prey.y - a.y) / d) * speed;
        a.x = clamp(a.x + a.vx * dt, 45, 915);
        a.y = clamp(a.y + a.vy * dt, 80, 495);
        if (d < 12 && !a.stun) {
          prey.dead = true;
          lost++;
          a.stun = 1.8;
          e.damage(6);
          e.emit("hit", prey.x, prey.y, p().danger);
        }
      }
      for (let i = boids.length - 1; i >= 0; i--)
        if (boids[i].dead) boids.splice(i, 1);
      if (boids.length < 20 && refill <= 0) {
        hatch();
        refill = 1.5;
      }
      e.metric(
        "Guided home",
        v === 3
          ? goals.map((g) => `${g.captured}/${8 + l}`).join(" · ")
          : `${captured} / ${target}`,
      );
      let closest = null;
      minClearance = 1000;
      for (let i = 0; i < boids.length; i++)
        for (let j = i + 1; j < boids.length; j++) {
          const d = distance(boids[i], boids[j]);
          if (d < minClearance) {
            minClearance = d;
            closest = [boids[i], boids[j]];
          }
        }
      const center = {
        x: boids.reduce((n, b) => n + b.x, 0) / Math.max(1, boids.length),
        y: boids.reduce((n, b) => n + b.y, 0) / Math.max(1, boids.length),
      };
      spread = Math.sqrt(
        boids.reduce((n, b) => n + distance(b, center) ** 2, 0) /
          Math.max(1, boids.length),
      );
      if (minClearance < 9 && t > 2 && contactCooldown === 0 && closest) {
        contacts++;
        contactCooldown = 1;
        e.damage(2);
        e.emit("hit", closest[0].x, closest[0].y, p().danger);
        record(
          {
            concept: "Multi-robot collision avoidance",
            event: "Robot contact detected",
            decision: profile.name + " formation clearance",
            consequence: `Spacing ${minClearance.toFixed(1)} units fell below the 9-unit contact boundary.`,
            quality: 0,
          },
          t,
        );
      }
      report({
        time: t,
        concept: "Robotics · local collision avoidance",
        readout: `NEAREST ${minClearance.toFixed(1)}u  |  CLEARANCE ${profile.radius}u  |  SPREAD ${spread.toFixed(0)}u  |  CONTACTS ${contacts}`,
        status:
          minClearance < 9
            ? "danger"
            : minClearance < 16 || spread > 160
              ? "warning"
              : "good",
        explanation:
          minClearance < 16
            ? "Robots are too close. Increase clearance; a wider formation weakens cohesion and takes more room to guide."
            : "Compact formation improves cohesion but reduces contact margins near moving hazards and narrow passages.",
        formula:
          "d_min = min ||p_i−p_j||; separation force = gain × max(0, 1−distance/clearance)",
        signal: minClearance,
        setting: profile.radius,
        outcome: contacts,
        outcomeLabel: "Robot contacts",
        unit: "contacts",
      });
      e.metric("Flock", boids.length);
      e.metric("Rescues lost", lost);
      if (
        v === 3 ? goals.every((g) => g.captured >= 8 + l) : captured >= target
      )
        finish(true, "Flock safely guided home");
    }
    function draw(ctx) {
      const c = p();
      backdrop(
        ctx,
        e,
        c,
        [
          "SWARM / local rules, collective motion",
          "SWARM / predator evasion",
          "SWARM / moving rendezvous",
          "SWARM / two flock destinations",
          "SWARM / crosswind migration",
        ][v],
      );
      instrument(ctx, c);
      for (const o of obstacles) {
        circle(ctx, o.x, o.y, o.r, c.surface, c.muted);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(0.3);
        ctx.strokeStyle = c.muted;
        ctx.globalAlpha = 0.3;
        ctx.strokeRect(-o.r * 0.65, -o.r * 0.65, o.r * 1.3, o.r * 1.3);
        ctx.restore();
      }
      if (v === 4) {
        ctx.strokeStyle = c.cyan;
        ctx.globalAlpha = 0.17;
        for (let i = 0; i < 12; i++) {
          const y = 90 + i * 35,
            x = (t * 55 + i * 81) % e.w;
          ctx.beginPath();
          ctx.moveTo(x - 90, y);
          ctx.quadraticCurveTo(x - 40, y + Math.sin(t + i) * 25, x, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      for (const g of goals) {
        const col = g.group ? c.purple : c.accent;
        circle(ctx, g.x, g.y, g.r, c.surface, col);
        ctx.strokeStyle = col;
        ctx.setLineDash([9, 7]);
        circle(ctx, g.x, g.y, g.r + 9 + Math.sin(t * 3) * 2, null, col);
        ctx.setLineDash([]);
        text(ctx, `${g.captured}`, g.x, g.y, col, 24, "center");
      }
      ctx.save();
      ctx.globalAlpha = 0.12;
      circle(ctx, player.x, player.y, 165, c.cyan);
      ctx.restore();
      for (const b of boids) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = b.group ? c.purple : c.accent;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -4);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (const a of predators) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.atan2(a.vy, a.vx));
        ctx.strokeStyle = a.stun ? c.muted : c.danger;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-9, -10);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-9, 10);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      agent(ctx, player, c, t);
      if (pulse > 0.7)
        circle(ctx, player.x, player.y, (1.1 - pulse) * 250, null, c.purple);
      text(ctx, "ATTRACT TO GUIDE • REPEL TO SCATTER", 28, 515, c.cyan, 11);
    }
    return { update, draw, observe, act };
  }

  function ecosystem(env) {
    const { e, p, finish, ended, report, reading, record, instrument } =
        setup(env),
      v = e.variant,
      l = e.level;
    const cells = Array.from({ length: 45 }, (_, id) => {
      const planted = id % 6 === 2;
      return {
        id,
        c: id % 9,
        r: Math.floor(id / 9),
        x: 112 + (id % 9) * 92,
        y: 130 + Math.floor(id / 9) * 78,
        soil: (v === 1 ? 0.22 : 0.38) + e.random() * 0.19,
        water: 0.48 + e.random() * 0.3,
        growth: planted ? 0.35 + e.random() * 0.6 : 0,
        planted,
        invasive: v === 3 && [4, 13, 22, 31].includes(id),
      };
    });
    const player = { x: 112, y: 286 },
      bees = Array.from({ length: 5 }, (_, i) => ({
        x: 190 + i * 130,
        y: 100 + i * 45,
        index: i * 2,
        cool: 0,
      }));
    let t = 0,
      cool = 0,
      reservoir = 70,
      harvested = 0,
      pollinated = 0,
      spread = 5,
      ecology = 0,
      drought = false,
      setting = 1,
      pumpFlow = 0,
      waterUsed = 0,
      soilMoisture = 0.6,
      wetWarning = false;
    const profiles = [
      { name: "Water-saving", target: 0.32, flow: 0.6 },
      { name: "Sensor regulated", target: 0.52, flow: 1.4 },
      { name: "High irrigation", target: 0.84, flow: 2.8 },
    ];
    const target = 8 + l * 2;
    const habitat = () =>
      cells.filter((c) => c.planted && c.soil >= 0.5 && !c.invasive).length;
    function corridor() {
      let best = 0;
      const seen = new Set();
      for (const c of cells) {
        if (seen.has(c.id) || !c.planted || c.invasive) continue;
        const todo = [c];
        let n = 0;
        seen.add(c.id);
        while (todo.length) {
          const at = todo.pop();
          n++;
          for (const next of cells)
            if (
              !seen.has(next.id) &&
              next.planted &&
              !next.invasive &&
              Math.abs(at.c - next.c) + Math.abs(at.r - next.r) === 1
            ) {
              seen.add(next.id);
              todo.push(next);
            }
        }
        best = Math.max(best, n);
      }
      return best;
    }
    function observe() {
      return {
        family: "ecosystem",
        variant: v,
        level: l,
        time: t,
        setting,
        engineering: reading(),
        pumpFlow,
        waterUsed,
        soilMoisture,
        player: { ...player },
        cells: copy(cells),
        reservoir,
        harvested,
        habitat: habitat(),
        corridor: corridor(),
        pollinated,
        target,
        drought,
      };
    }
    function act(o) {
      const setting =
        o.reservoir < 20
          ? 0
          : o.soilMoisture < 0.34 && o.reservoir > 35
            ? 2
            : 1;
      const ranked = o.cells
        .map((c) => {
          let score = -Infinity,
            secondary = false;
          if (c.invasive) {
            score = 950;
            secondary = true;
          } else if (c.planted && c.growth >= 0.8) {
            score = 850;
            secondary = true;
          } else if (o.reservoir >= 7 && c.planted && c.water < 0.3) {
            score = 500;
          } else if (o.reservoir >= 11 && !c.planted) {
            score =
              280 +
              (o.variant === 2
                ? o.cells.filter(
                    (n) =>
                      n.planted &&
                      Math.abs(n.c - c.c) + Math.abs(n.r - c.r) === 1,
                  ).length * 70
                : 0);
          } else if (o.reservoir >= 7 && c.planted && c.soil < 0.55) {
            score = 200;
          }
          return {
            setting,
            c,
            secondary,
            score: score - distance(o.player, c) * 0.45,
          };
        })
        .sort((a, b) => b.score - a.score);
      const choice = ranked[0];
      if (!choice || !Number.isFinite(choice.score)) return { setting };
      const near = distance(o.player, choice.c) < 42;
      return {
        setting,
        ...move(o.player, choice.c, 7),
        action: near && !choice.secondary,
        secondary: near && choice.secondary,
      };
    }
    function update(dt, input = {}) {
      if (ended()) return;
      dt = clamp(dt, 0, 0.05);
      t += dt;
      setting = settingFrom(input, setting);
      const profile = profiles[setting];
      cool -= dt;
      spread -= dt;
      ecology -= dt;
      drought = v === 4 && t % 25 > 12;
      reservoir = Math.min(
        100,
        reservoir + dt * (drought ? 0.15 : v === 1 ? 0.8 : 1.35),
      );
      const needy = cells.filter(
        (c) => c.planted && !c.invasive && c.water < profile.target,
      );
      const demand = needy.reduce(
        (n, c) => n + (profile.target - c.water) * 8,
        0,
      );
      const volume = Math.min(profile.flow * dt, reservoir, demand);
      pumpFlow = dt > 0 ? volume / dt : 0;
      reservoir -= volume;
      waterUsed += volume;
      if (needy.length)
        for (const c of needy)
          c.water = Math.min(1, c.water + volume / (needy.length * 8));
      steer(player, input, dt, 205, e, true);
      const cell = nearest(player, cells);
      if (cool <= 0 && cell && distance(player, cell) < 51) {
        if (input.secondary && cell.invasive) {
          cell.invasive = false;
          cell.soil = Math.min(1, cell.soil + 0.1);
          cool = 0.45;
          e.award(16, "Invasive growth removed");
          e.emit("collect", cell.x, cell.y, p().purple);
        } else if (input.secondary && cell.planted && cell.growth >= 0.8) {
          harvested++;
          cell.growth = 0.16;
          cell.soil = Math.max(0.12, cell.soil - 0.065);
          cool = 0.45;
          const cropQuality = clamp(
            1 - Math.abs(cell.water - 0.55) * 1.8,
            0.3,
            1,
          );
          e.award(38 * cropQuality, "Greenhouse crop yield");
          record(
            {
              concept: "IoT greenhouse irrigation",
              event: "Crop harvested",
              decision:
                profile.name +
                " setpoint " +
                Math.round(profile.target * 100) +
                "%",
              consequence: `Root-zone moisture ${Math.round(cell.water * 100)}%; ${waterUsed.toFixed(1)}L irrigated; tank ${reservoir.toFixed(1)}L.`,
              quality: cropQuality,
            },
            t,
          );
          e.emit("collect", cell.x, cell.y, p().accent);
        } else if (
          input.action &&
          !cell.invasive &&
          reservoir >= (cell.planted ? 6 : 10)
        ) {
          const manualDose = cell.planted ? 6 : 10;
          reservoir -= manualDose;
          waterUsed += manualDose;
          if (!cell.planted) {
            cell.planted = true;
            cell.growth = 0.1;
            cell.soil = Math.min(1, cell.soil + 0.25);
            e.award(5, "Habitat planted");
          } else cell.soil = Math.min(1, cell.soil + 0.08);
          cell.water = Math.min(1, cell.water + 0.52);
          record(
            {
              concept: "IoT greenhouse irrigation",
              event: "Local irrigation dose applied",
              decision:
                profile.name + " automatic setpoint with manual watering",
              consequence: `${manualDose}L dose; local moisture ${Math.round(cell.water * 100)}%; reservoir ${reservoir.toFixed(1)}L.`,
              quality: clamp(1 - Math.abs(cell.water - 0.55) * 1.8, 0, 1),
            },
            t,
          );
          cool = 0.55;
          e.emit("boost", cell.x, cell.y, p().cyan);
        }
      }
      for (const c of cells) {
        const neighbors = cells.filter(
          (n) =>
            n.planted &&
            !n.invasive &&
            Math.abs(c.c - n.c) + Math.abs(c.r - n.r) === 1,
        ).length;
        c.water = clamp(
          c.water +
            dt *
              ((!drought ? 0.012 : 0) -
                (0.009 + l * 0.002) * (c.planted ? 1.8 : 0.7) -
                (drought ? 0.028 : 0) +
                neighbors * 0.001),
          0,
          1,
        );
        if (c.invasive) {
          c.soil = Math.max(0.1, c.soil - dt * 0.008);
          c.water = Math.max(0, c.water - dt * 0.012);
          continue;
        }
        if (c.planted) {
          const rate =
            (0.037 - l * 0.003) *
            (0.4 + c.soil * 0.6) *
            clamp((c.water - 0.12) / 0.45, 0, 1) *
            (c.water > 0.78 ? 0.25 : 1);
          c.growth = Math.min(1, c.growth + rate * dt);
          c.soil = Math.min(1, c.soil + dt * (0.003 + neighbors * 0.001));
          if (c.water < 0.035) {
            c.growth = Math.max(0, c.growth - dt * 0.025);
            if (c.growth <= 0) {
              c.planted = false;
              e.damage(2);
              record(
                {
                  concept: "IoT greenhouse irrigation",
                  event: "Dry root zone lost a plant",
                  decision: profile.name + " irrigation",
                  consequence: `Moisture ${Math.round(c.water * 100)}%; tank ${reservoir.toFixed(1)}L.`,
                  quality: 0,
                },
                t,
              );
              e.emit("hit", c.x, c.y, p().danger);
            }
          }
        } else c.soil = Math.min(1, c.soil + neighbors * dt * 0.0018);
      }
      if (v === 3 && spread <= 0) {
        const source = cells.filter((c) => c.invasive)[
          Math.floor(e.random() * cells.filter((c) => c.invasive).length)
        ];
        if (source) {
          const targets = cells.filter(
            (c) =>
              !c.invasive &&
              Math.abs(c.c - source.c) + Math.abs(c.r - source.r) === 1,
          );
          if (targets.length) {
            const next = targets[Math.floor(e.random() * targets.length)];
            next.invasive = true;
            e.emit("hit", next.x, next.y, p().purple);
          }
        }
        spread = 7 - l * 1.5;
      }
      const flowers = cells.filter(
        (c) => c.planted && c.growth > 0.4 && !c.invasive,
      );
      for (const bee of bees) {
        bee.cool -= dt;
        if (!flowers.length) continue;
        const goal = flowers[bee.index % flowers.length],
          d = distance(bee, goal);
        if (d > 8) {
          bee.x += ((goal.x - bee.x) / d) * 65 * dt;
          bee.y += ((goal.y - bee.y) / d) * 65 * dt;
        } else if (bee.cool <= 0) {
          goal.growth = Math.min(1, goal.growth + 0.045);
          pollinated++;
          bee.index += 3;
          bee.cool = 2;
        }
      }
      if (ecology <= 0) {
        const invasive = cells.filter((c) => c.invasive).length;
        if (invasive > 13) e.damage(3);
        ecology = 4;
      }
      const h = habitat(),
        chain = corridor();
      e.metric(
        v === 2 ? "Pollinations" : "Harvests",
        v === 2
          ? pollinated
          : `${harvested} / ${v === 3 ? 6 + l : v === 4 ? 7 + l : target}`,
      );
      e.metric(
        v === 2 ? "Connected habitat" : "Restored habitat",
        v === 2 ? chain : h,
      );
      e.metric(
        "Water reserve",
        `${Math.floor(reservoir)}L${drought ? " · DROUGHT" : ""}`,
      );
      const planted = cells.filter((c) => c.planted && !c.invasive);
      soilMoisture =
        planted.reduce((n, c) => n + c.water, 0) / Math.max(1, planted.length);
      const waterlogged = planted.filter((c) => c.water > 0.78).length;
      if (waterlogged > planted.length * 0.35 && !wetWarning) {
        wetWarning = true;
        record(
          {
            concept: "IoT greenhouse irrigation",
            event: "Waterlogging threshold crossed",
            decision: profile.name + " irrigation setpoint",
            consequence: `${waterlogged} root zones exceeded78% moisture; their growth rate is reduced to one quarter.`,
            quality: 0.2,
          },
          t,
        );
      } else if (waterlogged < planted.length * 0.2) wetWarning = false;
      report({
        time: t,
        concept: "IoT · greenhouse feedback irrigation",
        readout: `MOISTURE ${Math.round(soilMoisture * 100)}%  |  TARGET ${Math.round(profile.target * 100)}%  |  PUMP ${pumpFlow.toFixed(1)}L/s  |  TANK ${reservoir.toFixed(0)}L`,
        status:
          soilMoisture < 0.2 || reservoir < 5
            ? "danger"
            : waterlogged > planted.length * 0.3 || reservoir < 20
              ? "warning"
              : "good",
        explanation:
          soilMoisture > 0.78
            ? "Waterlogged root zones grow at one-quarter rate. Lower the irrigation target."
            : reservoir < 20
              ? "Pump demand is depleting the reservoir. Reduce flow or limit new planting until refill recovers."
              : "Local moisture sensors activate irrigation below the selected setpoint; dry air raises water demand.",
        formula:
          "R_next = R + refill × dt − pump × dt − manual dose; root-zone gain = dose / (8L × active zones)",
        signal: soilMoisture * 100,
        setting: profile.target * 100,
        outcome: waterUsed,
        outcomeLabel: "Irrigation used",
        unit: "L",
      });
      const won =
        v === 0
          ? harvested >= target
          : v === 1
            ? h >= 18 + l * 2 && harvested >= 3
            : v === 2
              ? pollinated >= 18 + l * 4 && chain >= 10 + l * 2
              : v === 3
                ? harvested >= 6 + l &&
                  cells.filter((c) => c.invasive).length <= 3 &&
                  t > 35
                : harvested >= 7 + l && h >= 12 && t > 40;
      if (won) finish(true, "Living system restored");
    }
    function draw(ctx) {
      const c = p();
      backdrop(
        ctx,
        e,
        c,
        [
          "IOT GREENHOUSE / regenerative harvest",
          "IOT GREENHOUSE / arid restoration",
          "IOT GREENHOUSE / pollinator corridors",
          "IOT GREENHOUSE / invasive containment",
          "IOT GREENHOUSE / drought resilience",
        ][v],
      );
      instrument(ctx, c);
      for (const a of cells) {
        ctx.fillStyle = c.surface;
        ctx.fillRect(a.x - 41, a.y - 33, 82, 66);
        ctx.strokeStyle = a.invasive
          ? c.purple
          : a.soil > 0.55
            ? c.accent
            : c.muted;
        ctx.globalAlpha = a.invasive ? 0.8 : 0.25;
        ctx.strokeRect(a.x - 41, a.y - 33, 82, 66);
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.cyan;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(a.x - 33, a.y + 25, 66 * a.water, 3);
        ctx.globalAlpha = 1;
        if (a.invasive) {
          ctx.strokeStyle = c.purple;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const an = (i * TAU) / 6 + t * 0.15;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(a.x + Math.cos(an) * 22, a.y + Math.sin(an) * 22);
          }
          ctx.stroke();
          circle(ctx, a.x, a.y, 7, c.purple);
        } else if (a.planted) {
          const size = 8 + a.growth * 19;
          ctx.strokeStyle = c.accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y + 16);
          ctx.lineTo(a.x, a.y - size);
          ctx.stroke();
          ctx.fillStyle = c.accent;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(
              a.x + side * size * 0.3,
              a.y - size * 0.15,
              size * 0.43,
              size * 0.18,
              side * 0.6,
              0,
              TAU,
            );
            ctx.fill();
          }
          if (a.growth >= 0.8) {
            circle(ctx, a.x, a.y - size, 6, c.amber);
            circle(ctx, a.x + size * 0.35, a.y - 5, 4, c.amber);
          }
        } else {
          ctx.strokeStyle = c.muted;
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.moveTo(a.x - 4, a.y);
          ctx.lineTo(a.x + 4, a.y);
          ctx.moveTo(a.x, a.y - 4);
          ctx.lineTo(a.x, a.y + 4);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      for (const b of bees) {
        circle(ctx, b.x, b.y, 3, c.amber);
        ctx.strokeStyle = c.cyan;
        ctx.beginPath();
        ctx.ellipse(b.x - 4, b.y - 3, 4, 2, Math.sin(t * 30), 0, TAU);
        ctx.ellipse(b.x + 4, b.y - 3, 4, 2, -Math.sin(t * 30), 0, TAU);
        ctx.stroke();
      }
      agent(ctx, player, c, t);
      text(
        ctx,
        drought ? "DROUGHT FRONT / water slowly returns" : "WATER CYCLE ACTIVE",
        28,
        510,
        drought ? c.amber : c.cyan,
        11,
      );
      text(
        ctx,
        "PLANT / WATER     HARVEST / CLEAR",
        930,
        510,
        c.accent,
        11,
        "right",
      );
    }
    return { update, draw, observe, act };
  }

  function orbit(env) {
    const { e, p, finish, ended, report, reading, record, instrument } =
        setup(env),
      v = e.variant,
      l = e.level;
    const planets = [{ x: 480, y: 282, r: 48, mu: 840000 * (1 + l * 0.1) }];
    if (v === 4)
      planets.push({ x: 748, y: 165, r: 29, mu: 220000 * (1 + l * 0.1) });
    const player = {
      x: 200,
      y: 282,
      vx: 0,
      vy: -59,
      angle: -Math.PI / 2,
      fuel: 100,
    };
    const stars = Array.from({ length: 95 }, () => ({
      x: e.random() * e.w,
      y: 60 + e.random() * (e.h - 60),
      r: e.random() < 0.85 ? 1 : 1.7,
      phase: e.random() * TAU,
    }));
    const debris = Array.from(
      { length: (v === 3 ? 15 : 4) + l * 4 },
      (_, i) => ({
        x: 80 + e.random() * 800,
        y: 80 + e.random() * 415,
        vx: (e.random() - 0.5) * (v === 3 ? 90 : 45),
        vy: (e.random() - 0.5) * 48,
        r: 5 + e.random() * 6,
        angle: e.random() * TAU,
      }),
    );
    let t = 0,
      progress = 0,
      boost = 0,
      hurt = 0,
      trail = 0,
      stableAward = 0,
      thrusting = false,
      setting = 1,
      fuelUsed = 0,
      legFuelStart = 0,
      closingVelocity = 0,
      stoppingDistance = 0;
    const profiles = [
      { name: "Precision", thrust: 72, flow: 4.2, impulse: 38, boostCost: 6 },
      { name: "Cruise", thrust: 112, flow: 7, impulse: 62, boostCost: 9 },
      {
        name: "High thrust",
        thrust: 170,
        flow: 13,
        impulse: 95,
        boostCost: 16,
      },
    ];
    const required = v === 1 ? 18 + l * 5 : v === 2 ? 4 : v === 4 ? 8 : 6 + l;
    function destination() {
      if (v === 1) {
        const a =
            Math.atan2(player.y - planets[0].y, player.x - planets[0].x) + 0.48,
          r = 190,
          speed = Math.sqrt(planets[0].mu / r);
        return {
          x: 480 + Math.cos(a) * r,
          y: 282 + Math.sin(a) * r,
          vx: -Math.sin(a) * speed,
          vy: Math.cos(a) * speed,
        };
      }
      if (v === 2) {
        const locations = [
            [795, 270],
            [760, 135],
            [190, 130],
            [200, 422],
          ],
          a = locations[Math.floor(progress) % locations.length];
        return {
          x: a[0],
          y: a[1] + Math.sin(t * 0.48) * 26,
          vx: 0,
          vy: Math.cos(t * 0.48) * 12.48,
        };
      }
      if (v === 4 && Math.floor(progress) % 2 === 1) {
        const a = -Math.PI * 0.6 + Math.floor(progress) * 0.4;
        return {
          x: planets[1].x + Math.cos(a) * 112,
          y: planets[1].y + Math.sin(a) * 112,
          vx: 0,
          vy: 0,
        };
      }
      const a = Math.PI + 0.62 + Math.floor(progress) * 0.78;
      return {
        x: 480 + Math.cos(a) * 240,
        y: 282 + Math.sin(a) * 174,
        vx: 0,
        vy: 0,
      };
    }
    function gravity(a) {
      let x = 0,
        y = 0;
      for (const b of planets) {
        const d = Math.max(b.r + 15, distance(a, b)),
          force = b.mu / (d * d);
        x += ((b.x - a.x) / d) * force;
        y += ((b.y - a.y) / d) * force;
      }
      return { x, y };
    }
    function observe() {
      return {
        family: "orbit",
        variant: v,
        level: l,
        time: t,
        setting,
        engineering: reading(),
        fuelUsed,
        closingVelocity,
        stoppingDistance,
        player: { ...player },
        planets: copy(planets),
        target: { ...destination() },
        progress,
        required,
        debris: copy(debris),
        boost,
      };
    }
    function act(o) {
      const targetDistance = distance(o.player, o.target);
      const setting =
        o.player.fuel < 22 || targetDistance < 130 || o.variant === 1
          ? 0
          : targetDistance > 300 && o.player.fuel > 55
            ? 2
            : 1;
      const a = o.player;
      let goal = { ...o.target },
        gx = 0,
        gy = 0;
      for (const b of o.planets) {
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.max(b.r + 15, Math.hypot(dx, dy));
        gx += ((dx / d) * b.mu) / (d * d);
        gy += ((dy / d) * b.mu) / (d * d);
      }
      let desiredX, desiredY;
      if (o.variant === 1) {
        const b = o.planets[0],
          dx = a.x - b.x,
          dy = a.y - b.y,
          r = Math.max(1, Math.hypot(dx, dy)),
          speed = Math.sqrt(b.mu / 190),
          radial = (190 - r) * 0.75;
        desiredX = (-dy / r) * speed + (dx / r) * radial;
        desiredY = (dx / r) * speed + (dy / r) * radial;
      } else {
        for (const b of o.planets) {
          const vx = goal.x - a.x,
            vy = goal.y - a.y,
            len = vx * vx + vy * vy,
            u = clamp(
              ((b.x - a.x) * vx + (b.y - a.y) * vy) / Math.max(1, len),
              0,
              1,
            ),
            close = { x: a.x + u * vx, y: a.y + u * vy };
          if (u > 0.04 && u < 0.95 && distance(close, b) < b.r + 60) {
            const n = Math.max(1, Math.hypot(vx, vy)),
              side = vx * (b.y - a.y) - vy * (b.x - a.x) > 0 ? -1 : 1;
            goal = {
              x: b.x - (vy / n) * (b.r + 125) * side,
              y: b.y + (vx / n) * (b.r + 125) * side,
              vx: 0,
              vy: 0,
            };
            break;
          }
        }
        desiredX = (goal.x - a.x) * 0.8 + (goal.vx || 0);
        desiredY = (goal.y - a.y) * 0.8 + (goal.vy || 0);
        const speed = Math.hypot(desiredX, desiredY),
          limit = o.variant === 2 ? 100 : 110;
        if (speed > limit) {
          desiredX = (desiredX / speed) * limit;
          desiredY = (desiredY / speed) * limit;
        }
      }
      const ax = (desiredX - a.vx) * 1.8 - gx,
        ay = (desiredY - a.vy) * 1.8 - gy,
        angle = Math.atan2(ay, ax),
        error = angleDelta(angle, a.angle),
        force = Math.hypot(ax, ay),
        d = distance(a, o.target);
      return {
        setting,
        left: error < -0.055,
        right: error > 0.055,
        up: Math.abs(error) < 0.28 && force > 10,
        down: false,
        action:
          Math.abs(error) < 0.12 &&
          d > 170 &&
          Math.hypot(a.vx, a.vy) < 90 &&
          a.fuel > 45 &&
          o.boost <= 0,
        secondary:
          o.variant === 2 &&
          d < 75 &&
          Math.hypot(a.vx - o.target.vx, a.vy - o.target.vy) > 28,
      };
    }
    function update(dt, input = {}) {
      if (ended()) return;
      dt = clamp(dt, 0, 0.05);
      t += dt;
      setting = settingFrom(input, setting);
      const profile = profiles[setting];
      boost = Math.max(0, boost - dt);
      hurt = Math.max(0, hurt - dt);
      trail -= dt;
      player.fuel = Math.min(100, player.fuel + dt * 3.5);
      if (v === 4) {
        planets[1].x = 738 + Math.sin(t * 0.13) * 28;
        planets[1].y = 165 + Math.cos(t * 0.13) * 22;
      }
      let turn = Number(!!input.right) - Number(!!input.left),
        thrust = !!input.up;
      if (input.pointer?.down) {
        const desired = Math.atan2(
            input.pointer.y - player.y,
            input.pointer.x - player.x,
          ),
          error = angleDelta(desired, player.angle);
        turn = Math.abs(error) < 0.05 ? 0 : Math.sign(error);
        thrust = Math.abs(error) < 0.3 && distance(player, input.pointer) > 35;
      }
      player.angle += turn * 3.1 * dt;
      const g = gravity(player);
      player.vx += g.x * dt;
      player.vy += g.y * dt;
      thrusting = (thrust || input.down) && player.fuel > 0;
      if (thrusting) {
        const supply =
          dt > 0 ? Math.min(1, player.fuel / (profile.flow * dt)) : 1;
        const f = profile.thrust * (input.down ? -0.625 : 1) * dt * supply;
        player.vx += Math.cos(player.angle) * f;
        player.vy += Math.sin(player.angle) * f;
        const spent = Math.min(player.fuel, dt * profile.flow);
        player.fuel -= spent;
        fuelUsed += spent;
      }
      if (input.action && boost <= 0 && player.fuel >= profile.boostCost) {
        player.vx += Math.cos(player.angle) * profile.impulse;
        player.vy += Math.sin(player.angle) * profile.impulse;
        player.fuel -= profile.boostCost;
        fuelUsed += profile.boostCost;
        record(
          {
            concept: "Actuator-limited motion planning",
            event: "Boost impulse applied",
            decision: profile.name + " thrust profile",
            consequence: `Impulse changed velocity by ${profile.impulse} units/s and used ${profile.boostCost} drive units.`,
            quality: clamp(player.fuel / 100, 0, 1),
          },
          t,
        );
        boost = 1.6;
        e.emit("boost", player.x, player.y, p().cyan);
      }
      if (input.secondary && player.fuel > 0) {
        const speed = Math.hypot(player.vx, player.vy),
          supply =
            dt > 0 ? Math.min(1, player.fuel / (profile.flow * 0.75 * dt)) : 1,
          braking = Math.min(speed, profile.thrust * 0.9 * dt * supply);
        if (speed > 0) {
          player.vx *= 1 - braking / speed;
          player.vy *= 1 - braking / speed;
        }
        const spent = Math.min(player.fuel, profile.flow * 0.75 * dt);
        player.fuel -= spent;
        fuelUsed += spent;
      }
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > 260) {
        player.vx = (player.vx / speed) * 260;
        player.vy = (player.vy / speed) * 260;
      }
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      if (player.x < 20 || player.x > 940) {
        player.x = clamp(player.x, 20, 940);
        player.vx *= -0.6;
      }
      if (player.y < 65 || player.y > 520) {
        player.y = clamp(player.y, 65, 520);
        player.vy *= -0.6;
      }
      for (const b of planets) {
        const d = distance(player, b);
        if (d < b.r + 13) {
          const nx = (player.x - b.x) / Math.max(1, d),
            ny = (player.y - b.y) / Math.max(1, d);
          player.x = b.x + nx * (b.r + 15);
          player.y = b.y + ny * (b.r + 15);
          player.vx = nx * 85;
          player.vy = ny * 85;
          if (!hurt) {
            hurt = 1.2;
            e.damage(13);
            record(
              {
                concept: "Actuator-limited motion planning",
                event: "Gravity-body collision",
                decision: profile.name + " thrust profile",
                consequence: `Trajectory entered the exclusion radius; ${fuelUsed.toFixed(1)} drive units used.`,
                quality: 0,
              },
              t,
            );
            e.emit("hit", player.x, player.y, p().danger);
          }
        }
      }
      for (const a of debris) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.angle += dt * 0.5;
        if (a.x < 15) a.x = 945;
        if (a.x > 945) a.x = 15;
        if (a.y < 65) a.y = 515;
        if (a.y > 520) a.y = 65;
        if (distance(a, player) < a.r + 10 && !hurt) {
          hurt = 0.9;
          player.vx += a.vx * 0.4;
          player.vy += a.vy * 0.4;
          e.damage(v === 3 ? 8 : 5);
          record(
            {
              concept: "Actuator-limited motion planning",
              event: "Obstacle clearance lost",
              decision: profile.name + " thrust profile",
              consequence: `Debris contact at ${Math.hypot(player.vx, player.vy).toFixed(1)} units/s; ${fuelUsed.toFixed(1)} drive units used.`,
              quality: 0,
            },
            t,
          );
          e.emit("hit", player.x, player.y, p().danger);
        }
      }
      const goal = destination();
      if (v === 1) {
        const b = planets[0],
          r = distance(player, b),
          radial =
            ((player.x - b.x) * player.vx + (player.y - b.y) * player.vy) /
            Math.max(1, r),
          band = 40 - l * 7;
        if (Math.abs(r - 190) < band && Math.abs(radial) < 32) {
          progress += dt;
          stableAward += dt;
          if (stableAward >= 1.5) {
            stableAward = 0;
            e.award(
              12 * (0.6 + (0.4 * player.fuel) / 100),
              "Stable controlled trajectory",
            );
            record(
              {
                concept: "Actuator-limited motion planning",
                event: "Orbit remained inside the control band",
                decision: profile.name + " thrust profile",
                consequence: `Radial velocity ${radial.toFixed(1)} units/s; drive reserve ${player.fuel.toFixed(0)}%.`,
                quality: clamp(1 - Math.abs(radial) / 40, 0, 1),
              },
              t,
            );
            e.emit("trail", player.x, player.y, p().accent);
          }
        }
      } else if (
        distance(player, goal) < (v === 2 ? 31 : 27) &&
        (v !== 2 ||
          Math.hypot(player.vx - goal.vx, player.vy - goal.vy) <
            (input.secondary ? 40 : 28))
      ) {
        progress++;
        const legFuel = fuelUsed - legFuelStart,
          legQuality = clamp(1 - legFuel / 100, 0.35, 1);
        legFuelStart = fuelUsed;
        record(
          {
            concept: "Actuator-limited motion planning",
            event:
              v === 2
                ? "Docked within relative-speed tolerance"
                : "Trajectory gate reached",
            decision: profile.name + " thrust profile",
            consequence: `Relative speed ${Math.hypot(player.vx - goal.vx, player.vy - goal.vy).toFixed(1)} units/s; leg used ${legFuel.toFixed(1)} drive units.`,
            quality: legQuality,
          },
          t,
        );
        player.fuel = Math.min(100, player.fuel + 22);
        e.award(
          (v === 2 ? 100 : 65) * legQuality,
          v === 2 ? "Docking complete" : "Navigation gate cleared",
        );
        e.emit("collect", goal.x, goal.y, p().accent);
      }
      if (trail <= 0) {
        e.emit(
          "trail",
          player.x - Math.cos(player.angle) * 12,
          player.y - Math.sin(player.angle) * 12,
          thrusting ? p().amber : p().muted,
        );
        trail = 0.09;
      }
      e.metric(
        v === 1 ? "Stable orbit" : v === 2 ? "Dockings" : "Gates",
        `${v === 1 ? progress.toFixed(1) : progress} / ${required}${v === 1 ? " s" : ""}`,
      );
      e.metric(
        "Velocity",
        `${Math.round(Math.hypot(player.vx, player.vy))} units/s`,
      );
      e.metric("Drive reserve", `${Math.floor(player.fuel)}%`);
      const aim = destination(),
        range = Math.max(1, distance(player, aim));
      closingVelocity =
        ((aim.x - player.x) * (player.vx - aim.vx) +
          (aim.y - player.y) * (player.vy - aim.vy)) /
        range;
      stoppingDistance =
        Math.max(0, closingVelocity) ** 2 / (2 * profile.thrust * 0.9);
      report({
        time: t,
        concept: "Robotics · actuator-limited trajectory control",
        readout: `CLOSING ${closingVelocity.toFixed(1)}u/s  |  BRAKE DIST ${stoppingDistance.toFixed(1)}u  |  THRUST ${profile.thrust}u/s²  |  USED ${fuelUsed.toFixed(1)}`,
        status:
          stoppingDistance > range * 0.8 && closingVelocity > 25
            ? "danger"
            : player.fuel < 20
              ? "warning"
              : "good",
        explanation:
          stoppingDistance > range * 0.8
            ? "The remaining approach is shorter than the ideal braking distance. Counterthrust now; gravity adds further acceleration."
            : "Higher thrust changes velocity faster but consumes more drive reserve. Precision thrust supports low-speed alignment.",
        formula:
          "v_next = v + (gravity + thrust) × dt; ideal stop distance = max(0, closing speed)² / (2 × brake acceleration), ignoring gravity",
        signal: closingVelocity,
        setting: profile.thrust,
        outcome: stoppingDistance,
        outcomeLabel: "Ideal braking distance",
        unit: "units",
      });
      if (progress >= required)
        finish(
          true,
          v === 1
            ? "Stable orbital window secured"
            : v === 2
              ? "Rendezvous sequence completed"
              : "Flight objectives completed",
        );
    }
    function draw(ctx) {
      const c = p();
      backdrop(
        ctx,
        e,
        c,
        [
          "ORBIT / inertial gate flight",
          "ORBIT / stable orbital window",
          "ORBIT / rendezvous and docking",
          "ORBIT / debris navigation",
          "ORBIT / binary gravity slingshot",
        ][v],
      );
      instrument(ctx, c);
      for (const a of stars) {
        ctx.globalAlpha = 0.35 + Math.sin(t * 0.3 + a.phase) * 0.2;
        circle(ctx, a.x, a.y, a.r, c.text);
      }
      ctx.globalAlpha = 1;
      for (const b of planets) {
        ctx.strokeStyle = c.cyan;
        ctx.globalAlpha = 0.12;
        for (let r = b.r + 35; r < 260; r += 45)
          circle(ctx, b.x, b.y, r, null, c.cyan);
        ctx.globalAlpha = 1;
        circle(ctx, b.x, b.y, b.r, c.surface, c.cyan);
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.clip();
        ctx.strokeStyle = c.muted;
        ctx.globalAlpha = 0.35;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.ellipse(b.x, b.y + k * b.r * 0.27, b.r, b.r * 0.16, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
        circle(
          ctx,
          b.x - b.r * 0.28,
          b.y - b.r * 0.26,
          b.r * 0.18,
          null,
          c.muted,
        );
      }
      if (v === 1) {
        ctx.strokeStyle = c.accent;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([9, 7]);
        circle(ctx, 480, 282, 190 - 40 + l * 7, null, c.accent);
        circle(ctx, 480, 282, 190 + 40 - l * 7, null, c.accent);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      const goal = destination();
      ctx.save();
      ctx.translate(goal.x, goal.y);
      ctx.rotate(v === 2 ? 0 : t * 0.5);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 3;
      if (v === 2) {
        ctx.strokeRect(-25, -18, 50, 36);
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 27, 0.2, TAU - 0.2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(TAU / 4);
          ctx.fillStyle = c.accent;
          ctx.fillRect(32, -2, 10, 4);
        }
      }
      ctx.restore();
      text(
        ctx,
        v === 1
          ? "ORBIT WINDOW"
          : v === 2
            ? "DOCK AT LOW SPEED"
            : `GATE ${Math.floor(progress) + 1}`,
        goal.x,
        goal.y - 44,
        c.accent,
        10,
        "center",
      );
      for (const a of debris) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        ctx.strokeStyle = c.amber;
        ctx.fillStyle = c.surface;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const an = (i * TAU) / 6,
            r = a.r * (i % 2 ? 0.8 : 1.1);
          if (i === 0) ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r);
          else ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.strokeStyle = hurt > 0 ? c.danger : c.text;
      ctx.lineWidth = 2;
      ctx.fillStyle = c.surface;
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (thrusting) {
        ctx.fillStyle = c.amber;
        ctx.beginPath();
        ctx.moveTo(-9, -4);
        ctx.lineTo(-22 - Math.sin(t * 37) * 6, 0);
        ctx.lineTo(-9, 4);
        ctx.fill();
      }
      ctx.restore();
      text(
        ctx,
        "THRUST CHANGES VELOCITY • GRAVITY NEVER STOPS",
        28,
        518,
        c.muted,
        11,
      );
    }
    return { update, draw, observe, act };
  }
  return { factory, network, swarm, ecosystem, orbit };
});
