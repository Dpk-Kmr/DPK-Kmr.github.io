const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/scripts/quotation-model.js");
const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}`,
  );
const sample = () => M.analyzeTriangles(M.sampleTriangles());
const geometry = () => M.scaleGeometry(sample(), "mm");
const manufacturing = (options = {}) =>
  M.calculateQuote({
    geometry: geometry(),
    process: "fdm",
    material: "pla",
    quantity: 1,
    finishing: true,
    ...options,
  });
const design = (options = {}) =>
  M.calculateDesignQuote({
    parts: 1,
    complexity: "simple",
    drawings: 1,
    revisions: 1,
    ...options,
  });
function binarySTL(triangles) {
  const buffer = new ArrayBuffer(84 + (triangles.length / 9) * 50),
    view = new DataView(buffer);
  new Uint8Array(buffer).set(new TextEncoder().encode("solid binary header"));
  view.setUint32(80, triangles.length / 9, true);
  for (let t = 0; t < triangles.length / 9; t++)
    for (let n = 0; n < 9; n++)
      view.setFloat32(84 + t * 50 + 12 + n * 4, triangles[t * 9 + n], true);
  return buffer;
}
function asciiSTL(triangles) {
  let text = "solid block\n";
  for (let t = 0; t < triangles.length / 9; t++)
    text += `facet normal 0 0 0\nouter loop\n${[0, 1, 2].map((i) => `vertex ${Array.from(triangles.slice(t * 9 + i * 3, t * 9 + i * 3 + 3)).join(" ")}`).join("\n")}\nendloop\nendfacet\n`;
  return new TextEncoder().encode(text + "endsolid block\n").buffer;
}
test("closed block reports true dimensions, area and volume", () => {
  const g = sample();
  assert.equal(g.valid, true);
  assert.deepEqual(g.dimensions, [40, 30, 20]);
  close(g.volume, 24000);
  close(g.area, 5200);
});
test("binary STL is decoded even when header begins solid", () => {
  const g = M.parseSTL(binarySTL(M.sampleTriangles()));
  assert.equal(g.valid, true);
  close(g.volume, 24000);
});
test("ASCII STL is decoded with normals and triangle structure", () => {
  const g = M.parseSTL(asciiSTL(M.sampleTriangles()));
  assert.equal(g.valid, true);
  close(g.volume, 24000);
});
test("volume is stable after a large translation", () => {
  const g = M.analyzeTriangles(M.sampleTriangles().map((x) => x + 1e8));
  assert.equal(g.valid, true);
  close(g.volume, 24000);
});
test("uniformly reversed winding preserves absolute solid volume", () => {
  const p = M.sampleTriangles();
  for (let i = 0; i < p.length; i += 9)
    for (let j = 0; j < 3; j++)
      [p[i + 3 + j], p[i + 6 + j]] = [p[i + 6 + j], p[i + 3 + j]];
  const g = M.analyzeTriangles(p);
  assert.equal(g.valid, true);
  close(g.volume, 24000);
});
test("one reversed face is rejected for inconsistent orientation", () => {
  const p = M.sampleTriangles();
  for (let j = 0; j < 3; j++) [p[j + 3], p[j + 6]] = [p[j + 6], p[j + 3]];
  const g = M.analyzeTriangles(p);
  assert.equal(g.valid, false);
  assert.equal(g.volume, null);
  assert.ok(g.issues.includes("inconsistent face orientation"));
});
test("open mesh has no usable automatic volume", () => {
  const g = M.analyzeTriangles(M.sampleTriangles().slice(9));
  assert.equal(g.valid, false);
  assert.equal(g.volume, null);
  assert.ok(g.issues.includes("open edges"));
  assert.throws(() => M.scaleGeometry(g, "mm"));
});
test("duplicate triangles trigger non-manifold rejection", () => {
  const p = M.sampleTriangles();
  const g = M.analyzeTriangles(Float64Array.from([...p, ...p.slice(0, 9)]));
  assert.equal(g.valid, false);
  assert.ok(g.issues.includes("non-manifold edges"));
});
test("degenerate facets cannot produce a quote", () => {
  const p = M.sampleTriangles();
  p.set(p.slice(0, 3), 3);
  const g = M.analyzeTriangles(p);
  assert.equal(g.valid, false);
  assert.ok(g.issues.includes("degenerate triangles"));
});
test("two disconnected solids are flagged for manual review", () => {
  const p = M.sampleTriangles(),
    second = p.map((v, i) => v + (i % 3 === 0 ? 100 : 0));
  const g = M.analyzeTriangles(Float64Array.from([...p, ...second]));
  assert.equal(g.valid, false);
  assert.ok(g.issues.includes("multiple separate shells"));
});
test("nonfinite and unreasonable mesh coordinates are rejected", () => {
  for (const n of [NaN, Infinity, 1e10]) {
    const p = M.sampleTriangles();
    p[0] = n;
    assert.throws(() => M.analyzeTriangles(p));
  }
});
test("malformed ASCII vertices and trailing junk are rejected", () => {
  for (const s of [
    "solid\nvertex 0 0 0\nendsolid",
    "solid\nfacet normal 0 0 1\nouter loop\nvertex NaN 0 0\nendloop\nendfacet\nendsolid",
    "solid\nendsolid\njunk",
  ])
    assert.throws(() => M.parseSTL(new TextEncoder().encode(s).buffer));
});
test("truncated binary and empty uploads are rejected", () => {
  assert.throws(() => M.parseSTL(binarySTL(M.sampleTriangles()).slice(0, -1)));
  assert.throws(() => M.parseSTL(new ArrayBuffer(0)));
});
test("oversized files and excess triangle counts are rejected before decoding", () => {
  assert.throws(() => M.parseSTL(new ArrayBuffer(M.LIMITS.bytes + 1)), /20 MB/);
  const buffer = new ArrayBuffer(84 + (M.LIMITS.triangles + 1) * 50);
  new DataView(buffer).setUint32(80, M.LIMITS.triangles + 1, true);
  assert.throws(() => M.parseSTL(buffer), /200,000/);
});
test("unit conversion scales volume cubically and area quadratically", () => {
  const mm = geometry(),
    cm = M.scaleGeometry(sample(), "cm"),
    inch = M.scaleGeometry(sample(), "inch");
  close(mm.volume, 24);
  close(cm.volume / mm.volume, 1000);
  close(cm.area / mm.area, 100);
  close(inch.volume / mm.volume, 25.4 ** 3, 1e-6);
  close(inch.area / mm.area, 25.4 ** 2, 1e-6);
});
test("manual geometry distinguishes envelope from stated solid volume", () => {
  const box = M.manualGeometry([40, 30, 20], "mm", "");
  assert.equal(box.source, "envelope");
  close(box.volume, 24);
  const solid = M.manualGeometry([4, 3, 2], "cm", 12);
  assert.equal(solid.source, "manual");
  close(solid.volume, 12);
  assert.deepEqual(solid.dimensions, [40, 30, 20]);
});
test("manual geometry rejects missing, negative, oversize or impossible volume", () => {
  for (const dims of [
    [0, 2, 3],
    ["", 2, 3],
    [-1, 2, 3],
    [6000, 2, 3],
  ])
    assert.throws(() => M.manualGeometry(dims, "mm", ""));
  assert.throws(() => M.manualGeometry([40, 30, 20], "mm", 25));
  assert.throws(() => M.manualGeometry([40, 30, 20], "parsecs", ""));
});
test("FDM formula matches hand calculation and rounded line items", () => {
  const q = manufacturing();
  const shell = 52 * 0.12,
    print = (shell + (24 - shell) * 0.25) * 1.1,
    grams = print * 1.1 * 1.24;
  close(q.massGrams, grams);
  close(q.hoursPerPart, 0.15 + print / 18);
  assert.equal(q.lines[0].paise, Math.round((grams / 1000) * 1600 * 100));
  assert.equal(q.lines.find((l) => l.key === "setup").paise, 25000);
  assert.equal(
    q.totalPaise,
    q.lines.reduce((sum, l) => sum + l.paise, 0),
  );
});
test("CNC charges stock with allowance and removed-volume machine time", () => {
  const q = manufacturing({ process: "cnc", material: "aluminium" });
  const stock = (46 * 36 * 26) / 1000;
  close(q.stockVolume, stock);
  close(q.massGrams, stock * 1.1 * 2.7);
  close(q.hoursPerPart, 0.3 + (stock - 24) / 45 + 52 * 0.0015);
});
test("setup occurs once and total increases with order quantity", () => {
  for (const process of ["fdm", "cnc"]) {
    const material = process === "fdm" ? "pla" : "steel";
    const one = manufacturing({ process, material }),
      ten = manufacturing({ process, material, quantity: 10 });
    assert.ok(ten.totalPaise > one.totalPaise);
    assert.equal(one.lines[1].paise, ten.lines[1].paise);
    assert.ok(ten.perPartPaise < one.perPartPaise);
  }
});
test("larger FDM geometry, infill and supports increase estimated cost", () => {
  const base = manufacturing();
  assert.ok(
    manufacturing({ geometry: M.scaleGeometry(sample(), "cm") }).totalPaise >
      base.totalPaise,
  );
  assert.ok(manufacturing({ infill: 100 }).totalPaise > base.totalPaise);
  assert.ok(manufacturing({ support: 40 }).totalPaise > base.totalPaise);
});
test("materials must be compatible with chosen process", () => {
  assert.throws(() => manufacturing({ material: "steel" }), /compatible/);
  assert.throws(
    () => manufacturing({ process: "cnc", material: "pla" }),
    /compatible/,
  );
});
test("quantity, rates, infill and tax are validated", () => {
  for (const quantity of [0, -1, 1.2, 10001, "", NaN])
    assert.throws(() => manufacturing({ quantity }));
  for (const options of [
    { rates: { machine: -1 } },
    { rates: { throughput: 0 } },
    { infill: 0 },
    { taxPercent: 101 },
    { materialRate: "" },
  ])
    assert.throws(() => manufacturing(options));
});
test("tax, paise rounding and optional finishing reconcile", () => {
  const q = manufacturing({
    quantity: 3,
    materialRate: 1666.667,
    taxPercent: 18,
    rates: { setup: 250.123 },
  });
  assert.equal(q.taxPaise, Math.round(q.subtotalPaise * 0.18));
  assert.equal(
    q.totalPaise,
    q.lines.reduce((sum, l) => sum + l.paise, 0) + q.taxPaise,
  );
  assert.equal(
    manufacturing().totalPaise - manufacturing({ finishing: false }).totalPaise,
    3500,
  );
});
test("design estimate has five independent effort components", () => {
  const q = design();
  assert.equal(q.totalHours, 5.5);
  assert.equal(q.totalPaise, 440000);
  assert.deepEqual(
    q.lines.map((l) => l.hours),
    [1, 2, 1.5, 0.5, 0.5],
  );
  assert.equal(q.type, "design");
});
test("design scope, complexity, drawings and revisions increase cost", () => {
  const base = design();
  for (const options of [
    { parts: 2 },
    { complexity: "moderate" },
    { complexity: "complex" },
    { drawings: 2 },
    { revisions: 2 },
  ])
    assert.ok(design(options).totalPaise > base.totalPaise);
  assert.equal(design({ drawings: 0, revisions: 0 }).totalHours, 3.5);
});
test("design briefing charged once while modeling/review scale by distinct parts", () => {
  const q = design({ parts: 3, drawings: 0, revisions: 0 });
  assert.deepEqual(
    q.lines.map((l) => l.hours),
    [1, 6, 0, 0, 1.5],
  );
});
test("design rates and tax remain editable with exact reconciliation", () => {
  const q = design({
    parts: 3,
    rates: { hourly: 899.99, briefing: 0.3333 },
    taxPercent: 18,
  });
  assert.equal(
    q.totalPaise,
    q.lines.reduce((s, l) => s + l.paise, 0) + q.taxPaise,
  );
  assert.equal(q.taxPaise, Math.round(q.subtotalPaise * 0.18));
});
test("design invalid scope and rates are rejected", () => {
  for (const options of [
    { parts: 0 },
    { parts: 1.5 },
    { drawings: -1 },
    { revisions: 11 },
    { complexity: "automatic" },
    { rates: { hourly: "" } },
    { rates: { review: -1 } },
    { taxPercent: 101 },
  ])
    assert.throws(() => design(options));
});
test("decimal half-paise rates round consistently in both estimate modes", () => {
  const d = design({
    drawings: 0,
    revisions: 0,
    rates: { hourly: 1, briefing: 1.005, simple: 0, review: 0 },
  });
  assert.equal(d.lines[0].paise, 101);
  const q = manufacturing({ rates: { setup: 10.075 } });
  assert.equal(q.lines.find((l) => l.key === "setup").paise, 1008);
  assert.equal(
    q.totalPaise,
    q.lines.reduce((s, l) => s + l.paise, 0) + q.taxPaise,
  );
});
