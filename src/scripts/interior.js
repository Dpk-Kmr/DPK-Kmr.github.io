(() => {
  "use strict";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "paused";

  // Search opens only the relevant service categories; clearing restores browsing.
  const search = $("[data-capability-search]");
  if (search) {
    const sections = $$("[data-service-section]");
    const capabilities = $$("[data-capability]");
    let browsingState = null;
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      if (query && !browsingState) {
        browsingState = sections.map((section) => section.open);
      }
      let count = 0;
      capabilities.forEach((capability) => {
        const category = capability.closest("[data-service-section]");
        const haystack = `${$(".service-group-summary h2", category).textContent} ${capability.textContent}`;
        const matches = !query || haystack.toLocaleLowerCase().includes(query);
        capability.hidden = !matches;
        if (matches) count++;
      });
      sections.forEach((section, index) => {
        section.hidden = !$$("[data-capability]", section).some(
          (item) => !item.hidden,
        );
        if (query) section.open = !section.hidden;
        else if (browsingState) section.open = browsingState[index];
      });
      if (!query) browsingState = null;
      const status = $("[data-search-status]");
      status.hidden = !query;
      status.textContent = `${count} ${count === 1 ? "service" : "services"} found for “${search.value.trim()}”.`;
      $("[data-search-empty]").hidden = count !== 0;
    });
    const revealCategory = (hash) => {
      const section = sections.find((item) => `#${item.id}` === hash);
      if (!section) return;
      search.value = "";
      search.dispatchEvent(new Event("input"));
      section.open = true;
    };
    $$(".service-overview a").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        if (location.hash !== link.hash) history.pushState(null, "", link.hash);
        revealCategory(link.hash);
        document.getElementById(link.hash.slice(1)).scrollIntoView({
          behavior: prefersReducedMotion() ? "instant" : "smooth",
          block: "start",
        });
      });
    });
    window.addEventListener("hashchange", () => revealCategory(location.hash));
    revealCategory(location.hash);
  }

  // The company model explains how each discipline connects to the others.
  const modelData = {
    precision: {
      eyebrow: "Design & manufacturing",
      title: "From an idea to a finished part.",
      copy: "We create CAD models, test designs, and make prototypes and production parts.",
      tags: ["Design", "Prototype", "Manufacture"],
      anchor: "manufacturing",
      link: "View design & manufacturing services",
    },
    intelligence: {
      eyebrow: "AI & automation",
      title: "Make your machines more useful.",
      copy: "We connect equipment to sensors and software so you can monitor operations, spot problems, and automate tasks.",
      tags: ["Sense", "Connect", "Optimize"],
      anchor: "deep-tech",
      link: "View AI & automation services",
    },
    academy: {
      eyebrow: "Training",
      title: "Learn by making things.",
      copy: "Our practical courses help students and teams learn CAD, simulation, manufacturing, and automation.",
      tags: ["Learn", "Experiment", "Apply"],
      anchor: "training",
      link: "View training courses",
    },
  };
  $$("[data-model]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.model;
      const content = modelData[key];
      $$("[data-model]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      $(".company-model-visual").dataset.activeModel = key;
      $(".company-model-copy").style.setProperty(
        "--theme-color",
        `var(--${key === "precision" ? "accent" : key === "intelligence" ? "cyan" : "amber"})`,
      );
      $("[data-model-eyebrow]").textContent = content.eyebrow;
      const title = $("[data-model-title]");
      title.replaceChildren();
      content.title.split("\n").forEach((line, index) => {
        if (index) title.append(document.createElement("br"));
        title.append(document.createTextNode(line));
      });
      $("[data-model-copy]").textContent = content.copy;
      $("[data-model-tags]").replaceChildren(
        ...content.tags.map((label) => {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = label;
          return tag;
        }),
      );
      const link = $("[data-model-link]");
      link.href = `./services.html#${content.anchor}`;
      link.textContent = `${content.link} ↗`;
    }),
  );

  // This is a conceptual exploded assembly, not a released product specification.
  const assemblyRange = $("[data-assembly-range]");
  if (assemblyRange) {
    const updateAssembly = () => {
      const amount = Number(assemblyRange.value);
      // At zero the enclosure, PCB, and mounting base form a compact stack.
      $('[data-product-layer="enclosure"]').setAttribute(
        "transform",
        `translate(0 ${36 - amount * 1.2})`,
      );
      $('[data-product-layer="electronics"]').setAttribute(
        "transform",
        `translate(0 ${15 - amount * 0.15})`,
      );
      $('[data-product-layer="base"]').setAttribute(
        "transform",
        `translate(0 ${amount * 0.3})`,
      );
      $("#assembly-output").textContent = `${amount}%`;
      assemblyRange.setAttribute(
        "aria-valuetext",
        amount === 0 ? "Fully assembled" : `${amount} percent exploded`,
      );
      $("[data-assembly-status]").textContent =
        amount === 0 ? "ASSEMBLED VIEW" : "EXPLODED VIEW";
    };
    assemblyRange.addEventListener("input", updateAssembly);
    $("[data-product-reset]").addEventListener("click", () => {
      assemblyRange.value = "65";
      updateAssembly();
    });
    updateAssembly();
  }

  // Role filters do not discard the full descriptions and application requirements.
  $$("[data-job-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      const filter = button.dataset.jobFilter;
      let count = 0;
      $$("[data-job-filter]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      $$("[data-job]").forEach((job) => {
        job.hidden = filter !== "all" && job.dataset.discipline !== filter;
        if (!job.hidden) count++;
      });
      $("[data-job-status]").textContent =
        `Showing ${count} ${count === 1 ? "role" : "roles"}.`;
    }),
  );
  $$("[data-apply-role]").forEach((link) =>
    link.addEventListener("click", (event) => {
      const select = $("[data-role-select]");
      if (!select) return;
      event.preventDefault();
      select.value = link.dataset.applyRole;
      $("[data-application-helper]").textContent =
        `Applying for ${link.dataset.applyRole}. Tell us about yourself below, then prepare your application email.`;
      const target = $("#career-application");
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "instant" : "smooth",
        block: "start",
      });
      select.focus({ preventScroll: true });
      history.replaceState(null, "", "#career-application");
    }),
  );
  // Deep links to roles reveal their description immediately.
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.matches("[data-job]")) target.open = true;
  }

  const interestData = {
    precision: {
      title: "Design & manufacturing",
      copy: "From CAD and simulation to prototyping and precision manufacturing. Tell us about the part, product, or process you have in mind.",
      label: "Design & manufacturing",
      color: "var(--accent)",
    },
    intelligence: {
      title: "AI & automation",
      copy: "IoT, AI, automation, and connected operations. Tell us about your machines, your data, and the decisions you want to improve.",
      label: "AI & automation",
      color: "var(--cyan)",
    },
    academy: {
      title: "Training",
      copy: "Practical technical courses for students and teams. Share the skills you want to develop and your preferred schedule.",
      label: "Training",
      color: "var(--amber)",
    },
    research: {
      title: "Research mentoring",
      copy: "Individual support with research methods, experiments, analysis, writing, and your research portfolio or CV. Share your topic, current stage, and what you want to learn.",
      label: "Research mentoring",
      color: "var(--purple)",
    },
    partnership: {
      title: "Research & partnerships",
      copy: "Research, industry-academia collaboration, and new engineering opportunities. Tell us what you’re exploring and how we could work together.",
      label: "Research or partnership",
      color: "var(--accent)",
    },
  };
  const interestSelect = $("[data-interest-select]");
  if (interestSelect) {
    const updateBrief = () => {
      const selected = interestData[interestSelect.value];
      $("[data-brief-title]").textContent =
        selected?.title || "Let’s work together.";
      $("[data-brief-copy]").textContent =
        selected?.copy ||
        "Engineering projects, practical training, and research mentoring.";
      $(".brief-card").style.setProperty(
        "--theme-color",
        selected?.color || "var(--accent)",
      );
    };
    const interest = new URLSearchParams(location.search).get("interest");
    if (Object.hasOwn(interestData, interest)) interestSelect.value = interest;
    interestSelect.addEventListener("change", updateBrief);
    updateBrief();
  }

  // No backend is implied: visitors review and send the draft in their email app.
  $$("[data-email-form]").forEach((form) => {
    const status = $("[data-form-status]", form);
    const buildEmail = () => {
      const values = new FormData(form);
      const application = form.dataset.emailForm === "application";
      const subject = application
        ? `Career application — ${values.get("Applying for")} — ${values.get("Full name")}`
        : `Project inquiry — ${interestData[values.get("Requirement")]?.label || "Atriksha"} — ${values.get("Name")}`;
      const body = [...values]
        .map(([key, value]) => {
          const readableValue =
            key === "Requirement"
              ? interestData[value]?.label || value
              : String(value).trim();
          return `${key}: ${readableValue || "Not provided"}`;
        })
        .join("\n\n");
      return {
        subject,
        body,
        url: `mailto:info@atriksha.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      };
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const email = buildEmail();
      const fallback = $("[data-email-fallback]", form);
      fallback.href = email.url;
      fallback.hidden = false;
      status.textContent =
        "Your draft is prepared. Review and send it in your email app. If an app doesn’t open, copy the text and email info@atriksha.com.";
      window.location.href = email.url;
    });
    $("[data-copy-email]", form)?.addEventListener("click", async () => {
      if (!form.reportValidity()) return;
      const email = buildEmail();
      const text = `To: info@atriksha.com\nSubject: ${email.subject}\n\n${email.body}`;
      try {
        if (!navigator.clipboard?.writeText)
          throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(text);
        status.textContent =
          "Copied. Paste this into an email to info@atriksha.com, then review and send.";
      } catch {
        // A selectable fallback still works when clipboard permission is unavailable.
        let copyArea = $("[data-copy-fallback]", form);
        if (!copyArea) {
          const label = document.createElement("label");
          label.className = "form-wide";
          const caption = document.createElement("span");
          caption.textContent = "Your email text — select and copy";
          copyArea = document.createElement("textarea");
          copyArea.dataset.copyFallback = "";
          copyArea.rows = 8;
          copyArea.readOnly = true;
          label.append(caption, copyArea);
          form.append(label);
        }
        copyArea.value = text;
        copyArea.focus();
        copyArea.select();
        status.textContent =
          "Select and copy the prepared text below, then email it to info@atriksha.com.";
      }
    });
  });
})();
