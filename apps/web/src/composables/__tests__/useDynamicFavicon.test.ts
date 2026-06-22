/**
 * Tests for useDynamicFavicon — swaps the page favicon to a reactive URL and
 * restores the default on unmount / when the URL is falsy.
 *
 * Tests manipulate the jsdom <head> directly to assert which <link> element is
 * targeted (existing #app-favicon, an existing rel="icon", or a freshly created
 * link) and what href it receives. The default favicon depends on
 * location.hostname (localhost → /dev_favicon.png).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { defineComponent, h, ref, type Ref } from "vue";
import { mount } from "@vue/test-utils";
import { useDynamicFavicon } from "@/composables/useDynamicFavicon";

const DEV_DEFAULT = "/dev_favicon.png";

function mountFavicon(srcRef: Ref<string | undefined | null>) {
  return mount(
    defineComponent({
      setup() {
        useDynamicFavicon(srcRef);
        return () => h("div");
      },
    }),
  );
}

beforeEach(() => {
  // Clean slate: remove any favicon links from prior tests.
  document.head
    .querySelectorAll('link[rel~="icon"], #app-favicon')
    .forEach((el) => el.remove());
});

describe("applying the favicon", () => {
  it("creates a <link rel=icon> and sets its href on mount", () => {
    mountFavicon(ref("https://x/custom.png"));
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    expect(link).not.toBeNull();
    expect(link!.href).toContain("https://x/custom.png");
  });

  it("reuses an existing #app-favicon element", () => {
    const existing = document.createElement("link");
    existing.id = "app-favicon";
    existing.rel = "icon";
    document.head.appendChild(existing);

    mountFavicon(ref("https://x/custom.png"));

    expect(existing.href).toContain("https://x/custom.png");
    // No second link should have been created.
    expect(document.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);
  });

  it("reuses an existing rel=icon link that has no app-favicon id", () => {
    const existing = document.createElement("link");
    existing.rel = "icon";
    document.head.appendChild(existing);

    mountFavicon(ref("https://x/custom.png"));

    expect(existing.href).toContain("https://x/custom.png");
    // No second link should have been created.
    expect(document.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);
  });

  it("falls back to the default favicon when the src is falsy (localhost)", () => {
    mountFavicon(ref(""));
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    expect(link!.href).toContain(DEV_DEFAULT);
  });

  it("updates the favicon reactively when the ref changes", async () => {
    const src = ref<string | undefined | null>("https://x/a.png");
    mountFavicon(src);
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    expect(link!.href).toContain("a.png");

    src.value = "https://x/b.png";
    await Promise.resolve();
    expect(link!.href).toContain("b.png");
  });

  it("restores the default when the ref transitions to null", async () => {
    const src = ref<string | undefined | null>("https://x/a.png");
    mountFavicon(src);
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');

    src.value = null;
    await Promise.resolve();
    expect(link!.href).toContain(DEV_DEFAULT);
  });
});

describe("unmount cleanup", () => {
  it("restores the default favicon on unmount", () => {
    const wrapper = mountFavicon(ref("https://x/custom.png"));
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    expect(link!.href).toContain("custom.png");

    wrapper.unmount();
    expect(link!.href).toContain(DEV_DEFAULT);
  });
});

describe("default favicon by hostname", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("uses the production favicon on a non-localhost hostname", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, hostname: "grids.so" },
    });

    mountFavicon(ref(""));
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    expect(link!.href).toContain("/favicon.png");
    expect(link!.href).not.toContain("/dev_favicon.png");
  });
});
