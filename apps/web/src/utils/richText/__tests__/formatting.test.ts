import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/vue-3";
import { richTextSchemaExtensions } from "@/extensions/tiptap/richTextExtensions";
import {
  DEFAULT_FONT_SIZE_PX,
  normalizeFontSizeInput,
  presetForPx,
  readFormatting,
  setBlockAlign,
  setFontFamily,
  setFontSizePx,
  setLink,
  setTextColor,
  toggleMark,
} from "@/utils/richText/formatting";

const editors: Editor[] = [];
afterEach(() => {
  while (editors.length) editors.pop()!.destroy();
});

function make(html: string) {
  const editor = new Editor({ extensions: richTextSchemaExtensions(), content: html });
  editors.push(editor);
  return editor;
}

/** Select the whole text of the first paragraph ("hello" → 1..6). */
function selectWord(editor: Editor, from = 1, to = 6) {
  editor.commands.setTextSelection({ from, to });
}

const json = (editor: Editor) => JSON.stringify(editor.getJSON());

describe("readFormatting", () => {
  it("reports defaults for plain text", () => {
    const editor = make("<p>hello</p>");
    selectWord(editor);
    const state = readFormatting(editor);
    expect(state.marks).toEqual({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      code: false,
    });
    expect(state.fontFamily).toBe("Inter");
    expect(state.fontSizePx).toBe(DEFAULT_FONT_SIZE_PX);
    expect(state.fontSizePreset).toBe("Medium");
    expect(state.color).toBeNull();
    expect(state.align).toBeNull();
    expect(state.link).toBeNull();
  });

  it("reads marks, text style, alignment and link at the selection", () => {
    const editor = make(
      '<p style="text-align: center"><a href="https://grids.so"><strong><u><span style="font-size: 20px; font-family: Lobster; color: #ff0000">hello</span></u></strong></a></p>',
    );
    selectWord(editor);
    const state = readFormatting(editor);
    expect(state.marks.bold).toBe(true);
    expect(state.marks.underline).toBe(true);
    expect(state.fontFamily).toBe("Lobster");
    expect(state.fontSizePx).toBe(20);
    expect(state.fontSizePreset).toBe("Large");
    // jsdom normalizes the parsed CSS color to rgb().
    expect(state.color).toMatch(/#ff0000|rgb\(255, 0, 0\)/);
    expect(state.align).toBe("center");
    expect(state.link).toBe("https://grids.so");
  });
});

describe("applying formatting to a selection", () => {
  it.each(["bold", "italic", "underline", "strike", "code"] as const)(
    "toggles %s on and off",
    (mark) => {
      const editor = make("<p>hello</p>");
      selectWord(editor);
      toggleMark(editor, mark);
      expect(readFormatting(editor).marks[mark]).toBe(true);
      toggleMark(editor, mark);
      expect(readFormatting(editor).marks[mark]).toBe(false);
    },
  );

  it("sets font family, returning to the default removes it", () => {
    const editor = make("<p>hello</p>");
    selectWord(editor);
    setFontFamily(editor, "Lobster");
    expect(json(editor)).toContain('"fontFamily":"Lobster"');
    setFontFamily(editor, "Inter");
    expect(json(editor)).not.toContain("Lobster");
  });

  it("sets a preset or custom size in px", () => {
    const editor = make("<p>hello</p>");
    selectWord(editor);
    setFontSizePx(editor, 37);
    expect(readFormatting(editor).fontSizePx).toBe(37);
    expect(readFormatting(editor).fontSizePreset).toBeNull();
    setFontSizePx(editor, 12);
    expect(readFormatting(editor).fontSizePreset).toBe("Small");
  });

  it("sets a picked color and clears back to automatic", () => {
    const editor = make("<p>hello</p>");
    selectWord(editor);
    setTextColor(editor, "#00ff00");
    expect(readFormatting(editor).color).toBe("#00ff00");
    setTextColor(editor, null);
    expect(readFormatting(editor).color).toBeNull();
    expect(json(editor)).not.toContain("#00ff00");
  });

  it("links and unlinks the selection", () => {
    const editor = make("<p>hello</p>");
    selectWord(editor);
    setLink(editor, "https://grids.so");
    expect(readFormatting(editor).link).toBe("https://grids.so");
    setLink(editor, null);
    expect(readFormatting(editor).link).toBeNull();
  });
});

describe("applying formatting at a caret (from the cursor on)", () => {
  it("formats what is typed next without touching existing text", () => {
    const editor = make("<p>hello</p>");
    editor.commands.setTextSelection(6);
    toggleMark(editor, "bold");
    setTextColor(editor, "#0000ff");
    setFontSizePx(editor, 26);
    editor.commands.insertContent(" world");

    const paragraph = editor.getJSON().content![0]!;
    const [before, after] = paragraph.content!;
    expect(before!.text).toBe("hello");
    expect(before!.marks).toBeUndefined();
    expect(after!.text).toBe(" world");
    expect(JSON.stringify(after!.marks)).toContain('"type":"bold"');
    expect(JSON.stringify(after!.marks)).toContain('"color":"#0000ff"');
    expect(JSON.stringify(after!.marks)).toContain('"fontSize":"26px"');
  });
});

describe("block alignment", () => {
  it("aligns every block the selection touches", () => {
    const editor = make("<p>one</p><p>two</p><p>three</p>");
    editor.commands.setTextSelection({ from: 2, to: 8 });
    setBlockAlign(editor, "right");
    const aligns = editor.getJSON().content!.map((node) => node.attrs?.textAlign);
    expect(aligns).toEqual(["right", "right", null]);
  });

  it("choosing the current alignment again hands the block back to the tile", () => {
    const editor = make('<p style="text-align: center">one</p>');
    editor.commands.setTextSelection(2);
    setBlockAlign(editor, "center");
    expect(readFormatting(editor).align).toBeNull();
  });

  it("applies at a caret to the block it sits in", () => {
    const editor = make("<p>one</p><p>two</p>");
    editor.commands.setTextSelection(7);
    setBlockAlign(editor, "center");
    const aligns = editor.getJSON().content!.map((node) => node.attrs?.textAlign);
    expect(aligns).toEqual([null, "center"]);
  });
});

describe("size helpers", () => {
  it("maps presets and clamps typed sizes", () => {
    expect(presetForPx(14)).toBe("Medium");
    expect(presetForPx(15)).toBeNull();
    expect(normalizeFontSizeInput("18")).toBe(18);
    expect(normalizeFontSizeInput("18.6px")).toBe(19);
    expect(normalizeFontSizeInput("2")).toBe(8);
    expect(normalizeFontSizeInput("999")).toBe(200);
    expect(normalizeFontSizeInput("big")).toBeNull();
  });
});
