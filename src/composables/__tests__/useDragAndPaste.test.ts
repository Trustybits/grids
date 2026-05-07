import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, onMounted, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useLayoutStore } from "@/stores/layout";
import { useDragAndPaste } from "@/composables/useDragAndPaste";

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({
    uploadFileOptimistic: vi.fn(),
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

    const layoutStore = useLayoutStore();
    layoutStore.isOwner = true;

    await nextTick();
    await nextTick();

    await wrapper.get("[data-testid='drop-target']").trigger("dragenter");

    expect(wrapper.find("[data-testid='drag-overlay']").exists()).toBe(true);
  });
});
