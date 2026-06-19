/**
 * Tests for usePostHog — a thin reactive wrapper around posthog-js whose only
 * job is to gate every call behind the presence of VITE_POSTHOG_KEY.
 *
 * The posthog-js module is mocked so we can assert exactly which SDK methods
 * are invoked, and VITE_POSTHOG_KEY is stubbed per-test to exercise both the
 * configured and unconfigured branches.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import posthog from "posthog-js";
import { usePostHog } from "@/composables/usePostHog";

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    setPersonProperties: vi.fn(),
  },
}));

const mockedPosthog = vi.mocked(posthog);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("usePostHog — when VITE_POSTHOG_KEY is set", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_key");
  });

  it("forwards capture with event name and properties", () => {
    const { capture } = usePostHog();
    capture("button_clicked", { id: 42 });
    expect(mockedPosthog.capture).toHaveBeenCalledTimes(1);
    expect(mockedPosthog.capture).toHaveBeenCalledWith("button_clicked", {
      id: 42,
    });
  });

  it("forwards capture with no properties", () => {
    const { capture } = usePostHog();
    capture("page_view");
    expect(mockedPosthog.capture).toHaveBeenCalledWith("page_view", undefined);
  });

  it("forwards identify with userId and properties", () => {
    const { identify } = usePostHog();
    identify("user-1", { plan: "pro" });
    expect(mockedPosthog.identify).toHaveBeenCalledWith("user-1", {
      plan: "pro",
    });
  });

  it("forwards reset", () => {
    const { reset } = usePostHog();
    reset();
    expect(mockedPosthog.reset).toHaveBeenCalledTimes(1);
  });

  it("forwards setPersonProperties", () => {
    const { setPersonProperties } = usePostHog();
    setPersonProperties({ theme: "dark" });
    expect(mockedPosthog.setPersonProperties).toHaveBeenCalledWith({
      theme: "dark",
    });
  });

  it("exposes the raw posthog instance for direct access", () => {
    const { posthog: instance } = usePostHog();
    expect(instance).toBe(mockedPosthog);
  });
});

describe("usePostHog — when VITE_POSTHOG_KEY is absent", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
  });

  it("does not call capture", () => {
    const { capture } = usePostHog();
    capture("button_clicked", { id: 1 });
    expect(mockedPosthog.capture).not.toHaveBeenCalled();
  });

  it("does not call identify", () => {
    const { identify } = usePostHog();
    identify("user-1");
    expect(mockedPosthog.identify).not.toHaveBeenCalled();
  });

  it("does not call reset", () => {
    const { reset } = usePostHog();
    reset();
    expect(mockedPosthog.reset).not.toHaveBeenCalled();
  });

  it("does not call setPersonProperties", () => {
    const { setPersonProperties } = usePostHog();
    setPersonProperties({ theme: "dark" });
    expect(mockedPosthog.setPersonProperties).not.toHaveBeenCalled();
  });
});
