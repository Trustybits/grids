import { describe, expect, it } from "vitest";
import {
  MIXED,
  parseStoredDoc,
  readBlockAlign,
  readFontFamily,
  readMark,
  readTextStyle,
  setBlockAlign,
  setFontFamily,
  setFontSizePx,
  setMark,
  setTextColor,
  transformStoredText,
  type DocNode,
} from "../docTransforms";

const text = (value: string, marks?: DocNode["marks"]): DocNode =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };

const doc = (...blocks: DocNode[]): DocNode => ({ type: "doc", content: blocks });
const para = (...children: DocNode[]): DocNode => ({
  type: "paragraph",
  content: children,
});

describe("parseStoredDoc / transformStoredText", () => {
  it("reads empty text as nothing to format", () => {
    expect(parseStoredDoc("")).toBeNull();
    expect(transformStoredText("", (d) => setMark(d, "bold", true))).toBe("");
  });

  it("wraps legacy plain text in a paragraph, as the editor loads it", () => {
    expect(parseStoredDoc("hello")).toEqual(doc(para(text("hello"))));
  });

  it("round-trips a stored doc through a transform", () => {
    const stored = JSON.stringify(doc(para(text("hi"))));
    const next = transformStoredText(stored, (d) => setMark(d, "bold", true));
    expect(JSON.parse(next)).toEqual(
      doc(para(text("hi", [{ type: "bold" }]))),
    );
  });
});

describe("marks", () => {
  it("reads all / none / mixed", () => {
    const bold = text("a", [{ type: "bold" }]);
    expect(readMark(doc(para(bold)), "bold")).toBe(true);
    expect(readMark(doc(para(text("a"))), "bold")).toBe(false);
    expect(readMark(doc(para(bold, text("b"))), "bold")).toBe(MIXED);
  });

  it("adds and removes a mark everywhere without duplicating it", () => {
    const start = doc(para(text("a", [{ type: "bold" }]), text("b")));
    const on = setMark(start, "bold", true);
    expect(readMark(on, "bold")).toBe(true);
    expect(on.content![0].content![0].marks).toEqual([{ type: "bold" }]);
    expect(readMark(setMark(on, "bold", false), "bold")).toBe(false);
    expect(setMark(on, "bold", false).content![0].content![0].marks).toBeUndefined();
  });

  it("follows the editor's code rules", () => {
    const styled = doc(
      para(text("a", [{ type: "bold" }, { type: "italic" }])),
    );
    // Code excludes every other mark.
    const code = setMark(styled, "code", true);
    expect(code.content![0].content![0].marks).toEqual([{ type: "code" }]);
    // And nothing is added to code text.
    expect(
      setMark(code, "bold", true).content![0].content![0].marks,
    ).toEqual([{ type: "code" }]);
  });

  it("leaves code blocks alone", () => {
    const block: DocNode = {
      type: "codeBlock",
      content: [text("let x")],
    };
    const result = setMark(doc(block, para(text("a"))), "bold", true);
    expect(result.content![0]).toEqual(block);
    expect(readMark(result, "bold")).toBe(true);
  });
});

describe("textStyle attributes", () => {
  it("sets and reads font, size and color", () => {
    let d = doc(para(text("a"), text("b")));
    d = setFontFamily(d, "Lobster");
    d = setFontSizePx(d, 20);
    d = setTextColor(d, "#ff0000");
    expect(readFontFamily(d)).toBe("Lobster");
    expect(readTextStyle(d, "fontSize")).toBe("20px");
    expect(readTextStyle(d, "color")).toBe("#ff0000");
  });

  it("stores the default family as unset and drops an empty textStyle", () => {
    const styled = setFontFamily(doc(para(text("a"))), "Lobster");
    const reset = setFontFamily(styled, "Inter");
    expect(readFontFamily(reset)).toBe("Inter");
    expect(reset.content![0].content![0].marks).toBeUndefined();
  });

  it("keeps other textStyle attributes when one is cleared", () => {
    let d = setFontSizePx(doc(para(text("a"))), 26);
    d = setTextColor(d, "#00ff00");
    d = setTextColor(d, null);
    expect(d.content![0].content![0].marks).toEqual([
      { type: "textStyle", attrs: { fontSize: "26px" } },
    ]);
  });

  it("reads mixed sizes as mixed", () => {
    const d = doc(
      para(
        text("a", [{ type: "textStyle", attrs: { fontSize: "12px" } }]),
        text("b", [{ type: "textStyle", attrs: { fontSize: "20px" } }]),
      ),
    );
    expect(readTextStyle(d, "fontSize")).toBe(MIXED);
  });
});

describe("block alignment", () => {
  it("reads and sets paragraph/heading alignment", () => {
    const d = doc(
      para(text("a")),
      { type: "heading", attrs: { level: 2 }, content: [text("b")] },
    );
    expect(readBlockAlign(d)).toBeNull();
    const centered = setBlockAlign(d, "center");
    expect(readBlockAlign(centered)).toBe("center");
    expect(centered.content![1].attrs).toEqual({
      level: 2,
      textAlign: "center",
    });
    expect(readBlockAlign(setBlockAlign(centered, null))).toBeNull();
  });

  it("reads differing blocks as mixed", () => {
    const d = doc(
      { ...para(text("a")), attrs: { textAlign: "left" } },
      { ...para(text("b")), attrs: { textAlign: "right" } },
    );
    expect(readBlockAlign(d)).toBe(MIXED);
  });
});
