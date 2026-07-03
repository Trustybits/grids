import ImageExt from "@tiptap/extension-image";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import ImageNodeView from "@/components/tiptap/ImageNodeView.vue";

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
      // Authoritative archive key for user-owned inline uploads. Round-trips
      // through the serialized JSON/HTML so refCount reconciliation and grid
      // duplication can resolve the file by hash rather than URL parsing.
      hash: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-hash") || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.hash) return {};
          return { "data-hash": attrs.hash };
        },
      },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageNodeView);
  },
});
