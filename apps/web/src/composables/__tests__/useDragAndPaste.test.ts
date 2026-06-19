import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, onMounted, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useGridStore } from "@/stores/grid";
import { useDragAndPaste } from "@/composables/useDragAndPaste";

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({
    uploadFileOptimistic: vi.fn(),
    uploadDocumentsOptimistic: vi.fn(),
  }),
}));

describe("useDragAndPaste", () => {
  it("attaches drag listeners when the container ref appears after mount", async () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const container = ref<HTMLElement | null>(null);
          const showContainer = ref(false);
          const { isDraggingOver } = useDragAndPaste(container);

          onMounted(() => {
            showContainer.value = true;
          });

          return () =>
            h("div", [
              showContainer.value
                ? h("div", { ref: container, "data-testid": "drop-target" })
                : null,
              isDraggingOver.value
                ? h("span", { "data-testid": "drag-overlay" }, "Drop to add to grid")
                : null,
            ]);
        },
      }),
    );

    const gridStore = useGridStore();
    gridStore.isOwner = true;

    await nextTick();
    await nextTick();

    await wrapper.get("[data-testid='drop-target']").trigger("dragenter");

    expect(wrapper.find("[data-testid='drag-overlay']").exists()).toBe(true);
  });

  it("requests focus for the smart-text tile created from pasted plain text", async () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const container = ref<HTMLElement | null>(null);
          useDragAndPaste(container);
          return () => h("div", { ref: container });
        },
      }),
    );
    const gridStore = useGridStore();
    gridStore.isOwner = true;
    const addTile = vi
      .spyOn(gridStore, "addTile")
      .mockReturnValue("pasted-text-tile");
    const pasteTarget = document.createElement("div");
    document.body.appendChild(pasteTarget);
    const pasteEvent = new Event("paste", {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: {
        items: [],
        getData: vi.fn(() => "Pasted plain text"),
      },
    });

    pasteTarget.dispatchEvent(pasteEvent);
    await nextTick();

    expect(addTile).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "smart_text",
        text: expect.stringContaining("Pasted plain text"),
      }),
    );
    expect(gridStore.pendingFocusTileId).toBe("pasted-text-tile");
    expect(pasteEvent.defaultPrevented).toBe(true);

    wrapper.unmount();
    pasteTarget.remove();
  });
});
