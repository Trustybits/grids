import ImageExt from "@tiptap/extension-image";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import ImageNodeView from "./ImageNodeView.vue";

/**
 * Extends TipTap Image with resizable width, alignment,
 * and a custom Vue NodeView with drag handles + alignment toolbar.
 */
export const ResizableImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-width") || el.getAttribute("width") || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.width) return {};
          return { "data-width": attrs.width };
        },
      },
      align: {
        default: "center",
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-align") || "center",
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.align) return {};
          return { "data-align": attrs.align };
        },
      },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageNodeView);
  },
});
