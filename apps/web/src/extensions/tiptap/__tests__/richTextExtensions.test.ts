import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/vue-3";
import { richTextSchemaExtensions } from "@/extensions/tiptap/richTextExtensions";

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

// One of everything the smart text editor can insert today.
const SMART_TEXT_DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
    paragraph("Intro"),
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "styled",
          marks: [
            { type: "bold" },
            { type: "italic" },
            {
              type: "textStyle",
              attrs: { color: "#ff0000", fontFamily: "Lobster", fontSize: "20px" },
            },
          ],
        },
        { type: "text", text: " " },
        {
          type: "text",
          text: "a link",
          marks: [{ type: "link", attrs: { href: "https://grids.so" } }],
        },
        { type: "text", text: " " },
        {
          type: "smartButton",
          attrs: { href: "https://grids.so", label: "Visit" },
        },
        {
          type: "image",
          attrs: { src: "https://example.com/a.png", alt: "a", width: "50%", align: "center", hash: "abc" },
        },
      ],
    },
    { type: "bulletList", content: [{ type: "listItem", content: [paragraph("one")] }] },
    { type: "orderedList", content: [{ type: "listItem", content: [paragraph("two")] }] },
    {
      type: "taskList",
      content: [{ type: "taskItem", attrs: { checked: true }, content: [paragraph("done")] }],
    },
    { type: "blockquote", content: [paragraph("quoted")] },
    { type: "horizontalRule" },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [{ type: "tableHeader", content: [paragraph("H")] }],
        },
        {
          type: "tableRow",
          content: [{ type: "tableCell", content: [paragraph("C")] }],
        },
      ],
    },
  ],
};

const editors: Editor[] = [];
afterEach(() => {
  while (editors.length) editors.pop()!.destroy();
});

function load(content: unknown) {
  const editor = new Editor({
    extensions: richTextSchemaExtensions(),
    content: content as never,
  });
  editors.push(editor);
  return editor;
}

function nodeTypes(json: unknown): Set<string> {
  const types = new Set<string>();
  const walk = (node: { type?: string; content?: unknown[] }) => {
    if (node.type) types.add(node.type);
    node.content?.forEach((child) => walk(child as typeof node));
  };
  walk(json as { type?: string; content?: unknown[] });
  return types;
}

describe("richTextSchemaExtensions", () => {
  it("loads every node a smart text tile can hold without blanking the doc", () => {
    const editor = load(SMART_TEXT_DOC);

    expect(editor.isEmpty).toBe(false);
    expect(nodeTypes(editor.getJSON())).toEqual(nodeTypes(SMART_TEXT_DOC));
  });

  it("round-trips a smart text doc through save and reload unchanged", () => {
    const saved = JSON.stringify(load(SMART_TEXT_DOC).getJSON());
    const reloaded = JSON.stringify(load(JSON.parse(saved)).getJSON());

    expect(reloaded).toBe(saved);
  });

  it("keeps marks and node attributes", () => {
    const json = JSON.stringify(load(SMART_TEXT_DOC).getJSON());

    expect(json).toContain('"fontFamily":"Lobster"');
    expect(json).toContain('"fontSize":"20px"');
    expect(json).toContain('"color":"#ff0000"');
    expect(json).toContain('"href":"https://grids.so"');
    expect(json).toContain('"label":"Visit"');
    expect(json).toContain('"hash":"abc"');
  });
});
