import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { reactive } from "vue";
import type { ChatContent, ChatMessage } from "@grids/contracts/types";
import ChatContentComponent from "@/components/tilecontent/ChatContent.vue";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const chatHolder = vi.hoisted(() => ({
  onMessages: null as ((msgs: ChatMessage[]) => void) | null,
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getChatService: () => ({
      subscribeToMessages: vi.fn(
        (
          _gridId: string,
          _tileId: string,
          onMessages: (msgs: ChatMessage[]) => void,
        ) => {
          chatHolder.onMessages = onMessages;
          return () => {
            chatHolder.onMessages = null;
          };
        },
      ),
      sendMessage: vi.fn(),
      editMessage: vi.fn(),
      deleteMessage: vi.fn(),
    }),
  }),
}));

function makeStore() {
  return reactive({
    mode: "live",
    canEdit: true,
    isOwner: true,
    grid: { id: "grid-1", userId: "user-1" },
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
