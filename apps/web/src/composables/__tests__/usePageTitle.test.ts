/**
 * Tests for usePageTitle — keeps document.title in sync with a reactive title
 * ref, prefixing "Grids" + a separator, plus a "DEV " prefix in dev builds.
 *
 * Tests mount a host component so the immediate watch and onUnmounted cleanup
 * run. import.meta.env.DEV is stubbed to exercise both prefixes. The onUnmount
 * reset only fires if the document title is still the one this composable set.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h, ref, type Ref } from "vue";
import { mount } from "@vue/test-utils";
import { usePageTitle, type TitleSeparator } from "@/composables/usePageTitle";

function mountTitle(titleRef: Ref<string | undefined>, separator?: TitleSeparator) {
  return mount(
    defineComponent({
      setup() {
        usePageTitle(titleRef, separator);
        return () => h("div");
      },
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("DEV", false);
  document.title = "";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("title formatting", () => {
  it("formats as 'Grids - <title>' with the default separator", () => {
    mountTitle(ref("My Page"));
    expect(document.title).toBe("Grids - My Page");
  });

  it("uses the '|' separator for owned grids", () => {
    mountTitle(ref("My Grid"), "|");
    expect(document.title).toBe("Grids | My Grid");
  });

  it("uses the em-dash separator for slug pages", () => {
    mountTitle(ref("matt"), "—");
    expect(document.title).toBe("Grids — matt");
  });

  it("falls back to just 'Grids' when the title is empty", () => {
    mountTitle(ref(""));
    expect(document.title).toBe("Grids");
  });

  it("falls back to just 'Grids' when the title is undefined", () => {
    mountTitle(ref(undefined));
    expect(document.title).toBe("Grids");
  });
});

describe("dev prefix", () => {
  it("prepends 'DEV ' in development builds", () => {
    vi.stubEnv("DEV", true);
    mountTitle(ref("My Page"));
    expect(document.title).toBe("DEV Grids - My Page");
  });

  it("prepends 'DEV ' to the bare fallback in development", () => {
    vi.stubEnv("DEV", true);
    mountTitle(ref(""));
    expect(document.title).toBe("DEV Grids");
  });
});

describe("reactivity", () => {
  it("updates the document title when the ref changes", async () => {
    const title = ref("First");
    mountTitle(title);
    expect(document.title).toBe("Grids - First");

    title.value = "Second";
    await Promise.resolve();
    expect(document.title).toBe("Grids - Second");
  });
});

describe("unmount cleanup", () => {
  it("resets the title to 'Grids' when it still matches what it set", () => {
    const wrapper = mountTitle(ref("My Page"));
    expect(document.title).toBe("Grids - My Page");
    wrapper.unmount();
    expect(document.title).toBe("Grids");
  });

  it("does NOT reset the title if another route already changed it", () => {
    const wrapper = mountTitle(ref("My Page"));
    // Simulate the next route taking over the title.
    document.title = "Grids - Next Route";
    wrapper.unmount();
    expect(document.title).toBe("Grids - Next Route");
  });
});
