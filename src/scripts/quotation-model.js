/* Indicative, editable planning rates. Replace with Atriksha's approved rate card before offering binding prices. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaQuote = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMITS = Object.freeze({
    bytes: 20 * 1024 * 1024,
    triangles: 200000,
    dimensionMM: 5000,
    quantity: 10000,
  });
  const MATERIALS = Object.freeze({
    pla: { name: "PLA", process: "fdm", density: 1.24, rate: 1600 },
    petg: { name: "PETG", process: "fdm", density: 1.27, rate: 1800 },
    abs: { name: "ABS", process: "fdm", density: 1.04, rate: 1800 },
    aluminium: { name: "Aluminium", process: "cnc", density: 2.7, rate: 450 },
    steel: { name: "Mild steel", process: "cnc", density: 7.85, rate: 150 },
  });
  const DEFAULT_RATES = Object.freeze({
    fdm: {
      setup: 250,
      machine: 150,
      throughput: 18,
      preparation: 0.15,
      finishing: 35,
      inspection: 20,
      waste: 10,
      allowance: 0,
      shell: 1.2,
      detailTime: 0,
    },
    cnc: {
      setup: 1500,
      machine: 850,
      throughput: 45,
      preparation: 0.3,
      finishing: 150,
      inspection: 100,
      waste: 10,
      allowance: 3,
      shell: 0,
      detailTime: 0.0015,
    },
  });
  function number(value, name, min = 0, max = 1e12) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : NaN;
    if (!Number.isFinite(n) || n < min || n > max)
      throw new Error(`${name} must be between ${min} and ${max}.`);
    return n;
  }
  // Correct binary floating-point representation error at decimal half-paise boundaries.
  const roundedInteger = (value) =>
    Math.round(value + Number.EPSILON * Math.max(1, Math.abs(value)) * 4);
  const toPaise = (rupees) => roundedInteger(rupees * 100);
  function unitScale(unit) {
    const scale = { mm: 1, cm: 10, inch: 25.4 }[unit];
    if (!scale) throw new Error("Choose millimetres, centimetres, or inches.");
    return scale;
  }
  function sampleTriangles() {
    const v = [
      [0, 0, 0],
      [40, 0, 0],
      [40, 30, 0],
      [0, 30, 0],
      [0, 0, 20],
      [40, 0, 20],
      [40, 30, 20],
      [0, 30, 20],
    ];
    return Float64Array.from(
      [
        [0, 2, 1],
        [0, 3, 2],
        [4, 5, 6],
        [4, 6, 7],
        [0, 1, 5],
        [0, 5, 4],
        [1, 2, 6],
        [1, 6, 5],
        [2, 3, 7],
        [2, 7, 6],
        [3, 0, 4],
        [3, 4, 7],
      ].flatMap((t) => t.flatMap((i) => v[i])),
    );
  }
  function analyzeTriangles(triangles) {
    if (!triangles || !triangles.length || triangles.length % 9)
      throw new Error("The STL contains incomplete triangles.");
    const count = triangles.length / 9;
    if (count > LIMITS.triangles)
      throw new Error(
        "This mesh exceeds 200,000 triangles. Export a lighter STL.",
      );
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < triangles.length; i++) {
      const value = number(triangles[i], "Mesh coordinate", -1e9, 1e9),
        axis = i % 3;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
    const dimensions = max.map((x, i) => x - min[i]);
    const largest = Math.max(...dimensions);
    if (!largest || dimensions.some((v) => v <= 0))
      throw new Error(
        "This mesh has no three-dimensional volume. Enter the intended dimensions instead.",
      );
    const tolerance = largest * 1e-8;
    const key = (p) =>
      p.map((x, i) => Math.round((x - min[i]) / tolerance)).join(",");
    const origin = min.map((v, i) => v + dimensions[i] / 2);
    const edgeMap = new Map();
    const parents = Int32Array.from({ length: count }, (_, i) => i);
    const find = (n) => {
      while (parents[n] !== n) {
        parents[n] = parents[parents[n]];
        n = parents[n];
      }
      return n;
    };
    let area = 0,
      signedVolume = 0,
      compensation = 0,
      degenerate = false;
    for (let t = 0; t < count; t++) {
      const p = [0, 1, 2].map((i) =>
        Array.from(triangles.slice(t * 9 + i * 3, t * 9 + i * 3 + 3)),
      );
      const a = p[1].map((x, i) => x - p[0][i]),
        b = p[2].map((x, i) => x - p[0][i]);
      const cross = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const twiceArea = Math.hypot(...cross);
      if (twiceArea <= largest * largest * 1e-12) degenerate = true;
      area += twiceArea / 2;
      const q = p[0].map((x, i) => x - origin[i]);
      const term =
        (q[0] * cross[0] + q[1] * cross[1] + q[2] * cross[2]) / 6 -
        compensation;
      const next = signedVolume + term;
      compensation = next - signedVolume - term;
      signedVolume = next;
      const keys = p.map(key);
      for (let i = 0; i < 3; i++) {
        const from = keys[i],
          to = keys[(i + 1) % 3],
          id = from < to ? `${from}|${to}` : `${to}|${from}`;
        const direction = from < to ? 1 : -1;
        const edge = edgeMap.get(id);
        if (edge) {
          edge.count++;
          edge.direction += direction;
          parents[find(t)] = find(edge.triangle);
        } else edgeMap.set(id, { count: 1, direction, triangle: t });
      }
    }
    const issues = [];
    if (degenerate) issues.push("degenerate triangles");
    if ([...edgeMap.values()].some((e) => e.count === 1))
      issues.push("open edges");
    if ([...edgeMap.values()].some((e) => e.count > 2))
      issues.push("non-manifold edges");
    if ([...edgeMap.values()].some((e) => e.count === 2 && e.direction !== 0))
      issues.push("inconsistent face orientation");
    const components = new Set(Array.from(parents, (_, i) => find(i))).size;
    if (components !== 1) issues.push("multiple separate shells");
    const volume = Math.abs(signedVolume),
      envelope = dimensions.reduce((a, b) => a * b, 1);
    if (
      !Number.isFinite(volume) ||
      volume <= envelope * 1e-10 ||
      volume > envelope * (1 + 1e-6)
    )
      issues.push("unreliable enclosed volume");
    return {
      triangles,
      triangleCount: count,
      min,
      max,
      dimensions,
      area,
      volume: issues.length ? null : volume,
      valid: issues.length === 0,
      issues,
    };
  }
  function parseSTL(buffer) {
    if (!(buffer instanceof ArrayBuffer))
      throw new Error(
        "The STL could not be read. Please select the file again.",
      );
    if (buffer.byteLength > LIMITS.bytes)
      throw new Error("Keep the file under 20 MB. Export a lighter STL.");
    if (buffer.byteLength < 15)
      throw new Error("This file does not contain a readable STL model.");
    const view = new DataView(buffer);
    let triangles;
    const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
    if (buffer.byteLength >= 84 && 84 + count * 50 === buffer.byteLength) {
      if (!count || count > LIMITS.triangles)
        throw new Error("Use an STL with 1 to 200,000 triangles.");
      triangles = new Float64Array(count * 9);
      for (let t = 0; t < count; t++)
        for (let n = 0; n < 9; n++)
          triangles[t * 9 + n] = view.getFloat32(
            84 + t * 50 + 12 + n * 4,
            true,
          );
    } else {
      const text = new TextDecoder().decode(buffer).trim();
      if (
        !/^solid(?:\s|$)/i.test(text) ||
        !/\bendsolid(?:\s[^\n]*)?\s*$/i.test(text)
      )
        throw new Error(
          "This STL is incomplete or unsupported. Re-export a binary or ASCII STL.",
        );
      const values = [];
      const numeric = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?";
      const vertex = `vertex\\s+(${numeric})\\s+(${numeric})\\s+(${numeric})`;
      const facet = new RegExp(
        `facet\\s+normal\\s+${numeric}\\s+${numeric}\\s+${numeric}\\s+outer\\s+loop\\s+${vertex}\\s+${vertex}\\s+${vertex}\\s+endloop\\s+endfacet`,
        "gi",
      );
      let match,
        end = 0,
        facets = 0;
      const body = text
        .replace(/^solid[^\r\n]*(?:\r?\n|$)/i, "")
        .replace(/\bendsolid[^\r\n]*\s*$/i, "");
      while ((match = facet.exec(body))) {
        if (body.slice(end, match.index).trim())
          throw new Error(
            "The ASCII STL has malformed triangle records. Re-export the model.",
          );
        for (let i = 1; i <= 9; i++) values.push(Number(match[i]));
        end = facet.lastIndex;
        if (++facets > LIMITS.triangles)
          throw new Error(
            "This mesh exceeds 200,000 triangles. Export a lighter STL.",
          );
      }
      if (!facets || body.slice(end).trim())
        throw new Error(
          "The ASCII STL has incomplete triangle records. Re-export the model.",
        );
      triangles = Float64Array.from(values);
    }
    return analyzeTriangles(triangles);
  }
  function scaleGeometry(mesh, unit) {
    if (!mesh.valid || mesh.volume === null)
      throw new Error(
        "A closed, consistently oriented single mesh is needed. Enter geometry manually.",
      );
    const scale = unitScale(unit);
    const geometry = {
      dimensions: mesh.dimensions.map((v) => v * scale),
      volume: (mesh.volume * scale ** 3) / 1000,
      area: (mesh.area * scale ** 2) / 100,
      source: "stl",
    };
    validateGeometry(geometry);
    return geometry;
  }
  function manualGeometry(dimensions, unit, volume) {
    const scale = unitScale(unit);
    const d = dimensions.map(
      (v) => number(v, "Dimension", 0.001, LIMITS.dimensionMM) * scale,
    );
    const geometry = {
      dimensions: d,
      volume:
        volume === "" || volume === undefined || volume === null
          ? d.reduce((a, b) => a * b, 1) / 1000
          : number(volume, "Solid volume (cm³)", 0.000001),
      area: (2 * (d[0] * d[1] + d[0] * d[2] + d[1] * d[2])) / 100,
      source:
        volume === "" || volume === undefined || volume === null
          ? "envelope"
          : "manual",
    };
    validateGeometry(geometry);
    return geometry;
  }
  function validateGeometry(g) {
    if (!g || !Array.isArray(g.dimensions) || g.dimensions.length !== 3)
      throw new Error("Enter all three dimensions.");
    g.dimensions.forEach((v) =>
      number(v, "Dimension (mm)", 0.001, LIMITS.dimensionMM),
    );
    const envelope = g.dimensions.reduce((a, b) => a * b, 1) / 1000;
    number(g.volume, "Solid volume (cm³)", 0.000001, envelope * (1 + 1e-6));
    number(g.area, "Surface area (cm²)", 0.000001);
  }
  function calculateQuote(input) {
    const { geometry: g, process, material } = input;
    validateGeometry(g);
    const mat = MATERIALS[material];
    if (!DEFAULT_RATES[process] || !mat || mat.process !== process)
      throw new Error("Choose a material compatible with this process.");
    const quantity = number(input.quantity, "Quantity", 1, LIMITS.quantity);
    if (!Number.isInteger(quantity))
      throw new Error("Quantity must be a whole number.");
    const r = { ...DEFAULT_RATES[process], ...input.rates };
    for (const key of Object.keys(DEFAULT_RATES[process]))
      r[key] = number(
        r[key],
        `${key} rate`,
        key === "throughput" ? 0.01 : 0,
        1e6,
      );
    if (r.waste > 100 || r.allowance > 100 || r.shell > 10)
      throw new Error("Check the waste, stock allowance, and shell values.");
    const materialRate = number(
      input.materialRate === undefined ? mat.rate : input.materialRate,
      "Material rate",
      0,
      1e6,
    );
    const taxPercent = number(
      input.taxPercent === undefined ? 0 : input.taxPercent,
      "Tax percentage",
      0,
      100,
    );
    const infill = number(
      input.infill === undefined ? 25 : input.infill,
      "Infill percentage",
      5,
      100,
    );
    const support = number(
      input.support === undefined ? 10 : input.support,
      "Support allowance",
      0,
      100,
    );
    let purchaseVolume,
      processVolume,
      hours,
      stockVolume = 0;
    if (process === "fdm") {
      const shell = Math.min(g.volume, (g.area * r.shell) / 10);
      processVolume =
        (shell + ((g.volume - shell) * infill) / 100) * (1 + support / 100);
      purchaseVolume = processVolume * (1 + r.waste / 100);
      hours = r.preparation + processVolume / r.throughput;
    } else {
      stockVolume =
        g.dimensions.reduce(
          (product, d) => product * (d + 2 * r.allowance),
          1,
        ) / 1000;
      processVolume = Math.max(0, stockVolume - g.volume);
      purchaseVolume = stockVolume * (1 + r.waste / 100);
      hours =
        r.preparation + processVolume / r.throughput + g.area * r.detailTime;
    }
    const massGrams = purchaseVolume * mat.density;
    const paise = toPaise;
    const lines = [
      {
        key: "material",
        label:
          process === "fdm"
            ? "Material + waste allowance"
            : "Raw stock + waste allowance",
        paise: paise((massGrams / 1000) * materialRate * quantity),
      },
      { key: "setup", label: "Setup · once per order", paise: paise(r.setup) },
      {
        key: "machine",
        label: "Machine time",
        paise: paise(hours * r.machine * quantity),
      },
      {
        key: "finishing",
        label: "Finishing",
        paise: paise(input.finishing ? r.finishing * quantity : 0),
      },
      {
        key: "inspection",
        label: "Basic inspection",
        paise: paise(r.inspection * quantity),
      },
    ];
    const subtotalPaise = lines.reduce((s, l) => s + l.paise, 0);
    const taxPaise = roundedInteger((subtotalPaise * taxPercent) / 100),
      totalPaise = subtotalPaise + taxPaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise > 1e12)
      throw new Error(
        "This estimate is too large for the calculator. Request a reviewed quote.",
      );
    return {
      process,
      material,
      materialName: mat.name,
      quantity,
      geometry: g,
      rates: r,
      materialRate,
      taxPercent,
      infill,
      support,
      finishing: Boolean(input.finishing),
      massGrams,
      hoursPerPart: hours,
      processVolume,
      stockVolume,
      lines,
      subtotalPaise,
      taxPaise,
      totalPaise,
      perPartPaise: Math.round(totalPaise / quantity),
    };
  }
  const DESIGN_RATES = Object.freeze({
    hourly: 800,
    briefing: 1,
    drawing: 1.5,
    revision: 0.5,
    review: 0.5,
    simple: 2,
    moderate: 5,
    complex: 12,
  });
  function calculateDesignQuote(input) {
    const parts = number(input.parts, "Distinct parts", 1, 100);
    const drawings = number(input.drawings, "Technical drawings", 0, 200);
    const revisions = number(input.revisions, "Revision rounds", 0, 10);
    if (![parts, drawings, revisions].every(Number.isInteger))
      throw new Error(
        "Parts, drawings and revision rounds must be whole numbers.",
      );
    if (!["simple", "moderate", "complex"].includes(input.complexity))
      throw new Error("Choose a design complexity.");
    const rates = { ...DESIGN_RATES, ...input.rates };
    for (const key of Object.keys(DESIGN_RATES))
      rates[key] = number(
        rates[key],
        `${key} rate`,
        0,
        key === "hourly" ? 1000000 : 1000,
      );
    const taxPercent = number(
      input.taxPercent === undefined ? 0 : input.taxPercent,
      "Tax percentage",
      0,
      100,
    );
    const line = (key, label, hours) => ({
      key,
      label,
      hours,
      paise: toPaise(hours * rates.hourly),
    });
    const lines = [
      line("briefing", "Brief & requirements", rates.briefing),
      line("modeling", "3D CAD modeling", parts * rates[input.complexity]),
      line("drawings", "Technical drawings", drawings * rates.drawing),
      line(
        "revisions",
        "Revision allowance",
        revisions * parts * rates.revision,
      ),
      line("review", "Design review", parts * rates.review),
    ];
    const subtotalPaise = lines.reduce((sum, item) => sum + item.paise, 0);
    const taxPaise = roundedInteger((subtotalPaise * taxPercent) / 100);
    const totalPaise = subtotalPaise + taxPaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise > 1e12)
      throw new Error(
        "This estimate is too large for the calculator. Request a reviewed quote.",
      );
    return {
      type: "design",
      parts,
      drawings,
      revisions,
      complexity: input.complexity,
      rates,
      taxPercent,
      lines,
      totalHours: lines.reduce((sum, item) => sum + item.hours, 0),
      subtotalPaise,
      taxPaise,
      totalPaise,
    };
  }
  return {
    LIMITS,
    MATERIALS,
    DEFAULT_RATES,
    DESIGN_RATES,
    unitScale,
    sampleTriangles,
    analyzeTriangles,
    parseSTL,
    scaleGeometry,
    manualGeometry,
    calculateQuote,
    calculateDesignQuote,
  };
});
