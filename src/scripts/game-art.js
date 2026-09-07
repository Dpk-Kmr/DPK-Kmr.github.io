/* Original concept illustrations: one visual identity for each learning game. */
(() => {
  const line = (d) => `<path class="art-line" d="${d}"/>`,
    circle = (x, y, r = 4, dim = false) =>
      `<circle class="${dim ? "art-line" : "art-fill"}" cx="${x}" cy="${y}" r="${r}"/>`,
    rect = (x, y, w, h, fill = false) =>
      `<rect class="${fill ? "art-fill" : "art-line"}" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`,
    label = (x, y, t, size = 11) =>
      `<text fill="currentColor" x="${x}" y="${y}" text-anchor="middle" font-family="var(--font-mono)" font-size="${size}">${t}</text>`;
  const points = (ps) => ps.map(([x, y]) => circle(x, y, 3)).join("");
  const bars = (heights, x = 27) =>
    heights.map((h, i) => rect(x + i * 28, 88 - h, 16, h, true)).join("");
  const s = {
    "mean-mixer":
      bars([25, 48, 70]) + line("M20 40H164") + label(151, 31, "μ", 17),
    "median-shield":
      line("M16 55H174") +
      [25, 48, 70, 95, 119, 142, 166]
        .map((x, i) => circle(x, 55, i === 3 ? 12 : 4, i === 3))
        .join("") +
      label(95, 88, "middle", 10),
    "spread-lab":
      line(
        "M15 87C45 87 58 20 94 20S144 87 177 87M56 91H133M56 85V98M133 85V98",
      ) + label(95, 67, "σ²", 17),
    "feature-scaler":
      line(
        "M22 23H168M22 18V29M168 18V29M42 86H148M42 80V92M148 80V92M32 34 52 70M159 34 138 70",
      ) +
      label(22, 13, "0", 9) +
      label(168, 13, "100", 9) +
      label(42, 107, "0", 9) +
      label(148, 107, "1", 9) +
      circle(112, 23, 5) +
      circle(108, 86, 5),
    "chart-chooser":
      bars([15, 28, 43], 20) +
      line("M118 66V23H170M122 59 137 43 153 48 169 25") +
      circle(144, 86, 13, true) +
      line("M144 73V86H157"),
    "data-detective":
      rect(15, 30, 47, 47) +
      rect(72, 30, 47, 47) +
      rect(129, 30, 47, 47) +
      label(39, 60, "Aa", 17) +
      label(96, 60, "#", 21) +
      label(153, 60, "↔", 20),
    "sampling-scout": Array.from({ length: 24 }, (_, i) =>
      circle(
        26 + (i % 6) * 28,
        21 + Math.floor(i / 6) * 23,
        [2, 7, 14, 21].includes(i) ? 7 : 3,
        [2, 7, 14, 21].includes(i),
      ),
    ).join(""),
    "outlier-radar":
      points([
        [40, 46],
        [50, 57],
        [32, 63],
        [61, 70],
        [72, 52],
        [66, 32],
        [48, 31],
        [80, 69],
        [53, 85],
      ]) +
      circle(151, 24, 5) +
      circle(151, 24, 17, true) +
      line("M100 54 132 35"),
    "missing-pieces": Array.from({ length: 12 }, (_, i) =>
      [3, 6, 10].includes(i)
        ? label(43 + (i % 4) * 35, 32 + Math.floor(i / 4) * 28, "?", 16)
        : rect(30 + (i % 4) * 35, 15 + Math.floor(i / 4) * 28, 25, 21),
    ).join(""),
    "correlation-compass":
      line("M22 91H175M22 91V16M33 84 163 24") +
      points([
        [41, 78],
        [60, 69],
        [78, 63],
        [99, 49],
        [114, 44],
        [134, 36],
        [155, 22],
      ]),
    "threshold-tuner":
      bars([22, 38, 70, 58]) + line("M16 40H174") + label(162, 32, "T", 13),
    "gradient-step":
      line("M23 20Q97 160 174 20") +
      points([
        [40, 46],
        [55, 68],
        [71, 84],
        [88, 90],
      ]) +
      line("m41 47 19 17m-2-9 2 9-10-1") +
      circle(99, 90, 8, true),
    "pipeline-pilot":
      rect(9, 39, 43, 33) +
      rect(73, 39, 43, 33) +
      rect(137, 39, 43, 33) +
      line("M52 55H70M116 55H134m-69-5 5 5-5 5m64-10 5 5-5 5") +
      label(30, 60, "data", 10) +
      label(94, 60, "fit", 10) +
      label(158, 60, "test", 10),
    "metric-match":
      rect(32, 18, 56, 35) +
      rect(101, 18, 56, 35) +
      rect(32, 66, 56, 35) +
      rect(101, 66, 56, 35) +
      label(60, 41, "TP", 14) +
      label(129, 41, "FP", 14) +
      label(60, 89, "FN", 14) +
      label(129, 89, "TN", 14),
    "model-mission":
      rect(72, 10, 47, 26) +
      line("M95 36V48M42 65V48H151V65") +
      rect(19, 66, 47, 28) +
      rect(127, 66, 47, 28) +
      label(95, 27, "x > t", 10) +
      circle(42, 80, 5) +
      label(150, 84, "×", 18),
    "leakage-guard":
      rect(14, 34, 51, 45) +
      rect(126, 34, 51, 45) +
      line("M66 56H124M90 43 103 69M103 43 90 69") +
      label(40, 60, "train", 9) +
      label(152, 60, "test", 10),
    "learning-modes":
      points([
        [35, 26],
        [44, 37],
        [30, 46],
        [50, 60],
        [65, 51],
        [119, 35],
        [134, 43],
        [123, 59],
        [150, 61],
      ]) +
      rect(21, 15, 47, 60) +
      circle(135, 47, 29, true) +
      label(40, 97, "labels", 9) +
      label(134, 97, "patterns", 9),
    "confusion-matrix":
      rect(36, 16, 52, 35, true) +
      rect(100, 16, 52, 35) +
      rect(36, 65, 52, 35) +
      rect(100, 65, 52, 35, true) +
      line("M21 56H168M94 6V107"),
    "cluster-pilot":
      circle(42, 41, 29, true) +
      circle(131, 35, 25, true) +
      circle(105, 82, 23, true) +
      points([
        [26, 35],
        [39, 50],
        [52, 34],
        [121, 25],
        [139, 37],
        [128, 43],
        [94, 81],
        [108, 91],
        [116, 74],
      ]),
    "overfit-detective":
      line(
        "M18 86C33 4 53 109 69 32S94 110 111 40S144 77 172 14M19 73 171 32",
      ) +
      points([
        [25, 69],
        [48, 63],
        [73, 60],
        [103, 48],
        [131, 45],
        [159, 32],
      ]),
    "signal-sampler":
      line(
        "M12 55C28-12 43-12 59 55S90 122 106 55S137-12 153 55S174 96 183 75",
      ) +
      points([
        [18, 34],
        [40, 6],
        [61, 62],
        [83, 103],
        [106, 55],
        [130, 5],
        [153, 55],
        [173, 91],
      ]),
    "sensor-calibration":
      line("M34 81A65 65 0 0 1 130 19M144 35A65 65 0 0 1 158 81M95 77 141 31") +
      circle(95, 77, 7) +
      label(82, 42, "+c", 15) +
      line("M34 81H49M40 46 53 53M65 21 71 34M95 11V25M158 81H144"),
    "message-journey":
      rect(19, 40, 30, 40) +
      line("M34 34Q60 6 85 34M44 39Q60 20 76 39M58 61H122") +
      rect(85, 50, 18, 18, true) +
      rect(137, 24, 34, 66) +
      line("M145 36H164M145 48H164M145 76H164"),
    "protocol-match":
      rect(26, 19, 138, 23) +
      rect(39, 44, 113, 23) +
      rect(52, 69, 87, 23) +
      label(95, 35, "application", 10) +
      label(95, 60, "transport", 10) +
      label(95, 85, "link", 10),
    "plc-logic":
      line("M15 35H66M15 75H66M65 20V91H105C164 91 164 20 105 20ZM148 55H180") +
      circle(15, 35, 5) +
      circle(15, 75, 5, true) +
      label(101, 62, "AND", 14),
    "packet-parity":
      Array.from({ length: 7 }, (_, i) => rect(15 + i * 23, 34, 18, 27)).join(
        "",
      ) +
      ["1", "0", "1", "1", "0", "0", "1"]
        .map((t, i) => label(24 + i * 23, 52, t, 12))
        .join("") +
      line("M15 72H171M171 65V79") +
      label(95, 98, "even parity", 10),
    "sampling-windows":
      line("M15 84H177") +
      rect(20, 21, 44, 63) +
      rect(67, 21, 44, 63) +
      rect(114, 21, 44, 63) +
      points([
        [26, 60],
        [47, 42],
        [76, 36],
        [96, 65],
        [118, 54],
        [145, 32],
      ]) +
      label(89, 103, "[ t₀, t₁ )", 10),
    "packet-router":
      line("M20 55 70 19 118 55 168 21M20 55 70 91 118 55 168 91M168 21V91") +
      [
        [20, 55],
        [70, 19],
        [118, 55],
        [168, 21],
        [168, 91],
        [70, 91],
      ]
        .map(([x, y]) => circle(x, y, 7, true))
        .join(""),
    "sensor-relay":
      line("M26 80 67 44 109 77 157 36M67 44 114 15 157 36M67 44 109 77") +
      points([
        [26, 80],
        [67, 44],
        [109, 77],
        [157, 36],
        [114, 15],
      ]) +
      line("M14 65Q26 51 39 65M144 22Q157 9 170 22"),
    "sensor-units":
      line(
        "M53 15V66A15 15 0 1 0 69 66V15Q61 6 53 15ZM61 33V74M73 27H85M73 43H82M73 59H85",
      ) +
      circle(61, 79, 7) +
      line("M139 21Q110 58 117 75Q139 106 160 75Q168 58 139 21Z") +
      label(139, 78, "%", 16),
    "tolerance-fit":
      rect(18, 37, 145, 36) +
      line("M58 16V94M134 16V94") +
      rect(48, 26, 97, 58) +
      line("M55 11H139m-81-4-4 4 4 4m77-8 4 4-4 4") +
      label(96, 106, "clearance", 9),
    "oee-workshop":
      circle(43, 50, 26, true) +
      circle(96, 50, 26, true) +
      circle(149, 50, 26, true) +
      label(43, 57, "A", 21) +
      label(96, 57, "P", 21) +
      label(149, 57, "Q", 21) +
      label(95, 97, "A × P × Q", 12),
    "lean-line":
      rect(12, 39, 37, 34) +
      rect(76, 24, 37, 64) +
      rect(140, 39, 37, 34) +
      line("M49 56H75M113 56H140") +
      circle(22, 93, 4) +
      circle(36, 93, 4) +
      circle(50, 93, 4) +
      circle(64, 93, 4) +
      label(95, 62, "!", 23),
    "print-sequence":
      line(
        "M32 89H156M39 78H149M46 67H142M53 56H135M60 45H128M68 34H120M76 23H112M89 11H99",
      ) + line("M169 82V20m-5 7 5-7 5 7"),
    "process-picker":
      line("M19 76H86V42H64V20H42V42H19ZM114 81V59H135V38H154V17H173") +
      label(52, 101, "− material", 9) +
      label(140, 101, "+ material", 9),
    "defect-detective":
      rect(19, 23, 112, 67) +
      line("M80 24 68 42 84 57 65 72 74 90") +
      circle(133, 52, 27, true) +
      line("M153 74 177 99"),
    "stock-sort":
      rect(20, 69, 32, 26) +
      rect(20, 41, 32, 26) +
      rect(72, 69, 32, 26) +
      rect(72, 41, 32, 26) +
      rect(72, 13, 32, 26) +
      rect(124, 69, 32, 26) +
      line("M10 59H171") +
      label(162, 48, "ROP", 10),
    "quality-gate":
      line("M17 89C45 89 54 19 95 19S145 89 177 89M56 14V99M135 14V99") +
      label(95, 62, "✓", 25),
    "workshop-route":
      rect(19, 18, 41, 27) +
      rect(129, 18, 41, 27) +
      rect(19, 75, 41, 27) +
      rect(129, 75, 41, 27) +
      line("M60 32H112V88H129M40 45V75M150 45V75") +
      circle(95, 32, 6),
    "inspection-route":
      line("M30 30H153V85H30V30M30 85 153 30") +
      [
        [30, 30],
        [91, 30],
        [153, 30],
        [153, 85],
        [91, 85],
        [30, 85],
      ]
        .map(([x, y], i) => circle(x, y, i % 2 ? 5 : 10, true))
        .join("") +
      label(92, 67, "✓", 21),
    "bayes-booth":
      line(
        "M21 56 85 24 166 12M85 24 166 43M21 56 85 89 166 72M85 89 166 105",
      ) +
      circle(21, 56, 6) +
      circle(85, 24, 6) +
      circle(85, 89, 6, true) +
      label(42, 23, "P(A)", 10) +
      label(134, 61, "P(B|A)", 10),
    "mixture-balance":
      line(
        "M23 25V87Q23 96 37 96H64Q76 96 76 87V25M114 25V87Q114 96 128 96H155Q167 96 167 87V25",
      ) +
      rect(29, 55, 41, 34, true) +
      rect(120, 39, 41, 50, true) +
      label(49, 17, "10%", 11) +
      label(140, 17, "30%", 11) +
      label(96, 65, "+", 18),
    "operation-order":
      circle(95, 23, 15, true) +
      circle(45, 78, 17, true) +
      circle(145, 78, 17, true) +
      line("M84 35 56 65M107 35 134 65") +
      label(95, 29, "+", 17) +
      label(45, 84, "×", 21) +
      label(145, 84, "÷", 21),
    "critical-path":
      line("M20 57 71 21 128 21 175 57 128 91 71 91 20 57M71 21 128 91") +
      [
        [20, 57],
        [71, 21],
        [128, 21],
        [175, 57],
        [128, 91],
        [71, 91],
      ]
        .map(([x, y]) => circle(x, y, 6, true))
        .join("") +
      line("M20 57 71 21 128 21 175 57"),
    "function-family": line(
      "M16 90H177M16 90V13M23 79 171 21M22 87Q126 90 173 11M22 56Q47 5 74 56T127 56T177 56",
    ),
    "constraint-keeper":
      line("M22 89H176M22 89V14M27 29 159 90M30 89 142 14M26 52H170") +
      `<path class="art-fill art-dim" d="M58 74 92 34 131 52 159 90H75Z"/>` +
      circle(95, 64, 5),
    "knapsack-grid":
      line("M60 29V17Q95-2 130 17V29M46 29H144L158 92Q95 110 32 92Z") +
      rect(54, 53, 23, 23, true) +
      rect(84, 42, 23, 34) +
      rect(114, 58, 23, 18, true),
    "probability-deck":
      rect(29, 24, 45, 67) +
      rect(74, 16, 45, 67) +
      rect(119, 24, 45, 67) +
      label(51, 69, "♠", 24) +
      label(96, 58, "A", 24) +
      label(141, 69, "♦", 24),
    "vector-voyager":
      line(
        "M27 90H169M27 90V14M27 90 143 24m-14 1 14-1-7 13M27 90 150 76m-11-5 11 5-9 7",
      ) +
      label(115, 26, "u", 13) +
      label(158, 67, "v", 13),
    "optimization-sense":
      `<ellipse class="art-line art-dim" cx="100" cy="56" rx="78" ry="41"/><ellipse class="art-line" cx="100" cy="56" rx="53" ry="28"/><ellipse class="art-line" cx="100" cy="56" rx="25" ry="14"/>` +
      line("M38 85 64 65 100 56") +
      circle(100, 56, 4),
  };
  window.AtrikshaGameArt = {
    render(id) {
      return `<svg viewBox="0 0 190 112" aria-hidden="true">${s[id] || ""}</svg>`;
    },
  };
})();
