/* Curated learning challenges. All quantities are teaching examples, not operating specifications. */
(function (root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  else root.ATRIKSHA_GAMES = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const categories = [
    { id: "data-science", name: "Data science", color: "lime" },
    { id: "machine-learning", name: "Machine learning", color: "cyan" },
    { id: "iot", name: "IoT", color: "purple" },
    { id: "manufacturing", name: "Manufacturing", color: "amber" },
    { id: "math-optimization", name: "Math & optimization", color: "blue" },
  ];
  const games = [];
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  const rotate = (xs, n = 1) =>
    xs.slice(n % xs.length).concat(xs.slice(0, n % xs.length));
  const join = (xs) => xs.join(", ");
  const options = (labels) =>
    labels.map((label, i) => ({ id: `o${i}`, label: String(label) }));
  const seed = (text) =>
    [...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  const control = (id, label, min, max, step, initial, unit) => ({
    id,
    label,
    min,
    max,
    step,
    initial,
    ...(unit ? { unit } : {}),
  });
  function add(
    id,
    title,
    category,
    concept,
    difficulty,
    minutes,
    mechanic,
    make,
  ) {
    const rounds = Array.from({ length: 5 }, (_, i) => ({
      id: `${id}-${i + 1}`,
      type: mechanic,
      ...make(i),
    }));
    games.push({
      id,
      title,
      category,
      concept,
      difficulty,
      minutes,
      mechanic,
      rounds,
    });
  }
  function tune(
    prompt,
    explanation,
    label,
    target,
    { min = 0, max = 100, step = 1, initial = 0, unit, visual, context } = {},
  ) {
    return {
      prompt,
      explanation,
      controls: [control("value", label, min, max, step, initial, unit)],
      targets: { value: target },
      tolerance: { value: step / 100 },
      ...(visual ? { visual } : {}),
      ...(context ? { context } : {}),
    };
  }
  function select(prompt, labels, index, explanation, visual) {
    return {
      prompt,
      explanation,
      options: rotate(options(labels), seed(prompt) % labels.length),
      answer: [`o${index}`],
      multiple: false,
      ...(visual ? { visual } : {}),
    };
  }
  function sort(prompt, orderedLabels, explanation, k = 0) {
    const ordered = orderedLabels.map((label, i) => ({
      id: `item${i}`,
      label: String(label),
    }));
    return {
      prompt,
      explanation,
      items: rotate(ordered, 1 + (k % (ordered.length - 1))),
      answer: ordered.map((x) => x.id),
    };
  }
  function match(prompt, pairs, explanation, k = 0) {
    return {
      prompt,
      explanation,
      left: pairs.map((p, i) => ({ id: `l${i}`, label: p[0] })),
      right: rotate(
        pairs.map((p, i) => ({ id: `r${i}`, label: p[1] })),
        1 + (k % (pairs.length - 1)),
      ),
      pairs: Object.fromEntries(pairs.map((_, i) => [`l${i}`, `r${i}`])),
    };
  }
  function classify(prompt, labels, rows, explanation, k = 0) {
    const buckets = labels.map((label, i) => ({ id: `b${i}`, label }));
    const items = rows.map((row, i) => ({ id: `item${i}`, label: row[0] }));
    return {
      prompt,
      explanation,
      buckets,
      items: rotate(items, k),
      answers: Object.fromEntries(
        rows.map((row, i) => [`item${i}`, `b${row[1]}`]),
      ),
    };
  }
  function grid(prompt, values, predicate, explanation, columns = 3) {
    const cells = values.map((value, i) => ({ id: `cell${i}`, value }));
    return {
      prompt,
      explanation,
      columns,
      cells: rotate(cells, seed(prompt + values.join("|")) % cells.length),
      answer: cells.filter((c, i) => predicate(c.value, i)).map((c) => c.id),
    };
  }

  // DATA SCIENCE — summaries, distributions, scales and evidence.
  add(
    "mean-mixer",
    "Mean Mixer",
    "data-science",
    "Find the arithmetic mean by sharing a total equally.",
    "Starter",
    2,
    "tune",
    (k) => {
      const data = [
          [6, 10, 14],
          [4, 10, 16, 22],
          [10, 16, 18, 22, 24],
          [10, 18, 22, 28, 32],
          [12, 24, 30, 36, 48],
        ][k],
        target = sum(data) / data.length;
      return tune(
        `Readings: ${join(data)}. Move the dial to their mean. Mean = sum of readings ÷ number of readings.`,
        `${sum(data)} ÷ ${data.length} = ${target}. The mean gives every reading equal weight.`,
        "Mean",
        target,
        {
          max: 50,
          initial: 1,
          visual: { kind: "bars" },
          context: { kind: "mean", points: data.map((y, x) => ({ x, y })) },
        },
      );
    },
  );
  add(
    "median-shield",
    "Median Shield",
    "data-science",
    "Order observations and see how the median resists one extreme value.",
    "Starter",
    2,
    "sort",
    (k) => {
      const data = [
        [2, 4, 6, 8, 50],
        [7, 9, 11, 13, 90],
        [3, 8, 12, 15, 18, 21, 100],
        [10, 14, 18, 22, 26, 30, 180],
        [4, 11, 17, 23, 29, 35, 41, 47, 500],
      ][k];
      return sort(
        `Arrange these ${data.length} readings from smallest to largest. The median is the middle reading; one very large reading should stay at the end.`,
        data,
        `The middle reading is ${data[(data.length - 1) / 2]}. Increasing only the largest reading does not change this median.`,
        k,
      );
    },
  );
  add(
    "spread-lab",
    "Spread Lab",
    "data-science",
    "Compute population variance as the mean squared distance from the mean.",
    "Builder",
    3,
    "tune",
    (k) => {
      const d = k + 1,
        c = 12 + k * 3,
        data = [c - d, c - d, c + d, c + d];
      return tune(
        `Population readings: ${join(data)}. Their mean is ${c}. Find population variance: add the FOUR squared distances from the mean, then divide by 4.`,
        `Each distance has magnitude ${d}; each squared distance is ${d * d}. Their average is ${d * d}. We divide by 4 because these are the whole population.`,
        "Population variance",
        d * d,
        { max: 30, initial: 0, unit: "units²", visual: { kind: "bars" } },
      );
    },
  );
  add(
    "feature-scaler",
    "Feature Scaler",
    "data-science",
    "Put a measurement on a zero-to-one scale with min–max normalization.",
    "Builder",
    3,
    "tune",
    (k) => {
      const min = 10 * k,
        span = [10, 20, 30, 40, 50][k],
        fraction = [0.2, 0.4, 0.6, 0.8, 0.5][k],
        x = min + span * fraction;
      return tune(
        `Training minimum = ${min}; maximum = ${min + span}; reading = ${x}. Normalize the reading with (reading − minimum) ÷ (maximum − minimum).`,
        `(${x} − ${min}) ÷ (${min + span} − ${min}) = ${fraction}. This places the reading relative to the training range.`,
        "Scaled reading",
        fraction,
        { max: 1, step: 0.1, initial: 0, visual: { kind: "line" } },
      );
    },
  );
  add(
    "chart-chooser",
    "Chart Chooser",
    "data-science",
    "Match a visual display to the comparison it needs to communicate.",
    "Starter",
    3,
    "match",
    (k) => {
      const cases = [
        [
          ["Compare outputs of named teams A=12, B=9, C=18.", "Bar chart"],
          ["Show temperature at 08:00, 09:00 and 10:00.", "Line chart"],
          [
            "Show how many individual task durations fall into each 5-minute interval.",
            "Histogram",
          ],
        ],
        [
          [
            "Compare average heights of three named plant species.",
            "Bar chart",
          ],
          [
            "Show paired light exposure and plant growth for every plant.",
            "Scatter plot",
          ],
          ["Show soil moisture in chronological hour order.", "Line chart"],
          [
            "Show the frequency distribution of individual leaf lengths.",
            "Histogram",
          ],
        ],
        [
          [
            "Show median, quartiles and spread of part sizes for each machine.",
            "Box plot",
          ],
          [
            "Color each machine-by-shift output value in a rectangular table.",
            "Heat map",
          ],
          [
            "Show paired vibration and load readings for each observation.",
            "Scatter plot",
          ],
        ],
        [
          [
            "Compare median and interquartile spread of delivery times across hubs.",
            "Box plot",
          ],
          [
            "Show counts of deliveries in 10-minute duration intervals.",
            "Histogram",
          ],
          [
            "Track total parcels processed at each successive hour.",
            "Line chart",
          ],
          ["Color a hub-by-day matrix of delay counts.", "Heat map"],
        ],
        [
          ["Compare output of four named solar-panel models.", "Bar chart"],
          [
            "Show each panel’s paired temperature and power output.",
            "Scatter plot",
          ],
          ["Color an hour-by-panel matrix of power readings.", "Heat map"],
          [
            "Compare medians and quartiles of output across panel models.",
            "Box plot",
          ],
        ],
      ][k];
      const descriptions = {
        "Bar chart": "bars compare named groups",
        "Line chart": "lines show time order",
        Histogram: "histograms bin one numeric variable",
        "Scatter plot": "scatter plots pair two numeric variables",
        "Box plot": "box plots summarize median, quartiles and spread",
        "Heat map": "heat maps color values in a matrix",
      };
      return match(
        "Choose a display: " +
          [...new Set(cases.map((x) => x[1]))]
            .map((x) => descriptions[x])
            .join("; ") +
          ".",
        cases,
        "Choose the visual for the question: comparisons, time order, a distribution, paired values, summary spread, or a matrix.",
        k,
      );
    },
  );
  add(
    "data-detective",
    "Data Detective",
    "data-science",
    "Separate named categories, counts, and continuous measurements.",
    "Starter",
    2,
    "classify",
    (k) => {
      const domains = [
        ["machine type", "parts produced", "part length"],
        ["plant species", "leaves counted", "plant mass"],
        ["vehicle model", "trips completed", "travel distance"],
        ["sensor brand", "packets received", "air temperature"],
        ["material name", "defects counted", "surface thickness"],
      ][k];
      return classify(
        "Classify each field by what it represents. Category = a name; count = how many whole items; measurement = an amount measured on a scale.",
        ["Category", "Count", "Measurement"],
        [
          [domains[0], 0],
          [domains[1], 1],
          [domains[2], 2],
          [
            `Number of ${["operators", "pots", "drivers", "devices", "samples"][k]}`,
            1,
          ],
        ],
        "Counts answer “how many”; measurements answer “how much”; a category identifies a kind rather than an amount.",
        k,
      );
    },
  );
  add(
    "sampling-scout",
    "Sampling Scout",
    "data-science",
    "Distinguish random, systematic, and convenience sample selection.",
    "Builder",
    3,
    "classify",
    (k) => {
      const nouns = ["parts", "plants", "customers", "devices", "shipments"],
        n = nouns[k],
        interval = k + 3;
      return classify(
        `Classify how ${n} were sampled. Random: lottery gives every listed item a chance. Systematic: every kth item in an ordered list. Convenience: whichever items are easiest to reach.`,
        ["Random", "Systematic", "Convenience"],
        [
          [
            `Use a random-number draw to choose ${5 + k} IDs from the complete list.`,
            0,
          ],
          [
            `Choose every ${interval}th item from the ordered list after a fixed starting point.`,
            1,
          ],
          ["Choose only the items nearest the inspector.", 2],
          [
            "Select IDs by shuffling the complete list and taking its first few entries.",
            0,
          ],
        ],
        "The selection method, not the sample size, determines these labels. Convenience samples can miss parts of the population.",
        k,
      );
    },
  );
  add(
    "outlier-radar",
    "Outlier Radar",
    "data-science",
    "Apply a stated interquartile-range rule to flag unusual observations.",
    "Builder",
    3,
    "grid",
    (k) => {
      const q1 = 10 + k * 5,
        q3 = q1 + 4,
        lo = q1 - 6,
        hi = q3 + 6,
        values = [lo - 2, q1, q1 + 2, q3, hi, hi + 1, lo, q1 + 1, hi + 4];
      return grid(
        `Q1 = ${q1}, Q3 = ${q3}; IQR = Q3 − Q1. Select readings strictly below Q1 − 1.5×IQR or strictly above Q3 + 1.5×IQR. Values ON a boundary are not flagged.`,
        values,
        (v) => v < lo || v > hi,
        `IQR = 4, so the boundaries are ${lo} and ${hi}. Flag only values outside that interval; this is an outlier rule, not proof of an error.`,
      );
    },
  );
  add(
    "missing-pieces",
    "Missing Pieces",
    "data-science",
    "Distinguish missing observations from valid zero measurements.",
    "Starter",
    2,
    "grid",
    (k) => {
      const values = [
        [0, 12, "NA", 7, "—", 5, 0, "NA", 9],
        [4, "—", 0, 15, 3, "NA", 12, 0, "—"],
        ["NA", 0, 22, 8, "—", 14, 0, 7, "NA"],
        [10, 0, "—", "NA", 24, 0, 6, "NA", 19],
        [0, "NA", 3, 0, "—", 8, "NA", 30, 1],
      ][k];
      return grid(
        "Select every missing reading. In this dataset only “NA” and “—” mean missing. A numeric 0 is a real measurement and must stay.",
        values,
        (v) => typeof v === "string",
        "Missing data need a handling decision. Replacing a valid zero would change the evidence, so only the stated missing markers are selected.",
      );
    },
  );
  add(
    "correlation-compass",
    "Correlation Compass",
    "data-science",
    "Read association direction without treating association as causation.",
    "Starter",
    2,
    "select",
    (k) => {
      const cases = [
          { ys: [2, 4, 6, 8, 10], a: 0 },
          { ys: [12, 10, 8, 6, 4], a: 1 },
          { ys: [3, 3, 3, 3, 3], a: 2 },
          { ys: [1, 3, 4, 7, 9], a: 0 },
          { ys: [9, 7, 6, 3, 1], a: 1 },
        ],
        c = cases[k];
      return select(
        `At x = 1, 2, 3, 4, 5, y = ${join(c.ys)}. Which description fits the observed direction? This chart alone cannot establish a cause.`,
        [
          "Positive association: y tends to rise with x",
          "Negative association: y tends to fall with x",
          "No variation in y, so correlation is undefined",
        ],
        c.a,
        c.a === 2
          ? "Every y is identical. Its standard deviation is zero, so Pearson correlation is undefined."
          : `The paired readings show a ${c.a === 0 ? "rising" : "falling"} trend. That describes association; it does not show which variable caused a change.`,
        {
          kind: "scatter",
          values: c.ys,
          points: c.ys.map((y, i) => ({ x: i + 1, y })),
        },
      );
    },
  );

  // MACHINE LEARNING — decisions, optimization, validation and task selection.
  add(
    "threshold-tuner",
    "Threshold Tuner",
    "machine-learning",
    "Place a decision threshold that separates given positive and negative scores.",
    "Builder",
    3,
    "tune",
    (k) => {
      const low = [20, 30, 40, 50, 60][k],
        high = low + 20;
      return tune(
        `Classify as positive when score ≥ threshold. Negative examples score ${low - 10} and ${low}; positive examples score ${high} and ${high + 10}. Set the threshold exactly halfway between the largest negative and smallest positive score.`,
        `The midpoint is (${low} + ${high}) ÷ 2 = ${low + 10}. It separates all four examples; this teaching sample does not establish a real deployment threshold.`,
        "Decision threshold",
        low + 10,
        {
          max: 100,
          step: 5,
          initial: 0,
          unit: "%",
          visual: { kind: "threshold" },
          context: {
            points: [
              { x: 0, y: low - 10 },
              { x: 1, y: low },
              { x: 2, y: high },
              { x: 3, y: high + 10 },
            ],
          },
        },
      );
    },
  );
  add(
    "gradient-step",
    "Gradient Step",
    "machine-learning",
    "Take one gradient-descent update on a quadratic loss.",
    "Builder",
    3,
    "tune",
    (k) => {
      const target = [2, 4, 6, 8, 10][k],
        w = target + 8,
        lr = 0.25,
        next = w - lr * 2 * (w - target);
      return tune(
        `Loss L(w) = (w − ${target})². Start w = ${w}; derivative = 2(w − ${target}); learning rate = 0.25. Set the next w using w_new = w − learning_rate × derivative.`,
        `The derivative is 16. Subtract 0.25 × 16 = 4 from ${w}, giving ${next}. This one step moves toward the minimum at ${target}.`,
        "Next weight",
        next,
        { max: 25, initial: 0, visual: { kind: "line" } },
      );
    },
  );
  add(
    "pipeline-pilot",
    "Pipeline Pilot",
    "machine-learning",
    "Order a modeling workflow so evaluation data stay independent.",
    "Starter",
    3,
    "sort",
    (k) => {
      const workflows = [
        [
          "Reserve training and test sets",
          "Fit preprocessing on training data",
          "Transform data using the fitted preprocessing",
          "Train the model on transformed training data",
          "Evaluate once on the reserved test set",
        ],
        [
          "Reserve a test set",
          "Split remaining data into training and validation sets",
          "Train candidate models on training data",
          "Choose a candidate using validation performance",
          "Evaluate the chosen candidate on the reserved test set",
        ],
        [
          "Order records by event time",
          "Reserve the latest records for testing",
          "Fit preprocessing on earlier training records",
          "Train on the transformed earlier records",
          "Test predictions on the reserved future records",
        ],
        [
          "Reserve the independent test set",
          "Use only training data to select features",
          "Fit a model using the selected training features",
          "Apply the same feature selection to test records",
          "Evaluate the trained model on the test records",
        ],
        [
          "Freeze the feature definitions and training data",
          "Fit the final preprocessing transform",
          "Train the final model on transformed training data",
          "Package the transform together with the trained model",
          "Apply that packaged pipeline to new incoming records",
        ],
      ][k];
      return sort(
        "Order the modeling workflow by dependency. Keep reserved test records independent of fitting and selection; reuse training-fitted transforms for later data.",
        workflows,
        `The chain is ${workflows.join(" → ")}. Keeping data roles and fitted steps explicit helps prevent leakage.`,
        k,
      );
    },
  );
  add(
    "metric-match",
    "Metric Match",
    "machine-learning",
    "Connect classification and regression metrics to the quantities they measure.",
    "Builder",
    3,
    "match",
    (k) => {
      const a = 5 + k,
        b = 2 + k,
        c = 3 + k,
        d = 10 + k;
      return match(
        `A classifier has TP=${a}, FP=${b}, FN=${c}, TN=${d}. Match each metric to its formula. TP means correct positives; FP means false alarms; FN means missed positives; TN means correct negatives.`,
        [
          ["Precision", `TP / (TP + FP) = ${a} / ${a + b}`],
          ["Recall", `TP / (TP + FN) = ${a} / ${a + c}`],
          ["Accuracy", `(TP + TN) / all = ${a + d} / ${a + b + c + d}`],
          ["False-positive rate", `FP / (FP + TN) = ${b} / ${b + d}`],
        ],
        "Precision asks whether a positive prediction was right; recall asks whether an actual positive was found. The denominators answer different questions.",
        k,
      );
    },
  );
  add(
    "model-mission",
    "Model Mission",
    "machine-learning",
    "Choose regression, classification, clustering, or anomaly detection for a stated goal.",
    "Starter",
    3,
    "match",
    (k) => {
      const tasks = [
        [
          "Predict next hour’s energy use in kWh.",
          "Predict a known “pass” or “fail” label from labeled examples.",
          "Group unlabeled operating patterns by similarity.",
          "Flag rare readings unlike normal machine operation.",
        ],
        [
          "Predict plant height next week in centimetres.",
          "Predict a known plant-species label from labeled photos.",
          "Group unlabeled soil profiles without named classes.",
          "Flag sudden moisture readings unlike the normal pattern.",
        ],
        [
          "Predict delivery duration in minutes.",
          "Predict a known small/medium/large parcel label from labeled examples.",
          "Discover groups of similar orders without predefined groups.",
          "Flag unusually large inventory changes relative to normal activity.",
        ],
        [
          "Predict remaining battery runtime in hours.",
          "Predict labeled terrain classes such as paved or gravel.",
          "Group unlabeled robot trajectories by shape.",
          "Flag a wheel-vibration pattern far from normal recordings.",
        ],
        [
          "Predict tomorrow’s peak power in kW.",
          "Predict a predefined normal/high-demand label from labeled days.",
          "Discover groups of similar unlabeled daily energy profiles.",
          "Flag power spikes unlike the usual operating range.",
        ],
      ][k];
      return match(
        "Match the task to its method. Regression predicts a number; classification predicts a known label; clustering discovers unlabeled groups; anomaly detection flags unusual cases.",
        tasks.map((task, i) => [
          task,
          ["Regression", "Classification", "Clustering", "Anomaly detection"][
            i
          ],
        ]),
        "The desired output and available labels determine the learning task. A number, known class, discovered group, and unusual observation answer different questions.",
        k,
      );
    },
  );
  add(
    "leakage-guard",
    "Leakage Guard",
    "machine-learning",
    "Identify information that would leak future or test outcomes into training.",
    "Explorer",
    3,
    "classify",
    (k) => {
      const scenarios = [
        {
          goal: "tomorrow’s demand at noon today",
          rows: [
            ["Orders received before noon today.", 0],
            ["Tomorrow’s final sales total.", 1],
            ["A scaler fitted on the entire held-out test set.", 1],
            [
              "A historical average computed only from earlier training orders.",
              0,
            ],
          ],
        },
        {
          goal: "a delivery duration before the vehicle departs",
          rows: [
            ["Route distance known before departure.", 0],
            ["The actual arrival timestamp.", 1],
            ["Previous deliveries completed before this departure.", 0],
            ["A “late delivery” label assigned after arrival.", 1],
          ],
        },
        {
          goal: "next week’s energy use this Friday",
          rows: [
            ["Energy readings recorded through this Friday.", 0],
            ["Next week’s actual meter total.", 1],
            ["Feature rankings chosen by inspecting test-set outcomes.", 1],
            ["Calendar information already known for next week.", 0],
            ["A transform fitted only on training weeks.", 0],
          ],
        },
        {
          goal: "a part’s later inspection result before inspection",
          rows: [
            ["Material batch recorded before inspection.", 0],
            ["The final inspection pass/fail field.", 1],
            ["Measured features captured before the prediction.", 0],
            ["A defect flag created by the later inspection.", 1],
          ],
        },
        {
          goal: "a machine fault tomorrow using data available today",
          rows: [
            ["Maintenance completed before today.", 0],
            ["A repair report written after tomorrow’s fault.", 1],
            ["Past sensor trends from before the prediction time.", 0],
            ["A rolling average that includes tomorrow’s sensor readings.", 1],
            [
              "A preprocessing transform fitted only on past training records.",
              0,
            ],
          ],
        },
      ][k];
      return classify(
        `Predict ${scenarios.goal}. Mark information as “Available now” or “Leakage”. Only data known at prediction time and transforms fitted on training data are allowed.`,
        ["Available now", "Leakage"],
        scenarios.rows,
        "Future outcomes, direct target copies and test-fitted transforms can leak the answer. Known calendar information and genuinely earlier measurements are allowed.",
        k,
      );
    },
  );
  add(
    "learning-modes",
    "Learning Modes",
    "machine-learning",
    "Separate learning from labels, unlabeled structure, and reward feedback.",
    "Starter",
    3,
    "classify",
    (k) => {
      const rows = [
        [
          ["Train from photos paired with correct part names.", 0],
          ["Group unlabeled motion traces by similarity.", 1],
          [
            "Try robot actions in a simulator and receive rewards for reaching the target.",
            2,
          ],
          [
            "Fit a prediction to readings paired with measured output values.",
            0,
          ],
        ],
        [
          ["Learn steering from images paired with expert steering angles.", 0],
          ["Discover groups in unlabeled route histories.", 1],
          [
            "Choose driving actions and receive a reward after each safe simulated arrival.",
            2,
          ],
          [
            "Compress unlabeled sensor profiles by learning their structure.",
            1,
          ],
        ],
        [
          [
            "Predict defect labels from images with inspector-provided labels.",
            0,
          ],
          ["Group unknown material samples without target labels.", 1],
          [
            "Learn a picking policy from rewards after successful simulated picks.",
            2,
          ],
          ["Estimate part mass from examples paired with measured masses.", 0],
        ],
        [
          ["Predict known terrain classes from labeled recordings.", 0],
          ["Find structure in unlabeled navigation traces.", 1],
          ["Explore a maze and receive rewards for reaching exits.", 2],
          [
            "Learn temperature predictions from inputs paired with actual temperatures.",
            0,
          ],
          ["Group unlabeled weather profiles.", 1],
        ],
        [
          [
            "Imitate movement using examples paired with correct motor commands.",
            0,
          ],
          ["Discover repeated patterns in unlabeled machine logs.", 1],
          [
            "Improve a simulated cart policy through action-dependent rewards.",
            2,
          ],
          [
            "Predict a known failure label from previously labeled examples.",
            0,
          ],
          ["Explore simulated choices to maximize cumulative reward.", 2],
        ],
      ][k];
      return classify(
        "Identify the learning setup. Supervised uses examples with target labels or values; unsupervised learns structure without targets; reinforcement learns actions through rewards.",
        ["Supervised", "Unsupervised", "Reinforcement"],
        rows,
        "The decisive clue is the feedback: a target answer, unlabeled structure, or a reward resulting from actions.",
        k,
      );
    },
  );
  add(
    "confusion-matrix",
    "Confusion Matrix",
    "machine-learning",
    "Locate false positives and false negatives by comparing truth with prediction.",
    "Builder",
    3,
    "grid",
    (k) => {
      const rows = [
          ["P/P", "N/P", "P/N", "N/N"],
          ["P/N", "P/P", "N/N", "N/P"],
          ["N/N", "P/N", "N/P", "P/P"],
          ["N/P", "N/N", "P/P", "P/N"],
          ["P/P", "N/N", "P/N", "N/P"],
        ][k],
        mode = k % 2 === 0 ? "false positives" : "false negatives",
        code = k % 2 === 0 ? "N/P" : "P/N";
      return grid(
        `Each cell is ACTUAL / PREDICTED: P = positive and N = negative. Select ${mode}: ${k % 2 === 0 ? "actual N but predicted P" : "actual P but predicted N"}.`,
        [...rows, ...rotate(rows, 1), ...rows],
        (v) => v === code,
        `A ${k % 2 === 0 ? "false positive is a false alarm" : "false negative is a missed positive"}. Read actual first, then predicted.`,
        4,
      );
    },
  );
  add(
    "cluster-pilot",
    "Cluster Pilot",
    "machine-learning",
    "Assign a one-dimensional observation to its nearest centroid.",
    "Builder",
    3,
    "grid",
    (k) => {
      const left = 10 + k * 5,
        right = left + 10,
        mid = left + 5,
        values = [
          left - 3,
          left + 1,
          right + 2,
          left + 4,
          right - 1,
          left - 1,
          right + 4,
          left + 2,
          right,
        ];
      return grid(
        `Two cluster centers are A=${left} and B=${right}. Select readings closer to A using absolute distance. No reading is exactly halfway.`,
        values,
        (v) => Math.abs(v - left) < Math.abs(v - right),
        `The midpoint is ${mid}; all readings below it are closer to A. This is the assignment step used by one-dimensional k-means.`,
      );
    },
  );
  add(
    "overfit-detective",
    "Overfit Detective",
    "machine-learning",
    "Use the training–validation gap to recognize overfitting.",
    "Builder",
    3,
    "select",
    (k) => {
      const train = 99 - k,
        valid = 61 + k;
      return select(
        `A model scores ${train}% on training data but ${valid}% on independent validation data. A smaller model scores ${83 + k}% on training and ${80 + k}% on validation. Which is the strongest evidence-based interpretation?`,
        [
          "The first model likely overfits; the smaller model generalizes better on this validation set.",
          "The first model must be better because its training score is higher.",
          "Validation performance can be ignored once training finishes.",
        ],
        0,
        `The first gap is ${train - valid} percentage points, versus 3 for the smaller model. Higher validation performance supports the smaller model for this comparison.`,
      );
    },
  );

  // IOT — sampled signals, calibration, logic and connected paths.
  add(
    "signal-sampler",
    "Signal Sampler",
    "iot",
    "Choose a sample rate with a stated margin above the Nyquist limit.",
    "Builder",
    3,
    "tune",
    (k) => {
      const f = [5, 10, 15, 20, 25][k];
      return tune(
        `The highest frequency of an ideally band-limited signal is ${f} Hz. Sampling must exceed twice that frequency. For this exercise, choose the specified safety margin of FOUR samples per highest-frequency cycle.`,
        `Four samples per cycle means 4 × ${f} = ${f * 4} samples/s. This exceeds 2 × ${f}; real systems also need suitable anti-alias filtering.`,
        "Sample rate",
        f * 4,
        {
          max: 120,
          step: 5,
          initial: 5,
          unit: "Hz",
          visual: { kind: "signal" },
          context: { kind: "sampling", frequency: f },
        },
      );
    },
  );
  add(
    "sensor-calibration",
    "Sensor Calibration",
    "iot",
    "Correct a constant sensor offset using a known reference.",
    "Starter",
    2,
    "tune",
    (k) => {
      const truth = [10, 20, 30, 40, 50][k],
        read = truth - (k + 2);
      return tune(
        `A reference measures ${truth} °C while a sensor reports ${read} °C. Assume a constant offset error. Set correction c so corrected reading = sensor reading + c.`,
        `${read} + ${truth - read} = ${truth}. A one-point correction fixes an assumed constant offset, not gain error or nonlinear behavior.`,
        "Offset correction",
        truth - read,
        { min: -10, max: 10, initial: 0, unit: "°C", visual: { kind: "line" } },
      );
    },
  );
  add(
    "message-journey",
    "Message Journey",
    "iot",
    "Order dependent steps in a sensor-to-application data pipeline.",
    "Starter",
    3,
    "sort",
    (k) => {
      const paths = [
        [
          "Read the sensor",
          "Convert the reading to engineering units",
          "Package the converted reading",
          "Transmit the message",
          "Display the received message",
        ],
        [
          "Wake the sleeping device",
          "Read the sensor",
          "Transmit the reading",
          "Wait for an acknowledgement",
          "Return to sleep",
        ],
        [
          "Read the raw signal",
          "Apply the calibration offset",
          "Compare the calibrated value to the alarm limit",
          "Create the alarm message",
          "Deliver the alarm to the dashboard",
        ],
        [
          "Receive a timestamped reading",
          "Check that its timestamp is fresh",
          "Validate the reading range",
          "Store the accepted reading",
          "Update the chart from stored data",
        ],
        [
          "Collect a batch of readings",
          "Compute the batch average",
          "Encode the average as a message",
          "Send the encoded message",
          "Decode and display the average",
        ],
      ];
      return sort(
        "Build the pipeline in dependency order. Each step needs the result of the previous one; put the initial input first and the final output last.",
        paths[k],
        `The valid dependency chain is: ${paths[k].join(" → ")}. Explicit ordering prevents later steps from using data that do not exist yet.`,
        k,
      );
    },
  );
  add(
    "protocol-match",
    "Message Match",
    "iot",
    "Match communication patterns to how information is exchanged.",
    "Builder",
    3,
    "match",
    (k) => {
      const examples = [
        [
          "One client asks a device for its current temperature.",
          "A broker distributes each new temperature to subscribed dashboards.",
          "A device sends an ordered, continuous sequence of audio samples.",
          "A device retries a command until the receiver confirms receipt.",
        ],
        [
          "A dashboard asks for the current battery percentage.",
          "Every subscribed service receives a published low-battery event.",
          "A camera sends a continuous sequence of video frames.",
          "A configuration sender waits for confirmation and retries if none arrives.",
        ],
        [
          "A client asks a machine for its serial number.",
          "A machine publishes an alarm for every subscribing listener.",
          "A microphone sends samples continuously as they are captured.",
          "A receiver confirms each configuration delivery before the sender stops retrying.",
        ],
        [
          "A server asks a meter for one present reading.",
          "A meter publishes updates to a topic consumed by several applications.",
          "A vibration monitor sends an ongoing ordered sample feed.",
          "A firmware sender resends a block after a missing receipt confirmation.",
        ],
        [
          "An operator requests one stored diagnostic report.",
          "A gateway publishes “device offline” to interested subscribers.",
          "A controller supplies a continuous real-time telemetry feed.",
          "A sender repeats a settings message until an acknowledgement arrives.",
        ],
      ][k];
      return match(
        "Match the exchange pattern. Request/response answers a specific request; publish/subscribe distributes topic updates; streaming supplies a continuous sequence; acknowledged delivery confirms receipt and may retry.",
        examples.map((x, i) => [
          x,
          [
            "Request / response",
            "Publish / subscribe",
            "Streaming",
            "Acknowledged delivery",
          ][i],
        ]),
        "Match the communication behavior, not the physical device. Acknowledgement confirms receipt; it does not by itself prove an action was performed.",
        k,
      );
    },
  );
  add(
    "plc-logic",
    "PLC Logic",
    "iot",
    "Evaluate AND, OR, and NOT conditions in a simple control rule.",
    "Builder",
    3,
    "classify",
    (k) => {
      const rules = [
          { text: "Run = A AND B", fn: (a, b) => a && b },
          { text: "Run = A OR B", fn: (a, b) => a || b },
          { text: "Run = A AND NOT B", fn: (a, b) => a && !b },
          { text: "Run = NOT A AND B", fn: (a, b) => !a && b },
          { text: "Run = (A OR B) AND NOT E", fn: (a, b, e) => (a || b) && !e },
        ],
        r = rules[k];
      const states =
        k === 4
          ? [
              [0, 0, 0],
              [1, 0, 0],
              [0, 1, 0],
              [1, 1, 1],
              [1, 0, 1],
              [1, 1, 0],
            ]
          : [
              [0, 0],
              [0, 1],
              [1, 0],
              [1, 1],
            ];
      return classify(
        `Teaching logic only: ${r.text}. 1 means true; 0 means false. AND requires both inputs; OR requires at least one; NOT reverses a value. Classify each input state.`,
        ["Run = 0", "Run = 1"],
        states.map(([a, b, e]) => [
          `A=${a}, B=${b}${e === undefined ? "" : `, E=${e}`}`,
          r.fn(a, b, e) ? 1 : 0,
        ]),
        "Evaluate NOT first, then AND, then OR unless brackets say otherwise. These are logic exercises, not a machinery safety design.",
        k,
      );
    },
  );
  add(
    "packet-parity",
    "Packet Parity",
    "iot",
    "Check an even-parity bit rule and recognize its limited error detection.",
    "Starter",
    2,
    "grid",
    (k) => {
      const rows = [
        [
          "0000",
          "0001",
          "0011",
          "0100",
          "0101",
          "0111",
          "1010",
          "1101",
          "1111",
        ],
        [
          "000001",
          "000011",
          "001010",
          "010101",
          "011110",
          "101010",
          "110000",
          "111110",
          "111111",
        ],
        [
          "1001",
          "1011",
          "1100",
          "1110",
          "0010",
          "0101",
          "1000",
          "0110",
          "1111",
        ],
        [
          "000101",
          "001011",
          "010010",
          "010111",
          "100001",
          "101101",
          "110011",
          "111001",
          "111100",
        ],
        [
          "00110011",
          "01010101",
          "10000000",
          "11111110",
          "10101010",
          "11000001",
          "00000000",
          "00000111",
          "01111111",
        ],
      ][k];
      return grid(
        "Each cell is one complete packet including its parity bit. This exercise uses EVEN parity: a valid packet has an even number of 1 bits. Select packets that fail that rule.",
        rows,
        (v) => v.split("1").length % 2 === 0,
        "An odd number of 1 bits fails even parity. Parity can flag an odd number of flipped bits, but it cannot detect every possible transmission error.",
      );
    },
  );
  add(
    "sampling-windows",
    "Sampling Windows",
    "iot",
    "Assign timestamped events to half-open time windows without double counting.",
    "Starter",
    2,
    "grid",
    (k) => {
      const start = k * 10,
        end = start + 10,
        values = [
          start - 1,
          start,
          start + 2,
          start + 4,
          end,
          end + 1,
          start + 9,
          start - 3,
          end + 5,
        ];
      return grid(
        `Timestamps are in seconds. Select events in the window [${start}, ${end}): include the start time ${start}, but exclude the end time ${end}.`,
        values,
        (v) => v >= start && v < end,
        `Half-open intervals assign the boundary event at ${end} to the next window, so adjacent windows do not double count it.`,
      );
    },
  );
  function routingRound(k, context, labels) {
    const ids = ["start", "a", "b", "c", "d", "end", "u", "v", "w"];
    const coordinates = [
      [8, 50],
      [25, 30],
      [42, 30],
      [59, 30],
      [76, 30],
      [93, 50],
      [25, 75],
      [52, 75],
      [76, 75],
    ];
    const nodes = ids.map((id, i) => ({
      id,
      label: labels[i],
      x: coordinates[i][0],
      y: coordinates[i][1],
    }));
    const edges = [
      ["start", "a"],
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
      ["d", "end"],
      ["start", "u"],
      ["u", "v"],
      ["v", "w"],
      ["w", "end"],
    ];
    const variants = [
      { extra: [["b", "end"]], blocked: ["v"] },
      { extra: [["a", "c"]], blocked: ["v"] },
      { extra: [], blocked: ["v"] },
      { extra: [["a", "w"]], blocked: ["b"] },
      { extra: [], blocked: ["c"] },
    ];
    const variant = variants[k];
    return {
      prompt: `${context} ${labels[0]} → ${labels[5]}. Each drawn link costs one hop and works in either direction. Avoid ${variant.blocked.map((id) => nodes.find((n) => n.id === id).label).join(", ")}. Build a route using the FEWEST hops; the start node is already selected.`,
      explanation:
        "With equal hop costs, compare the number of links rather than the visual length of lines. A breadth-first search finds a shortest unblocked path; equally short alternatives are valid.",
      nodes,
      edges: [...edges, ...variant.extra],
      start: "start",
      end: "end",
      blocked: variant.blocked,
    };
  }
  add(
    "packet-router",
    "Packet Router",
    "iot",
    "Find a minimum-hop network route around an unavailable router.",
    "Builder",
    3,
    "route",
    (k) =>
      routingRound(k, "Route one packet through this simulated network.", [
        "Sensor",
        "Router A",
        "Router B",
        "Router C",
        "Router D",
        "Server",
        "Router U",
        "Router V",
        "Router W",
      ]),
  );
  add(
    "sensor-relay",
    "Sensor Relay",
    "iot",
    "Minimize store-and-forward relay delay when each link has equal latency.",
    "Builder",
    3,
    "route",
    (k) => {
      const r = routingRound(
        k,
        "A teaching sensor network spends exactly 2 ms forwarding across each link. Minimize forwarding delay from",
        [
          "Field node",
          "Relay A",
          "Relay B",
          "Relay C",
          "Relay D",
          "Gateway",
          "Relay U",
          "Relay V",
          "Relay W",
        ],
      );
      r.explanation =
        "Each link adds the same 2 ms, so the fewest-hop path also has the lowest forwarding delay in this model. Real radio latency and reliability may vary.";
      return r;
    },
  );
  add(
    "sensor-units",
    "Sensor Units",
    "iot",
    "Convert sensor readings while preserving the quantity being measured.",
    "Starter",
    2,
    "select",
    (k) => {
      const cases = [
        [
          "A duration is 2,500 milliseconds. Convert it to seconds using 1 second = 1,000 milliseconds.",
          ["0.25 s", "2.5 s", "25 s"],
          1,
          "2,500 ÷ 1,000 = 2.5 seconds. A second is the larger unit, so the numerical count decreases.",
        ],
        [
          "A distance is 320 centimetres. Convert it to metres using 1 metre = 100 centimetres.",
          ["0.32 m", "32 m", "3.2 m"],
          2,
          "320 ÷ 100 = 3.2 metres. Each group of 100 centimetres becomes one metre.",
        ],
        [
          "A sensor reports 0.75 volts. Convert to millivolts using 1 volt = 1,000 millivolts.",
          ["750 mV", "75 mV", "7,500 mV"],
          0,
          "0.75 × 1,000 = 750 millivolts. A millivolt is smaller than a volt, so the numerical count increases.",
        ],
        [
          "A device sends 4,000 bytes. Using decimal units, 1 kilobyte = 1,000 bytes. How many kilobytes is that?",
          ["4 kB", "4,000 kB", "0.4 kB"],
          0,
          "4,000 ÷ 1,000 = 4 decimal kilobytes. The prompt specifies decimal units.",
        ],
        [
          "A sample interval is 0.02 seconds. Sampling rate = 1 ÷ interval. Find the rate.",
          ["20 Hz", "50 Hz", "200 Hz"],
          1,
          "1 ÷ 0.02 = 50 samples per second, or 50 Hz.",
        ],
      ][k];
      return select(...[cases[0], cases[1], cases[2], cases[3]]);
    },
  );

  // MANUFACTURING — tolerances, process choices, flow and inspection.
  add(
    "tolerance-fit",
    "Tolerance Fit",
    "manufacturing",
    "Compute a target shaft size from a hole size and specified clearance.",
    "Builder",
    3,
    "tune",
    (k) => {
      const hole = [10, 12, 16, 20, 25][k],
        clearance = [0.2, 0.3, 0.4, 0.5, 0.6][k],
        target = hole - clearance;
      return tune(
        `For this simplified fit, hole diameter is ${hole} mm. Required diametral clearance is ${clearance} mm. Clearance = hole diameter − shaft diameter. Set the target shaft diameter.`,
        `${hole} − ${clearance} = ${target} mm. This is a nominal arithmetic exercise; production fits also account for tolerances on both parts.`,
        "Shaft diameter",
        target,
        {
          min: 0,
          max: 30,
          step: 0.1,
          initial: 0,
          unit: "mm",
          visual: { kind: "bars" },
          context: { kind: "fit", holeDiameter: hole },
        },
      );
    },
  );
  add(
    "oee-workshop",
    "OEE Workshop",
    "manufacturing",
    "Combine availability, performance, and quality as multiplicative proportions.",
    "Builder",
    3,
    "tune",
    (k) => {
      const values = [
          [80, 100, 100],
          [100, 75, 80],
          [80, 75, 100],
          [100, 80, 90],
          [80, 50, 90],
        ][k],
        target = values.reduce((a, b) => (a * b) / 100, 100);
      return tune(
        `Availability = ${values[0]}%, performance = ${values[1]}%, quality = ${values[2]}%. OEE = (A/100) × (P/100) × (Q/100) × 100%. Set OEE.`,
        `${values.map((v) => v / 100).join(" × ")} × 100% = ${target}%. The factors multiply; averaging them would overstate this combined measure.`,
        "OEE",
        target,
        { max: 100, initial: 0, unit: "%", visual: { kind: "bars" } },
      );
    },
  );
  add(
    "lean-line",
    "Lean Line",
    "manufacturing",
    "Find the bottleneck by comparing sequential station cycle times.",
    "Builder",
    3,
    "sort",
    (k) => {
      const times = [
          [2, 4, 6, 9],
          [3, 5, 8, 12],
          [4, 7, 10, 15, 18],
          [3, 6, 11, 16, 22],
          [5, 9, 14, 20, 26],
        ][k],
        labels = times.map(
          (t, i) => `Station ${String.fromCharCode(65 + i)}: ${t} s / part`,
        );
      return sort(
        "Rank these sequential stations from FASTEST to SLOWEST by cycle time. Assume one machine at each station and no parallel processing. The final station in your ranking is the bottleneck.",
        labels,
        `The bottleneck takes ${times.at(-1)} s per part. Under these assumptions, the line cannot sustainably produce faster than its slowest station.`,
        k,
      );
    },
  );
  add(
    "print-sequence",
    "Print Sequence",
    "manufacturing",
    "Order dependent steps in preparing and checking a printed prototype.",
    "Starter",
    3,
    "sort",
    (k) => {
      const workflows = [
        [
          "Create the CAD model",
          "Export a mesh from the model",
          "Slice the exported mesh",
          "Print the sliced toolpath",
          "Inspect the finished print",
        ],
        [
          "Review the required dimensions",
          "Update the CAD geometry",
          "Export the updated mesh",
          "Slice the updated mesh",
          "Print and measure the prototype",
        ],
        [
          "Obtain the mesh file",
          "Check that the mesh is a closed solid",
          "Choose the print orientation",
          "Generate supports and slice",
          "Review the generated toolpath",
        ],
        [
          "Read the failed prototype’s measurements",
          "Identify the dimension that needs correction",
          "Change the CAD dimension",
          "Create a new sliced toolpath",
          "Print and compare with the target",
        ],
        [
          "Receive the approved model",
          "Confirm the intended model units",
          "Load the model into the slicer",
          "Generate and review the toolpath",
          "Print the approved toolpath",
        ],
      ][k];
      return sort(
        "Order the prototype workflow by dependency. A later file or result must be created before the next step can use it.",
        workflows,
        `This chain keeps each result consistent with the previous step: ${workflows.join(" → ")}.`,
        k,
      );
    },
  );
  add(
    "process-picker",
    "Process Picker",
    "manufacturing",
    "Match an explicitly stated manufacturing operation to its process family.",
    "Starter",
    3,
    "match",
    (k) => {
      const cases = [
        [
          ["Remove material from a rotating cylindrical workpiece.", "Turning"],
          ["Build a shape by depositing layers.", "Additive manufacturing"],
          ["Join two metal pieces by fusing their edges.", "Welding"],
          ["Force molten material into a shaped cavity.", "Injection molding"],
        ],
        [
          [
            "Use a rotating cutter to remove material from a fixed workpiece.",
            "Milling",
          ],
          ["Cut a flat metal profile using a focused beam.", "Laser cutting"],
          ["Shape sheet metal by folding it along a line.", "Bending"],
          ["Make a hole using a rotating drill bit.", "Drilling"],
        ],
        [
          [
            "Form a repeated polymer shape by filling a mold.",
            "Injection molding",
          ],
          [
            "Create a prototype by successively adding layers.",
            "Additive manufacturing",
          ],
          [
            "Reduce a rotating shaft’s outside diameter with a cutting tool.",
            "Turning",
          ],
          ["Fuse the edges of two metal plates.", "Welding"],
        ],
        [
          ["Produce a folded sheet-metal bracket.", "Bending"],
          ["Remove material with an end mill.", "Milling"],
          ["Produce a hole with a drill bit.", "Drilling"],
          [
            "Trace and cut a flat outline with a focused beam.",
            "Laser cutting",
          ],
        ],
        [
          [
            "Build geometry layer by layer instead of removing a solid block.",
            "Additive manufacturing",
          ],
          [
            "Fill a shaped mold cavity with molten polymer.",
            "Injection molding",
          ],
          ["Rotate the workpiece while a tool cuts its diameter.", "Turning"],
          ["Move a rotating cutter across a fixed part.", "Milling"],
        ],
      ][k];
      return match(
        "Match each operation to its process name. The descriptions identify how material is shaped; they do not imply a process is best for every material or production volume.",
        cases,
        "Recognize the physical operation first: adding, removing, forming, joining, or filling a mold.",
        k,
      );
    },
  );
  add(
    "defect-detective",
    "Defect Detective",
    "manufacturing",
    "Separate a defect observation from a claimed root cause.",
    "Builder",
    3,
    "match",
    (k) => {
      const data = [
        [
          ["Measured diameter exceeds the upper size limit.", "Oversize"],
          ["Measured diameter falls below the lower size limit.", "Undersize"],
          ["A thin unwanted sharp edge remains after cutting.", "Burr"],
          ["A surface has a visible linear separation.", "Crack"],
        ],
        [
          ["A flat part bows away from its intended plane.", "Warping"],
          ["Small internal voids appear in an inspection image.", "Porosity"],
          ["Two intended mating holes do not line up.", "Misalignment"],
          ["The surface has unwanted scratch marks.", "Scratching"],
        ],
        [
          ["Target width is 10–11 mm; measured width is 11.4 mm.", "Oversize"],
          ["Target width is 10–11 mm; measured width is 9.7 mm.", "Undersize"],
          ["An unwanted lip projects from a cut edge.", "Burr"],
          ["A visible split interrupts the material surface.", "Crack"],
        ],
        [
          ["A plate’s corners lift from a flat reference surface.", "Warping"],
          ["A scan shows many small empty pockets in the solid.", "Porosity"],
          ["Assembly features are offset rather than aligned.", "Misalignment"],
          ["Sliding contact leaves shallow marks on the finish.", "Scratching"],
        ],
        [
          ["A pin measures larger than its stated maximum.", "Oversize"],
          ["A slot measures narrower than its stated minimum.", "Undersize"],
          ["A sharp projection remains at the drilled-hole edge.", "Burr"],
          ["A fracture-like line separates part of the material.", "Crack"],
        ],
      ][k];
      return match(
        "Match observations to defect names. Describe what was observed; this information alone does not establish why it happened.",
        data,
        "A defect label records the observation. Establishing its root cause requires additional evidence and testing.",
        k,
      );
    },
  );
  add(
    "stock-sort",
    "Stock Sort",
    "manufacturing",
    "Apply reorder-point rules to inventory without confusing equality with shortage.",
    "Builder",
    3,
    "classify",
    (k) => {
      const point = 10 + k * 5,
        maximum = point + 20;
      return classify(
        `Inventory rule: stock BELOW ${point} units → Reorder; stock from ${point} through ${maximum} inclusive → In range; stock ABOVE ${maximum} → Overstock. Classify these bins.`,
        ["Reorder", "In range", "Overstock"],
        [
          [`Bin A: ${point - 3} units`, 0],
          [`Bin B: ${point} units`, 1],
          [`Bin C: ${point + 8} units`, 1],
          [`Bin D: ${maximum} units`, 1],
          [`Bin E: ${maximum + 5} units`, 2],
        ],
        `The boundaries are inclusive for “In range”. ${point} units does not trigger reorder under this stated rule.`,
        k,
      );
    },
  );
  add(
    "quality-gate",
    "Quality Gate",
    "manufacturing",
    "Accept measurements inside an inclusive dimensional tolerance band.",
    "Starter",
    2,
    "grid",
    (k) => {
      const nominal = 10 + k * 5,
        lo = nominal - 1,
        hi = nominal + 1,
        values = [
          lo - 1,
          lo,
          nominal,
          hi,
          hi + 1,
          lo - 0.5,
          nominal + 0.5,
          hi + 0.5,
          nominal - 0.5,
        ];
      return grid(
        `Drawing requirement: ${nominal} ± 1 mm. Select ALL acceptable measurements, including values exactly on either limit.`,
        values,
        (v) => v >= lo && v <= hi,
        `The acceptable interval is ${lo} to ${hi} mm, inclusive. The nominal value is a target, while the tolerance defines acceptance.`,
      );
    },
  );
  add(
    "workshop-route",
    "Workshop Route",
    "manufacturing",
    "Minimize part transfers through equally costly workshop links.",
    "Builder",
    3,
    "route",
    (k) => {
      const r = routingRound(
        k,
        "A teaching workshop charges one transfer unit per marked aisle. Minimize part transfers from",
        [
          "Raw stock",
          "Cell A",
          "Cell B",
          "Cell C",
          "Cell D",
          "Assembly",
          "Cell U",
          "Cell V",
          "Cell W",
        ],
      );
      r.explanation =
        "In this simplified layout each connected aisle costs one transfer unit, so the shortest valid link sequence minimizes transfer cost. The drawing’s apparent distances are not the cost model.";
      return r;
    },
  );
  add(
    "inspection-route",
    "Inspection Route",
    "manufacturing",
    "Find the shortest approved inspection handoff path around a closed checkpoint.",
    "Builder",
    3,
    "route",
    (k) => {
      const r = routingRound(
        k,
        "Only the drawn handoffs are approved in this inspection exercise; every handoff takes one minute. Route the sample from",
        [
          "Sample in",
          "Check A",
          "Check B",
          "Check C",
          "Check D",
          "Release",
          "Check U",
          "Check V",
          "Check W",
        ],
      );
      r.explanation =
        "Minimize the number of approved handoffs while avoiding a closed checkpoint. This graph exercise uses interchangeable checks; an actual inspection plan may require specific operations.";
      return r;
    },
  );

  // MATH & OPTIMIZATION — probability, constraints and efficient choices.
  add(
    "bayes-booth",
    "Bayes Booth",
    "math-optimization",
    "Update a fault probability from base counts and an imperfect signal.",
    "Explorer",
    4,
    "tune",
    (k) => {
      const bad = [100, 50, 200, 25, 400][k],
        trueFlags = bad * 0.8,
        falseFlags = [80, 60, 40, 80, 180][k],
        posterior = (trueFlags / (trueFlags + falseFlags)) * 100;
      return tune(
        `Among 1,000 parts, ${bad} have a fault. A detector flags 80% of faulty parts and also flags ${falseFlags} good parts. Given that a part is FLAGGED, what percentage of flagged parts are actually faulty? Use faulty flags ÷ all flags × 100.`,
        `There are ${bad} × 0.8 = ${trueFlags} faulty flags and ${falseFlags} false alarms. ${trueFlags} ÷ ${trueFlags + falseFlags} × 100 = ${posterior}%. The base count matters when interpreting a positive signal.`,
        "Fault probability after a flag",
        posterior,
        { max: 100, initial: 0, unit: "%", visual: { kind: "bars" } },
      );
    },
  );
  add(
    "mixture-balance",
    "Mixture Balance",
    "math-optimization",
    "Solve a two-component mixture using a weighted average.",
    "Builder",
    3,
    "tune",
    (k) => {
      const target = [12, 14, 18, 22, 26][k],
        high = (target - 10) / 2;
      return tune(
        `Make 10 L of a ${target}% mixture from 10% and 30% concentrates. In this teaching model volumes add exactly. Let x be litres of 30% concentrate: 30x + 10(10 − x) = 10 × ${target}. Set x.`,
        `Simplifying gives 20x = ${10 * target - 100}, so x = ${high} L. Use ${10 - high} L of the 10% concentrate; the volume-weighted concentration is ${target}%.`,
        "30% concentrate",
        high,
        {
          max: 10,
          initial: 0,
          unit: "L",
          visual: { kind: "bars" },
          context: {
            kind: "mixture",
            totalVolume: 10,
            lowConcentration: 10,
            highConcentration: 30,
          },
        },
      );
    },
  );
  add(
    "operation-order",
    "Operation Order",
    "math-optimization",
    "Evaluate brackets, powers, multiplication, and addition in the proper order.",
    "Starter",
    3,
    "sort",
    (k) => {
      const expressions = [
        [
          ["6 ÷ 2", 3],
          ["2 + 3", 5],
          ["2 × 4", 8],
          ["3²", 9],
        ],
        [
          ["18 ÷ 3 − 1", 5],
          ["2 × (3 + 1)", 8],
          ["2 + 3 × 4", 14],
          ["(2 + 3) × 4", 20],
        ],
        [
          ["2³", 8],
          ["20 − 2 × 4", 12],
          ["(7 + 2) × 2", 18],
          ["5²", 25],
        ],
        [
          ["24 ÷ (2 + 4)", 4],
          ["3² + 1", 10],
          ["4 × (8 − 5)", 12],
          ["2⁴", 16],
        ],
        [
          ["30 ÷ (2 × 3)", 5],
          ["(6 − 2)²", 16],
          ["3 + 4 × 5", 23],
          ["2 × (3 + 10)", 26],
        ],
      ][k];
      return sort(
        "Arrange expressions by their evaluated result, SMALLEST first. Calculate brackets, then powers, then multiplication/division, then addition/subtraction.",
        expressions.map((x) => x[0]),
        expressions.map((x) => `${x[0]} = ${x[1]}`).join("; ") +
          ". No results are tied.",
        k,
      );
    },
  );
  add(
    "critical-path",
    "Critical Path",
    "math-optimization",
    "Compute earliest task finish times while respecting dependencies.",
    "Explorer",
    4,
    "sort",
    (k) => {
      const a = 2 + k,
        d = 4 + k,
        finish = [a, a + 3, a + 5, a + 3 + d, a + 3 + d + 2],
        labels = [
          `A: ${a} min; no prerequisite`,
          `B: 3 min; after A`,
          `C: 5 min; after A`,
          `D: ${d} min; after B`,
          "E: 2 min; after both C and D",
        ];
      return sort(
        "Start the project at minute 0. Independent tasks can run in parallel. Earliest start = latest finish among prerequisites; finish = start + duration. Rank tasks by EARLIEST FINISH time, smallest first.",
        labels,
        `Earliest finishes: ${finish.map((v, i) => `${String.fromCharCode(65 + i)}=${v}`).join(", ")} minutes. E waits for D; the critical chain is A → B → D → E.`,
        k,
      );
    },
  );
  add(
    "function-family",
    "Function Family",
    "math-optimization",
    "Match a function rule to its input–output behavior.",
    "Builder",
    3,
    "match",
    (k) => {
      const funcs = [
        [
          ["y = 2x", "x=1 → y=2; x=3 → y=6"],
          ["y = x + 3", "x=1 → y=4; x=3 → y=6"],
          ["y = x²", "x=1 → y=1; x=3 → y=9"],
          ["y = 5", "x=1 → y=5; x=3 → y=5"],
        ],
        [
          ["y = 3x", "x=2 → y=6; x=4 → y=12"],
          ["y = x − 1", "x=2 → y=1; x=4 → y=3"],
          ["y = 2ˣ", "x=2 → y=4; x=4 → y=16"],
          ["y = 8 / x", "x=2 → y=4; x=4 → y=2"],
        ],
        [
          ["y = 2x + 1", "x=0 → y=1; x=2 → y=5; x=3 → y=7"],
          ["y = x² + 1", "x=0 → y=1; x=2 → y=5; x=3 → y=10"],
          ["y = x + 1", "x=0 → y=1; x=2 → y=3"],
          ["y = 4", "x=0 → y=4; x=2 → y=4"],
        ],
        [
          ["y = |x|", "x=−2 → y=2; x=3 → y=3"],
          ["y = −x", "x=−2 → y=2; x=3 → y=−3"],
          ["y = x²", "x=−2 → y=4; x=3 → y=9"],
          ["y = x − 2", "x=−2 → y=−4; x=3 → y=1"],
        ],
        [
          ["y = x / 2", "x=2 → y=1; x=6 → y=3"],
          ["y = 12 / x", "x=2 → y=6; x=6 → y=2"],
          ["y = x + 2", "x=2 → y=4; x=6 → y=8"],
          ["y = 2x − 2", "x=2 → y=2; x=6 → y=10"],
        ],
      ][k];
      return match(
        "Match each rule to the listed outputs. Substitute each x into the rule and check every output shown. A squared x and a linear x may agree at a few inputs, so use the full evidence.",
        funcs,
        "A function rule must reproduce every input–output pair in its matching card.",
        k,
      );
    },
  );
  add(
    "constraint-keeper",
    "Constraint Keeper",
    "math-optimization",
    "Identify feasible choices by checking every inequality constraint.",
    "Builder",
    3,
    "classify",
    (k) => {
      const cap = 8 + k * 2,
        min = 2 + k,
        rows = [
          [min, 1],
          [min - 1, 2],
          [min + 1, cap - min - 1],
          [min + 2, cap - min],
          [0, cap],
          [min, cap - min],
        ];
      return classify(
        `A plan has nonnegative whole-number x and y. It is feasible only if BOTH x ≥ ${min} and x + y ≤ ${cap}. Classify each candidate; equality is allowed.`,
        ["Feasible", "Infeasible"],
        rows.map(([x, y]) => [
          `x=${x}, y=${y}`,
          x >= min && x + y <= cap ? 0 : 1,
        ]),
        "Every constraint must hold. A candidate that passes the capacity check can still fail the minimum-x requirement.",
        k,
      );
    },
  );
  add(
    "knapsack-grid",
    "Knapsack Grid",
    "math-optimization",
    "Enumerate feasible choices and maximize value under a capacity limit.",
    "Explorer",
    4,
    "grid",
    (k) => {
      const data = [
        {
          cap: 5,
          items: [
            [2, 3],
            [3, 5],
            [4, 6],
          ],
          best: [0, 1],
        },
        {
          cap: 6,
          items: [
            [1, 2],
            [3, 5],
            [4, 8],
          ],
          best: [0, 2],
        },
        {
          cap: 7,
          items: [
            [2, 4],
            [3, 6],
            [5, 9],
          ],
          best: [0, 2],
        },
        {
          cap: 8,
          items: [
            [2, 3],
            [4, 7],
            [5, 10],
          ],
          best: [0, 2],
        },
        {
          cap: 9,
          items: [
            [3, 5],
            [4, 8],
            [6, 11],
          ],
          best: [0, 2],
        },
      ][k];
      const values = data.items.map(
          ([w, v], i) =>
            `${String.fromCharCode(65 + i)} · weight ${w}, value ${v}`,
        ),
        weight = sum(data.best.map((i) => data.items[i][0])),
        value = sum(data.best.map((i) => data.items[i][1]));
      return grid(
        `Capacity = ${data.cap}. Select a subset of items with maximum TOTAL VALUE and total weight ≤ capacity. Each item may be used once; you do not have to fill the capacity exactly.`,
        values,
        (_, i) => data.best.includes(i),
        `Choose ${data.best.map((i) => String.fromCharCode(65 + i)).join(" + ")}: weight ${weight}, value ${value}. Comparing all feasible subsets confirms it is the unique maximum.`,
        3,
      );
    },
  );
  add(
    "probability-deck",
    "Probability Deck",
    "math-optimization",
    "Count equally likely outcomes and distinguish replacement from no replacement.",
    "Builder",
    3,
    "select",
    (k) => {
      const data = [
        [
          "A bag holds 3 red and 2 blue tokens. Draw ONE token uniformly at random. What is the chance of red?",
          ["3/5", "2/5", "1/3"],
          0,
          "There are 3 favorable outcomes among 5 equally likely tokens: 3/5.",
        ],
        [
          "A fair six-sided die is rolled once. What is the chance of an even number?",
          ["1/6", "1/2", "2/3"],
          1,
          "The even outcomes are 2, 4, and 6: 3 of 6 outcomes, or 1/2.",
        ],
        [
          "A bag holds 2 red and 2 blue tokens. Draw two WITHOUT replacement. What is the chance both are red?",
          ["1/4", "1/2", "1/6"],
          2,
          "First red: 2/4. Then only 1 red remains among 3 tokens: (2/4) × (1/3) = 1/6.",
        ],
        [
          "A bag holds 2 red and 2 blue tokens. Draw one, REPLACE it, then draw again. What is the chance both are red?",
          ["1/4", "1/6", "1/2"],
          0,
          "Replacement restores the original bag: (2/4) × (2/4) = 1/4.",
        ],
        [
          "Two fair coins are tossed independently. What is the chance of AT LEAST one head?",
          ["1/4", "1/2", "3/4"],
          2,
          "Only TT has no head. Among HH, HT, TH, TT, three outcomes contain at least one head: 3/4.",
        ],
      ][k];
      return select(data[0], data[1], data[2], data[3]);
    },
  );
  add(
    "vector-voyager",
    "Vector Voyager",
    "math-optimization",
    "Compute displacement, length, and dot products in two dimensions.",
    "Builder",
    3,
    "select",
    (k) => {
      const data = [
        [
          "A robot moves by vector (3, 2), then by (−1, 4). What is its total displacement?",
          ["(2, 6)", "(4, −2)", "(3, 8)"],
          0,
          "Add matching coordinates: (3−1, 2+4) = (2, 6).",
        ],
        [
          "Vector v = (3, 4). Its length is √(x² + y²). What is |v|?",
          ["7", "5", "25"],
          1,
          "√(3² + 4²) = √25 = 5. The Euclidean length combines perpendicular components using the Pythagorean relation.",
        ],
        [
          "Vectors a=(2, 3) and b=(4, −1). Dot product = aₓbₓ + aᵧbᵧ. Find a·b.",
          ["11", "−5", "5"],
          2,
          "2×4 + 3×(−1) = 8−3 = 5. A dot product multiplies corresponding components and adds those products.",
        ],
        [
          "Move from point A=(2, 5) to B=(7, 3). Displacement is B−A. Choose the displacement vector.",
          ["(9, 8)", "(5, −2)", "(−5, 2)"],
          1,
          "Subtract starting coordinates from ending coordinates: (7−2, 3−5) = (5, −2).",
        ],
        [
          "Vector v=(6, 8) has length 10. Divide by its length to form a unit vector. Which is correct?",
          ["(0.6, 0.8)", "(6, 8)", "(0.8, 0.6)"],
          0,
          "(6/10, 8/10) = (0.6, 0.8), whose squared length is 0.36+0.64=1.",
        ],
      ][k];
      return select(data[0], data[1], data[2], data[3]);
    },
  );
  add(
    "optimization-sense",
    "Optimization Sense",
    "math-optimization",
    "Distinguish objectives, constraints, feasible improvements, and global evidence.",
    "Explorer",
    3,
    "select",
    (k) => {
      const data = [
        [
          "A factory wants to minimize energy while producing at least 100 units. Which quantity is the OBJECTIVE?",
          ["Energy used", "The 100-unit minimum", "The factory name"],
          0,
          "The objective is what is minimized or maximized. The production minimum is a constraint.",
        ],
        [
          "Choose the cheapest feasible plan. A costs 8 and produces 7 units; B costs 10 and produces 10; C costs 12 and produces 12. At least 10 units are required.",
          ["A", "B", "C"],
          1,
          "A is infeasible. Between feasible B and C, B has the lower cost.",
        ],
        [
          "A feasible plan costs 12. A new feasible plan costs 9 under the same constraints. For cost minimization, what changed?",
          [
            "The objective improved by 3",
            "The new plan must violate a constraint",
            "Nothing changed",
          ],
          0,
          "Both plans are feasible and 9 is 3 less than 12, so the objective improved by 3.",
        ],
        [
          "You checked every feasible plan in a finite list: costs 14, 9, 11, and 7. What can you conclude?",
          [
            "9 is the global minimum",
            "7 is the global minimum within this complete list",
            "14 is the minimum because it appeared first",
          ],
          1,
          "Exhaustive comparison over the stated complete feasible set establishes 7 as its minimum.",
        ],
        [
          "A local search finds a solution better than all its immediate neighbors. Which claim is supported without more evidence?",
          [
            "It is always the global optimum",
            "It is a local optimum for the checked neighborhood",
            "There are no other feasible solutions",
          ],
          1,
          "Beating immediate neighbors establishes a local optimum. Distant feasible solutions may still be better.",
        ],
      ][k];
      return select(data[0], data[1], data[2], data[3]);
    },
  );

  return { categories, games };
});
