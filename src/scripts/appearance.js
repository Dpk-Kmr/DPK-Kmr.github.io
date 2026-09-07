(() => {
  "use strict";

  const themes = {
    midnight: {
      label: "Midnight",
      description: "Dark background",
      background: "#11151a",
      scheme: "dark",
    },
    paper: {
      label: "Paper",
      description: "Light background",
      background: "#f6f7f2",
      scheme: "light",
    },
    mist: {
      label: "Mist",
      description: "Cool light background",
      background: "#edf5fa",
      scheme: "light",
    },
    sand: {
      label: "Sand",
      description: "Warm light background",
      background: "#faf0e1",
      scheme: "light",
    },
  };
  const legacy = {
    lime: "midnight",
    arctic: "mist",
    violet: "paper",
    ember: "sand",
  };
  const hasTheme = (value) =>
    Object.prototype.hasOwnProperty.call(themes, value);
  const resolveTheme = (value) =>
    hasTheme(value)
      ? value
      : Object.prototype.hasOwnProperty.call(legacy, value)
        ? legacy[value]
        : "midnight";
  const key = "atriksha-theme";
  let current = "midnight";
  let paletteRevision = 0;
  try {
    const saved = localStorage.getItem(key);
    current = resolveTheme(saved);
  } catch {}

  // This script runs in the head so a saved palette is ready before first paint.
  const apply = (theme, persist = true) => {
    const revision = ++paletteRevision;
    document.documentElement.classList.add("theme-changing");
    current = resolveTheme(theme);
    document.documentElement.dataset.theme = current;
    document.documentElement.dataset.colorScheme = themes[current].scheme;
    document.documentElement.style.colorScheme = themes[current].scheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themes[current].background;
    if (persist) {
      try {
        localStorage.setItem(key, current);
      } catch {}
    }
    document.querySelectorAll("[data-theme-option]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.themeOption === current),
      );
    });
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute(
        "aria-label",
        `Background theme: ${themes[current].label}`,
      );
    });
    window.dispatchEvent(
      new CustomEvent("atriksha:theme", { detail: { theme: current } }),
    );
    // Foreground and background switch together instead of transitioning at
    // different speeds and briefly creating unreadable text.
    void document.documentElement.offsetHeight;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (revision === paletteRevision)
          document.documentElement.classList.remove("theme-changing");
      }),
    );
  };
  apply(current, false);

  const initialize = () => {
    document.querySelectorAll(".theme-picker").forEach((picker) => {
      const toggle = picker.querySelector("[data-theme-toggle]");
      const panel = picker.querySelector("[data-theme-panel]");
      if (!toggle || !panel) return;
      if (!toggle.querySelector(".theme-toggle-label")) {
        const label = document.createElement("span");
        label.className = "theme-toggle-label";
        label.textContent = "Theme";
        toggle.append(label);
      }
      panel.setAttribute("aria-label", "Background theme");
      panel.replaceChildren(
        ...Object.entries(themes).map(([id, theme]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "theme-option";
          button.dataset.themeOption = id;
          button.setAttribute("aria-pressed", String(id === current));
          const swatch = document.createElement("span");
          swatch.className = "theme-swatch";
          swatch.setAttribute("aria-hidden", "true");
          const copy = document.createElement("span");
          copy.className = "theme-option-copy";
          const label = document.createElement("span");
          label.textContent = theme.label;
          const description = document.createElement("small");
          description.textContent = theme.description;
          copy.append(label, description);
          button.append(swatch, copy);
          button.addEventListener("click", () => {
            apply(id);
            close(true);
          });
          return button;
        }),
      );
      const close = (restoreFocus = false) => {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        if (restoreFocus) toggle.focus({ preventScroll: true });
      };
      toggle.addEventListener("click", () => {
        if (!panel.hidden) return close();
        const menu = document.querySelector(
          '.menu-toggle[aria-expanded="true"]',
        );
        menu?.click();
        panel.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        // Pointer and touch activation keep focus on the trigger. Moving it
        // during a tap can cancel the next option click on mobile browsers.
        if (document.activeElement === toggle && !lastPointerActivation) {
          panel
            .querySelector('[aria-pressed="true"]')
            ?.focus({ preventScroll: true });
        }
        lastPointerActivation = false;
      });
      let lastPointerActivation = false;
      toggle.addEventListener("pointerdown", () => {
        lastPointerActivation = true;
      });
      toggle.addEventListener("keydown", () => {
        lastPointerActivation = false;
      });
      picker.addEventListener("keydown", (event) => {
        if (panel.hidden) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (
          [
            "ArrowDown",
            "ArrowUp",
            "ArrowRight",
            "ArrowLeft",
            "Home",
            "End",
          ].includes(event.key)
        ) {
          event.preventDefault();
          const options = [...panel.querySelectorAll("button")];
          const index = options.indexOf(document.activeElement);
          const step = ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1;
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? options.length - 1
                : index < 0
                  ? step > 0
                    ? 0
                    : options.length - 1
                  : (index + step + options.length) % options.length;
          options[next]?.focus();
        }
      });
      document.addEventListener("pointerdown", (event) => {
        if (!picker.contains(event.target)) close();
      });
      picker.addEventListener("focusout", (event) => {
        // A null relatedTarget occurs during touch activation and window blur;
        // it does not mean the visitor clicked outside this control.
        if (event.relatedTarget && !picker.contains(event.relatedTarget))
          close();
      });
      document
        .querySelector(".menu-toggle")
        ?.addEventListener("click", () => close());
    });
    apply(current, false);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) apply(event.newValue, false);
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    try {
      apply(localStorage.getItem(key), false);
    } catch {}
  });
})();
