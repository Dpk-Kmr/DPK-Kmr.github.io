(function () {
    const storageKey = "atriksha-theme";
    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

    function getSavedTheme() {
        try {
            return localStorage.getItem(storageKey);
        } catch (error) {
            return null;
        }
    }

    function resolveTheme() {
        const savedTheme = getSavedTheme();
        return savedTheme === "light" || savedTheme === "dark"
            ? savedTheme
            : (systemTheme.matches ? "dark" : "light");
    }

    function applyTheme(theme) {
        root.dataset.theme = theme;
        root.style.colorScheme = theme;

        const toggle = document.querySelector("[data-theme-toggle]");
        if (!toggle) return;

        const nextTheme = theme === "dark" ? "light" : "dark";
        toggle.dataset.activeTheme = theme;
        toggle.setAttribute("aria-label", `${theme === "dark" ? "Dark" : "Light"} theme active. Switch to ${nextTheme} theme`);
        toggle.setAttribute("title", `Switch to ${nextTheme} theme`);
        toggle.setAttribute("aria-pressed", String(theme === "dark"));
    }

    applyTheme(resolveTheme());

    function mountToggle() {
        if (document.querySelector("[data-theme-toggle]")) return;

        const toggle = document.createElement("button");
        toggle.className = "theme-toggle";
        toggle.type = "button";
        toggle.dataset.themeToggle = "";
        toggle.innerHTML = `
            <span class="theme-toggle-symbol" aria-hidden="true">
                <svg class="theme-toggle-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg>
                <svg class="theme-toggle-moon" viewBox="0 0 24 24"><path d="M20 15.2A8.1 8.1 0 0 1 8.8 4 8.2 8.2 0 1 0 20 15.2Z"></path></svg>
            </span>`;
        toggle.addEventListener("click", () => {
            const theme = root.dataset.theme === "dark" ? "light" : "dark";
            try {
                localStorage.setItem(storageKey, theme);
            } catch (error) {
                // The theme still applies for this page if storage is unavailable.
            }
            applyTheme(theme);
        });
        document.body.append(toggle);
        applyTheme(resolveTheme());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountToggle, { once: true });
    } else {
        mountToggle();
    }

    systemTheme.addEventListener("change", () => {
        if (!getSavedTheme()) applyTheme(resolveTheme());
    });
})();
