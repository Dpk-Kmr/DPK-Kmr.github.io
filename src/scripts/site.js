(() => {
  const menu = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".nav-links");
  const closeMenu = () => {
    menu?.setAttribute("aria-expanded", "false");
    menu?.setAttribute("aria-label", "Open navigation");
    navigation?.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };
  menu?.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
    navigation?.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  });
  navigation?.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menu?.getAttribute("aria-expanded") === "true"
    ) {
      closeMenu();
      menu.focus();
    }
  });
  matchMedia("(min-width: 1001px)").addEventListener("change", (event) => {
    if (event.matches) closeMenu();
  });
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let motionPaused = reducedMotion.matches;
  try {
    if (sessionStorage.getItem("atriksha-motion") === "paused")
      motionPaused = true;
  } catch {}
  const applyMotion = () => {
    document.documentElement.dataset.motion = motionPaused
      ? "paused"
      : "playing";
    document.querySelectorAll("[data-motion-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(motionPaused));
      button.setAttribute(
        "aria-label",
        motionPaused ? "Resume animations" : "Pause animations",
      );
      const label = button.querySelector("[data-motion-label]");
      if (label)
        label.textContent = motionPaused ? "Motion paused" : "Pause motion";
    });
    window.dispatchEvent(
      new CustomEvent("atriksha:motion", { detail: { paused: motionPaused } }),
    );
  };
  applyMotion();
  document.querySelectorAll("[data-motion-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      motionPaused = !motionPaused;
      try {
        sessionStorage.setItem(
          "atriksha-motion",
          motionPaused ? "paused" : "playing",
        );
      } catch {}
      applyMotion();
    }),
  );
  reducedMotion.addEventListener("change", (event) => {
    motionPaused = event.matches;
    applyMotion();
  });

  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      el.classList.add("reveal-ready");
      observer.observe(el);
    });
  }
})();
