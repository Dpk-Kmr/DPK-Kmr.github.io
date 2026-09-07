(() => {
  "use strict";
  const M = window.AtrikshaQuote;
  if (!M) return;
  const $ = (id) => document.getElementById(id);
  const money = (paise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(paise / 100);
  const decimal = (n) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  const state = {
    mode: "design",
    input: "upload",
    process: "fdm",
    mesh: null,
    geometry: null,
    quote: null,
    fileName: "",
    reference: "",
    angle: -0.55,
    loadId: 0,
  };
  const rateKeys = [
    "setup",
    "machine",
    "throughput",
    "finishing",
    "inspection",
    "waste",
  ];
  const processRates = {
    fdm: { ...M.DEFAULT_RATES.fdm },
    cnc: { ...M.DEFAULT_RATES.cnc },
  };
  const materialRates = Object.fromEntries(
    Object.entries(M.MATERIALS).map(([key, value]) => [key, value.rate]),
  );
  const complexity = {
    simple: [
      "Simple · a clearly defined part",
      "Brackets, spacers or basic enclosures with a few features.",
    ],
    moderate: [
      "Moderate · several connected features",
      "Housings, fixtures or parts with mounting details and fits.",
    ],
    complex: [
      "Complex · detailed geometry",
      "Detailed surfaces, many features or intricate mechanical parts.",
    ],
  };
  function clearGeometry() {
    state.mesh = null;
    state.geometry = null;
    state.quote = null;
    ["length", "width", "height", "solid-volume"].forEach((id) => {
      $(id).value = "";
    });
    $("part-preview").hidden = true;
  }
  function setStatus(message, error = false) {
    $("file-status").textContent = message;
    $("file-status").classList.toggle("is-error", error);
  }
  function setInput(method, reset = true) {
    if (reset) {
      state.loadId++;
      clearGeometry();
      state.fileName = "";
      $("cad-file").value = "";
    }
    state.input = method;
    $("upload-panel").hidden = method !== "upload";
    $("manual-panel").hidden = method !== "manual";
    ["upload", "manual"].forEach((key) => {
      $(`${key}-tab`).classList.toggle("is-active", key === method);
      $(`${key}-tab`).setAttribute("aria-pressed", String(key === method));
    });
    if (reset)
      setStatus(
        method === "manual"
          ? "Enter your part’s overall dimensions. Solid volume is optional."
          : "Your file stays in your browser.",
      );
    update();
  }
  function syncRates() {
    rateKeys.forEach((key) => {
      $(`rate-${key}`).value = processRates[state.process][key];
    });
    $("rate-material").value = materialRates[$("material").value];
    $("throughput-label").textContent =
      state.process === "fdm"
        ? "Print flow (cm³ / hour)"
        : "Removal rate (cm³ / hour)";
    $("finishing-description").textContent =
      state.process === "fdm"
        ? "Support removal and light cleanup"
        : "Deburring and light surface cleanup";
    $("print-options").hidden = state.process !== "fdm";
    $("formula-explanation").innerHTML =
      state.process === "fdm"
        ? "<strong>Material cost = purchased cm³ × density (g/cm³) ÷ 1,000 × ₹/kg × quantity.</strong><br />Shell cm³ = min(solid cm³, surface cm² × 1.2 mm ÷ 10).<br />Printed cm³ = [shell + (solid − shell) × infill% ÷ 100] × (1 + support% ÷ 100).<br />Purchased cm³ = printed cm³ × (1 + waste% ÷ 100).<br /><strong>Machine hours / part = 0.15 + printed cm³ ÷ flow (cm³/hour).</strong><br />Machine cost = hours × ₹/hour × quantity. Finishing and inspection = their ₹/part rates × quantity. Setup is charged once.<br />Total = rounded line items + tax. Tax = subtotal × tax% ÷ 100. No minimum-order surcharge."
        : "<strong>Material cost = purchased cm³ × density (g/cm³) ÷ 1,000 × ₹/kg × quantity.</strong><br />Stock cm³ = (length mm + 6) × (width mm + 6) × (height mm + 6) ÷ 1,000. This assumes 3 mm stock allowance per side.<br />Purchased cm³ = stock cm³ × (1 + waste% ÷ 100). Removed cm³ = stock − solid cm³.<br /><strong>Machine hours / part = 0.3 + removed cm³ ÷ removal rate (cm³/hour) + surface cm² × 0.0015 hours/cm².</strong><br />The surface term is a planning allowance for detail work, not a toolpath simulation.<br />Machine cost = hours × ₹/hour × quantity. Finishing and inspection = their ₹/part rates × quantity. Setup is charged once.<br />Total = rounded line items + tax. Tax = subtotal × tax% ÷ 100. No minimum-order surcharge.";
  }
  function setProcess(process) {
    rateKeys.forEach((key) => {
      processRates[state.process][key] = $(`rate-${key}`).value;
    });
    materialRates[$("material").value] = $("rate-material").value;
    state.process = process;
    document.querySelectorAll("[data-process]").forEach((button) => {
      const active = button.dataset.process === process;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("material").replaceChildren(
      ...Object.entries(M.MATERIALS)
        .filter(([, m]) => m.process === process)
        .map(([id, m]) => new Option(m.name, id)),
    );
    previousMaterial = $("material").value;
    syncRates();
    update();
  }
  function setMode(mode) {
    state.mode = mode;
    $("design-form").hidden = mode !== "design";
    $("quote-form").hidden = mode === "design";
    document.querySelectorAll("[data-quote-mode]").forEach((button) => {
      const active = button.dataset.quoteMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("journey-one").textContent =
      mode === "design" ? "1. Describe the design" : "1. Add your design";
    $("journey-one").href =
      mode === "design" ? "#design-service-step" : "#design-step";
    $("journey-two").textContent =
      mode === "design" ? "2. Choose deliverables" : "2. Choose how it’s made";
    $("journey-two").href =
      mode === "design" ? "#deliverables-step" : "#make-step";
    $("estimate-heading").textContent =
      mode === "design" ? "CAD design estimate" : "Manufacturing estimate";
    $("receipt-note").textContent =
      mode === "design"
        ? "Example planning rates. Final price, deliverables and design scope are confirmed after the team reviews your requirements. Manufacturing is excluded."
        : "Example planning rates. Final price, tolerances and manufacturing feasibility are confirmed after the team reviews your design. CAD design services are excluded.";
    update();
  }
  async function loadFile(file) {
    if (!file) return;
    const loadId = ++state.loadId;
    clearGeometry();
    state.fileName = "";
    setInput("upload", false);
    setStatus("Reading your file…");
    update();
    try {
      if (file.size > M.LIMITS.bytes)
        throw new Error("Keep the file under 20 MB. Export a lighter file.");
      if (!file.size)
        throw new Error("This file is empty. Please select a CAD file.");
      const extension = file.name.split(".").pop().toLowerCase();
      if (!["stl", "step", "stp", "iges", "igs"].includes(extension))
        throw new Error("Choose an STL, STEP or IGES file.");
      if (extension !== "stl") {
        state.fileName = file.name;
        setInput("manual", false);
        setStatus(
          `${file.name} added as a reference. Enter dimensions below; STEP / IGES geometry is not extracted.`,
        );
        return;
      }
      const data = await file.arrayBuffer();
      if (loadId !== state.loadId) return;
      const mesh = M.parseSTL(data);
      if (!mesh.valid)
        throw new Error(
          `This STL has ${mesh.issues.join(", ")}. Re-export one closed solid, or choose “Enter dimensions” and enter its geometry manually.`,
        );
      state.mesh = mesh;
      state.fileName = file.name;
      setStatus(
        `${file.name} · ${decimal(mesh.triangleCount)} triangles · closed-mesh checks passed. Confirm the design units below.`,
      );
      update();
    } catch (error) {
      if (loadId !== state.loadId) return;
      clearGeometry();
      setStatus(error.message, true);
      update();
    }
  }
  function useSample() {
    state.loadId++;
    clearGeometry();
    setInput("upload", false);
    $("cad-file").value = "";
    $("design-unit").value = "mm";
    state.mesh = M.analyzeTriangles(M.sampleTriangles());
    state.fileName = "Sample block · 40 × 30 × 20 mm";
    state.angle = -0.55;
    setStatus(
      "Sample part loaded. Try another process, material or quantity to compare the cost.",
    );
    update();
  }
  function getManufacturingQuote() {
    let geometry;
    if (state.input === "manual") {
      const dimensions = ["length", "width", "height"].map((id) => $(id).value);
      if (dimensions.every((value) => value === "")) return null;
      if (dimensions.some((value) => value === ""))
        throw new Error("Enter length, width and height to see your estimate.");
      geometry = M.manualGeometry(
        dimensions,
        $("design-unit").value,
        $("solid-volume").value,
      );
    } else {
      if (!state.mesh) return null;
      geometry = M.scaleGeometry(state.mesh, $("design-unit").value);
    }
    state.geometry = geometry;
    const rates = Object.fromEntries(
      rateKeys.map((key) => [key, $(`rate-${key}`).value]),
    );
    return M.calculateQuote({
      geometry,
      process: state.process,
      material: $("material").value,
      quantity: $("quantity").value,
      infill: $("infill").value,
      support: $("support").value,
      finishing: $("finishing").checked,
      rates,
      materialRate: $("rate-material").value,
      taxPercent: $("tax-percent").value,
    });
  }
  function getDesignQuote() {
    const rates = Object.fromEntries(
      Object.keys(M.DESIGN_RATES).map((key) => [
        key,
        $(`design-rate-${key}`).value,
      ]),
    );
    const choice = $("design-complexity").value;
    $("complexity-title").textContent = complexity[choice][0];
    $("complexity-description").textContent = complexity[choice][1];
    $("modeling-hours").textContent =
      `${rates[choice] || "—"} modeling hours per part`;
    const path = $("design-scope-icon").firstElementChild;
    path.style.strokeWidth = choice === "complex" ? "2" : "1.3";
    return M.calculateDesignQuote({
      parts: $("design-parts").value,
      complexity: choice,
      drawings: $("design-drawings").value,
      revisions: $("design-revisions").value,
      rates,
      taxPercent: $("design-tax").value,
    });
  }
  function update() {
    document.querySelectorAll("[data-unit-label]").forEach((label) => {
      label.textContent = `(${$("design-unit").value === "inch" ? "in" : $("design-unit").value})`;
    });
    $("quote-error").hidden = true;
    state.quote = null;
    try {
      state.quote =
        state.mode === "design" ? getDesignQuote() : getManufacturingQuote();
    } catch (error) {
      $("quote-error").textContent = error.message;
      $("quote-error").hidden = false;
    }
    $("receipt-result").hidden = !state.quote;
    $("receipt-empty").hidden = !!state.quote || state.mode === "design";
    if (state.quote) renderQuote(state.quote);
    if (state.mode === "manufacturing" && state.geometry && state.quote) {
      $("part-preview").hidden = false;
      $("preview-name").textContent =
        state.input === "manual"
          ? `BOUNDING BOX${state.fileName ? ` · ${state.fileName}` : ""}`
          : state.fileName || "YOUR PART";
      $("part-canvas").setAttribute(
        "aria-label",
        state.input === "manual"
          ? "Preview of the bounding box from your entered dimensions, not the exact part geometry"
          : "Wireframe preview of your uploaded STL geometry",
      );
      $("geometry-dimensions").textContent =
        `${state.geometry.dimensions.map(decimal).join(" × ")} mm`;
      $("geometry-volume").textContent =
        `${decimal(state.geometry.volume)} cm³`;
      $("volume-label").textContent =
        state.geometry.source === "envelope"
          ? "Envelope volume"
          : "Solid volume";
      drawPart();
    } else if (state.mode === "manufacturing") $("part-preview").hidden = true;
  }
  function basisText(quote) {
    if (quote.type === "design")
      return `${decimal(quote.totalHours)} estimated hours · scope-based planning estimate. This total covers design work only.`;
    const source = quote.geometry.source;
    return source === "stl"
      ? "Based on STL geometry. Mesh checks are preliminary; self-intersections, cavities and feasibility need review."
      : source === "manual"
        ? "Based on your stated solid volume. Surface area is approximated from the bounding box."
        : "Bounding-box estimate: assumes a solid block, not your exact part. Add solid volume for a closer estimate.";
  }
  function renderQuote(quote) {
    const design = quote.type === "design";
    $("receipt-summary").textContent = design
      ? `${quote.parts} distinct ${quote.parts === 1 ? "part" : "parts"} · ${quote.complexity} complexity${$("design-name").value.trim() ? ` · ${$("design-name").value.trim()}` : ""}`
      : `${quote.quantity} ${quote.quantity === 1 ? "part" : "parts"} · ${quote.process === "fdm" ? "FDM 3D printing" : "CNC machining"} · ${quote.materialName}`;
    $("geometry-basis").textContent = basisText(quote);
    $("receipt-lines").replaceChildren(
      ...quote.lines.map((line) => {
        const row = document.createElement("div");
        row.className = "receipt-line";
        const label = document.createElement("dt");
        label.textContent = line.label;
        if (design) {
          const hours = document.createElement("small");
          hours.textContent = `${decimal(line.hours)} hr × ${money(Math.round(quote.rates.hourly * 100))}/hr`;
          label.append(hours);
        }
        const value = document.createElement("dd");
        value.textContent = money(line.paise);
        row.append(label, value);
        return row;
      }),
    );
    $("subtotal").textContent = money(quote.subtotalPaise);
    $("tax").textContent = money(quote.taxPaise);
    $("tax-label").textContent = quote.taxPercent
      ? `GST / tax (${decimal(quote.taxPercent)}%)`
      : "Tax not included";
    $("total").textContent = money(quote.totalPaise);
    $("per-part").textContent = design
      ? "CAD design services · manufacturing excluded"
      : `${money(quote.perPartPaise)} per part on average · ${quote.quantity} ${quote.quantity === 1 ? "part" : "parts"}`;
    $("receipt-usage").textContent = design
      ? `${quote.drawings} technical ${quote.drawings === 1 ? "drawing" : "drawings"} · ${quote.revisions} revision ${quote.revisions === 1 ? "round" : "rounds"} · design review included. ${state.reference ? `Reference: ${state.reference}` : ""}`
      : `Per part: ~${decimal(quote.massGrams)} g purchased material · ~${decimal(quote.hoursPerPart)} machine hours. ${quote.process === "fdm" ? `${quote.infill}% infill · ${quote.support}% support allowance.` : `${decimal(quote.stockVolume)} cm³ stock including machining allowance.`} Delivery excluded.`;
    const subject = `Atriksha ${design ? "CAD design" : "manufacturing"} quotation review${design && $("design-name").value.trim() ? `: ${$("design-name").value.trim()}` : ""}`;
    $("review-quote").href =
      `mailto:info@atriksha.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(quoteText(quote))}`;
  }
  function quoteText(quote) {
    const design = quote.type === "design";
    const lines = [
      "ATRIKSHA — INDICATIVE ESTIMATE",
      design
        ? "CAD design services (manufacturing excluded)"
        : "Part manufacturing (CAD design services excluded)",
      "",
      $("receipt-summary").textContent,
      basisText(quote),
      `Reference: ${design ? state.reference || "None added" : state.fileName || "Manual dimensions"}`,
    ];
    if (!design)
      lines.push(
        `Dimensions: ${quote.geometry.dimensions.map(decimal).join(" × ")} mm; volume: ${decimal(quote.geometry.volume)} cm³; surface area: ${decimal(quote.geometry.area)} cm²`,
      );
    lines.push(
      "",
      ...quote.lines.map(
        (line) =>
          `${line.label}${design ? ` (${decimal(line.hours)} h)` : ""}: ${money(line.paise)}`,
      ),
      `Subtotal: ${money(quote.subtotalPaise)}`,
      `${quote.taxPercent ? `GST / tax (${quote.taxPercent}%)` : "Tax not included"}: ${money(quote.taxPaise)}`,
      `Estimated total: ${money(quote.totalPaise)}`,
      $("per-part").textContent,
      "",
      $("receipt-usage").textContent,
      "",
      "PLANNING ASSUMPTIONS",
    );
    if (design)
      lines.push(
        `Hourly rate: ${money(Math.round(quote.rates.hourly * 100))}/hour`,
        `Modeling: ${quote.rates[quote.complexity]} hours/part; briefing: ${quote.rates.briefing} hours/project; drawing: ${quote.rates.drawing} hours/drawing; revision: ${quote.rates.revision} hours/part/round; review: ${quote.rates.review} hours/part.`,
      );
    else
      lines.push(
        `Material: ${money(Math.round(quote.materialRate * 100))}/kg; density: ${M.MATERIALS[quote.material].density} g/cm³; setup: ${money(Math.round(quote.rates.setup * 100))}/order; machine: ${money(Math.round(quote.rates.machine * 100))}/hour; throughput: ${quote.rates.throughput} cm³/hour; material waste: ${quote.rates.waste}%; finishing: ${money(Math.round(quote.rates.finishing * 100))}/part (${quote.finishing ? "selected" : "not selected"}); inspection: ${money(Math.round(quote.rates.inspection * 100))}/part.`,
        quote.process === "fdm"
          ? `Printed cm³ ≈ [shell + (solid cm³ − shell) × infill% / 100] × (1 + support% / 100). Shell cm³ = min(solid cm³, surface cm² × ${quote.rates.shell} mm / 10). Purchased cm³ = printed cm³ × (1 + waste% / 100). Machine hours = ${quote.rates.preparation} + printed cm³ / throughput (cm³/hour).`
          : `Stock cm³ = product of (each dimension in mm + 2 × ${quote.rates.allowance} mm) / 1,000. Purchased cm³ = stock cm³ × (1 + waste% / 100). Machine hours = ${quote.rates.preparation} + (stock − solid cm³) / throughput (cm³/hour) + surface cm² × ${quote.rates.detailTime} hours/cm².`,
      );
    if (!design)
      lines.push(
        "Material cost = purchased cm³ × density (g/cm³) / 1,000 × ₹/kg × quantity. Machine cost = hours × ₹/hour × quantity. Finishing and inspection = ₹/part × quantity. Setup is charged once. Tax = subtotal × tax% / 100. Rounded line items are added to produce the total.",
      );
    lines.push(
      "",
      "These editable example rates are not an approved Atriksha rate card. Tax is excluded unless entered. Final price, scope, tolerances and feasibility require team review.",
      "Please attach your CAD or reference file when sending this email. Files have not been uploaded.",
    );
    return lines.join("\n");
  }
  function drawPart() {
    if (!state.geometry || $("part-preview").hidden) return;
    const canvas = $("part-canvas"),
      ctx = canvas.getContext("2d");
    if (!ctx) return;
    const palette = getComputedStyle(document.documentElement);
    const accent = palette.getPropertyValue("--accent").trim();
    const muted = palette.getPropertyValue("--muted").trim();
    const width = canvas.clientWidth || 550,
      height = canvas.clientHeight || 230,
      ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    let triangles, min, dimensions;
    if (state.mesh && state.input === "upload")
      ({ triangles, min, dimensions } = state.mesh);
    else {
      dimensions = state.geometry.dimensions;
      min = [0, 0, 0];
      triangles = M.sampleTriangles().map(
        (v, i) => (v * dimensions[i % 3]) / [40, 30, 20][i % 3],
      );
    }
    const center = min.map((v, i) => v + dimensions[i] / 2),
      size = Math.max(...dimensions),
      zoom = Math.min(width * 0.31, height * 0.55) / size;
    const project = (p) => {
      const x = p[0] - center[0],
        y = p[1] - center[1],
        z = p[2] - center[2];
      const xx = x * Math.cos(state.angle) - y * Math.sin(state.angle),
        yy = x * Math.sin(state.angle) + y * Math.cos(state.angle);
      return [width / 2 + xx * zoom, height / 2 + (yy * 0.5 - z * 0.9) * zoom];
    };
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.07;
    ctx.lineWidth = 1;
    for (let x = 20; x < width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 15; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    const step = Math.max(1, Math.ceil(triangles.length / 9 / 1800));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.85;
    ctx.fillStyle = accent;
    for (let t = 0; t < triangles.length / 9; t += step) {
      const points = [0, 1, 2].map((i) =>
        project(Array.from(triangles.slice(t * 9 + i * 3, t * 9 + i * 3 + 3))),
      );
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.closePath();
      ctx.globalAlpha = 0.02;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
    ctx.fillStyle = muted;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(
      state.input === "manual" ? "BOUNDING BOX PREVIEW" : "GEOMETRY PREVIEW",
      16,
      height - 14,
    );
  }
  $("quote-form").addEventListener("submit", (event) => event.preventDefault());
  $("design-form").addEventListener("submit", (event) =>
    event.preventDefault(),
  );
  $("quote-form").addEventListener("input", (event) => {
    if (event.target.type !== "file") update();
  });
  $("design-form").addEventListener("input", (event) => {
    if (event.target.type !== "file") update();
  });
  document
    .querySelectorAll("[data-quote-mode]")
    .forEach((button) =>
      button.addEventListener("click", () => setMode(button.dataset.quoteMode)),
    );
  document.querySelectorAll("[data-process]").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.process !== state.process)
        setProcess(button.dataset.process);
    }),
  );
  $("upload-tab").addEventListener("click", () => {
    if (state.input !== "upload") setInput("upload");
  });
  $("manual-tab").addEventListener("click", () => {
    if (state.input !== "manual") setInput("manual");
  });
  $("sample-button").addEventListener("click", useSample);
  $("receipt-sample").addEventListener("click", useSample);
  $("cad-file").addEventListener("change", (event) =>
    loadFile(event.target.files[0]),
  );
  $("design-reference").addEventListener("change", (event) => {
    const file = event.target.files[0];
    state.reference = "";
    const invalid =
      file &&
      (file.size > M.LIMITS.bytes ||
        !file.size ||
        !/\.(stl|step|stp|iges|igs|pdf|png|jpe?g)$/i.test(file.name));
    if (invalid) {
      $("design-reference-status").textContent =
        "Choose a supported, non-empty reference file under 20 MB.";
      $("design-reference-status").classList.add("is-error");
      event.target.value = "";
    } else {
      state.reference = file ? file.name : "";
      $("design-reference-status").textContent = file
        ? `${file.name} selected as a reference. Design effort uses the scope above; the file is not analysed.`
        : "A sketch, drawing or CAD file. It stays in your browser.";
      $("design-reference-status").classList.remove("is-error");
    }
    update();
  });
  $("file-zone").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("file-zone").classList.add("is-dragover");
  });
  $("file-zone").addEventListener("dragleave", () =>
    $("file-zone").classList.remove("is-dragover"),
  );
  $("file-zone").addEventListener("drop", (event) => {
    event.preventDefault();
    $("file-zone").classList.remove("is-dragover");
    loadFile(event.dataTransfer.files[0]);
  });
  let previousMaterial = $("material").value;
  $("material").addEventListener("change", () => {
    materialRates[previousMaterial] = $("rate-material").value;
    previousMaterial = $("material").value;
    $("rate-material").value = materialRates[previousMaterial];
    update();
  });
  $("reset-rates").addEventListener("click", () => {
    processRates[state.process] = { ...M.DEFAULT_RATES[state.process] };
    materialRates[$("material").value] = M.MATERIALS[$("material").value].rate;
    $("tax-percent").value = 0;
    syncRates();
    update();
  });
  $("reset-design-rates").addEventListener("click", () => {
    Object.entries(M.DESIGN_RATES).forEach(([key, value]) => {
      $(`design-rate-${key}`).value = value;
    });
    $("design-tax").value = 0;
    update();
  });
  $("rotate-part").addEventListener("click", () => {
    state.angle += Math.PI / 6;
    drawPart();
  });
  let drag = null;
  $("part-canvas").addEventListener("pointerdown", (event) => {
    drag = { x: event.clientX, angle: state.angle };
    $("part-canvas").setPointerCapture(event.pointerId);
  });
  $("part-canvas").addEventListener("pointermove", (event) => {
    if (drag) {
      state.angle = drag.angle + (event.clientX - drag.x) * 0.012;
      drawPart();
    }
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) =>
    $("part-canvas").addEventListener(type, () => {
      drag = null;
    }),
  );
  window.addEventListener("resize", drawPart);
  window.addEventListener("atriksha:theme", drawPart);
  $("download-quote").addEventListener("click", () => {
    if (!state.quote) return;
    const blob = new Blob([quoteText(state.quote)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atriksha-${state.mode}-estimate.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("print-quote").addEventListener("click", () => window.print());
  syncRates();
  const params = new URLSearchParams(location.search);
  setMode(
    params.get("mode") === "manufacturing" ||
      params.get("type") === "manufacturing"
      ? "manufacturing"
      : "design",
  );
})();
