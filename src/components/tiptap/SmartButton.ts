import { Node, mergeAttributes } from "@tiptap/core";

/**
 * SmartText inline button.
 * Rendered as a styled anchor that behaves like a button.
 * Inline so it can be inserted at any cursor position via /button.
 */
export const SmartButton = Node.create({
  name: "smartButton",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      href: {
        default: "",
        parseHTML: (element) => element.getAttribute("href") || "",
      },
      label: {
        default: "Button",
        parseHTML: (element) => (element.textContent || "Button").trim(),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-smart-button="true"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { href, label } = node.attrs as { href: string; label: string };

    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-smart-button": "true",
        class: "smart-button",
        href: href || undefined,
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      label || "Button",
    ];
  },
});

