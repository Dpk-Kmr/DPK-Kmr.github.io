(() => {
  "use strict";

  const catalog = window.ATRIKSHA_RESEARCH;
  const grid = document.getElementById("research-grid");
  if (!catalog?.papers || !grid) return;

  const countLabel = document.querySelector("[data-research-count]");
  const yearLabel = document.querySelector("[data-research-range]");
  if (countLabel)
    countLabel.textContent = `${catalog.papers.length} publications`;
  const years = catalog.papers.map((paper) => paper.year);
  if (yearLabel && years.length)
    yearLabel.textContent = `${Math.min(...years)}–${Math.max(...years)}`;

  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  // Original concept diagrams. Coordinates and curves are schematic, not study data.
  // Each group maps to Question / Approach / Finding in the accompanying story.
  const diagrams = {
    "co2-solvents": `
      <g class="stage-part" data-stage="0">
        <path d="M45 80L69 65L94 79V106L69 121L45 106ZM45 80L27 69M94 79L112 68M69 121V142"/>
        <circle class="soft story-spark" cx="69" cy="92" r="37"/>
        <circle class="solid" cx="27" cy="69" r="4"/><circle class="solid" cx="112" cy="68" r="4"/>
        <text x="69" y="170">Molecules</text>
      </g>
      <path class="diagram-arrow" d="M119 97H144L138 91M144 97L138 103M230 97H253L247 91M253 97L247 103"/>
      <g class="stage-part" data-stage="1">
        <rect class="soft" x="153" y="53" width="70" height="81" rx="10"/>
        <path d="M165 111C175 83 186 115 211 73M165 69H190M165 78H180"/>
        <circle class="solid story-spark" cx="211" cy="73" r="4"/>
        <text x="188" y="170">Predict properties</text>
      </g>
      <g class="stage-part" data-stage="2">
        <path d="M282 63V115Q282 124 291 124H301Q310 124 310 115V63M278 63H314M282 86H310M326 83V132Q326 139 333 139H343Q350 139 350 132V83M322 83H354M326 104H350"/>
        <path class="story-spark" d="M289 99H303M329 114Q338 124 348 114M291 48V38M298 50V32M305 48V40"/>
        <text x="318" y="170">Compare blends</text>
      </g>`,
    "symbolic-physics": `
      <g class="stage-part" data-stage="0">
        <path class="diagram-muted" d="M27 131V48M27 131H117"/>
        <path class="diagram-muted" d="M36 118C62 114 51 65 107 53"/>
        <circle class="solid" cx="38" cy="119" r="4"/><circle class="solid" cx="52" cy="111" r="4"/><circle class="solid" cx="65" cy="90" r="4"/><circle class="solid" cx="78" cy="71" r="4"/><circle class="solid story-spark" cx="104" cy="55" r="4"/>
        <text x="70" y="170">Observations</text>
      </g>
      <path class="diagram-arrow" d="M123 97H142L136 91M142 97L136 103M238 97H257L251 91M257 97L251 103"/>
      <g class="stage-part" data-stage="1">
        <rect class="soft" x="151" y="52" width="33" height="32" rx="5"/><rect class="soft" x="193" y="52" width="33" height="32" rx="5"/><rect class="soft" x="151" y="95" width="33" height="32" rx="5"/><rect class="soft" x="193" y="95" width="33" height="32" rx="5"/>
        <text class="diagram-large" x="168" y="77">+</text><text class="diagram-large" x="210" y="77">×</text><text class="diagram-large" x="168" y="119">÷</text><text class="story-spark" x="210" y="115">exp</text>
        <text x="190" y="170">Symbolic learning</text>
      </g>
      <g class="stage-part" data-stage="2">
        <path class="soft" d="M272 44H329L349 64V142H272ZM329 44V64H349"/>
        <text class="diagram-large story-spark" x="308" y="92">f(x)</text>
        <path d="M286 107H335M286 118H326M286 130H315"/>
        <text x="310" y="170">Readable physics</text>
      </g>`,
    "model-maintenance": `
      <g class="stage-part" data-stage="0">
        <path class="diagram-muted" d="M25 115H115"/>
        <path d="M25 107L48 107L53 70L76 70L81 107L106 107"/>
        <path class="story-spark" d="M72 50L86 40L103 51M87 40V61"/>
        <text x="70" y="170">Process changes</text>
      </g>
      <path class="diagram-arrow" d="M121 97H139L133 91M139 97L133 103M238 97H256L250 91M256 97L250 103"/>
      <g class="stage-part" data-stage="1">
        <rect class="soft" x="146" y="72" width="25" height="46" rx="5"/><rect class="soft" x="180" y="60" width="25" height="58" rx="5"/><rect class="soft" x="214" y="49" width="16" height="69" rx="5"/>
        <path d="M152 89L158 95L165 84M185 83L191 89L199 76"/>
        <path class="story-spark" d="M215 67L220 73L227 61"/>
        <text x="190" y="170">Update each layer</text>
      </g>
      <g class="stage-part" data-stage="2">
        <path class="diagram-muted" stroke-dasharray="4 5" d="M268 114C286 105 308 81 350 79"/>
        <path class="story-spark" d="M268 110C288 101 290 58 312 75S333 127 352 93"/>
        <circle class="solid" cx="278" cy="101" r="3"/><circle class="solid" cx="300" cy="71" r="3"/><circle class="solid" cx="324" cy="98" r="3"/><circle class="solid" cx="347" cy="103" r="3"/>
        <text x="312" y="170">Adapt the model</text>
      </g>`,
    "koopman-dynamics": `
      <g class="stage-part" data-stage="0">
        <path class="soft story-spark" d="M38 111C16 72 86 39 104 75S66 137 43 106S53 66 76 74S88 110 69 107S55 89 69 89"/>
        <text x="70" y="170">Nonlinear motion</text>
      </g>
      <path class="diagram-arrow" d="M120 97H142L136 91M142 97L136 103M237 97H257L251 91M257 97L251 103"/>
      <g class="stage-part" data-stage="1">
        <path class="soft" d="M155 70L187 50L225 70V121L192 140L155 121ZM155 70L192 90L225 70M192 90V140"/>
        <path class="story-spark" d="M174 75L188 65L205 74M182 76L188 80L203 71"/>
        <text x="190" y="170">Explicit mapping</text>
      </g>
      <g class="stage-part" data-stage="2">
        <path d="M272 128L347 60M272 100L323 54M294 133L352 80"/>
        <circle class="solid story-spark" cx="321" cy="84" r="5"/><circle class="solid" cx="298" cy="77" r="4"/><circle class="solid" cx="325" cy="105" r="4"/>
        <text x="311" y="170">Linear evolution</text>
      </g>`,
    "heart-health": `
      <g class="stage-part" data-stage="0">
        <path d="M29 65H104M29 88H104M29 111H104M29 134H104" class="diagram-muted"/>
        <rect class="soft" x="33" y="57" width="29" height="15" rx="3"/><rect class="soft" x="44" y="80" width="47" height="15" rx="3"/><rect class="soft" x="63" y="103" width="35" height="15" rx="3"/><circle class="solid story-spark" cx="52" cy="134" r="4"/><circle class="solid" cx="75" cy="134" r="4"/>
        <text x="69" y="170">Patient inputs</text>
      </g>
      <path class="diagram-arrow" d="M119 97H142L136 91M142 97L136 103M232 97H257L251 91M257 97L251 103"/>
      <g class="stage-part" data-stage="1">
        <path d="M155 51H222M155 138H222" class="diagram-muted"/>
        <rect x="158" y="62" width="24" height="10" rx="2"/><rect x="194" y="62" width="24" height="10" rx="2"/><rect x="158" y="77" width="24" height="10" rx="2"/><rect x="194" y="77" width="24" height="10" rx="2"/><rect x="158" y="92" width="24" height="10" rx="2"/><rect x="194" y="92" width="24" height="10" rx="2"/><rect class="soft story-spark" x="158" y="107" width="24" height="10" rx="2"/><rect x="194" y="107" width="24" height="10" rx="2"/><rect x="158" y="122" width="24" height="10" rx="2"/><rect x="194" y="122" width="24" height="10" rx="2"/>
        <text x="190" y="170">Compare models</text>
      </g>
      <g class="stage-part" data-stage="2">
        <rect class="soft" x="283" y="43" width="57" height="101" rx="9"/><path d="M302 52H320M304 136H318"/>
        <path class="story-spark" d="M293 83C285 69 304 64 311 78C317 64 337 69 329 83L311 102Z"/>
        <path d="M297 114H326M297 122H318"/>
        <text x="310" y="170">mHealth research</text>
      </g>`,
    "forward-faults": `
      <g class="stage-part" data-stage="0">
        <path d="M24 68L34 68L42 59L51 78L59 67H112M24 95L36 95L44 87L55 102L66 91L77 96H112"/>
        <path class="story-spark" d="M24 121H54L64 113L73 139L81 117L90 122H112"/>
        <text x="70" y="170">Live signals</text>
      </g>
      <path class="diagram-arrow" d="M121 96H143L137 90M143 96L137 102M232 96H254L248 90M254 96L248 102"/>
      <g class="stage-part" data-stage="1">
        <path class="soft" d="M153 53L179 77H201L225 53V138L201 114H179L153 138Z"/>
        <path d="M160 70L186 91H194L218 70M160 122L186 100H194L218 122"/>
        <circle class="solid story-spark" cx="190" cy="96" r="5"/>
        <text x="190" y="170">Forward learning</text>
      </g>
      <g class="stage-part" data-stage="2">
        <path d="M267 96H280V65H298M280 96V126H298"/>
        <circle class="soft" cx="318" cy="65" r="17"/><path d="M311 65L316 70L325 59"/>
        <path class="soft story-spark" d="M319 109L337 141H301Z"/><path d="M319 119V127M319 133V134"/>
        <text x="312" y="170">Isolate faults</text>
      </g>`,
    "antibody-production": `
      <g class="stage-part" data-stage="0">
        <path class="soft" d="M41 64Q41 53 69 53Q97 53 97 64V126Q97 140 69 140Q41 140 41 126Z"/>
        <path d="M41 64Q69 77 97 64M69 41V116M54 99H83M57 113H80M41 86H22V51M97 116H119V134"/>
        <circle class="solid story-spark" cx="53" cy="122" r="3"/><circle class="solid" cx="85" cy="86" r="3"/><circle class="solid" cx="77" cy="127" r="3"/>
        <text x="70" y="170">Bioreactor</text>
      </g>
      <path class="diagram-arrow" d="M121 96H143L137 90M143 96L137 102M235 96H256L250 90M256 96L250 102"/>
      <g class="stage-part" data-stage="1">
        <path d="M188 53V132M157 69H220M188 53L185 58M161 69L148 99H175ZM214 69L202 115H228Z"/>
        <path class="soft" d="M148 99Q161 117 175 99M202 115Q215 132 228 115"/>
        <path class="story-spark" d="M174 132H202"/>
        <text x="190" y="170">Balance priorities</text>
      </g>
      <g class="stage-part" data-stage="2">
        <path d="M280 65L292 78L304 65M292 78V100M323 95L335 108L347 95M335 108V130M283 118L294 130L305 118M294 130V147"/>
        <circle class="soft story-spark" cx="312" cy="96" r="51"/>
        <text x="312" y="170">Antibody output</text>
      </g>`,
  };

  const fallbackDiagram = `
    <g class="stage-part" data-stage="0"><circle class="soft" cx="70" cy="95" r="30"/><text x="70" y="100">Question</text></g>
    <path class="diagram-arrow" d="M107 95H143M227 95H263"/>
    <g class="stage-part" data-stage="1"><rect class="soft" x="150" y="65" width="75" height="60" rx="8"/><text x="188" y="100">Approach</text></g>
    <g class="stage-part" data-stage="2"><circle class="soft" cx="305" cy="95" r="32"/><text x="305" y="100">Finding</text></g>`;

  const diagram = (paper) => `<figure class="research-visual">
    <svg viewBox="0 0 380 190" role="img" aria-label="${escape(paper.visualDescription)}">
      <g class="diagram-base"><path class="diagram-grid" d="M10 30H370M10 60H370M10 90H370M10 120H370M10 150H370M40 20V152M70 20V152M100 20V152M130 20V152M160 20V152M190 20V152M220 20V152M250 20V152M280 20V152M310 20V152M340 20V152"/>
      ${diagrams[paper.id] || fallbackDiagram}</g>
    </svg><figcaption>Concept illustration</figcaption>
  </figure>`;

  const stepKeys = ["question", "approach", "finding"];
  const stepLabels = ["Question", "Approach", "Finding"];
  const sourceMarkup = (paper) => `<details class="paper-source">
    <summary>Citation &amp; authors</summary>
    <p class="source-title">${escape(paper.title)}</p>
    <p class="source-authors">${paper.authors.map(escape).join(" · ")}</p>
    ${paper.authorNote ? `<p class="source-author-note">${escape(paper.authorNote)}</p>` : ""}
    <p class="source-venue">${escape(paper.journal)} · ${escape(paper.citation)} · ${paper.year}<br />${escape(paper.type)} · ${escape(paper.status)}</p>
    <a class="source-doi" href="${escape(paper.doiUrl)}" target="_blank" rel="noopener noreferrer">DOI: ${escape(paper.doi)}</a>
  </details>`;

  grid.innerHTML = catalog.papers
    .map(
      (
        paper,
      ) => `<article class="research-card" id="${escape(paper.id)}" data-color="${escape(paper.color)}" data-step="overview" aria-labelledby="${escape(paper.id)}-title">
    <div class="research-card-header"><p class="research-meta"><span>${paper.year}</span><span>${escape(paper.topic)}</span></p><h3 id="${escape(paper.id)}-title">${escape(paper.headline)}</h3></div>
    ${diagram(paper)}
    <p class="research-takeaway">${escape(paper.takeaway)}</p>
    <details class="study-details"><summary aria-label="Explore the study: ${escape(paper.headline)}">Explore the study</summary>
      <div class="study-story">
        <div class="story-step-buttons" role="group" aria-label="Story steps for ${escape(paper.headline)}">
          ${stepLabels.map((label, index) => `<button class="story-step-button" type="button" data-step-button="${index}" aria-pressed="${index === 0}" aria-controls="${escape(paper.id)}-panel">${index + 1}. ${label}</button>`).join("")}
        </div>
        <div class="story-panel" id="${escape(paper.id)}-panel" aria-live="polite" aria-atomic="true"><h4>The question</h4><p>${escape(paper.question)}</p></div>
        <button class="story-next" type="button"><span>Next: the approach</span><span aria-hidden="true">→</span></button>
        <p class="story-context"><strong>Why it matters</strong>${escape(paper.why)}</p>
        <p class="story-limitation">${escape(paper.limitation)}</p>
        ${sourceMarkup(paper)}
        <div class="source-links"><a href="${escape(paper.publisherUrl)}" target="_blank" rel="noopener noreferrer">Read the original paper <span aria-hidden="true">↗</span></a></div>
      </div>
    </details>
  </article>`,
    )
    .join("");

  const papersById = new Map(catalog.papers.map((paper) => [paper.id, paper]));
  const setStep = (card, index) => {
    const paper = papersById.get(card.id);
    if (!paper) return;
    card.dataset.step = String(index);
    card.querySelectorAll("[data-step-button]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.stepButton) === index),
      );
    });
    const panel = card.querySelector(".story-panel");
    panel.querySelector("h4").textContent =
      `The ${stepLabels[index].toLowerCase()}`;
    panel.querySelector("p").textContent = paper[stepKeys[index]];
    card.querySelector(".story-next span").textContent =
      index === 2
        ? "Back to the question"
        : `Next: the ${stepLabels[index + 1].toLowerCase()}`;
  };

  grid.querySelectorAll(".research-card").forEach((card) => {
    card.querySelector(".study-details").addEventListener("toggle", (event) => {
      if (event.target.open) setStep(card, 0);
      else card.dataset.step = "overview";
    });
    card.querySelectorAll("[data-step-button]").forEach((button) => {
      button.addEventListener("click", () =>
        setStep(card, Number(button.dataset.stepButton)),
      );
    });
    card.querySelector(".story-next").addEventListener("click", () => {
      setStep(card, (Number(card.dataset.step) + 1) % 3);
    });
  });

  const filters = document.getElementById("research-filters");
  const search = document.getElementById("research-search");
  const topics = [
    "All research",
    ...new Set(catalog.papers.map((paper) => paper.topic)),
  ];
  let activeTopic = "All research";

  filters.innerHTML = topics
    .map(
      (topic, index) =>
        `<button class="research-filter" type="button" aria-pressed="${index === 0}" data-topic="${escape(topic)}">${escape(topic)}</button>`,
    )
    .join("");
  const applyFilters = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    catalog.papers.forEach((paper) => {
      const searchable = [
        paper.title,
        paper.headline,
        paper.topic,
        paper.year,
        paper.takeaway,
        paper.question,
        paper.approach,
        paper.finding,
        ...paper.authors,
      ]
        .join(" ")
        .toLocaleLowerCase();
      const visible =
        (activeTopic === "All research" || paper.topic === activeTopic) &&
        (!query || searchable.includes(query));
      document.getElementById(paper.id).hidden = !visible;
      if (visible) count++;
    });
    document.getElementById("research-results").textContent =
      `${count} ${count === 1 ? "study" : "studies"}${count === catalog.papers.length ? " · Newest first" : ` of ${catalog.papers.length}`}`;
    document.getElementById("research-empty").hidden = count !== 0;
    filters
      .querySelectorAll("[data-topic]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.topic === activeTopic),
        ),
      );
  };
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-topic]");
    if (!button) return;
    activeTopic = button.dataset.topic;
    applyFilters();
  });
  search.addEventListener("input", applyFilters);
  document.getElementById("clear-research").addEventListener("click", () => {
    search.value = "";
    activeTopic = "All research";
    applyFilters();
    search.focus();
  });
  document.getElementById("research-tools").hidden = false;
  applyFilters();

  // A shared link to a paper opens its story. Unrelated anchors remain normal.
  const openLinkedStudy = () => {
    const id = window.location.hash.slice(1);
    if (!papersById.has(id)) return;
    const card = document.getElementById(id);
    if (card.hidden) {
      activeTopic = "All research";
      search.value = "";
      applyFilters();
    }
    card.querySelector(".study-details").open = true;
    card.scrollIntoView({ behavior: "instant", block: "start" });
  };
  window.addEventListener("hashchange", openLinkedStudy);
  openLinkedStudy();
})();
