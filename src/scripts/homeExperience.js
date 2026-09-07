(() => {
  "use strict";
  const tabs = [...document.querySelectorAll("[data-lab-tab]")];
  function selectLab(tab) {
    tabs.forEach((button) => {
      const active = button === tab;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      document.getElementById(button.getAttribute("aria-controls")).hidden =
        !active;
    });
  }
  function keyboardTabs(buttons, select, vertical = false) {
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(button));
      button.addEventListener("keydown", (event) => {
        const previous = vertical ? "ArrowUp" : "ArrowLeft";
        const next = vertical ? "ArrowDown" : "ArrowRight";
        if (![previous, next, "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let target = index;
        if (event.key === next) target = (index + 1) % buttons.length;
        if (event.key === previous)
          target = (index - 1 + buttons.length) % buttons.length;
        if (event.key === "Home") target = 0;
        if (event.key === "End") target = buttons.length - 1;
        select(buttons[target]);
        buttons[target].focus();
      });
    });
  }
  keyboardTabs(tabs, selectLab);

  const shoulder = document.getElementById("shoulder-angle");
  const elbow = document.getElementById("elbow-angle");
  function updateMechanism() {
    if (!shoulder || !elbow) return;
    const shoulderAngle = Number(shoulder.value);
    const elbowAngle = Number(elbow.value);
    const theta = (shoulderAngle * Math.PI) / 180;
    const phi = ((shoulderAngle + elbowAngle) * Math.PI) / 180;
    const first = {
      x: 130 + 180 * Math.cos(theta),
      y: 290 - 180 * Math.sin(theta),
    };
    const end = {
      x: first.x + 165 * Math.cos(phi),
      y: first.y - 165 * Math.sin(phi),
    };
    // Fit the full physical reach into the preview without limiting the controls.
    const points = [{ x: 130, y: 290 }, first, end];
    const minX = Math.min(30, ...points.map((p) => p.x)) - 25;
    const maxX = Math.max(595, ...points.map((p) => p.x)) + 25;
    const minY = Math.min(0, ...points.map((p) => p.y)) - 25;
    const maxY = Math.max(335, ...points.map((p) => p.y)) + 25;
    document
      .getElementById("mechanism-svg")
      .setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    document
      .getElementById("arm-one")
      .setAttribute("d", `M130 290 ${first.x} ${first.y}`);
    document
      .getElementById("arm-two")
      .setAttribute("d", `M${first.x} ${first.y} ${end.x} ${end.y}`);
    document
      .getElementById("arm-shadow")
      .setAttribute("d", `M130 290 ${first.x} ${first.y} ${end.x} ${end.y}`);
    const joint = document.getElementById("arm-joint");
    joint.setAttribute("cx", first.x);
    joint.setAttribute("cy", first.y);
    const tool = document.getElementById("arm-tool");
    tool.setAttribute("cx", end.x);
    tool.setAttribute("cy", end.y);
    document
      .getElementById("arm-target")
      .setAttribute(
        "d",
        `M${end.x - 17} ${end.y}h34M${end.x} ${end.y - 17}v34`,
      );
    document.getElementById("shoulder-value").textContent = `${shoulderAngle}°`;
    document.getElementById("elbow-value").textContent =
      `${elbowAngle < 0 ? "−" : ""}${Math.abs(elbowAngle)}°`;
    document.getElementById("arm-coordinate").textContent =
      `TOOL POSITION / X: ${Math.round(end.x - 130)} Y: ${Math.round(290 - end.y)}`;
  }
  shoulder?.addEventListener("input", updateMechanism);
  elbow?.addEventListener("input", updateMechanism);
  updateMechanism();

  const anomalyButton = document.getElementById("anomaly-button");
  const normalSignal = document
    .getElementById("signal-line")
    ?.getAttribute("d");
  anomalyButton?.addEventListener("click", () => {
    const anomaly = anomalyButton.getAttribute("aria-pressed") !== "true";
    anomalyButton.setAttribute("aria-pressed", String(anomaly));
    anomalyButton.innerHTML = anomaly
      ? '<span class="anomaly-symbol" aria-hidden="true">↺</span> Reset the signal <span aria-hidden="true">↗</span>'
      : '<span class="anomaly-symbol" aria-hidden="true">⌁</span> Introduce an anomaly <span aria-hidden="true">↗</span>';
    document
      .getElementById("intelligence-demo")
      .classList.toggle("is-anomaly", anomaly);
    document.getElementById("anomaly-status").innerHTML = anomaly
      ? '<span class="mini-dot"></span>Pattern detected. A maintenance check is recommended.'
      : '<span class="mini-dot"></span>All clear. The system is listening.';
    document.getElementById("decision-label").textContent = anomaly
      ? "CHECK NEEDED"
      : "HEALTHY";
    document.getElementById("decision-caption").textContent = anomaly
      ? "Act before a breakdown"
      : "Keep things moving";
    document.getElementById("signal-state").textContent = anomaly
      ? "UNUSUAL VIBRATION"
      : "NORMAL PATTERN";
    document.getElementById("intelligence-explanation").textContent = anomaly
      ? "An unusual signal becomes an actionable maintenance alert."
      : "Connected machines. More informed decisions.";
    document
      .getElementById("signal-svg")
      .setAttribute(
        "aria-label",
        anomaly
          ? "Simulated vibration chart showing sharp unusual vibration spikes"
          : "Simulated vibration chart showing a normal repeating pattern",
      );
    document
      .getElementById("signal-line")
      .setAttribute(
        "d",
        anomaly
          ? "M0 55 15 55 25 43 35 67 45 51 55 55 80 55 91 36 104 75 116 49 125 55 155 55 169 43 180 65 193 48 205 55 225 55 236 20 245 101 255 6 265 89 276 34 286 72 298 50 315 55 327 42 338 67 350 48 362 55 381 55 392 8 404 101 415 14 429 90 440 31 452 60 472 55 484 43 495 64 508 50 520 55 552 55 564 45 580 55"
          : normalSignal,
      );
  });

  const skillPaths = {
    design: {
      name: "DESIGN & BUILD",
      steps: [
        [
          "Foundations",
          "Start with the fundamentals.",
          "Read engineering drawings, explore geometry, and understand how dimensions and tolerances bring an idea into the real world.",
          "TRY IT: SKETCH A SIMPLE BRACKET",
        ],
        [
          "3D modeling",
          "Give your idea a dimension.",
          "Turn a sketch into a parametric 3D model. Work with parts, assemblies, and clear design intent using professional CAD workflows.",
          "TRY IT: MODEL A TWO-PART ASSEMBLY",
        ],
        [
          "Simulation",
          "Ask “will it work?” before you build.",
          "Explore loads, constraints, and material behavior. Use structural or thermal simulation to understand how a design could perform.",
          "TRY IT: COMPARE TWO BRACKET DESIGNS",
        ],
        [
          "Prototype",
          "Make the leap from screen to bench.",
          "Prepare a manufacturable design, build a physical prototype, and use measurements and testing to inform the next iteration.",
          "TRY IT: BUILD AND TEST YOUR FIRST PART",
        ],
      ],
    },
    intelligence: {
      name: "AI & IoT",
      steps: [
        [
          "Python basics",
          "Give your curiosity a language.",
          "Build confidence with Python, data structures, and simple analysis. Learn how a few lines of code can explain a real-world signal.",
          "TRY IT: PLOT A SENSOR DATASET",
        ],
        [
          "Sensors",
          "Connect code to the real world.",
          "Learn how microcontrollers read sensors. Collect temperature or vibration readings and understand noise, sampling, and data quality.",
          "TRY IT: READ A TEMPERATURE SENSOR",
        ],
        [
          "AI models",
          "Find the pattern in the noise.",
          "Explore preprocessing, simple machine learning models, and meaningful evaluation. Understand what your model knows and where it needs care.",
          "TRY IT: CLASSIFY NORMAL VS UNUSUAL SIGNALS",
        ],
        [
          "Integration",
          "Turn an insight into something useful.",
          "Bring a sensor, a model, and a dashboard together. Build an understandable system that helps someone make a better decision.",
          "TRY IT: BUILD A MACHINE-HEALTH DASHBOARD",
        ],
      ],
    },
    automation: {
      name: "AUTOMATION",
      steps: [
        [
          "Logic",
          "Start with cause and effect.",
          "Understand inputs, outputs, sequencing, and safe operating states. Map a simple process before you begin programming it.",
          "TRY IT: MAP A CONVEYOR SEQUENCE",
        ],
        [
          "Soft-PLC",
          "Make a process follow your logic.",
          "Practice industrial control concepts using software PLC tools. Explore timers, interlocks, and structured sequences in a learning environment.",
          "TRY IT: SIMULATE A START/STOP CIRCUIT",
        ],
        [
          "Connectivity",
          "Help your systems talk.",
          "Explore IoT connectivity, real-time monitoring, and the movement of information between controllers and an operator interface.",
          "TRY IT: CONNECT A STATUS DASHBOARD",
        ],
        [
          "Smart systems",
          "Bring the whole workflow together.",
          "Combine control logic, sensing, and visibility in a practical learning project. Test edge cases and document the behavior you expect.",
          "TRY IT: BUILD A VIRTUAL SORTING STATION",
        ],
      ],
    },
  };
  let activePath = "design";
  let activeMilestone = 0;
  const pathButtons = [...document.querySelectorAll("[data-skill-path]")];
  const milestones = [...document.querySelectorAll("[data-milestone]")];
  function updatePath() {
    const path = skillPaths[activePath];
    pathButtons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.skillPath === activePath),
      ),
    );
    milestones.forEach((button, index) => {
      button.querySelector("strong").textContent = path.steps[index][0];
      button.classList.toggle("is-active", activeMilestone === index);
      button.setAttribute("aria-pressed", String(activeMilestone === index));
    });
    const step = path.steps[activeMilestone];
    document.getElementById("milestone-number").textContent =
      `STEP 0${activeMilestone + 1} / ${path.name}`;
    document.getElementById("milestone-title").textContent = step[1];
    document.getElementById("milestone-description").textContent = step[2];
    document.getElementById("milestone-project").textContent = step[3];
  }
  pathButtons.forEach((button) =>
    button.addEventListener("click", () => {
      activePath = button.dataset.skillPath;
      activeMilestone = 0;
      updatePath();
    }),
  );
  milestones.forEach((button) =>
    button.addEventListener("click", () => {
      activeMilestone = Number(button.dataset.milestone);
      updatePath();
    }),
  );
})();
