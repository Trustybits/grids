/**
 * Tests for useEditingLifecycle and useEditorContentSync.
 *
 * useEditingLifecycle wires a Tiptap editor's editable/focus state to the grid
 * store's canEdit flag plus a local isEditing ref, drives enter/exit callbacks,
 * persists on transitions, and installs a click-outside-to-exit handler.
 *
 * The grid store is mocked with a *reactive* object so the composable's watchers
 * track canEdit changes. The editor is a fake object exposing the methods the
 * composable calls. A host component is mounted so onMounted/onUnmounted and the
 * watchers run; tileId is provided via inject.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
  type Ref,
} from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import {
  useEditingLifecycle,
  useEditorContentSync,
} from "@/composables/useEditingLifecycle";

// Reactive store mock assigned per-test so watchers can react to canEdit.
const storeHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
}));

interface FakeEditor {
  setEditable: ReturnType<typeof vi.fn>;
  commands: {
    focus: ReturnType<typeof vi.fn>;
    blur: ReturnType<typeof vi.fn>;
    setContent: ReturnType<typeof vi.fn>;
  };
  isFocused: boolean;
  getJSON: ReturnType<typeof vi.fn>;
}

function makeEditor(overrides: Partial<FakeEditor> = {}): FakeEditor {
  return {
    setEditable: vi.fn(),
    commands: { focus: vi.fn(), blur: vi.fn(), setContent: vi.fn() },
    isFocused: false,
    getJSON: vi.fn(() => ({ type: "doc" })),
    ...overrides,
  };
}

const wrappers: VueWrapper[] = [];

interface MountOpts {
  editor: Ref<FakeEditor | undefined>;
  isEditing: Ref<boolean>;
  containerRef: Ref<HTMLElement | null>;
  flushPersist?: () => void;
  onEnter?: () => void;
  onExit?: () => void;
  shouldBlockExit?: () => boolean;
  tileId?: string | null;
}

function mountLifecycle(opts: MountOpts) {
  const wrapper = mount(
    defineComponent({
      setup() {
        useEditingLifecycle({
          editor: opts.editor as never,
          isEditing: opts.isEditing,
          containerRef: opts.containerRef,
          flushPersist: opts.flushPersist ?? (() => {}),
          onEnter: opts.onEnter,
          onExit: opts.onExit,
          shouldBlockExit: opts.shouldBlockExit,
        });
        return () => h("div");
      },
    }),
    { global: { provide: { tileId: opts.tileId ?? null } } },
  );
  wrappers.push(wrapper);
  return wrapper;
}

/**
 * Let watchers, the inner nextTick, and the deferred setTimeout(0) that
 * registers the click-outside handler all run. Two macrotask cycles are needed
 * because the handler is scheduled from *inside* a nextTick callback, one
 * macrotask after the watcher fires.
 */
async function flushAll() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

beforeEach(() => {
  storeHolder.current = reactive({
    canEdit: true,
    pendingFocusTileId: null as string | null,
    beginEditing: vi.fn(),
    commitEditing: vi.fn(),
  });
});

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  document.body.querySelectorAll("div").forEach((el) => el.remove());
});

function store() {
  return storeHolder.current as {
    canEdit: boolean;
    pendingFocusTileId: string | null;
    beginEditing: ReturnType<typeof vi.fn>;
    commitEditing: ReturnType<typeof vi.fn>;
  };
}

describe("useEditingLifecycle — entering edit mode", () => {
  it("makes the editor editable, fires onEnter, focuses, then persists and begins editing", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    const containerRef = ref<HTMLElement | null>(null);
    const flushPersist = vi.fn();
    const onEnter = vi.fn();

    mountLifecycle({
      editor,
      isEditing,
      containerRef,
      flushPersist,
      onEnter,
      tileId: "tile-1",
    });

    isEditing.value = true;
    await flushAll();

    expect(editor.value.setEditable).toHaveBeenLastCalledWith(true);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(editor.value.commands.focus).toHaveBeenCalledWith("end");
    expect(flushPersist).toHaveBeenCalled();
    expect(store().beginEditing).toHaveBeenCalledWith("tile-1");
  });

  it("enters edit mode but does not call beginEditing when tileId is null", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    const flushPersist = vi.fn();
    const onEnter = vi.fn();

    mountLifecycle({
      editor,
      isEditing,
      containerRef: ref(null),
      flushPersist,
      onEnter,
      tileId: null,
    });

    isEditing.value = true;
    await flushAll();

    expect(editor.value.setEditable).toHaveBeenLastCalledWith(true);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(flushPersist).toHaveBeenCalled();
    expect(store().beginEditing).not.toHaveBeenCalled();
  });

  it("does nothing when the editor ref is undefined", async () => {
    const editor = ref<FakeEditor | undefined>(undefined);
    const isEditing = ref(false);
    const flushPersist = vi.fn();

    mountLifecycle({
      editor,
      isEditing,
      containerRef: ref(null),
      flushPersist,
      tileId: "tile-1",
    });

    isEditing.value = true;
    await flushAll();

    expect(store().beginEditing).not.toHaveBeenCalled();
    expect(flushPersist).not.toHaveBeenCalled();
  });
});

describe("useEditingLifecycle — exiting edit mode", () => {
  it("blurs, fires onExit, persists, and commits when canEdit is still true", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(true);
    const flushPersist = vi.fn();
    const onExit = vi.fn();

    mountLifecycle({
      editor,
      isEditing,
      containerRef: ref(null),
      flushPersist,
      onExit,
      tileId: "tile-1",
    });

    // Toggle off.
    isEditing.value = false;
    await flushAll();

    expect(editor.value.setEditable).toHaveBeenLastCalledWith(false);
    expect(editor.value.commands.blur).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(flushPersist).toHaveBeenCalled();
    expect(store().commitEditing).toHaveBeenCalledTimes(1);
  });

  it("forces isEditing false and does not commit when canEdit becomes false", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(true);
    const flushPersist = vi.fn();

    mountLifecycle({
      editor,
      isEditing,
      containerRef: ref(null),
      flushPersist,
      tileId: "tile-1",
    });

    store().canEdit = false;
    await flushAll();

    expect(editor.value.commands.blur).toHaveBeenCalled();
    expect(isEditing.value).toBe(false);
    expect(store().commitEditing).not.toHaveBeenCalled();
  });
});

describe("useEditingLifecycle — auto-focus on mount", () => {
  it("enters editing when this tile is the pending focus target", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    store().pendingFocusTileId = "tile-1";

    mountLifecycle({
      editor,
      isEditing,
      containerRef: ref(null),
      tileId: "tile-1",
    });
    await flushAll();

    expect(store().pendingFocusTileId).toBeNull();
    expect(isEditing.value).toBe(true);
  });

  it("does not auto-focus when the pending tile matches but canEdit is false", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    store().pendingFocusTileId = "tile-1";
    store().canEdit = false;

    mountLifecycle({
      editor,
      isEditing,
      containerRef: ref(null),
      tileId: "tile-1",
    });
    await flushAll();

    expect(isEditing.value).toBe(false);
    // The pending marker is left intact since auto-focus was gated out.
    expect(store().pendingFocusTileId).toBe("tile-1");
  });

  it("does not auto-focus when the pending focus target is a different tile", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    store().pendingFocusTileId = "other";

    mountLifecycle({
      editor,
      isEditing,
      containerRef: ref(null),
      tileId: "tile-1",
    });
    await flushAll();

    expect(isEditing.value).toBe(false);
    expect(store().pendingFocusTileId).toBe("other");
  });
});

describe("useEditingLifecycle — click outside to exit", () => {
  it("exits editing on an outside click", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const containerRef = ref<HTMLElement | null>(container);

    mountLifecycle({ editor, isEditing, containerRef, tileId: "tile-1" });

    isEditing.value = true;
    await flushAll();

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(isEditing.value).toBe(false);
    outside.remove();
    container.remove();
  });

  it("stays in editing when the click is inside the container", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    const container = document.createElement("div");
    const inner = document.createElement("span");
    container.appendChild(inner);
    document.body.appendChild(container);
    const containerRef = ref<HTMLElement | null>(container);

    mountLifecycle({ editor, isEditing, containerRef, tileId: "tile-1" });

    isEditing.value = true;
    await flushAll();

    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(isEditing.value).toBe(true);
    container.remove();
  });

  it("honors shouldBlockExit to keep editing on an outside click", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const containerRef = ref<HTMLElement | null>(container);

    mountLifecycle({
      editor,
      isEditing,
      containerRef,
      shouldBlockExit: () => true,
      tileId: "tile-1",
    });

    isEditing.value = true;
    await flushAll();

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(isEditing.value).toBe(true);
    outside.remove();
    container.remove();
  });

  it("removes the outside-click handler after unmount", async () => {
    const editor = ref(makeEditor());
    const isEditing = ref(false);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const containerRef = ref<HTMLElement | null>(container);

    const wrapper = mountLifecycle({
      editor,
      isEditing,
      containerRef,
      tileId: "tile-1",
    });

    isEditing.value = true;
    await flushAll();
    wrapper.unmount();

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Handler is gone; isEditing remains whatever it was (true).
    expect(isEditing.value).toBe(true);
    outside.remove();
    container.remove();
  });
});

describe("useEditorContentSync", () => {
  function mountSync(
    editor: Ref<FakeEditor | undefined>,
    getter: () => string | undefined,
    parser?: (t: string) => unknown,
  ) {
    const wrapper = mount(
      defineComponent({
        setup() {
          useEditorContentSync(editor as never, getter, parser);
          return () => h("div");
        },
      }),
    );
    wrappers.push(wrapper);
    return wrapper;
  }

  it("sets parsed content on the editor when external text changes", async () => {
    const editor = ref(makeEditor());
    const text = ref('{"type":"doc","content":[]}');
    mountSync(editor, () => text.value);

    text.value = '{"type":"doc","content":[{"x":1}]}';
    await nextTick();

    expect(editor.value.commands.setContent).toHaveBeenCalledWith(
      { type: "doc", content: [{ x: 1 }] },
      false,
    );
  });

  it("does nothing while the editor is focused", async () => {
    const editor = ref(makeEditor({ isFocused: true }));
    const text = ref('{"a":1}');
    mountSync(editor, () => text.value);

    text.value = '{"a":2}';
    await nextTick();

    expect(editor.value.commands.setContent).not.toHaveBeenCalled();
  });

  it("does nothing when the new text already matches the editor JSON", async () => {
    const json = { type: "doc" };
    const editor = ref(makeEditor({ getJSON: vi.fn(() => json) }));
    const text = ref("seed");
    mountSync(editor, () => text.value);

    // New value equals JSON.stringify(getJSON()).
    text.value = JSON.stringify(json);
    await nextTick();

    expect(editor.value.commands.setContent).not.toHaveBeenCalled();
  });

  it("sets empty content when the new text is empty", async () => {
    const editor = ref(makeEditor());
    const text = ref<string | undefined>("seed");
    mountSync(editor, () => text.value);

    text.value = "";
    await nextTick();

    expect(editor.value.commands.setContent).toHaveBeenCalledWith("", false);
  });

  it("uses a custom parser when provided", async () => {
    const editor = ref(makeEditor());
    const text = ref("a");
    const parser = vi.fn((t: string) => ({ parsed: t }));
    mountSync(editor, () => text.value, parser);

    text.value = "hello";
    await nextTick();

    expect(parser).toHaveBeenCalledWith("hello");
    expect(editor.value.commands.setContent).toHaveBeenCalledWith(
      { parsed: "hello" },
      false,
    );
  });

  it("does nothing when there is no editor", async () => {
    const editor = ref<FakeEditor | undefined>(undefined);
    const text = ref("a");
    expect(() => {
      mountSync(editor, () => text.value);
    }).not.toThrow();

    text.value = "b";
    await nextTick();
    // Nothing to assert beyond no throw — editor is undefined.
  });
});
