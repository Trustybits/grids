import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { reactive } from "vue";
import type { ChatContent, ChatMessage } from "@grids/contracts/types";
import ChatContentComponent from "@/components/tilecontent/ChatContent.vue";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const chatHolder = vi.hoisted(() => {
  const holder = {
    onMessages: null as ((msgs: ChatMessage[]) => void) | null,
    service: {
      subscribeToMessages: vi.fn(
        (
          _gridId: string,
          _tileId: string,
          onMessages: (msgs: ChatMessage[]) => void,
        ) => {
          holder.onMessages = onMessages;
          return () => {
            holder.onMessages = null;
          };
        },
      ),
      sendMessage: vi.fn(async () => "new-msg"),
      editMessage: vi.fn(async () => undefined),
      deleteMessage: vi.fn(async () => undefined),
    },
  };
  return holder;
});

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getChatService: () => chatHolder.service,
  }),
}));

function makeStore(overrides: Record<string, unknown> = {}) {
  return reactive({
    mode: "live",
    canEdit: true,
    isOwner: true,
    grid: { id: "grid-1", userId: "user-1" },
    publicGridId: "grid-1",
    ...overrides,
  });
}

function makeMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `msg-${index}`,
    text: `Message ${index}`,
    authorId: "user-1",
    createdAt: 1_700_000_000_000 + index * 1000,
  })) as ChatMessage[];
}

// jsdom has no layout engine, so scrollHeight/clientHeight are always 0 and
// scrollTop clamps to 0. Give the message list a real-looking scroll geometry
// so the component's near-bottom check and scroll writes behave as in a browser.
function fakeScrollGeometry(
  element: HTMLElement,
  { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number },
) {
  let scrollTop = 0;
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.max(0, Math.min(value, scrollHeight - clientHeight));
    },
  });
  element.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    const top = typeof options === "number" ? options : options?.top;
    if (typeof top === "number") element.scrollTop = top;
  }) as unknown as typeof element.scrollTo;
}

type ChatVm = {
  onResize: () => void;
  messagesContainer: HTMLDivElement | null;
};

async function mountChat(): Promise<{
  wrapper: VueWrapper;
  vm: ChatVm;
  container: HTMLDivElement;
}> {
  const content = { type: "chat" } as unknown as ChatContent;
  const wrapper = mount(ChatContentComponent, {
    props: { content, tileId: "tile-1" },
    attachTo: document.body,
    global: {
      stubs: { Teleport: true, FloatingTooltip: { template: "<div><slot /></div>" } },
    },
  });
  await flushPromises();

  const vm = wrapper.vm as unknown as ChatVm;
  const container = vm.messagesContainer;
  if (!container) throw new Error("messagesContainer did not mount");
  return { wrapper, vm, container };
}

describe("ChatContent message store identity under draft editing", () => {
  beforeEach(() => {
    chatHolder.onMessages = null;
    chatHolder.service.subscribeToMessages.mockClear();
    chatHolder.service.sendMessage.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("subscribes under the public grid id, not the hidden draft the owner is editing", async () => {
    // Draft/publish: the open grid is `draft__grid-1`, but the message
    // subcollection lives under the original `grid-1`. Subscribing to the
    // draft's id shows the owner an empty history.
    storeHolder.current = makeStore({
      grid: { id: "draft__grid-1", userId: "user-1" },
      publicGridId: "grid-1",
    });

    const { wrapper } = await mountChat();

    expect(chatHolder.service.subscribeToMessages).toHaveBeenCalledTimes(1);
    expect(chatHolder.service.subscribeToMessages).toHaveBeenCalledWith(
      "grid-1",
      "tile-1",
      expect.any(Function),
      expect.any(Function),
    );

    wrapper.unmount();
  });

  it("sends new messages to the public grid so they survive the draft being published", async () => {
    storeHolder.current = makeStore({
      grid: { id: "draft__grid-1", userId: "user-1" },
      publicGridId: "grid-1",
    });

    const { wrapper, container } = await mountChat();
    // jsdom has no scrollTo; the post-send smooth scroll needs one.
    fakeScrollGeometry(container, { scrollHeight: 400, clientHeight: 400 });
    const textarea = wrapper.find("textarea");
    await textarea.setValue("hello from the editor");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(chatHolder.service.sendMessage).toHaveBeenCalledWith(
      "grid-1",
      "tile-1",
      "hello from the editor",
    );

    wrapper.unmount();
  });

  it("uses the grid's own id when not editing a draft", async () => {
    storeHolder.current = makeStore();

    const { wrapper } = await mountChat();

    expect(chatHolder.service.subscribeToMessages).toHaveBeenCalledWith(
      "grid-1",
      "tile-1",
      expect.any(Function),
      expect.any(Function),
    );

    wrapper.unmount();
  });
});

describe("ChatContent scroll behaviour on resize", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storeHolder.current = makeStore();
    chatHolder.onMessages = null;
    // jsdom has no canvas; the component tolerates a null context, this just
    // keeps jsdom's "not implemented" noise out of the test output.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the reader's place when a resize arrives while scrolled into history", async () => {
    const { wrapper, vm, container } = await mountChat();
    fakeScrollGeometry(container, { scrollHeight: 2000, clientHeight: 400 });

    chatHolder.onMessages?.(makeMessages(20));
    await flushPromises();
    await vi.runAllTimersAsync();
    // Initial load pins to the bottom.
    expect(container.scrollTop).toBe(1600);

    // Reader scrolls up into older messages.
    container.scrollTop = 300;
    await container.dispatchEvent(new Event("scroll"));

    vm.onResize();
    await flushPromises();
    await vi.runAllTimersAsync();

    // Neither the immediate scroll nor the delayed follow-ups (50ms/150ms)
    // may yank the list back to the bottom.
    expect(container.scrollTop).toBe(300);

    wrapper.unmount();
  });

  it("follows the newest messages through a resize when the reader was at the bottom", async () => {
    const { wrapper, vm, container } = await mountChat();
    fakeScrollGeometry(container, { scrollHeight: 2000, clientHeight: 400 });

    chatHolder.onMessages?.(makeMessages(20));
    await flushPromises();
    await vi.runAllTimersAsync();
    expect(container.scrollTop).toBe(1600);

    // Nudge slightly off the bottom but still within the near-bottom band.
    container.scrollTop = 1550;
    await container.dispatchEvent(new Event("scroll"));

    vm.onResize();
    await flushPromises();
    await vi.runAllTimersAsync();

    expect(container.scrollTop).toBe(1600);

    wrapper.unmount();
  });

  it("does not pull a reader in history down when a new message arrives", async () => {
    const { wrapper, container } = await mountChat();
    fakeScrollGeometry(container, { scrollHeight: 2000, clientHeight: 400 });

    chatHolder.onMessages?.(makeMessages(20));
    await flushPromises();
    await vi.runAllTimersAsync();

    container.scrollTop = 300;
    await container.dispatchEvent(new Event("scroll"));

    chatHolder.onMessages?.(makeMessages(21));
    await flushPromises();
    await vi.runAllTimersAsync();

    expect(container.scrollTop).toBe(300);

    wrapper.unmount();
  });
});
