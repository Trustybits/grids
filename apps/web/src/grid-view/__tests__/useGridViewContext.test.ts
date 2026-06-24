import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { GridViewContext } from "@/grid-view/GridViewContext";
import {
  provideGridViewContext,
  resetDefaultGridViewContext,
  setDefaultGridViewContextFactory,
  useGridViewContext,
} from "@/grid-view/useGridViewContext";

const storeHolder = vi.hoisted(() => ({
  current: null as GridViewContext | null,
}));

// The default factory path delegates to createLiveGridViewContext; stub it so
// these provide/inject + memoization tests don't depend on the live store wiring.
vi.mock("@/grid-view/createLiveGridViewContext", () => ({
  createLiveGridViewContext: () => storeHolder.current,
}));

function makeContext(mode: GridViewContext["mode"]): GridViewContext {
  return { mode } as GridViewContext;
}

function mountContextConsumer(provider?: GridViewContext): {
  wrapper: VueWrapper;
  resolved: GridViewContext | null;
} {
  let resolved: GridViewContext | null = null;

  const Child = defineComponent({
    setup() {
      resolved = useGridViewContext();
      return () => h("div");
    },
  });

  const Parent = defineComponent({
    setup() {
      if (provider) {
        provideGridViewContext(provider);
      }
      return () => h(Child);
    },
  });

  const wrapper = mount(Parent);
  return { wrapper, resolved };
}

afterEach(() => {
  resetDefaultGridViewContext();
});

describe("useGridViewContext", () => {
  it("returns an explicitly provided context", () => {
    const provided = makeContext("demo");
    const fallback = makeContext("live");
    const factory = vi.fn(() => fallback);
    setDefaultGridViewContextFactory(factory);

    const { wrapper, resolved } = mountContextConsumer(provided);

    expect(resolved).toBe(provided);
    expect(factory).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("lazily memoizes the default context when no provider exists", () => {
    const fallback = makeContext("live");
    const factory = vi.fn(() => fallback);
    setDefaultGridViewContextFactory(factory);

    const first = mountContextConsumer();
    const second = mountContextConsumer();

    expect(first.resolved).toBe(fallback);
    expect(second.resolved).toBe(fallback);
    expect(factory).toHaveBeenCalledTimes(1);

    first.wrapper.unmount();
    second.wrapper.unmount();
  });

  it("resets the memoized default context", () => {
    const first = makeContext("live");
    const second = makeContext("demo");
    setDefaultGridViewContextFactory(vi.fn(() => first));

    const firstMount = mountContextConsumer();
    resetDefaultGridViewContext();
    setDefaultGridViewContextFactory(vi.fn(() => second));
    const secondMount = mountContextConsumer();

    expect(firstMount.resolved).toBe(first);
    expect(secondMount.resolved).toBe(second);

    firstMount.wrapper.unmount();
    secondMount.wrapper.unmount();
  });

  it("creates a live context when no provider or override factory exists", () => {
    storeHolder.current = makeContext("live");

    const first = mountContextConsumer();
    const second = mountContextConsumer();

    expect(first.resolved?.mode).toBe("live");
    expect(second.resolved).toBe(first.resolved);

    first.wrapper.unmount();
    second.wrapper.unmount();
  });
});
