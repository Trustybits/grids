/**
 * Unit tests for the theme Pinia store (src/stores/theme.ts).
 *
 * Covers:
 *  - Initial state (defaults to the dark theme + registry of available themes)
 *  - Getters: currentTheme, themeClass, isDarkMode
 *  - setTheme: valid id, unknown id fallback (+ console.warn)
 *  - toggleDarkMode: dark <-> light
 *  - applyGridTheme: explicit id, missing id default, unknown id fallback
 *  - resetToAppDefault
 *  - applyTheme / initializeTheme DOM side effects on <html> and <body>
 *
 * The themes registry (@/themes) is real static data, not an external system,
 * so it is left unmocked; the only side effect to observe is DOM class mutation,
 * which jsdom provides.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { themes } from "@/themes";
import { useThemeStore } from "../theme";

describe("theme store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Strip any theme-* classes left on the document by a prior test.
    for (const el of [document.documentElement, document.body]) {
      Array.from(el.classList)
        .filter((c) => c.startsWith("theme-"))
        .forEach((c) => el.classList.remove(c));
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the dark theme and exposes the theme registry", () => {
    const store = useThemeStore();

    expect(store.currentThemeId).toBe("dark");
    expect(store.availableThemes).toEqual(themes);
  });

  describe("getters", () => {
    it("currentTheme resolves the active theme object", () => {
      const store = useThemeStore();
      expect(store.currentTheme).toBe(themes.dark);

      store.currentThemeId = "light";
      expect(store.currentTheme).toBe(themes.light);
    });

    it("currentTheme falls back to light for an unknown id", () => {
      const store = useThemeStore();
      store.currentThemeId = "does-not-exist";
      expect(store.currentTheme).toBe(themes.light);
    });

    it("themeClass derives a CSS class from the current id", () => {
      const store = useThemeStore();
      expect(store.themeClass).toBe("theme-dark");

      store.currentThemeId = "light";
      expect(store.themeClass).toBe("theme-light");
    });

    it("isDarkMode is true only for the dark theme", () => {
      const store = useThemeStore();
      expect(store.isDarkMode).toBe(true);

      store.currentThemeId = "light";
      expect(store.isDarkMode).toBe(false);
    });
  });

  describe("setTheme", () => {
    it("applies a known theme and tags the document with its class", () => {
      const store = useThemeStore();

      store.setTheme("light");

      expect(store.currentThemeId).toBe("light");
      expect(document.documentElement.classList.contains("theme-light")).toBe(
        true,
      );
      expect(document.body.classList.contains("theme-light")).toBe(true);
    });

    it("warns and falls back to dark for an unknown theme id", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const store = useThemeStore();

      store.setTheme("neon");

      expect(store.currentThemeId).toBe("dark");
      expect(warn).toHaveBeenCalledWith(
        'Theme "neon" not found, falling back to dark',
      );
      expect(document.documentElement.classList.contains("theme-dark")).toBe(
        true,
      );
    });
  });

  describe("toggleDarkMode", () => {
    it("switches from dark to light", () => {
      const store = useThemeStore();
      expect(store.currentThemeId).toBe("dark");

      store.toggleDarkMode();

      expect(store.currentThemeId).toBe("light");
    });

    it("switches from light back to dark", () => {
      const store = useThemeStore();
      store.setTheme("light");

      store.toggleDarkMode();

      expect(store.currentThemeId).toBe("dark");
    });
  });

  describe("applyGridTheme", () => {
    it("applies the provided theme id", () => {
      const store = useThemeStore();
      store.applyGridTheme("light");
      expect(store.currentThemeId).toBe("light");
    });

    it("defaults to dark when no id is provided", () => {
      const store = useThemeStore();
      store.setTheme("light");

      store.applyGridTheme();

      expect(store.currentThemeId).toBe("dark");
    });

    it("falls back to dark for an unknown id", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const store = useThemeStore();
      store.setTheme("light");

      store.applyGridTheme("bogus");

      expect(store.currentThemeId).toBe("dark");
    });
  });

  it("resetToAppDefault returns to the dark theme", () => {
    const store = useThemeStore();
    store.setTheme("light");

    store.resetToAppDefault();

    expect(store.currentThemeId).toBe("dark");
  });

  describe("applyTheme / initializeTheme", () => {
    it("replaces any previous theme-* classes rather than stacking them", () => {
      const store = useThemeStore();

      store.setTheme("light");
      store.setTheme("dark");

      const rootThemeClasses = Array.from(
        document.documentElement.classList,
      ).filter((c) => c.startsWith("theme-"));
      const bodyThemeClasses = Array.from(document.body.classList).filter((c) =>
        c.startsWith("theme-"),
      );

      expect(rootThemeClasses).toEqual(["theme-dark"]);
      expect(bodyThemeClasses).toEqual(["theme-dark"]);
    });

    it("preserves unrelated classes on the document elements", () => {
      document.documentElement.classList.add("no-js");
      document.body.classList.add("loaded");
      const store = useThemeStore();

      store.applyTheme();

      expect(document.documentElement.classList.contains("no-js")).toBe(true);
      expect(document.body.classList.contains("loaded")).toBe(true);
      expect(document.documentElement.classList.contains("theme-dark")).toBe(
        true,
      );

      document.documentElement.classList.remove("no-js");
      document.body.classList.remove("loaded");
    });

    it("initializeTheme applies the current theme to the document", () => {
      const store = useThemeStore();

      store.initializeTheme();

      expect(document.documentElement.classList.contains("theme-dark")).toBe(
        true,
      );
      expect(document.body.classList.contains("theme-dark")).toBe(true);
    });
  });
});
