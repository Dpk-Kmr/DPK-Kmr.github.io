/* Transparent local solvers: public problem models in, reproducible algorithm traces out. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AtrikshaGameAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const own = (object, key) =>
    Object.prototype.hasOwnProperty.call(object || {}, key);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const families = [
    "formula",
    "filter",
    "classify",
    "sort",
    "match",
    "select",
    "route",
    "knapsack",
    "toposort",
  ];
  const display = (value) =>
    typeof value === "number"
      ? String(Number(value.toPrecision(9)))
      : JSON.stringify(value);
  const same = (a, b) => {
    if (typeof a !== typeof b) return false;
    if (a === null || b === null || typeof a !== "object") return a === b;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => own(b, key) && same(a[key], b[key]))
    );
  };
  const numeric = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error("A calculation needs a finite number.");
    return value;
  };
  const summary = (value) => {
    const text = display(value);
    return text && text.length > 140 ? text.slice(0, 137) + "…" : String(text);
  };
  const operations = new Set([
    "add",
    "sub",
    "mul",
    "div",
    "pow",
    "abs",
    "min",
    "max",
    "sum",
    "mean",
    "median",
    "variance",
    "count",
    "eq",
    "ne",
    "lt",
    "lte",
    "gt",
    "gte",
    "and",
    "or",
    "not",
    "if",
    "mod",
    "bitcount",
    "round",
    "floor",
    "ceil",
    "sqrt",
    "sort",
    "slice",
  ]);

  function reference(scope, path) {
    let value = scope;
    for (const key of String(path).split(".")) {
      if (
        ["__proto__", "prototype", "constructor"].includes(key) ||
        value == null ||
        !own(value, key)
      )
        throw new Error(`Missing public input: ${path}`);
      value = value[key];
    }
    return value;
  }
  function expression(node, scope = {}, trace, depth = 0) {
    if (depth > 60) throw new Error("Expression is too deeply nested.");
    if (node === null || ["string", "boolean", "number"].includes(typeof node))
      return node;
    if (Array.isArray(node))
      return node.map((value) => expression(value, scope, trace, depth + 1));
    if (!node || typeof node !== "object")
      throw new Error("Invalid expression.");
    if (own(node, "ref")) return reference(scope, node.ref);
    if (!operations.has(node.op) || !Array.isArray(node.args))
      throw new Error(`Unsupported expression operation: ${node.op}`);
    if (node.op === "if")
      return expression(
        node.args[expression(node.args[0], scope, trace, depth + 1) ? 1 : 2],
        scope,
        trace,
        depth + 1,
      );
    if (node.op === "and")
      return node.args.every((arg) =>
        Boolean(expression(arg, scope, trace, depth + 1)),
      );
    if (node.op === "or")
      return node.args.some((arg) =>
        Boolean(expression(arg, scope, trace, depth + 1)),
      );
    const a = node.args.map((arg) => expression(arg, scope, trace, depth + 1));
    const list = a.length === 1 && Array.isArray(a[0]) ? a[0] : a;
    let result;
    switch (node.op) {
      case "add":
        result = a.reduce((total, value) => total + numeric(value), 0);
        break;
      case "sub":
        result =
          a.length === 1
            ? -numeric(a[0])
            : a
                .slice(1)
                .reduce(
                  (total, value) => total - numeric(value),
                  numeric(a[0]),
                );
        break;
      case "mul":
        result = a.reduce((total, value) => total * numeric(value), 1);
        break;
      case "div":
        if (numeric(a[1]) === 0)
          throw new Error("Division by zero is undefined.");
        result = numeric(a[0]) / a[1];
        break;
      case "pow":
        result = Math.pow(numeric(a[0]), numeric(a[1]));
        break;
      case "abs":
        result = Math.abs(numeric(a[0]));
        break;
      case "sqrt":
        result = Math.sqrt(numeric(a[0]));
        break;
      case "min":
        result = Math.min(...list.map(numeric));
        break;
      case "max":
        result = Math.max(...list.map(numeric));
        break;
      case "sum":
        result = list.reduce((total, value) => total + numeric(value), 0);
        break;
      case "mean":
        result =
          list.reduce((total, value) => total + numeric(value), 0) /
          list.length;
        break;
      case "median": {
        const ordered = list.map(numeric).sort((x, y) => x - y);
        const middle = Math.floor(ordered.length / 2);
        result =
          ordered.length % 2
            ? ordered[middle]
            : (ordered[middle - 1] + ordered[middle]) / 2;
        break;
      }
      case "variance": {
        const mean =
          list.reduce((total, value) => total + numeric(value), 0) /
          list.length;
        result =
          list.reduce((total, value) => total + (value - mean) ** 2, 0) /
          list.length;
        break;
      }
      case "count":
        result =
          a.length === 1 && (Array.isArray(a[0]) || typeof a[0] === "string")
            ? a[0].length
            : a.length;
        break;
      case "eq":
        result = same(a[0], a[1]);
        break;
      case "ne":
        result = !same(a[0], a[1]);
        break;
      case "lt":
        result = a[0] < a[1];
        break;
      case "lte":
        result = a[0] <= a[1];
        break;
      case "gt":
        result = a[0] > a[1];
        break;
      case "gte":
        result = a[0] >= a[1];
        break;
      case "not":
        result = !a[0];
        break;
      case "mod":
        result = numeric(a[0]) % numeric(a[1]);
        break;
      case "bitcount":
        result =
          (typeof a[0] === "string"
            ? a[0]
            : Math.trunc(numeric(a[0])).toString(2)
          ).split("1").length - 1;
        break;
      case "round": {
        const scale = 10 ** (a[1] ?? 0);
        result = Math.round(numeric(a[0]) * scale) / scale;
        break;
      }
      case "floor":
        result = Math.floor(numeric(a[0]));
        break;
      case "ceil":
        result = Math.ceil(numeric(a[0]));
        break;
      case "sort":
        if (!Array.isArray(a[0])) throw new Error("sort needs an array.");
        result = a[0].map(numeric).sort((x, y) => x - y);
        break;
      case "slice":
        if (!Array.isArray(a[0])) throw new Error("slice needs an array.");
        result = a[0].slice(a[1], a[2]);
        break;
    }
    if (typeof result === "number" && !Number.isFinite(result))
      throw new Error("This expression has no finite result.");
    if (trace && trace.length < 18)
      trace.push({
        title: operationTitle(node.op),
        detail: `${node.op}(${a.map(summary).join(", ")}) = ${summary(result)}`,
      });
    return result;
  }
  function operationTitle(op) {
    return (
      {
        add: "Combine the terms",
        sub: "Find the difference",
        mul: "Multiply the factors",
        div: "Form the ratio",
        pow: "Apply the power",
        mean: "Share the total equally",
        median: "Find the middle value",
        variance: "Average squared deviations",
        sum: "Add the observations",
        sqrt: "Take the square root",
        round: "Round the displayed result",
        min: "Compare the candidates",
        max: "Find the largest candidate",
      }[op] || `Evaluate ${op}`
    );
  }

  function publicRoute(round) {
    return Object.fromEntries(
      ["nodes", "edges", "start", "end", "blocked", "required"].map((key) => [
        key,
        own(round.model, key) ? round.model[key] : round[key],
      ]),
    );
  }
  function validateModel(round) {
    const errors = [];
    if (!round || !families.includes(round.solver))
      return {
        valid: false,
        errors: ["Choose a supported public-model solver."],
      };
    const model = round.model;
    if (!model || typeof model !== "object" || Array.isArray(model))
      return { valid: false, errors: ["A public problem model is required."] };
    let nodes = 0;
    const seen = new Set();
    function inspect(value, depth = 0) {
      if (++nodes > 6000 || depth > 48)
        throw new Error("The model is too large or deeply nested.");
      if (typeof value === "number" && !Number.isFinite(value))
        throw new Error("Inputs must be finite numbers.");
      if (typeof value === "string" && value.length > 2000)
        throw new Error("An input string is too long.");
      if (value && typeof value === "object") {
        if (seen.has(value))
          throw new Error("The public model must not contain cycles.");
        seen.add(value);
        if (Array.isArray(value) && value.length > 1000)
          throw new Error("Input arrays are limited to 1,000 entries.");
        if (
          own(value, "op") &&
          (!operations.has(value.op) ||
            !Array.isArray(value.args) ||
            value.args.length > 100)
        )
          throw new Error(
            "An expression uses an unsupported operation or too many arguments.",
          );
        if (own(value, "op")) {
          const count = value.args.length;
          const unary = [
            "abs",
            "sqrt",
            "floor",
            "ceil",
            "not",
            "bitcount",
            "sort",
          ];
          const binary = [
            "div",
            "pow",
            "mod",
            "eq",
            "ne",
            "lt",
            "lte",
            "gt",
            "gte",
          ];
          if (
            !count ||
            (unary.includes(value.op) && count !== 1) ||
            (binary.includes(value.op) && count !== 2) ||
            (value.op === "if" && count !== 3) ||
            (value.op === "slice" && (count < 2 || count > 3)) ||
            (value.op === "round" && count > 2)
          )
            throw new Error(`Invalid argument count for ${value.op}.`);
        }
        Object.values(value).forEach((entry) => inspect(entry, depth + 1));
        seen.delete(value);
      }
    }
    try {
      inspect(model);
    } catch (error) {
      errors.push(error.message);
      return { valid: false, errors };
    }
    const checkRows = (rows, name, max = 100) => {
      if (
        !Array.isArray(rows) ||
        !rows.length ||
        rows.length > max ||
        rows.some((row) => !row || typeof row.id !== "string") ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        errors.push(`${name} needs unique item IDs and at most ${max} rows.`);
    };
    if (
      ["filter", "classify", "sort", "knapsack", "toposort"].includes(
        round.solver,
      )
    )
      checkRows(model.rows, "Rows", round.solver === "knapsack" ? 18 : 100);
    if (
      round.solver === "formula" &&
      (!model.outputs ||
        typeof model.outputs !== "object" ||
        !Object.keys(model.outputs).length)
    )
      errors.push("A formula needs named output expressions.");
    if (round.solver === "filter" && !own(model, "predicate"))
      errors.push("A filter needs a predicate.");
    if (
      round.solver === "classify" &&
      (!Array.isArray(model.rules) || !model.rules.length)
    )
      errors.push("A classifier needs explicit rules.");
    if (round.solver === "sort" && !own(model, "key"))
      errors.push("Sorting needs an observable key.");
    if (round.solver === "select") {
      checkRows(model.options, "Options");
      if (!own(model, "expression"))
        errors.push("Selection needs a computed expression.");
    }
    if (round.solver === "match") {
      checkRows(model.leftRows, "Left rows", 16);
      checkRows(model.rightRows, "Right rows", 16);
      if (!own(model, "leftKey") || !own(model, "rightKey"))
        errors.push("Matching needs observable keys on both sides.");
    }
    if (
      round.solver === "knapsack" &&
      (!Number.isFinite(model.capacity) ||
        model.capacity < 0 ||
        (Array.isArray(model.rows) ? model.rows : []).some(
          (row) =>
            !Number.isFinite(row.weight) ||
            row.weight < 0 ||
            !Number.isFinite(row.value),
        ))
    )
      errors.push(
        "Knapsack needs nonnegative weights/capacity and finite values.",
      );
    if (round.solver === "knapsack") {
      const names = new Set(
        (Array.isArray(model.rows) ? model.rows : []).map((row) => row.id),
      );
      if (
        model.maxItems !== undefined &&
        (!Number.isInteger(model.maxItems) ||
          model.maxItems < 0 ||
          model.maxItems > 18)
      )
        errors.push("The item-count cap must be an integer from 0 to 18.");
      if (
        model.incompatible &&
        (!Array.isArray(model.incompatible) ||
          model.incompatible.length > 64 ||
          model.incompatible.some(
            (pair) =>
              !Array.isArray(pair) ||
              pair.length !== 2 ||
              pair.some((id) => !names.has(id)),
          ))
      )
        errors.push(
          "Incompatible pairs must reference existing items; use at most 64 pairs.",
        );
      if (
        model.tieBreak &&
        !["first", "lower-weight-then-ids"].includes(model.tieBreak)
      )
        errors.push("Unknown knapsack tie-break policy.");
    }
    if (round.solver === "toposort") {
      const names = new Set(
        (Array.isArray(model.rows) ? model.rows : []).map((row) => row.id),
      );
      if (
        (Array.isArray(model.rows) ? model.rows : []).some(
          (row) =>
            row.requires &&
            (!Array.isArray(row.requires) ||
              row.requires.length > 100 ||
              row.requires.some((id) => !names.has(id))),
        )
      )
        errors.push("Dependencies must reference existing tasks.");
    }
    if (round.solver === "route") {
      const graph = publicRoute(round);
      checkRows(graph.nodes, "Nodes", 64);
      const names = new Set(
        (Array.isArray(graph.nodes) ? graph.nodes : []).map((node) => node.id),
      );
      if (
        !Array.isArray(graph.edges) ||
        graph.edges.length > 256 ||
        graph.edges.some(
          (edge) =>
            !Array.isArray(edge) ||
            edge.length !== 2 ||
            edge.some((id) => !names.has(id)),
        )
      )
        errors.push("Route links must connect existing nodes.");
      if (!names.has(graph.start) || !names.has(graph.end))
        errors.push("Route endpoints must exist.");
      if (
        graph.required &&
        (!Array.isArray(graph.required) ||
          graph.required.length > 8 ||
          new Set(graph.required).size !== graph.required.length ||
          graph.required.some((id) => !names.has(id)))
      )
        errors.push("Routes support at most eight existing waypoints.");
      if (
        graph.blocked &&
        (!Array.isArray(graph.blocked) ||
          graph.blocked.length > 64 ||
          graph.blocked.some((id) => !names.has(id)))
      )
        errors.push("Blocked nodes must exist in the graph.");
    }
    return { valid: !errors.length, errors };
  }

  function pythonLiteral(value, level = 0) {
    if (value === null) return "None";
    if (value === true) return "True";
    if (value === false) return "False";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return JSON.stringify(value);
    if (Array.isArray(value))
      return (
        "[" +
        value.map((entry) => pythonLiteral(entry, level + 1)).join(", ") +
        "]"
      );
    return (
      "{\n" +
      Object.entries(value)
        .map(
          ([key, entry]) =>
            "    ".repeat(level + 1) +
            JSON.stringify(key) +
            ": " +
            pythonLiteral(entry, level + 1),
        )
        .join(",\n") +
      "\n" +
      "    ".repeat(level) +
      "}"
    );
  }
  function pyExpression(node) {
    if (node === null || typeof node !== "object") return pythonLiteral(node);
    if (Array.isArray(node))
      return "[" + node.map(pyExpression).join(", ") + "]";
    if (own(node, "ref"))
      return (
        "v" +
        String(node.ref)
          .split(".")
          .map((key) =>
            /^\d+$/.test(key) ? `[${Number(key)}]` : `[${JSON.stringify(key)}]`,
          )
          .join("")
      );
    const a = node.args.map(pyExpression);
    const list = a.length === 1 ? `_list(${a[0]})` : `[${a.join(", ")}]`;
    const infix = {
      add: "+",
      sub: "-",
      mul: "*",
      div: "/",
      pow: "**",
      lt: "<",
      lte: "<=",
      gt: ">",
      gte: ">=",
      and: "and",
      or: "or",
    };
    if (node.op === "sub" && a.length === 1) return `(-${a[0]})`;
    if (infix[node.op]) return `(${a.join(` ${infix[node.op]} `)})`;
    switch (node.op) {
      case "if":
        return `(${a[1]} if ${a[0]} else ${a[2]})`;
      case "not":
        return `(not ${a[0]})`;
      case "eq":
        return `_same(${a[0]}, ${a[1]})`;
      case "ne":
        return `(not _same(${a[0]}, ${a[1]}))`;
      case "abs":
        return `abs(${a[0]})`;
      case "sqrt":
        return `math.sqrt(${a[0]})`;
      case "floor":
        return `math.floor(${a[0]})`;
      case "ceil":
        return `math.ceil(${a[0]})`;
      case "round":
        return `(math.floor(${a[0]} * 10 ** (${a[1] || 0}) + 0.5) / 10 ** (${a[1] || 0}))`;
      case "mod":
        return `math.fmod(${a[0]}, ${a[1]})`;
      case "min":
      case "max":
      case "sum":
        return `${node.op}(${list})`;
      case "mean":
        return `statistics.mean(${list})`;
      case "median":
        return `statistics.median(${list})`;
      case "variance":
        return `statistics.pvariance(${list})`;
      case "count":
        return a.length === 1
          ? `len(_list_or_string(${a[0]}))`
          : String(a.length);
      case "bitcount":
        return `_bits(${a[0]})`;
      case "sort":
        return `sorted(${a[0]})`;
      case "slice":
        return `(${a[0]})[${a[1] || "0"}:${a[2] || ""}]`;
      default:
        throw new Error(`Cannot generate Python for ${node.op}.`);
    }
  }
  function pythonScript(input, body) {
    let helpers = "import json\n";
    if (body.includes("math.")) helpers += "import math\n";
    if (body.includes("statistics.")) helpers += "import statistics\n";
    if (body.includes("deque(")) helpers += "from collections import deque\n";
    if (body.includes("_same("))
      helpers += `

def _same(a, b):
    number = (int, float)
    if isinstance(a, number) and not isinstance(a, bool) and isinstance(b, number) and not isinstance(b, bool):
        return a == b
    if type(a) is not type(b):
        return False
    if isinstance(a, list):
        return len(a) == len(b) and all(_same(x, y) for x, y in zip(a, b))
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(_same(a[k], b[k]) for k in a)
    return a == b
`;
    if (body.includes("_list("))
      helpers += `

def _list(value):
    return value if isinstance(value, list) else [value]
`;
    if (body.includes("_list_or_string("))
      helpers += `

def _list_or_string(value):
    return value if isinstance(value, (list, str)) else [value]
`;
    if (body.includes("_bits("))
      helpers += `

def _bits(value):
    return (value if isinstance(value, str) else bin(int(value))).count("1")
`;
    // The source contains its current input and prints the same response used by the browser.
    return `# Atriksha learning lab · deterministic algorithm, no trained model\n# Run with Python 3. No additional packages are required.\n${helpers}\n${body}\n\nproblem = ${pythonLiteral(input)}\nprint(json.dumps(solve(problem), ensure_ascii=False))\n`;
  }

  function solve(round) {
    const validation = validateModel(round);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    // Deliberately read only public model fields; never inspect any grading key.
    const model = round.model;
    const scope = model.data || {};
    const steps = [];
    let response, algorithm, complexity, input, body;
    const step = (title, detail, current, extra) =>
      steps.push({
        title,
        detail,
        ...(current === undefined
          ? {}
          : { state: { response: clone(current), ...extra } }),
      });
    if (round.solver === "formula") {
      algorithm = "Symbolic arithmetic · deterministic calculation";
      complexity =
        "O(e + n): expression nodes plus any observations being aggregated.";
      input = { data: clone(scope) };
      response = {};
      step(
        "Read the quantities",
        Object.entries(scope)
          .map(([key, value]) => `${key}: ${summary(value)}`)
          .join(" · ") || "Use the quantities stated in the formula.",
      );
      for (const [id, expr] of Object.entries(model.outputs)) {
        const trace = [];
        response[id] = expression(expr, scope, trace);
        numeric(response[id]);
        steps.push(...trace.slice(0, Math.max(0, 20 - steps.length)));
        step(
          `Set ${id}`,
          `The computed value is ${display(response[id])}.`,
          response,
        );
      }
      body = `def solve(problem):\n    v = problem["data"]\n    return {\n${Object.entries(
        model.outputs,
      )
        .map(
          ([id, expr]) =>
            `        ${JSON.stringify(id)}: ${pyExpression(expr)}`,
        )
        .join(",\n")}\n    }`;
    } else if (round.solver === "filter") {
      algorithm = "Predicate filtering · rule-based agent";
      complexity =
        "O(n × p): test p predicate operations for each of n records.";
      input = { data: clone(scope), rows: clone(model.rows) };
      response = [];
      for (const row of model.rows) {
        const keep = Boolean(expression(model.predicate, { ...scope, ...row }));
        if (keep) response.push(row.id);
        step(
          keep ? "Keep this item" : "Exclude this item",
          `${row.label || row.id}: the stated predicate evaluates to ${keep}. Inputs: ${summary(row)}.`,
          response,
        );
      }
      body = `def solve(problem):\n    selected = []\n    for row in problem["rows"]:\n        v = {**problem["data"], **row}\n        if ${pyExpression(model.predicate)}:\n            selected.append(row["id"])\n    return selected`;
    } else if (round.solver === "classify") {
      algorithm = "Ordered decision rules · rule-based classifier";
      complexity =
        "O(n × r × p): n records, up to r rules, p operations per rule.";
      input = { data: clone(scope), rows: clone(model.rows) };
      response = {};
      for (const row of model.rows) {
        const v = { ...scope, ...row };
        let bucket = model.defaultBucket;
        let found = -1;
        for (let i = 0; i < model.rules.length; i += 1)
          if (expression(model.rules[i].when, v)) {
            bucket = model.rules[i].bucket;
            found = i;
            break;
          }
        if (typeof bucket !== "string")
          throw new Error(`No classification rule covers ${row.id}.`);
        response[row.id] = bucket;
        step(
          `Classify ${row.label || row.id}`,
          `${found >= 0 ? `Rule ${found + 1} is the first matching rule` : "No earlier rule matches, so use the stated default"}. Observed features: ${summary(row)}.`,
          response,
        );
      }
      body = `def solve(problem):\n    classified = {}\n    for row in problem["rows"]:\n        v = {**problem["data"], **row}\n${model.rules.map((rule, i) => `        ${i ? "elif" : "if"} ${pyExpression(rule.when)}:\n            classified[row["id"]] = ${pythonLiteral(rule.bucket)}`).join("\n")}\n        else:\n${typeof model.defaultBucket === "string" ? `            classified[row["id"]] = ${pythonLiteral(model.defaultBucket)}` : '            raise ValueError("No rule covers this record")'}\n    return classified`;
    } else if (round.solver === "sort") {
      algorithm = "Stable ordering by a computed key · classical algorithm";
      complexity =
        "O(n log n) comparisons, plus computing the key for every item.";
      input = { data: clone(scope), rows: clone(model.rows) };
      const rows = model.rows.map((row, index) => ({
        row,
        index,
        key: expression(model.key, { ...scope, ...row }),
      }));
      rows.forEach((entry) =>
        step(
          "Compute the ordering key",
          `${entry.row.label || entry.row.id}: ${summary(entry.key)}.`,
        ),
      );
      const descending = model.direction === "desc";
      rows.sort(
        (a, b) =>
          (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) *
            (descending ? -1 : 1) || a.index - b.index,
      );
      response = rows.map((entry) => entry.row.id);
      step(
        `Order ${descending ? "largest to smallest" : "smallest to largest"}`,
        `Stable sorting preserves the original order of items whose keys tie.`,
        response,
      );
      body = `def solve(problem):\n    def key(row):\n        v = {**problem["data"], **row}\n        return ${pyExpression(model.key)}\n    return [row["id"] for row in sorted(problem["rows"], key=key, reverse=${descending ? "True" : "False"})]`;
    } else if (round.solver === "match") {
      algorithm = "Observable-key matching · deterministic constraints";
      complexity =
        "O(n²) key comparisons: reserve one compatible destination for each source.";
      input = {
        data: clone(scope),
        leftRows: clone(model.leftRows),
        rightRows: clone(model.rightRows),
      };
      const left = model.leftRows.map((row) => ({
        id: row.id,
        key: expression(model.leftKey, { ...scope, ...row }),
      }));
      const right = model.rightRows.map((row) => ({
        id: row.id,
        key: expression(model.rightKey, { ...scope, ...row }),
      }));
      const chosen = {};
      const used = new Set();
      for (const source of left) {
        const candidate = right.find(
          (entry) => !used.has(entry.id) && same(source.key, entry.key),
        );
        if (!candidate)
          throw new Error(
            "The public matching constraints have no complete solution.",
          );
        chosen[source.id] = candidate.id;
        used.add(candidate.id);
      }
      response = chosen;
      const partial = {};
      left.forEach((entry) => {
        partial[entry.id] = chosen[entry.id];
        step(
          "Connect equal conceptual keys",
          `${entry.id} yields ${summary(entry.key)}; ${chosen[entry.id]} yields the same key. Reserve that destination for this match.`,
          partial,
        );
      });
      body = `def solve(problem):
    def left_key(row):
        v = {**problem["data"], **row}
        return ${pyExpression(model.leftKey)}
    def right_key(row):
        v = {**problem["data"], **row}
        return ${pyExpression(model.rightKey)}
    left = [(row["id"], left_key(row)) for row in problem["leftRows"]]
    right = [(row["id"], right_key(row)) for row in problem["rightRows"]]
    chosen, used = {}, set()
    for source_id, source_key in left:
        for target_id, target_key in right:
            if target_id not in used and _same(source_key, target_key):
                chosen[source_id] = target_id
                used.add(target_id)
                break
        else:
            raise ValueError("No complete matching")
    return chosen`;
    } else if (round.solver === "select") {
      algorithm = "Compute and compare candidates · deterministic reasoning";
      complexity = "O(e + n): evaluate the expression, then compare n options.";
      input = { data: clone(scope), options: clone(model.options) };
      const trace = [];
      const value = expression(model.expression, scope, trace);
      steps.push(...trace);
      const tolerance = model.tolerance ?? 1e-8;
      response = model.options
        .filter((option) =>
          typeof value === "number" && typeof option.value === "number"
            ? Math.abs(value - option.value) <= tolerance
            : same(value, option.value),
        )
        .map((option) => option.id);
      if (!response.length)
        throw new Error("No option matches the computed value.");
      step(
        "Compare the computed result with the options",
        `The result is ${summary(value)}. ${response.length} ${response.length === 1 ? "option matches" : "options match"}.`,
        response,
      );
      body = `def solve(problem):\n    v = problem["data"]\n    result = ${pyExpression(model.expression)}\n    selected = []\n    for option in problem["options"]:\n        value = option["value"]\n        numeric = isinstance(result, (int, float)) and not isinstance(result, bool) and isinstance(value, (int, float)) and not isinstance(value, bool)\n        if (abs(result - value) <= ${tolerance}) if numeric else _same(result, value):\n            selected.append(option["id"])\n    if not selected:\n        raise ValueError("No option matches the computed value")\n    return selected`;
    } else if (round.solver === "knapsack") {
      algorithm = "Exhaustive subset search · exact optimization";
      complexity =
        "O((n + c) × 2ⁿ) time for n items and c incompatible pairs; O(n) working memory.";
      input = {
        rows: clone(model.rows),
        capacity: model.capacity,
        maxItems: model.maxItems ?? model.rows.length,
        incompatible: clone(model.incompatible || []),
        tieBreak: model.tieBreak || "first",
      };
      let bestValue = -Infinity;
      let bestWeight = Infinity;
      let feasible = 0;
      response = [];
      for (let mask = 0; mask < 2 ** model.rows.length; mask += 1) {
        const selected = model.rows.filter((_, index) => mask & (1 << index));
        const weight = selected.reduce((total, row) => total + row.weight, 0);
        const value = selected.reduce((total, row) => total + row.value, 0);
        const names = new Set(selected.map((row) => row.id));
        const ids = [...names].sort();
        if (
          weight <= model.capacity &&
          selected.length <= input.maxItems &&
          !input.incompatible.some(([a, b]) => names.has(a) && names.has(b))
        ) {
          feasible += 1;
          const betterTie =
            input.tieBreak === "lower-weight-then-ids" &&
            value === bestValue &&
            (weight < bestWeight ||
              (weight === bestWeight &&
                ids.join("\0") < [...response].sort().join("\0")));
          if (value > bestValue || betterTie) {
            bestValue = value;
            bestWeight = weight;
            response = selected.map((row) => row.id);
            if (steps.length < 14)
              step(
                "Keep a better feasible subset",
                `Weight ${display(weight)} ≤ capacity ${model.capacity}; total value improves to ${display(value)}.`,
                response,
                { weight, value },
              );
          }
        }
      }
      step(
        "Certify the best feasible value",
        `Checked all ${2 ** model.rows.length} subsets; ${feasible} satisfy capacity. No feasible subset beats value ${display(bestValue)}. ${input.tieBreak === "lower-weight-then-ids" ? "Value ties prefer lower weight, then lexicographically smaller sorted IDs." : "Equal values keep the first subset in mask order."}`,
        response,
      );
      body = `def solve(problem):
    rows, capacity = problem["rows"], problem["capacity"]
    best_value, best_weight, best = -math.inf, math.inf, []
    for mask in range(1 << len(rows)):
        chosen = [row for index, row in enumerate(rows) if mask & (1 << index)]
        weight = sum(row["weight"] for row in chosen)
        value = sum(row["value"] for row in chosen)
        ids = [row["id"] for row in chosen]
        if weight > capacity or len(chosen) > problem["maxItems"]:
            continue
        if any(a in ids and b in ids for a, b in problem["incompatible"]):
            continue
        better_tie = problem["tieBreak"] == "lower-weight-then-ids" and value == best_value and (weight < best_weight or (weight == best_weight and sorted(ids) < sorted(best)))
        if value > best_value or better_tie:
            best_value, best_weight, best = value, weight, ids
    return best`;
    } else if (round.solver === "toposort") {
      algorithm = "Kahn’s topological sort · dependency planning";
      complexity = "O(V + E): process each task and each dependency once.";
      input = { rows: clone(model.rows) };
      const rows = model.rows;
      const all = new Set(rows.map((row) => row.id));
      const degree = new Map(
        rows.map((row) => [row.id, (row.requires || []).length]),
      );
      const next = new Map(rows.map((row) => [row.id, []]));
      rows.forEach((row) =>
        (row.requires || []).forEach((dependency) => {
          if (!all.has(dependency))
            throw new Error("A dependency refers to a missing task.");
          next.get(dependency).push(row.id);
        }),
      );
      const queue = rows
        .filter((row) => degree.get(row.id) === 0)
        .map((row) => row.id);
      response = [];
      for (let at = 0; at < queue.length; at += 1) {
        const id = queue[at];
        response.push(id);
        next.get(id).forEach((child) => {
          degree.set(child, degree.get(child) - 1);
          if (degree.get(child) === 0) queue.push(child);
        });
        step(
          "Release a ready task",
          `${id} has no unfinished dependencies. Complete it and update the dependent tasks.`,
          [
            ...response,
            ...rows
              .map((row) => row.id)
              .filter((item) => !response.includes(item)),
          ],
        );
      }
      if (response.length !== rows.length)
        throw new Error("The dependency graph has a cycle.");
      body = `def solve(problem):\n    rows = problem["rows"]\n    degree = {row["id"]: len(row.get("requires", [])) for row in rows}\n    outgoing = {row["id"]: [] for row in rows}\n    for row in rows:\n        for dependency in row.get("requires", []):\n            outgoing[dependency].append(row["id"])\n    queue = deque(row["id"] for row in rows if degree[row["id"]] == 0)\n    ordered = []\n    while queue:\n        task = queue.popleft()\n        ordered.append(task)\n        for child in outgoing[task]:\n            degree[child] -= 1\n            if degree[child] == 0:\n                queue.append(child)\n    if len(ordered) != len(rows):\n        raise ValueError("Dependency cycle")\n    return ordered`;
    } else {
      const graphInput = publicRoute(round);
      algorithm = (graphInput.required || []).length
        ? "Breadth-first search with waypoint state · classical pathfinding"
        : "Breadth-first search · classical pathfinding";
      complexity = (graphInput.required || []).length
        ? "O((V + E) × 2ᵏ), where k is the number of required waypoints."
        : "O(V + E): explore each node and each link once.";
      input = {
        nodes: graphInput.nodes.map((node) => ({
          id: node.id,
          label: node.label || node.id,
        })),
        edges: clone(graphInput.edges),
        start: graphInput.start,
        end: graphInput.end,
        blocked: [...(graphInput.blocked || [])],
        required: [...(graphInput.required || [])],
      };
      const blocked = new Set(input.blocked);
      const required = input.required;
      const bit = (id) => {
        const index = required.indexOf(id);
        return index >= 0 ? 1 << index : 0;
      };
      if (blocked.has(input.start) || blocked.has(input.end))
        throw new Error("A route endpoint is blocked.");
      const graph = new Map(input.nodes.map((node) => [node.id, []]));
      input.edges.forEach(([a, b]) => {
        graph.get(a).push(b);
        graph.get(b).push(a);
      });
      const initialMask = bit(input.start);
      const queue = [{ node: input.start, mask: initialMask }];
      const keyOf = (node, mask) => `${node}|${mask}`;
      const previous = new Map([
        [keyOf(input.start, initialMask), { node: input.start, parent: null }],
      ]);
      let explored = 0;
      for (let at = 0; at < queue.length; at += 1) {
        const state = queue[at];
        const current = state.node;
        explored += 1;
        const currentKey = keyOf(current, state.mask);
        if (
          current === input.end &&
          state.mask === (1 << required.length) - 1
        ) {
          response = [];
          let key = currentKey;
          while (key !== null) {
            const entry = previous.get(key);
            response.push(entry.node);
            key = entry.parent;
          }
          response.reverse();
          break;
        }
        for (const next of graph.get(current)) {
          const mask = state.mask | bit(next);
          const key = keyOf(next, mask);
          if (!blocked.has(next) && !previous.has(key)) {
            previous.set(key, { node: next, parent: currentKey });
            queue.push({ node: next, mask });
          }
        }
      }
      if (!response)
        throw new Error(
          "No route visits all required waypoints and reaches the finish.",
        );
      step(
        "Start a breadth-first frontier",
        `Begin at ${input.start}. Every link has equal cost; the queue explores paths by increasing hop count.`,
        [input.start],
      );
      if (required.length)
        step(
          "Remember required visits",
          `Track visits to ${required.join(", ")} as part of each state. Revisiting a node with a different visited-waypoint set can be useful.`,
        );
      response
        .slice(1)
        .forEach((id, index) =>
          step(
            `Follow link ${index + 1}`,
            `${response[index]} → ${id}. ${required.includes(id) ? "This visits a required waypoint." : "This link is available and connected."}`,
            response.slice(0, index + 2),
          ),
        );
      step(
        "Certify the shortest valid route",
        `The first complete state reached by breadth-first search uses ${response.length - 1} hops. The search explored ${explored} states.`,
        response,
      );
      body = `def solve(problem):
    graph = {node["id"]: [] for node in problem["nodes"]}
    for a, b in problem["edges"]:
        graph[a].append(b)
        graph[b].append(a)
    required = problem["required"]
    blocked = set(problem["blocked"])
    def bit(node):
        return 1 << required.index(node) if node in required else 0
    start, end = problem["start"], problem["end"]
    if start in blocked or end in blocked:
        raise ValueError("Blocked endpoint")
    initial = (start, bit(start))
    queue = deque([initial])
    previous = {initial: None}
    while queue:
        current, mask = queue.popleft()
        if current == end and mask == (1 << len(required)) - 1:
            path, state = [], (current, mask)
            while state is not None:
                path.append(state[0])
                state = previous[state]
            return path[::-1]
        for node in graph[current]:
            state = (node, mask | bit(node))
            if node not in blocked and state not in previous:
                previous[state] = (current, mask)
                queue.append(state)
    raise ValueError("No route visits all required waypoints")`;
    }
    if (!steps.length || !same(steps.at(-1).state?.response, response))
      step(
        "Apply the computed solution",
        "Use the algorithm’s result in the game controls.",
        response,
      );
    return {
      response: clone(response),
      steps,
      algorithm,
      complexity,
      code: pythonScript(input, body),
      input,
      trained: false,
    };
  }
  return Object.freeze({
    solve,
    validateModel,
    evaluateExpression: expression,
    families: Object.freeze(families),
  });
});
