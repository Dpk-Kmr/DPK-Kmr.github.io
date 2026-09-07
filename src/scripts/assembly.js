(() => {
  "use strict";

  const canvas = document.getElementById("assembly-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const explodeInput = document.getElementById("assembly-explode");
  const rotationButton = document.getElementById("assembly-rotate");
  const resetButton = document.getElementById("assembly-reset");
  const modeButtons = [...document.querySelectorAll("[data-assembly-mode]")];
  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const TAU = Math.PI * 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const normalize = (v) => {
    const length = Math.hypot(...v) || 1;
    return v.map((n) => n / length);
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const subtract = (a, b) => a.map((n, i) => n - b[i]);
  const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
  const polar = (radius, angle, y) => [
    radius * Math.cos(angle),
    y,
    radius * Math.sin(angle),
  ];
  const light = normalize([-0.55, 0.8, 0.9]);
  const halfLight = normalize([light[0], light[1], light[2] + 1]);

  let width = 1;
  let height = 1;
  let scale = 1;
  let yaw = -0.36;
  let pitch = 0.65;
  let roll = -0.32;
  let explode = clamp(Number(explodeInput?.value ?? 35) / 100, 0, 1);
  let rotating = true;
  let globalPaused = document.documentElement.dataset.motion === "paused";
  let visible = true;
  let dragging = false;
  let pointer = null;
  let wireframe = false;
  let frame = 0;
  let previousTime = 0;
  let dirty = true;
  let faces = [];
  let transform = null;
  let extent = 1;
  const readPalette = () => {
    const style = getComputedStyle(document.documentElement);
    const rgb = (name) => {
      const value = style.getPropertyValue(name).trim().replace("#", "");
      return [0, 2, 4].map((index) =>
        parseInt(value.slice(index, index + 2), 16),
      );
    };
    return {
      accent: rgb("--accent"),
      muted: rgb("--muted"),
      background: rgb("--bg"),
      light: document.documentElement.dataset.colorScheme === "light",
    };
  };
  let palette = readPalette();
  const paletteColor = (name, opacity) =>
    `rgba(${palette[name].join(",")},${opacity})`;

  // Geometry stays in model space. Only the camera transform changes per frame.
  function face(vertices, material = "silver", shade = 1) {
    const normal = normalize(
      cross(
        subtract(vertices[1], vertices[0]),
        subtract(vertices[2], vertices[0]),
      ),
    );
    const center = vertices[0].map(
      (_, i) => vertices.reduce((sum, p) => sum + p[i], 0) / vertices.length,
    );
    faces.push({ vertices, normal, center, material, shade });
  }

  function annulus(
    y,
    outer,
    inner,
    thickness,
    material = "silver",
    segments = 64,
    inlays = [],
    rimMaterial = null,
  ) {
    const bevel = Math.min(thickness * 0.22, 0.019, (outer - inner) * 0.15);
    const top = y + thickness / 2;
    const bottom = y - thickness / 2;
    // Walking from the inside of the top face to the outer wall and underside
    // gives each machined edge its own, physically oriented light response.
    const profile = [
      [inner + bevel, top],
      [outer - bevel, top],
      [outer, top - bevel],
      [outer, bottom + bevel],
      [outer - bevel, bottom],
      [inner + bevel, bottom],
      [inner, bottom + bevel],
      [inner, top - bevel],
    ];
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * TAU;
      const b = ((i + 1) / segments) * TAU;
      for (let j = 0; j < profile.length; j += 1) {
        const p = profile[j];
        const q = profile[(j + 1) % profile.length];
        const brushed = 1 + Math.sin(i * 2.399 + j * 0.8) * 0.006;
        if (j === 0 && inlays.length) {
          const radii = [
            p[0],
            ...inlays.flatMap((inlay) => [inlay.inner, inlay.outer]),
            q[0],
          ].sort((r1, r2) => r1 - r2);
          for (let band = 0; band < radii.length - 1; band += 1) {
            const r1 = radii[band];
            const r2 = radii[band + 1];
            if (r2 - r1 < 0.0001) continue;
            const midpoint = (r1 + r2) / 2;
            const inlay = inlays.find(
              (item) => midpoint > item.inner && midpoint < item.outer,
            );
            const bandMaterial =
              inlay && (!inlay.slots || i % 4 === 0)
                ? inlay.material
                : material;
            face(
              [
                polar(r1, a, top),
                polar(r1, b, top),
                polar(r2, b, top),
                polar(r2, a, top),
              ],
              bandMaterial,
              brushed,
            );
          }
        } else {
          face(
            [
              polar(p[0], a, p[1]),
              polar(p[0], b, p[1]),
              polar(q[0], b, q[1]),
              polar(q[0], a, q[1]),
            ],
            j === 2 && rimMaterial ? rimMaterial : material,
            brushed,
          );
        }
      }
    }
  }

  function cylinder(
    x,
    y,
    z,
    radius,
    length,
    material = "silver",
    segments = 20,
  ) {
    const top = y + length / 2;
    const bottom = y - length / 2;
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * TAU;
      const b = ((i + 1) / segments) * TAU;
      const v = (angle, py, r = radius) => [
        x + r * Math.cos(angle),
        py,
        z + r * Math.sin(angle),
      ];
      const steps = Math.max(1, Math.ceil(length / 0.15));
      for (let step = 0; step < steps; step += 1) {
        const y1 = bottom + ((top - radius * 0.1 - bottom) * step) / steps;
        const y2 =
          bottom + ((top - radius * 0.1 - bottom) * (step + 1)) / steps;
        face([v(a, y1), v(a, y2), v(b, y2), v(b, y1)], material);
      }
      face(
        [
          v(a, top - radius * 0.1),
          v(a, top, radius * 0.9),
          v(b, top, radius * 0.9),
          v(b, top - radius * 0.1),
        ],
        material,
        1.14,
      );
      face(
        [[x, top, z], v(b, top, radius * 0.9), v(a, top, radius * 0.9)],
        material,
        1.1,
      );
      face([[x, bottom, z], v(a, bottom), v(b, bottom)], material, 0.75);
    }
  }

  function bolt(y, radius, angle, size = 0.041) {
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    cylinder(x, y, z, size, size * 0.65, "graphite", 6);
    cylinder(x, y + size * 0.34, z, size * 0.4, 0.006, "black", 6);
  }

  function blade(y, angle) {
    const lower = [
      polar(0.46, angle, y),
      polar(0.48, angle + 0.045, y),
      polar(1.055, angle + 0.285, y),
      polar(1.055, angle + 0.23, y),
    ];
    const upper = [
      polar(0.46, angle + 0.055, y + 0.205),
      polar(0.48, angle + 0.1, y + 0.205),
      polar(1.025, angle + 0.34, y + 0.13),
      polar(1.025, angle + 0.285, y + 0.13),
    ];
    face([upper[0], upper[1], upper[2], upper[3]], "silver", 1.14);
    for (let j = 0; j < 4; j += 1) {
      const k = (j + 1) % 4;
      face(
        [lower[j], lower[k], upper[k], upper[j]],
        "silver",
        j % 2 ? 0.76 : 1.05,
      );
    }
  }

  function build() {
    faces = [];
    const gap = 0.84 + explode * 1.82;
    const base = -0.72 * gap;
    const stator = -0.22 * gap;
    const turbine = 0.28 * gap;
    const cap = 0.82 * gap;
    extent = Math.max(Math.abs(base - 0.25), cap + 0.28);

    cylinder(
      0,
      (base + cap) / 2 + 0.02,
      0,
      0.185,
      cap - base + 0.49,
      "shaft",
      64,
    );
    annulus(base - 0.07, 0.79, 0.255, 0.19, "graphite");
    annulus(base + 0.045, 0.91, 0.255, 0.085);
    annulus(base - 0.105, 0.802, 0.78, 0.024, "lime");
    annulus(base + 0.097, 0.67, 0.57, 0.022, "graphite");
    annulus(base + 0.13, 0.35, 0.19, 0.11, "shaft", 56);
    for (let i = 0; i < 12; i += 1)
      bolt(base + 0.102, 0.79, (i / 12) * TAU, 0.032);

    annulus(stator, 1.155, 0.285, 0.105, "silver", 96, [
      { inner: 1.019, outer: 1.045, material: "graphite" },
      { inner: 0.764, outer: 0.78, material: "graphite" },
      { inner: 0.83, outer: 0.97, material: "black", slots: true },
    ]);
    annulus(stator - 0.008, 1.168, 1.145, 0.033, "graphite");
    annulus(stator + 0.06, 0.42, 0.215, 0.09, "shaft", 56);
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * TAU;
      if (i % 3 === 0) bolt(stator + 0.068, 0.62, a, 0.035);
    }

    annulus(turbine, 1.09, 0.285, 0.09, "graphite", 80, [], "lime");
    annulus(turbine + 0.049, 1.091, 1.054, 0.018, "silver");
    for (let i = 0; i < 28; i += 1) blade(turbine + 0.048, (i / 28) * TAU);
    annulus(turbine + 0.11, 0.465, 0.285, 0.22, "shaft", 64);
    annulus(turbine + 0.23, 0.468, 0.28, 0.025, "silver", 64);

    annulus(
      cap,
      0.855,
      0.295,
      0.14,
      "silver",
      80,
      [
        { inner: 0.748, outer: 0.765, material: "graphite" },
        { inner: 0.525, outer: 0.535, material: "graphite" },
        { inner: 0.417, outer: 0.43, material: "lime" },
      ],
      "lime",
    );
    for (let i = 0; i < 8; i += 1)
      bolt(cap + 0.09, 0.65, (i / 8) * TAU + Math.PI / 8, 0.046);
    annulus(cap + 0.14, 0.275, 0.19, 0.13, "shaft", 56);
    cylinder(0, cap + 0.282, 0, 0.16, 0.024, "lime", 40);
    dirty = true;
  }

  function updateTransform() {
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw);
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const cr = Math.cos(roll),
      sr = Math.sin(roll);
    transform = (v) => {
      const x = v[0] * cy + v[2] * sy;
      const z = -v[0] * sy + v[2] * cy;
      const rx = x * cr - v[1] * sr;
      const ry = x * sr + v[1] * cr;
      return [rx, ry * cp - z * sp, ry * sp + z * cp];
    };
    scale = Math.min(width * 0.32, height / (3.63 + explode * 2.1));
  }

  function project(v) {
    const perspective = 8 / (8 - v[2]);
    return [
      width * 0.5 + v[0] * scale * perspective,
      height * 0.49 - v[1] * scale * perspective,
    ];
  }

  function line3d(points, color, lineWidth = 1, dashed = false) {
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = project(transform(p));
      if (i === 0) ctx.moveTo(q[0], q[1]);
      else ctx.lineTo(q[0], q[1]);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (dashed) ctx.setLineDash([3, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function guides() {
    const floor = -0.72 * (0.84 + explode * 1.82) - 0.3;
    for (const radius of [1.35, 1.56]) {
      const points = Array.from({ length: 97 }, (_, i) =>
        polar(radius, (i / 96) * TAU, floor),
      );
      line3d(points, paletteColor("muted", 0.14), 0.7);
    }
    for (let i = 0; i < 32; i += 1) {
      const a = (i / 32) * TAU;
      line3d(
        [polar(1.52, a, floor), polar(i % 4 === 0 ? 1.62 : 1.56, a, floor)],
        paletteColor("muted", 0.27),
        0.7,
      );
    }
    line3d(
      [
        [0, -extent - 0.23, 0],
        [0, extent + 0.35, 0],
      ],
      paletteColor("accent", 0.22),
      0.8,
      true,
    );
    line3d(
      [
        [-1.77, floor, 0],
        [1.77, floor, 0],
      ],
      paletteColor("muted", 0.12),
      0.7,
    );
    line3d(
      [
        [0, floor, -1.77],
        [0, floor, 1.77],
      ],
      paletteColor("muted", 0.12),
      0.7,
    );
  }

  function materialColor(material, normal, variation) {
    const diffuse = Math.max(0, dot(normal, light));
    const specular = Math.pow(
      Math.max(0, dot(normal, halfLight)),
      material === "shaft" ? 55 : 26,
    );
    const ambient = 0.44 + Math.max(0, normal[1]) * 0.16;
    const brightness = (ambient + diffuse * 0.51) * variation;
    let base;
    let shine = 55;
    switch (material) {
      case "lime":
        base = palette.accent;
        shine = 19;
        break;
      case "black":
        base = [18, 23, 19];
        shine = 4;
        break;
      case "graphite":
        base = [71, 79, 70];
        shine = 39;
        break;
      case "shaft":
        base = [148, 161, 151];
        shine = 100;
        break;
      default:
        base = [206, 216, 207];
    }
    return `rgb(${base.map((c) => Math.round(clamp(c * brightness + specular * shine, 0, 255))).join(",")})`;
  }

  function render() {
    dirty = false;
    ctx.clearRect(0, 0, width, height);
    updateTransform();
    // A soft, stationary ambient pool grounds the floating exploded assembly.
    const glow = ctx.createRadialGradient(
      width * 0.48,
      height * 0.52,
      scale * 0.12,
      width * 0.48,
      height * 0.52,
      scale * 1.78,
    );
    glow.addColorStop(0, paletteColor("accent", 0.05));
    glow.addColorStop(1, paletteColor("accent", 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    guides();

    const visibleFaces = [];
    for (const f of faces) {
      const center = transform(f.center);
      const normal = transform(f.normal);
      if (dot(normal, [-center[0], -center[1], 8 - center[2]]) <= 0) continue;
      visibleFaces.push({ f, normal, depth: center[2] });
    }
    visibleFaces.sort((a, b) => a.depth - b.depth);
    for (const item of visibleFaces) {
      const { f, normal } = item;
      ctx.beginPath();
      for (let i = 0; i < f.vertices.length; i += 1) {
        const p = project(transform(f.vertices[i]));
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      if (wireframe) {
        ctx.fillStyle = paletteColor("background", 0.88);
        ctx.strokeStyle =
          f.material === "lime"
            ? paletteColor("accent", 0.85)
            : paletteColor("muted", palette.light ? 0.8 : 0.5);
        ctx.lineWidth = 0.55;
      } else {
        ctx.fillStyle = materialColor(f.material, normal, f.shade);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.45;
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  const animationAllowed = () =>
    rotating &&
    !globalPaused &&
    !motionPreference.matches &&
    !document.hidden &&
    visible &&
    !dragging;

  function schedule() {
    if (!frame && (dirty || animationAllowed()))
      frame = requestAnimationFrame(tick);
  }

  function tick(time) {
    frame = 0;
    const elapsed = previousTime ? Math.min(time - previousTime, 50) : 16;
    previousTime = time;
    if (animationAllowed()) {
      yaw += elapsed * 0.000062;
      dirty = true;
    }
    if (dirty) render();
    if (animationAllowed()) schedule();
    else previousTime = 0;
  }

  function rotationState() {
    if (!rotationButton) return;
    const motionBlocked = globalPaused || motionPreference.matches;
    const running = rotating && !motionBlocked;
    const text = motionBlocked
      ? "Motion paused"
      : running
        ? "Pause rotation"
        : "Resume rotation";
    rotationButton.disabled = motionBlocked;
    rotationButton.setAttribute("aria-pressed", String(running));
    rotationButton.setAttribute("aria-label", text);
    rotationButton.title = motionPreference.matches
      ? "Automatic rotation respects your reduced-motion preference. Drag or use arrow keys to explore."
      : globalPaused
        ? "Enable motion with the site motion control to resume automatic rotation."
        : "Drag the assembly or use arrow keys to rotate it manually.";
    const label = rotationButton.querySelector("[data-rotation-label]");
    if (label) label.textContent = text;
    else
      rotationButton.innerHTML = `<span aria-hidden="true">${running ? "Ⅱ" : "▶"}</span>`;
  }

  function setExplode() {
    explode = clamp(Number(explodeInput?.value ?? 35) / 100, 0, 1);
    document.querySelectorAll("[data-assembly-value]").forEach((output) => {
      output.textContent = `${Math.round(explode * 100)}%`;
    });
    build();
    schedule();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width;
    height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
    schedule();
  }

  canvas.style.cursor = "grab";
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !pointer || event.pointerId !== pointer.id) return;
    yaw += (event.clientX - pointer.x) * 0.009;
    pitch = clamp(pitch + (event.clientY - pointer.y) * 0.005, 0.12, 1.22);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    dirty = true;
    schedule();
  });
  function endDrag(event) {
    if (pointer && event.pointerId !== pointer.id) return;
    dragging = false;
    pointer = null;
    canvas.style.cursor = "grab";
    schedule();
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);
  canvas.addEventListener("keydown", (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    if (event.key === "ArrowLeft") yaw -= 0.12;
    if (event.key === "ArrowRight") yaw += 0.12;
    if (event.key === "ArrowUp") pitch = clamp(pitch - 0.08, 0.12, 1.22);
    if (event.key === "ArrowDown") pitch = clamp(pitch + 0.08, 0.12, 1.22);
    dirty = true;
    schedule();
  });
  explodeInput?.addEventListener("input", setExplode);
  rotationButton?.addEventListener("click", () => {
    rotating = !rotating;
    rotationState();
    schedule();
  });
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      wireframe = button.dataset.assemblyMode === "wireframe";
      modeButtons.forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      dirty = true;
      schedule();
    });
  });
  resetButton?.addEventListener("click", () => {
    yaw = -0.36;
    pitch = 0.65;
    roll = -0.32;
    wireframe = false;
    rotating = true;
    if (explodeInput) explodeInput.value = "35";
    modeButtons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.assemblyMode === "solid"),
      ),
    );
    rotationState();
    setExplode();
  });
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("atriksha:theme", () => {
    palette = readPalette();
    dirty = true;
    schedule();
  });
  window.addEventListener("atriksha:motion", (event) => {
    globalPaused = Boolean(event.detail?.paused);
    rotationState();
    schedule();
  });
  motionPreference.addEventListener("change", () => {
    rotationState();
    schedule();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        schedule();
      },
      { rootMargin: "80px" },
    ).observe(canvas);
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);

  setExplode();
  rotationState();
  resize();
})();
