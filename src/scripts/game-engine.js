/* Educational game mechanics and deterministic scoring. No network or account required. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaGamesEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TYPES = [
    "select",
    "tune",
    "sort",
    "match",
    "classify",
    "grid",
    "route",
  ];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const own = (object, key) =>
    Object.prototype.hasOwnProperty.call(object || {}, key);
  const ids = (items) => (items || []).map((item) => item.id);
  const unique = (items) =>
    Array.isArray(items) && new Set(items).size === items.length;
  const isObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  let instanceCount = 0;

  function shortestPath(round) {
    const blocked = new Set(round.blocked || []);
    if (blocked.has(round.start) || blocked.has(round.end)) return null;
    const required = round.required || [];
    const bit = (id) => {
      const index = required.indexOf(id);
      return index < 0 ? 0 : 1 << index;
    };
    const queue = [{ path: [round.start], mask: bit(round.start) }];
    const seen = new Set([`${round.start}|${bit(round.start)}`]);
    for (let at = 0; at < queue.length; at += 1) {
      const { path, mask } = queue[at];
      const tail = path[path.length - 1];
      if (tail === round.end && mask === (1 << required.length) - 1)
        return path;
      for (const [a, b] of round.edges || []) {
        const next = a === tail ? b : b === tail ? a : null;
        const updated = mask | bit(next);
        const key = `${next}|${updated}`;
        if (next !== null && !blocked.has(next) && !seen.has(key)) {
          seen.add(key);
          queue.push({ path: [...path, next], mask: updated });
        }
      }
    }
    return null;
  }

  function validateRound(round) {
    const errors = [];
    if (!isObject(round) || !TYPES.includes(round.type))
      return { valid: false, errors: ["Unknown game mechanic."] };
    const checkItems = (name, minimum = 1) => {
      const list = round[name];
      if (!Array.isArray(list) || list.length < minimum) {
        errors.push(`${name} must contain at least ${minimum} items.`);
        return [];
      }
      if (
        list.some(
          (item) => !isObject(item) || typeof item.id !== "string" || !item.id,
        )
      )
        errors.push(`${name} requires nonempty string IDs.`);
      const result = list.filter(isObject).map((item) => item.id);
      if (!unique(result)) errors.push(`${name} contains duplicate IDs.`);
      return result;
    };
    const checkAnswer = (allowed, minimum = 1) => {
      if (
        !Array.isArray(round.answer) ||
        round.answer.length < minimum ||
        !unique(round.answer) ||
        round.answer.some((id) => !allowed.includes(id))
      )
        errors.push("Answer must contain unique IDs from the available items.");
    };
    if (round.type === "select") {
      const options = checkItems("options", 2);
      checkAnswer(options);
      if (!round.multiple && round.answer?.length !== 1)
        errors.push("A single-choice round needs exactly one answer.");
    }
    if (round.type === "grid") {
      const cells = checkItems("cells");
      checkAnswer(cells);
      if (
        !Number.isInteger(round.columns) ||
        round.columns < 1 ||
        round.columns > 12
      )
        errors.push("Grid columns must be an integer from 1 to 12.");
    }
    if (round.type === "sort") {
      const items = checkItems("items", 2);
      checkAnswer(items);
      if (round.answer?.length !== items.length)
        errors.push("The sorted answer must include every item.");
    }
    if (round.type === "tune") {
      checkItems("controls");
      if (!isObject(round.targets)) errors.push("Tune targets are required.");
      for (const control of Array.isArray(round.controls)
        ? round.controls
        : []) {
        if (!isObject(control)) continue;
        if (
          ![control.min, control.max, control.step, control.initial].every(
            Number.isFinite,
          ) ||
          control.min >= control.max ||
          control.step <= 0 ||
          control.initial < control.min ||
          control.initial > control.max
        )
          errors.push(`Invalid slider range for ${control.id}.`);
        if (
          !Number.isFinite(round.targets?.[control.id]) ||
          round.targets[control.id] < control.min ||
          round.targets[control.id] > control.max
        )
          errors.push(`Target for ${control.id} is outside its slider range.`);
        if (
          round.tolerance &&
          own(round.tolerance, control.id) &&
          (!Number.isFinite(round.tolerance[control.id]) ||
            round.tolerance[control.id] < 0)
        )
          errors.push(
            `Tolerance for ${control.id} must be a nonnegative number.`,
          );
      }
    }
    if (round.type === "match" || round.type === "classify") {
      const matching = round.type === "match";
      const sources = checkItems(matching ? "left" : "items");
      const choices = checkItems(matching ? "right" : "buckets");
      const answers = round[matching ? "pairs" : "answers"];
      if (
        !isObject(answers) ||
        sources.some(
          (id) => !own(answers, id) || !choices.includes(answers[id]),
        )
      )
        errors.push("Every source needs an answer from the available choices.");
      if (
        matching &&
        isObject(answers) &&
        !unique(sources.map((id) => answers[id]))
      )
        errors.push("Matching answers must use each destination at most once.");
    }
    if (round.type === "route") {
      const nodes = checkItems("nodes", 2);
      if (
        round.required &&
        (!Array.isArray(round.required) ||
          round.required.length > 8 ||
          !unique(round.required) ||
          round.required.some((id) => !nodes.includes(id)))
      )
        errors.push(
          "Required waypoints must be unique existing nodes, with at most eight visits required.",
        );
      if (
        Array.isArray(round.nodes) &&
        round.nodes.some(
          (node) => !Number.isFinite(node?.x) || !Number.isFinite(node?.y),
        )
      )
        errors.push("Route nodes require finite coordinates.");
      if (
        !nodes.includes(round.start) ||
        !nodes.includes(round.end) ||
        round.start === round.end
      )
        errors.push("Route start and end must be different valid nodes.");
      const validEdges =
        Array.isArray(round.edges) &&
        round.edges.every(
          (edge) =>
            Array.isArray(edge) &&
            edge.length === 2 &&
            nodes.includes(edge[0]) &&
            nodes.includes(edge[1]) &&
            edge[0] !== edge[1],
        );
      if (!validEdges)
        errors.push("Route edges must join two valid, different nodes.");
      if (
        round.blocked &&
        (!Array.isArray(round.blocked) ||
          round.blocked.some((id) => !nodes.includes(id)))
      )
        errors.push("Blocked route nodes must exist.");
      if (!errors.length && !shortestPath(round))
        errors.push("The route must have a path from start to end.");
    }
    return { valid: errors.length === 0, errors };
  }

  function result(
    score,
    complete,
    success,
    pending = "Complete your answer to score this round.",
  ) {
    const safe = Number.isFinite(score) ? Math.round(clamp(score, 0, 200)) : 0;
    const correct = complete && success;
    return {
      score: safe,
      correct,
      complete,
      feedback: !complete
        ? pending
        : correct
          ? "Excellent. You solved it!"
          : safe > 0
            ? "Good progress. Compare your answer with the explanation."
            : "Keep experimenting. The explanation shows how it works.",
    };
  }

  function evaluateRound(round, response) {
    if (!validateRound(round).valid)
      return result(0, false, false, "This round is unavailable.");
    if (["select", "grid"].includes(round.type)) {
      const allowed = new Set(
        ids(round.type === "select" ? round.options : round.cells),
      );
      if (
        !Array.isArray(response) ||
        !unique(response) ||
        response.some((id) => !allowed.has(id))
      )
        return result(0, false, false);
      if (!response.length)
        return result(0, false, false, "Choose an answer to score this round.");
      if (round.type === "select" && !round.multiple)
        return result(
          response.length === 1 && response[0] === round.answer[0] ? 200 : 0,
          response.length === 1,
          response.length === 1 && response[0] === round.answer[0],
        );
      const expected = new Set(round.answer);
      const hits = response.filter((id) => expected.has(id)).length;
      const score = (200 * 2 * hits) / (response.length + expected.size);
      return result(
        score,
        true,
        hits === expected.size && hits === response.length,
      );
    }
    if (round.type === "tune") {
      if (!isObject(response)) return result(0, false, false);
      let earned = 0;
      let answered = 0;
      for (const control of round.controls) {
        const current = response[control.id];
        if (
          !own(response, control.id) ||
          !Number.isFinite(current) ||
          current < control.min ||
          current > control.max
        )
          continue;
        answered += 1;
        const tolerance = round.tolerance?.[control.id] ?? control.step / 2;
        const distance = Math.max(
          0,
          Math.abs(current - round.targets[control.id]) - tolerance,
        );
        earned +=
          1 - clamp(distance / ((control.max - control.min) * 0.2), 0, 1);
      }
      const score = (200 * earned) / round.controls.length;
      return result(
        score,
        answered === round.controls.length,
        score >= 160,
        "Set every control to complete this round.",
      );
    }
    if (round.type === "sort") {
      const available = ids(round.items);
      if (
        !Array.isArray(response) ||
        !unique(response) ||
        response.length !== available.length ||
        response.some((id) => !available.includes(id))
      )
        return result(0, false, false, "Place every step in the sequence.");
      const expected = new Map(round.answer.map((id, index) => [id, index]));
      let ordered = 0;
      let pairs = 0;
      for (let i = 0; i < response.length; i += 1)
        for (let j = i + 1; j < response.length; j += 1) {
          pairs += 1;
          if (expected.get(response[i]) < expected.get(response[j]))
            ordered += 1;
        }
      return result((200 * ordered) / pairs, true, ordered === pairs);
    }
    if (["match", "classify"].includes(round.type)) {
      const matching = round.type === "match";
      const source = matching ? round.left : round.items;
      const choices = new Set(ids(matching ? round.right : round.buckets));
      const answers = matching ? round.pairs : round.answers;
      if (!isObject(response)) return result(0, false, false);
      let hits = 0;
      let answered = 0;
      const destinations = [];
      for (const { id } of source) {
        if (!own(response, id) || !choices.has(response[id])) continue;
        answered += 1;
        destinations.push(response[id]);
        if (response[id] === answers[id]) hits += 1;
      }
      if (matching && !unique(destinations))
        return result(0, false, false, "Each item needs a different match.");
      return result(
        (200 * hits) / source.length,
        answered === source.length,
        hits === source.length,
        matching
          ? "Match every item to complete the round."
          : "Place every item in a group to complete the round.",
      );
    }
    const available = new Set(ids(round.nodes));
    const blocked = new Set(round.blocked || []);
    if (
      !Array.isArray(response) ||
      !response.length ||
      response[0] !== round.start ||
      response.some((id) => !available.has(id) || blocked.has(id))
    )
      return result(
        0,
        false,
        false,
        "Build a connected path from start to finish.",
      );
    for (let i = 1; i < response.length; i += 1)
      if (
        !round.edges.some(
          ([a, b]) =>
            (a === response[i - 1] && b === response[i]) ||
            (b === response[i - 1] && a === response[i]),
        )
      )
        return result(
          0,
          false,
          false,
          "Your path must follow connected nodes.",
        );
    if (response[response.length - 1] !== round.end)
      return result(0, false, false, "Reach the finish to score this route.");
    if ((round.required || []).some((id) => !response.includes(id)))
      return result(
        0,
        false,
        false,
        "Visit every required waypoint before finishing this route.",
      );
    const best = shortestPath(round).length;
    const extra = Math.max(0, response.length - best);
    const scored = result(Math.max(20, 200 - extra * 20), true, extra === 0);
    scored.feedback =
      extra === 0
        ? "Perfect route. You found a shortest path!"
        : `You reached the finish with ${extra} extra ${extra === 1 ? "step" : "steps"}. A shorter path scores higher.`;
    return scored;
  }

  function initialResponse(round) {
    if (round.type === "tune")
      return Object.fromEntries(
        round.controls.map((control) => [control.id, control.initial]),
      );
    if (round.type === "sort") return ids(round.items);
    if (round.type === "route") return [round.start];
    return ["match", "classify"].includes(round.type) ? {} : [];
  }

  function validResponse(round, value) {
    if (["select", "grid", "sort", "route"].includes(round.type)) {
      if (!Array.isArray(value)) return false;
      const choices = ids(
        round.options || round.cells || round.items || round.nodes,
      );
      if (value.some((id) => !choices.includes(id))) return false;
      if (round.type !== "route" && !unique(value)) return false;
      if (round.type === "sort") return value.length === choices.length;
      if (round.type === "select") return round.multiple || value.length <= 1;
      if (round.type === "grid") return true;
      return (
        value.length > 0 &&
        value[0] === round.start &&
        !value.some((id) => (round.blocked || []).includes(id)) &&
        value.every(
          (id, index) =>
            !index ||
            round.edges.some(
              ([a, b]) =>
                (a === value[index - 1] && b === id) ||
                (b === value[index - 1] && a === id),
            ),
        )
      );
    }
    if (!isObject(value)) return false;
    if (round.type === "tune")
      return Object.entries(value).every(([id, number]) => {
        const control = round.controls.find((entry) => entry.id === id);
        return (
          control &&
          Number.isFinite(number) &&
          number >= control.min &&
          number <= control.max
        );
      });
    const sources = ids(round.type === "match" ? round.left : round.items);
    const destinations = ids(
      round.type === "match" ? round.right : round.buckets,
    );
    return (
      Object.entries(value).every(
        ([id, destination]) =>
          sources.includes(id) && destinations.includes(destination),
      ) &&
      (round.type !== "match" || unique(Object.values(value)))
    );
  }

  function mount(container, round, options = {}) {
    if (!container || typeof container.replaceChildren !== "function")
      throw new Error("A game container is required.");
    const validation = validateRound(round);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    const doc = container.ownerDocument;
    const instance = `game-engine-${++instanceCount}`;
    const root = element("div", "game-engine");
    root.dataset.mechanic = round.type;
    let response = initialResponse(round);
    let active = null;
    let disabled = false;
    let destroyed = false;
    let dragId = null;
    let renderVisual = () => {};
    const listeners = [];
    const resetControls = [];
    const invalidControls = new Set();
    const status = element("p", "ge-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    }
    function on(node, event, handler) {
      node.addEventListener(event, handler);
      listeners.push(() => node.removeEventListener(event, handler));
    }
    function button(text, className, action) {
      const node = element("button", className || "ge-button", text);
      node.type = "button";
      on(node, "click", (event) => {
        if (!disabled && !destroyed) action(event);
      });
      return node;
    }
    function announce(message) {
      status.textContent = message;
    }
    function changed() {
      if (destroyed) return;
      renderVisual();
      if (typeof options.onChange === "function")
        options.onChange(getResponse());
    }
    function getResponse() {
      return Array.isArray(response) ? [...response] : { ...response };
    }
    function svgNode(tag, attributes = {}, text) {
      const node = doc.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.entries(attributes).forEach(([key, value]) =>
        node.setAttribute(key, String(value)),
      );
      if (text !== undefined) node.textContent = String(text);
      return node;
    }
    function chart(label) {
      const wrap = element("div", "ge-visual");
      const svg = svgNode("svg", {
        viewBox: "0 0 660 260",
        role: "img",
        "aria-label": label,
        preserveAspectRatio: "xMidYMid meet",
      });
      wrap.append(svg);
      root.append(wrap);
      return svg;
    }
    function axes(svg) {
      for (let i = 0; i <= 4; i += 1)
        svg.append(
          svgNode("line", {
            x1: 40,
            y1: 25 + i * 45,
            x2: 630,
            y2: 25 + i * 45,
            class: "ge-chart-grid",
          }),
        );
      svg.append(
        svgNode("path", { d: "M40 20V210H635", class: "ge-chart-axis" }),
      );
    }
    function pointsPlot(svg, points, line) {
      const all = points.length
        ? points
        : [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ];
      const xMin = Math.min(0, ...all.map((point) => point.x));
      const xMax = Math.max(1, ...all.map((point) => point.x));
      const ys = [...all.map((point) => point.y)];
      if (line)
        ys.push(
          line.slope * xMin + line.intercept,
          line.slope * xMax + line.intercept,
        );
      const yMin = Math.min(0, ...ys);
      const yMax = Math.max(1, ...ys);
      const x = (value) => 40 + ((value - xMin) / (xMax - xMin || 1)) * 590;
      const y = (value) => 205 - ((value - yMin) / (yMax - yMin || 1)) * 175;
      all.forEach((point) =>
        svg.append(
          svgNode("circle", {
            cx: x(point.x),
            cy: y(point.y),
            r: 6,
            class: "ge-data-point",
          }),
        ),
      );
      if (line)
        svg.append(
          svgNode("line", {
            x1: x(xMin),
            y1: y(line.slope * xMin + line.intercept),
            x2: x(xMax),
            y2: y(line.slope * xMax + line.intercept),
            class: "ge-plot-line",
          }),
        );
      svg.append(
        svgNode(
          "text",
          { x: 40, y: 240, class: "ge-chart-label" },
          `x: ${xMin}–${xMax}`,
        ),
      );
      svg.append(
        svgNode(
          "text",
          { x: 630, y: 240, "text-anchor": "end", class: "ge-chart-label" },
          `y: ${Number(yMin.toFixed(2))}–${Number(yMax.toFixed(2))}`,
        ),
      );
    }
    function barPlot(svg, values, labels, maximum, selected) {
      const max =
        maximum || Math.max(1, ...values.map((value) => Math.abs(value)));
      const width = 580 / Math.max(1, values.length);
      values.forEach((value, i) => {
        const height = clamp(Math.abs(value) / max, 0, 1) * 165;
        svg.append(
          svgNode("rect", {
            x: 45 + i * width + width * 0.12,
            y: 205 - height,
            width: width * 0.76,
            height: Math.max(2, height),
            rx: 4,
            class: `ge-chart-bar${selected?.has(i) ? " is-active" : ""}`,
          }),
        );
        svg.append(
          svgNode(
            "text",
            {
              x: 45 + (i + 0.5) * width,
              y: 193 - height,
              "text-anchor": "middle",
              class: "ge-chart-value",
            },
            Number(value.toFixed(2)),
          ),
        );
        svg.append(
          svgNode(
            "text",
            {
              x: 45 + (i + 0.5) * width,
              y: 231,
              "text-anchor": "middle",
              class: "ge-chart-label",
            },
            labels?.[i] || String(i + 1),
          ),
        );
      });
    }
    function setupChoiceVisual() {
      if (!round.visual) return;
      const visual = round.visual;
      const svg = chart(visual.label || "Data for this challenge");
      renderVisual = () => {
        svg.replaceChildren();
        axes(svg);
        if (visual.kind === "scatter" && Array.isArray(visual.points))
          pointsPlot(svg, visual.points);
        else if (visual.kind === "signal" && Array.isArray(visual.values)) {
          const values = visual.values;
          const low = Math.min(0, ...values);
          const high = Math.max(1, ...values);
          const d = values
            .map(
              (value, i) =>
                `${i ? "L" : "M"}${40 + (i / Math.max(1, values.length - 1)) * 590},${205 - ((value - low) / (high - low || 1)) * 175}`,
            )
            .join(" ");
          svg.append(svgNode("path", { d, class: "ge-plot-line" }));
          values.forEach((value, i) => {
            const x = 40 + (i / Math.max(1, values.length - 1)) * 590;
            const y = 205 - ((value - low) / (high - low || 1)) * 175;
            svg.append(
              svgNode("circle", { cx: x, cy: y, r: 4, class: "ge-data-point" }),
            );
            if (values.length <= 14)
              svg.append(
                svgNode(
                  "text",
                  {
                    x,
                    y: y - 12,
                    "text-anchor": "middle",
                    class: "ge-chart-label",
                  },
                  value,
                ),
              );
          });
        } else if (Array.isArray(visual.values)) {
          const selected = new Set(
            round.options?.map((option, i) =>
              response.includes(option.id) ? i : -1,
            ),
          );
          barPlot(svg, visual.values, visual.labels, undefined, selected);
        }
      };
    }

    function selectGame() {
      setupChoiceVisual();
      const group = element("div", "ge-options");
      group.setAttribute("role", round.multiple ? "group" : "radiogroup");
      group.setAttribute(
        "aria-label",
        round.multiple ? "Choose all matching answers" : "Choose an answer",
      );
      const buttons = round.options.map((option, index) => {
        const node = button("", "ge-choice", () => {
          if (round.multiple)
            response = response.includes(option.id)
              ? response.filter((id) => id !== option.id)
              : [...response, option.id];
          else response = [option.id];
          sync();
          announce(
            round.multiple
              ? `${response.length} selected`
              : `Selected: ${option.label}`,
          );
          changed();
        });
        node.append(
          element("span", "ge-choice-key", String(index + 1).padStart(2, "0")),
          element("span", "ge-choice-label", option.label),
          element("span", "ge-choice-check", "✓"),
        );
        node.setAttribute("role", round.multiple ? "checkbox" : "radio");
        node.setAttribute("aria-checked", "false");
        if (!round.multiple)
          on(node, "keydown", (event) => {
            if (
              !disabled &&
              ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              const next =
                (index +
                  (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) +
                  buttons.length) %
                buttons.length;
              buttons[next].focus();
              buttons[next].click();
            }
          });
        group.append(node);
        return node;
      });
      function sync() {
        buttons.forEach((node, index) => {
          const picked = response.includes(round.options[index].id);
          node.classList.toggle("is-selected", picked);
          node.setAttribute("aria-checked", String(picked));
        });
      }
      root.append(group);
      const updateChart = renderVisual;
      renderVisual = () => {
        sync();
        updateChart();
      };
      sync();
    }

    function tuneGame() {
      const svg = chart(round.visual?.label || "Live values of your controls");
      const sliders = element("div", "ge-sliders");
      round.controls.forEach((control, index) => {
        const field = element("div", "ge-slider-control");
        const head = element("div", "ge-control-head");
        const label = element("label", "", control.label);
        const controlId = `${instance}-control-${index}`;
        label.htmlFor = controlId;
        const output = element("output", "ge-control-value");
        output.htmlFor = controlId;
        output.hidden = true;
        const entry = element("div", "ge-value-entry");
        const precise = element("input", "ge-number");
        precise.type = "number";
        precise.min = control.min;
        precise.max = control.max;
        precise.step = control.step;
        precise.value = control.initial;
        precise.setAttribute("aria-label", `${control.label}, enter a value`);
        entry.append(precise);
        if (control.unit)
          entry.append(element("span", "ge-number-unit", control.unit));
        const input = element("input", "ge-range");
        input.type = "range";
        input.id = controlId;
        input.min = control.min;
        input.max = control.max;
        input.step = control.step;
        input.value = control.initial;
        const sync = (updateEntry = true) => {
          output.value = `${response[control.id]}${control.unit ? ` ${control.unit}` : ""}`;
          if (updateEntry) {
            precise.value = response[control.id];
            precise.removeAttribute("aria-invalid");
            invalidControls.delete(control.id);
          }
          input.setAttribute("aria-valuetext", output.value);
          input.style.setProperty(
            "--range-fill",
            `${((response[control.id] - control.min) / (control.max - control.min)) * 100}%`,
          );
        };
        on(input, "input", () => {
          if (disabled) return;
          response[control.id] = Number(input.value);
          sync();
          changed();
        });
        on(precise, "input", () => {
          if (disabled) return;
          if (
            !precise.value ||
            !precise.validity.valid ||
            !Number.isFinite(precise.valueAsNumber)
          ) {
            invalidControls.add(control.id);
            precise.setAttribute("aria-invalid", "true");
            return;
          }
          invalidControls.delete(control.id);
          precise.removeAttribute("aria-invalid");
          response[control.id] = precise.valueAsNumber;
          input.value = precise.value;
          sync(false);
          changed();
        });
        on(precise, "change", () => {
          if (invalidControls.has(control.id)) precise.reportValidity();
          else sync();
        });
        const bounds = element("div", "ge-control-bounds");
        bounds.append(
          element(
            "span",
            "",
            `${control.min}${control.unit ? ` ${control.unit}` : ""}`,
          ),
          element(
            "span",
            "",
            `${control.max}${control.unit ? ` ${control.unit}` : ""}`,
          ),
        );
        head.append(label, entry, output);
        field.append(head, input, bounds);
        sliders.append(field);
        resetControls.push(() => {
          input.value = response[control.id];
          sync();
        });
        sync();
      });
      root.append(sliders);
      renderVisual = () => {
        svg.replaceChildren();
        axes(svg);
        const kind = round.visual?.kind;
        const context = round.context || {};
        const findControl = (term) =>
          round.controls.find((control) =>
            new RegExp(term, "i").test(control.id),
          );
        const slope = findControl("slope");
        const intercept = findControl("intercept");
        const frequency = findControl("frequency|^freq$");
        const amplitude = findControl("amplitude|^amp$");
        const currentValue = response[round.controls[0].id];
        if (context.kind === "mean" && Array.isArray(context.points)) {
          const values = context.points.map((point) => point.y);
          const maximum = Math.max(round.controls[0].max, ...values, 1);
          barPlot(
            svg,
            values,
            values.map((_, index) => `Reading ${index + 1}`),
            maximum,
          );
          const y = 205 - (currentValue / maximum) * 165;
          svg.append(
            svgNode("line", {
              x1: 40,
              y1: y,
              x2: 630,
              y2: y,
              class: "ge-threshold-line",
            }),
          );
          svg.append(
            svgNode(
              "text",
              {
                x: 630,
                y: Math.max(18, y - 8),
                "text-anchor": "end",
                class: "ge-chart-value",
              },
              `Your mean: ${currentValue}`,
            ),
          );
        } else if (
          context.kind === "sampling" &&
          Number.isFinite(context.frequency) &&
          context.frequency > 0
        ) {
          const timeWindow = Math.min(1, 4 / context.frequency);
          const waveY = (time) =>
            115 - Math.sin(time * Math.PI * 2 * context.frequency) * 75;
          const d = Array.from(
            { length: 361 },
            (_, i) =>
              `${i ? "L" : "M"}${40 + (i / 360) * 590},${waveY((i / 360) * timeWindow)}`,
          ).join(" ");
          svg.append(svgNode("path", { d, class: "ge-sampling-wave" }));
          const count = Math.min(
            240,
            Math.floor(Math.max(0, currentValue) * timeWindow),
          );
          for (let i = 0; i <= count && currentValue > 0; i += 1) {
            const time = i / currentValue;
            const x = 40 + (time / timeWindow) * 590;
            const y = waveY(time);
            svg.append(
              svgNode("line", {
                x1: x,
                y1: 205,
                x2: x,
                y2: y,
                class: "ge-sample-stem",
              }),
            );
            svg.append(
              svgNode("circle", {
                cx: x,
                cy: y,
                r: 4.5,
                class: "ge-data-point",
              }),
            );
          }
          svg.append(
            svgNode(
              "text",
              { x: 40, y: 240, class: "ge-chart-label" },
              `Signal: ${context.frequency} Hz`,
            ),
          );
          svg.append(
            svgNode(
              "text",
              { x: 630, y: 240, "text-anchor": "end", class: "ge-chart-label" },
              `${currentValue} samples/s · ${Number(timeWindow.toFixed(2))} s shown`,
            ),
          );
        } else if (
          context.kind === "fit" &&
          Number.isFinite(context.holeDiameter) &&
          context.holeDiameter > 0
        ) {
          svg.replaceChildren();
          const scale =
            85 / Math.max(context.holeDiameter, round.controls[0].max);
          svg.append(
            svgNode("line", {
              x1: 60,
              y1: 125,
              x2: 290,
              y2: 125,
              class: "ge-chart-grid",
            }),
          );
          svg.append(
            svgNode("line", {
              x1: 175,
              y1: 15,
              x2: 175,
              y2: 235,
              class: "ge-chart-grid",
            }),
          );
          svg.append(
            svgNode("circle", {
              cx: 175,
              cy: 125,
              r: context.holeDiameter * scale,
              class: "ge-fit-hole",
            }),
          );
          svg.append(
            svgNode("circle", {
              cx: 175,
              cy: 125,
              r: Math.max(1, currentValue * scale),
              class: `ge-fit-shaft${currentValue > context.holeDiameter ? " is-interference" : ""}`,
            }),
          );
          svg.append(
            svgNode(
              "text",
              { x: 345, y: 77, class: "ge-chart-label" },
              "HOLE DIAMETER",
            ),
          );
          svg.append(
            svgNode(
              "text",
              { x: 345, y: 103, class: "ge-chart-value" },
              `${context.holeDiameter} mm`,
            ),
          );
          svg.append(
            svgNode(
              "text",
              { x: 345, y: 142, class: "ge-chart-label" },
              "SHAFT DIAMETER",
            ),
          );
          svg.append(
            svgNode(
              "text",
              { x: 345, y: 168, class: "ge-chart-value" },
              `${currentValue} mm`,
            ),
          );
          const clearance = Number(
            (context.holeDiameter - currentValue).toFixed(3),
          );
          svg.append(
            svgNode(
              "text",
              {
                x: 330,
                y: 238,
                "text-anchor": "middle",
                class: "ge-chart-value",
              },
              `Diametral clearance: ${clearance} mm`,
            ),
          );
        } else if (
          context.kind === "mixture" &&
          Number.isFinite(context.totalVolume) &&
          context.totalVolume > 0 &&
          Number.isFinite(context.lowConcentration) &&
          Number.isFinite(context.highConcentration)
        ) {
          svg.replaceChildren();
          const highVolume = clamp(currentValue, 0, context.totalVolume);
          const lowVolume = context.totalVolume - highVolume;
          [
            {
              x: 85,
              volume: lowVolume,
              concentration: context.lowConcentration,
            },
            {
              x: 375,
              volume: highVolume,
              concentration: context.highConcentration,
            },
          ].forEach((tank, index) => {
            const height = (tank.volume / context.totalVolume) * 140;
            svg.append(
              svgNode("rect", {
                x: tank.x,
                y: 45,
                width: 200,
                height: 140,
                rx: 8,
                class: "ge-mixture-tank",
              }),
            );
            svg.append(
              svgNode("rect", {
                x: tank.x + 4,
                y: 185 - height,
                width: 192,
                height: Math.max(0, height - 4),
                rx: 5,
                class: `ge-mixture-fill ge-mixture-fill-${index}`,
              }),
            );
            svg.append(
              svgNode(
                "text",
                {
                  x: tank.x + 100,
                  y: 29,
                  "text-anchor": "middle",
                  class: "ge-chart-label",
                },
                `${tank.concentration}% concentrate`,
              ),
            );
            svg.append(
              svgNode(
                "text",
                {
                  x: tank.x + 100,
                  y: 211,
                  "text-anchor": "middle",
                  class: "ge-chart-value",
                },
                `${Number(tank.volume.toFixed(2))} L`,
              ),
            );
          });
          const concentration =
            (lowVolume * context.lowConcentration +
              highVolume * context.highConcentration) /
            context.totalVolume;
          svg.append(
            svgNode(
              "text",
              {
                x: 330,
                y: 248,
                "text-anchor": "middle",
                class: "ge-chart-value",
              },
              `Combined: ${context.totalVolume} L at ${Number(concentration.toFixed(2))}%`,
            ),
          );
        } else if (
          kind === "line" &&
          Array.isArray(context.points) &&
          (slope || intercept)
        ) {
          pointsPlot(svg, context.points, {
            slope: slope ? response[slope.id] : Number(context.slope ?? 1),
            intercept: intercept
              ? response[intercept.id]
              : Number(context.intercept ?? 0),
          });
        } else if (kind === "signal" && (frequency || amplitude)) {
          const f = frequency
            ? response[frequency.id]
            : Number(context.frequency ?? 2);
          const a = amplitude
            ? response[amplitude.id]
            : Number(context.amplitude ?? 1);
          const maxAmplitude = amplitude
            ? Math.max(Math.abs(amplitude.min), Math.abs(amplitude.max), 1)
            : Math.max(1, Math.abs(a));
          const points = Array.from({ length: 241 }, (_, i) => {
            const t = i / 240;
            return `${i ? "L" : "M"}${40 + t * 590},${115 - ((Math.sin(t * Math.PI * 2 * Math.min(f, 24)) * a) / maxAmplitude) * 80}`;
          });
          svg.append(
            svgNode("path", { d: points.join(" "), class: "ge-plot-line" }),
          );
          svg.append(
            svgNode(
              "text",
              { x: 40, y: 240, class: "ge-chart-label" },
              `Amplitude ${a} · Frequency ${f}${f > 24 ? " (24 cycles shown)" : ""}`,
            ),
          );
        } else if (
          kind === "threshold" &&
          (Array.isArray(context.values) || Array.isArray(context.points))
        ) {
          const control = findControl("threshold") || round.controls[0];
          const values =
            context.values || context.points.map((point) => point.y);
          const threshold = response[control.id];
          const maximum = Math.max(control.max, ...values, 1);
          barPlot(svg, values, context.labels, maximum);
          const y = 205 - (threshold / maximum) * 165;
          svg.append(
            svgNode("line", {
              x1: 40,
              y1: y,
              x2: 630,
              y2: y,
              class: "ge-threshold-line",
            }),
          );
          svg.append(
            svgNode(
              "text",
              {
                x: 630,
                y: Math.max(16, y - 8),
                "text-anchor": "end",
                class: "ge-chart-value",
              },
              `${control.label}: ${threshold}`,
            ),
          );
        } else {
          const width = 570 / round.controls.length;
          round.controls.forEach((control, index) => {
            const height =
              ((response[control.id] - control.min) /
                (control.max - control.min)) *
              165;
            svg.append(
              svgNode("rect", {
                x: 50 + index * width + width * 0.15,
                y: 40,
                width: width * 0.7,
                height: 165,
                rx: 6,
                class: "ge-bar-track",
              }),
            );
            svg.append(
              svgNode("rect", {
                x: 50 + index * width + width * 0.15,
                y: 205 - height,
                width: width * 0.7,
                height: Math.max(2, height),
                rx: 6,
                class: "ge-chart-bar is-active",
              }),
            );
            svg.append(
              svgNode(
                "text",
                {
                  x: 50 + (index + 0.5) * width,
                  y: Math.max(27, 193 - height),
                  "text-anchor": "middle",
                  class: "ge-chart-value",
                },
                `${response[control.id]}${control.unit ? ` ${control.unit}` : ""}`,
              ),
            );
            const label =
              control.label.length > 25
                ? `${control.label.slice(0, 23)}…`
                : control.label;
            svg.append(
              svgNode(
                "text",
                {
                  x: 50 + (index + 0.5) * width,
                  y: 235,
                  "text-anchor": "middle",
                  class: "ge-chart-label",
                },
                label,
              ),
            );
          });
        }
      };
    }

    function sortGame() {
      const list = element("ol", "ge-sort-list");
      const rows = new Map();
      const items = new Map(round.items.map((item) => [item.id, item]));
      function move(id, to) {
        const from = response.indexOf(id);
        if (
          disabled ||
          from < 0 ||
          to < 0 ||
          to >= response.length ||
          from === to
        )
          return;
        response.splice(from, 1);
        response.splice(to, 0, id);
        sync();
        announce(`${items.get(id).label} moved to step ${to + 1}.`);
        changed();
      }
      round.items.forEach((item) => {
        const row = element("li", "ge-sort-item");
        row.draggable = true;
        row.dataset.itemId = item.id;
        const number = element("span", "ge-step-number");
        const label = element("span", "ge-sort-label", item.label);
        const controls = element("div", "ge-sort-controls");
        const up = button("↑", "ge-icon-button", () =>
          move(item.id, response.indexOf(item.id) - 1),
        );
        up.setAttribute("aria-label", `Move ${item.label} up`);
        const down = button("↓", "ge-icon-button", () =>
          move(item.id, response.indexOf(item.id) + 1),
        );
        down.setAttribute("aria-label", `Move ${item.label} down`);
        controls.append(up, down);
        row.append(number, label, controls);
        on(row, "dragstart", (event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          dragId = item.id;
          event.dataTransfer?.setData("text/plain", item.id);
          row.classList.add("is-dragging");
        });
        on(row, "dragover", (event) => {
          if (!disabled && dragId) event.preventDefault();
        });
        on(row, "drop", (event) => {
          event.preventDefault();
          if (!disabled && dragId) move(dragId, response.indexOf(item.id));
        });
        on(row, "dragend", () => {
          row.classList.remove("is-dragging");
          dragId = null;
        });
        rows.set(item.id, { row, number, up, down });
      });
      function sync() {
        const focused = doc.activeElement;
        response.forEach((id, index) => {
          const item = rows.get(id);
          item.number.textContent = String(index + 1).padStart(2, "0");
          item.up.disabled = disabled || index === 0;
          item.down.disabled = disabled || index === response.length - 1;
          list.append(item.row);
        });
        if (focused && root.contains(focused) && !focused.disabled)
          focused.focus({ preventScroll: true });
      }
      root.append(list);
      renderVisual = sync;
      sync();
    }

    function matchGame() {
      const board = element("div", "ge-match-board");
      const left = element("div", "ge-match-column");
      const right = element("div", "ge-match-column");
      left.setAttribute("aria-label", "Items to match");
      right.setAttribute("aria-label", "Matching choices");
      const connections = svgNode("svg", {
        viewBox: "0 0 100 100",
        preserveAspectRatio: "none",
        "aria-hidden": "true",
        class: "ge-match-lines",
      });
      const leftButtons = new Map();
      const rightButtons = new Map();
      round.left.forEach((item, index) => {
        const choice = button("", "ge-match-choice", () => {
          active = active === item.id ? null : item.id;
          sync();
          announce(
            active ? `Choose a match for ${item.label}.` : "Selection cleared.",
          );
        });
        const tag = element("span", "ge-match-tag", String(index + 1));
        const label = element("span", "", item.label);
        const matchLabel = element("small", "ge-match-assignment");
        choice.append(tag, label, matchLabel);
        choice.setAttribute("aria-pressed", "false");
        leftButtons.set(item.id, { choice, matchLabel });
        left.append(choice);
      });
      round.right.forEach((item) => {
        const choice = button("", "ge-match-choice", () => {
          if (!active) {
            announce("Select an item on the left first.");
            leftButtons.values().next().value.choice.focus();
            return;
          }
          const current = active;
          Object.keys(response).forEach((key) => {
            if (response[key] === item.id) delete response[key];
          });
          response[current] = item.id;
          active = null;
          sync();
          announce(
            `${round.left.find((entry) => entry.id === current).label} matched with ${item.label}.`,
          );
          changed();
        });
        const tag = element("span", "ge-match-tag", "·");
        choice.append(tag, element("span", "", item.label));
        rightButtons.set(item.id, { choice, tag });
        right.append(choice);
      });
      function sync() {
        connections.replaceChildren();
        round.left.forEach((item, index) => {
          const { choice, matchLabel } = leftButtons.get(item.id);
          const matched = round.right.find(
            (entry) => entry.id === response[item.id],
          );
          choice.classList.toggle("is-selected", active === item.id);
          choice.classList.toggle("is-matched", !!matched);
          choice.setAttribute("aria-pressed", String(active === item.id));
          choice.setAttribute(
            "aria-label",
            `${item.label}${matched ? `, matched with ${matched.label}` : ", unmatched"}`,
          );
          matchLabel.textContent = matched ? `→ ${matched.label}` : "";
          if (matched) {
            const to = round.right.findIndex(
              (entry) => entry.id === matched.id,
            );
            connections.append(
              svgNode("path", {
                d: `M0 ${((index + 0.5) / round.left.length) * 100} C45 ${((index + 0.5) / round.left.length) * 100},55 ${((to + 0.5) / round.right.length) * 100},100 ${((to + 0.5) / round.right.length) * 100}`,
                class: "ge-connection",
              }),
            );
          }
        });
        round.right.forEach((item) => {
          const owner = round.left.findIndex(
            (entry) => response[entry.id] === item.id,
          );
          const { choice, tag } = rightButtons.get(item.id);
          choice.classList.toggle("is-matched", owner >= 0);
          tag.textContent = owner >= 0 ? String(owner + 1) : "·";
          choice.setAttribute(
            "aria-label",
            `${item.label}${owner >= 0 ? `, matched with ${round.left[owner].label}` : ""}`,
          );
        });
      }
      board.append(left, connections, right);
      root.append(board);
      renderVisual = sync;
      sync();
    }

    function classifyGame() {
      const items = element("div", "ge-classify-items");
      const buckets = element("div", "ge-buckets");
      const itemButtons = new Map();
      const bucketContents = new Map();
      function assign(itemId, bucketId) {
        if (disabled || !round.items.some((item) => item.id === itemId)) return;
        response[itemId] = bucketId;
        active = null;
        sync();
        announce(
          `${round.items.find((item) => item.id === itemId).label} placed in ${round.buckets.find((bucket) => bucket.id === bucketId).label}.`,
        );
        changed();
      }
      round.items.forEach((item) => {
        const choice = button("", "ge-classify-item", () => {
          active = active === item.id ? null : item.id;
          sync();
          announce(
            active ? `Choose a group for ${item.label}.` : "Selection cleared.",
          );
        });
        const label = element("span", "", item.label);
        const assignment = element("small", "ge-item-assignment");
        choice.append(label, assignment);
        choice.draggable = true;
        choice.setAttribute("aria-pressed", "false");
        on(choice, "dragstart", (event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          dragId = item.id;
          event.dataTransfer?.setData("text/plain", item.id);
          active = item.id;
          sync();
        });
        on(choice, "dragend", () => {
          dragId = null;
        });
        itemButtons.set(item.id, { choice, assignment });
        items.append(choice);
      });
      round.buckets.forEach((bucket, index) => {
        const area = element("div", "ge-bucket");
        area.style.setProperty("--bucket-index", index);
        const heading = button(bucket.label, "ge-bucket-heading", () => {
          if (active) assign(active, bucket.id);
          else announce("Select an item to place in this group.");
        });
        const content = element("div", "ge-bucket-content");
        bucketContents.set(bucket.id, content);
        area.append(heading, content);
        on(area, "dragover", (event) => {
          if (!disabled && dragId) {
            event.preventDefault();
            area.classList.add("is-drop-target");
          }
        });
        on(area, "dragleave", () => area.classList.remove("is-drop-target"));
        on(area, "drop", (event) => {
          event.preventDefault();
          area.classList.remove("is-drop-target");
          if (!disabled && dragId) assign(dragId, bucket.id);
        });
        buckets.append(area);
      });
      function sync() {
        bucketContents.forEach((content) => content.replaceChildren());
        round.items.forEach((item) => {
          const { choice, assignment } = itemButtons.get(item.id);
          const bucket = round.buckets.find(
            (entry) => entry.id === response[item.id],
          );
          choice.classList.toggle("is-selected", active === item.id);
          choice.classList.toggle("is-assigned", !!bucket);
          choice.setAttribute("aria-pressed", String(active === item.id));
          assignment.textContent = bucket ? bucket.label : "";
          if (bucket)
            bucketContents
              .get(bucket.id)
              .append(element("span", "ge-bucket-chip", item.label));
        });
      }
      root.append(items, buckets);
      renderVisual = sync;
      sync();
    }

    function gridGame() {
      const grid = element("div", "ge-heatmap");
      const textCells = round.cells.some(
        (cell) => String(cell.value).length > 16,
      );
      if (textCells) grid.classList.add("is-text-grid");
      grid.style.setProperty("--grid-columns", round.columns);
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", "Select matching cells");
      const numerical = round.cells
        .map((cell) => Number(cell.value))
        .filter(Number.isFinite);
      const low = Math.min(...numerical);
      const high = Math.max(...numerical);
      const buttons = [];
      round.cells.forEach((cell, index) => {
        const choice = button("", "ge-cell", () => {
          response = response.includes(cell.id)
            ? response.filter((id) => id !== cell.id)
            : [...response, cell.id];
          sync();
          announce(
            `${response.length} ${response.length === 1 ? "cell" : "cells"} selected.`,
          );
          changed();
        });
        const numericalValue = Number(cell.value);
        const level = Number.isFinite(numericalValue)
          ? clamp((numericalValue - low) / (high - low || 1), 0, 1)
          : 0.4;
        choice.style.setProperty("--heat", `${8 + level * 28}%`);
        choice.setAttribute(
          "aria-label",
          textCells
            ? String(cell.value)
            : `Row ${Math.floor(index / round.columns) + 1}, column ${(index % round.columns) + 1}: ${cell.value}`,
        );
        choice.setAttribute("aria-pressed", "false");
        choice.append(
          element("span", "ge-cell-value", cell.value),
          element("span", "ge-cell-check", "✓"),
        );
        on(choice, "keydown", (event) => {
          if (disabled) return;
          const deltas = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: round.columns,
            ArrowUp: -round.columns,
          };
          if (own(deltas, event.key)) {
            event.preventDefault();
            buttons[
              clamp(index + deltas[event.key], 0, buttons.length - 1)
            ].focus();
          }
        });
        buttons.push(choice);
        grid.append(choice);
      });
      function sync() {
        buttons.forEach((choice, index) => {
          const selected = response.includes(round.cells[index].id);
          choice.classList.toggle("is-selected", selected);
          choice.setAttribute("aria-pressed", String(selected));
        });
      }
      root.append(grid);
      renderVisual = sync;
      sync();
    }

    function routeGame() {
      const board = element("div", "ge-route-board");
      const svg = svgNode("svg", {
        viewBox: "0 0 100 100",
        preserveAspectRatio: "none",
        class: "ge-route-lines",
        "aria-hidden": "true",
      });
      board.append(svg);
      const positions = new Map();
      const buttons = new Map();
      const minX = Math.min(...round.nodes.map((node) => node.x));
      const maxX = Math.max(...round.nodes.map((node) => node.x));
      const minY = Math.min(...round.nodes.map((node) => node.y));
      const maxY = Math.max(...round.nodes.map((node) => node.y));
      // Link count carries the cost; spread crowded rows to separate touch targets.
      const rows = new Map();
      round.nodes.forEach((node) => {
        if (!rows.has(node.y)) rows.set(node.y, []);
        rows.get(node.y).push(node);
      });
      rows.forEach((row) => row.sort((a, b) => a.x - b.x));
      const blocked = new Set(round.blocked || []);
      const required = new Set(round.required || []);
      const finished = () =>
        response[response.length - 1] === round.end &&
        [...required].every((id) => response.includes(id));
      const adjacent = (a, b) =>
        round.edges.some(
          ([x, y]) => (x === a && y === b) || (y === a && x === b),
        );
      round.nodes.forEach((node) => {
        const row = rows.get(node.y);
        const x =
          row.length >= 3
            ? 13 +
              (row.findIndex((entry) => entry.id === node.id) /
                (row.length - 1)) *
                74
            : minX === maxX
              ? 50
              : 13 + ((node.x - minX) / (maxX - minX)) * 74;
        const y =
          minY === maxY ? 50 : 15 + ((node.y - minY) / (maxY - minY)) * 70;
        positions.set(node.id, { x, y });
        const choice = button("", "ge-route-node", () => {
          if (blocked.has(node.id)) return;
          const index = response.indexOf(node.id);
          if (node.id === response[response.length - 1]) return;
          if (index >= 0 && !required.size)
            response = response.slice(0, index + 1);
          else if (finished()) {
            announce(
              "You reached the finish. Use Back to explore another route.",
            );
            return;
          } else if (adjacent(response[response.length - 1], node.id))
            response.push(node.id);
          else {
            announce(
              "Choose a node connected to the current end of your path.",
            );
            return;
          }
          sync();
          announce(
            finished()
              ? `Finish reached in ${response.length - 1} steps.`
              : `Current node: ${node.label}. ${response.length - 1} steps.`,
          );
          changed();
        });
        choice.style.left = `${x}%`;
        choice.style.top = `${y}%`;
        const number = element(
          "span",
          "ge-route-node-symbol",
          blocked.has(node.id)
            ? "×"
            : node.id === round.start
              ? "S"
              : node.id === round.end
                ? "F"
                : required.has(node.id)
                  ? "◇"
                  : "•",
        );
        choice.append(
          number,
          element("span", "ge-route-node-label", node.label),
        );
        choice.setAttribute(
          "aria-label",
          `${node.label}${node.id === round.start ? ", start" : node.id === round.end ? ", finish" : ""}${required.has(node.id) ? ", required waypoint" : ""}${blocked.has(node.id) ? ", blocked" : ""}`,
        );
        if (blocked.has(node.id)) {
          choice.disabled = true;
          choice.dataset.permanentDisabled = "true";
          choice.classList.add("is-blocked");
        }
        buttons.set(node.id, choice);
        board.append(choice);
      });
      const controls = element("div", "ge-route-controls");
      const back = button("← Back", "ge-button", () => {
        if (response.length > 1) {
          response.pop();
          changed();
          announce("Last step removed.");
        }
      });
      const clear = button("Clear path", "ge-button", () => {
        response = [round.start];
        changed();
        announce("Path cleared.");
      });
      const count = element("span", "ge-route-count");
      controls.append(back, clear, count);
      function sync() {
        svg.replaceChildren();
        round.edges.forEach(([a, b]) => {
          const from = positions.get(a);
          const to = positions.get(b);
          const inPath = response.some(
            (id, index) =>
              index > 0 &&
              ((response[index - 1] === a && id === b) ||
                (response[index - 1] === b && id === a)),
          );
          const edgeClass = `ge-route-edge${inPath ? " is-active" : ""}${blocked.has(a) || blocked.has(b) ? " is-blocked" : ""}`;
          const skipsNode =
            from.y === to.y &&
            Array.from(positions.values()).some(
              (position) =>
                position.y === from.y &&
                position.x > Math.min(from.x, to.x) &&
                position.x < Math.max(from.x, to.x),
            );
          if (skipsNode) {
            // A bypass stays visually separate from the nodes it skips.
            svg.append(
              svgNode("path", {
                d: `M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${from.y + (from.y <= 50 ? -20 : 20)} ${to.x} ${to.y}`,
                class: edgeClass,
              }),
            );
          } else
            svg.append(
              svgNode("line", {
                x1: from.x,
                y1: from.y,
                x2: to.x,
                y2: to.y,
                class: edgeClass,
              }),
            );
        });
        buttons.forEach((choice, id) => {
          const index = response.indexOf(id);
          const current = response[response.length - 1];
          choice.classList.toggle("is-selected", index >= 0);
          choice.classList.toggle("is-current", id === current);
          choice.classList.toggle(
            "is-available",
            !blocked.has(id) &&
              (index < 0 || required.size > 0) &&
              !finished() &&
              adjacent(current, id),
          );
          choice.setAttribute("aria-pressed", String(index >= 0));
        });
        back.disabled = disabled || response.length <= 1;
        clear.disabled = disabled || response.length <= 1;
        count.textContent = `${response.length - 1} ${response.length === 2 ? "step" : "steps"}`;
      }
      root.append(board, controls);
      renderVisual = sync;
      sync();
    }

    const renderers = {
      select: selectGame,
      tune: tuneGame,
      sort: sortGame,
      match: matchGame,
      classify: classifyGame,
      grid: gridGame,
      route: routeGame,
    };
    renderers[round.type]();
    root.append(status);
    container.replaceChildren(root);
    renderVisual();
    function setDisabled(value) {
      disabled = Boolean(value);
      root.classList.toggle("is-locked", disabled);
      root.querySelectorAll("button, input").forEach((control) => {
        control.disabled =
          disabled || control.dataset.permanentDisabled === "true";
      });
      root.querySelectorAll("[draggable]").forEach((control) => {
        control.draggable = !disabled;
      });
      renderVisual();
    }
    return {
      evaluate: () =>
        invalidControls.size
          ? result(
              0,
              false,
              false,
              "Enter valid numbers within each control’s range and step.",
            )
          : evaluateRound(round, getResponse()),
      getResponse,
      setDisabled,
      setResponse: (value) => {
        if (destroyed || !validResponse(round, value)) return false;
        response = Array.isArray(value)
          ? [...value]
          : round.type === "tune"
            ? { ...response, ...value }
            : { ...value };
        active = null;
        resetControls.forEach((sync) => sync());
        changed();
        return true;
      },
      reset: () => {
        if (destroyed) return;
        response = initialResponse(round);
        active = null;
        dragId = null;
        resetControls.forEach((sync) => sync());
        announce("");
        setDisabled(false);
        changed();
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        listeners.forEach((remove) => remove());
        root.remove();
      },
    };
  }

  return Object.freeze({
    mount,
    evaluateRound,
    validateRound,
    shortestPath,
    validResponse,
    types: Object.freeze(TYPES),
  });
});
