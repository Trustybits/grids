import { describe, it, expect, vi, afterEach } from "vitest";
import { Editor } from "@tiptap/vue-3";
import { richTextSchemaExtensions } from "@/extensions/tiptap/richTextExtensions";
import { FULL_PROFILE, type TextEditorProfile } from "@/utils/richText/profiles";
import {
  SLASH_COMMANDS,
  commandsForProfile,
  filterSlashCommands,
  findSlashQuery,
  normalizeHttpUrl,
  type InlineFieldsRequest,
  type SlashCommandContext,
} from "@/utils/richText/slashCommands";

const editors: Editor[] = [];
afterEach(() => {
  while (editors.length) editors.pop()!.destroy();
});

/** An editor holding `before/query` with the caret after the query. */
function editorWithQuery(before: string, query: string) {
  const editor = new Editor({
    extensions: richTextSchemaExtensions(),
    content: `<p>${before}/${query}</p>`,
  });
  editors.push(editor);
  const to = editor.state.doc.content.size - 1;
  const from = to - query.length - 1;
  editor.commands.setTextSelection(to);
  return { editor, range: { from, to } };
}

function run(
  id: string,
  overrides: Partial<SlashCommandContext> = {},
  before = "Hi ",
) {
  const { editor, range } = editorWithQuery(before, id);
  const command = SLASH_COMMANDS.find((c) => c.id === id)!;
  const context: SlashCommandContext = {
    editor,
    range,
    pickImage: vi.fn(async () => null),
    requestFields: vi.fn(async () => null),
    ...overrides,
  };
  return { editor, context, done: command.run(context) };
}

const json = (editor: Editor) => JSON.stringify(editor.getJSON());

describe("findSlashQuery", () => {
  it("finds a slash at the start of the block", () => {
    expect(findSlashQuery("/hea")).toEqual({ offset: 0, query: "hea" });
  });

  it("finds a slash after whitespace", () => {
    expect(findSlashQuery("hello /ta")).toEqual({ offset: 6, query: "ta" });
  });

  it("ignores slashes inside words, like URLs and fractions", () => {
    expect(findSlashQuery("and/or")).toBeNull();
    expect(findSlashQuery("1/2")).toBeNull();
  });

  it("closes once the query contains a space", () => {
    expect(findSlashQuery("/h1 done")).toBeNull();
  });

  it("returns null without a slash", () => {
    expect(findSlashQuery("plain text")).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("returns everything for an empty query", () => {
    expect(filterSlashCommands(SLASH_COMMANDS, "  ")).toHaveLength(
      SLASH_COMMANDS.length,
    );
  });

  it("matches keywords case-insensitively", () => {
    const ids = filterSlashCommands(SLASH_COMMANDS, "LIST").map((c) => c.id);
    expect(ids).toEqual(["bullet", "numbered", "todo"]);
  });

  it("returns nothing when no keyword matches", () => {
    expect(filterSlashCommands(SLASH_COMMANDS, "zzz")).toEqual([]);
  });
});

describe("commandsForProfile", () => {
  it("gives the full profile every command", () => {
    expect(commandsForProfile(FULL_PROFILE).map((c) => c.id)).toEqual(
      SLASH_COMMANDS.map((c) => c.id),
    );
  });

  it("drops commands whose feature the profile leaves out", () => {
    const profile: TextEditorProfile = {
      id: "limited",
      slashMenu: true,
      features: new Set(["heading", "bulletList", "link"]),
    };
    expect(commandsForProfile(profile).map((c) => c.id)).toEqual([
      "h1",
      "h2",
      "bullet",
      "link",
    ]);
  });

  it("returns nothing when the profile has no slash menu", () => {
    expect(
      commandsForProfile({ ...FULL_PROFILE, slashMenu: false }),
    ).toEqual([]);
  });

  it("keeps command ids unique", () => {
    const ids = SLASH_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("normalizeHttpUrl", () => {
  it("adds https:// when missing and keeps existing schemes", () => {
    expect(normalizeHttpUrl(" grids.so ")).toBe("https://grids.so");
    expect(normalizeHttpUrl("HTTP://a.b")).toBe("HTTP://a.b");
    expect(normalizeHttpUrl("")).toBe("");
  });
});

describe("running commands", () => {
  it.each([
    ["h1", '"type":"heading"'],
    ["h2", '"level":2'],
    ["bullet", '"type":"bulletList"'],
    ["numbered", '"type":"orderedList"'],
    ["todo", '"type":"taskList"'],
    ["quote", '"type":"blockquote"'],
    ["divider", '"type":"horizontalRule"'],
    ["table", '"type":"table"'],
  ])("/%s inserts its block and removes the query", async (id, expected) => {
    const { editor, done } = run(id);
    await done;
    expect(json(editor)).toContain(expected);
    expect(editor.getText()).not.toContain(`/${id}`);
    expect(editor.getText()).toContain("Hi");
  });

  it("/image inserts the uploaded image with its hash", async () => {
    const { editor, done } = run("image", {
      pickImage: async () => ({ src: "https://x/a.png", alt: "a", hash: "h1" }),
    });
    await done;
    expect(json(editor)).toContain('"src":"https://x/a.png"');
    expect(json(editor)).toContain('"hash":"h1"');
    expect(editor.getText()).not.toContain("/image");
  });

  it("/link inserts linked text from the inline fields", async () => {
    const requestFields = vi.fn(async () => ({ url: "grids.so", text: "Grids" }));
    const { editor, done } = run("link", { requestFields });
    await done;
    expect(requestFields).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Add link" }),
    );
    expect(json(editor)).toContain('"href":"https://grids.so"');
    expect(editor.getText()).toContain("Grids");
    expect(editor.getText()).not.toContain("/link");
  });

  it("/link falls back to the URL as its text", async () => {
    const { editor, done } = run("link", {
      requestFields: async () => ({ url: "grids.so", text: "  " }),
    });
    await done;
    expect(editor.getText()).toContain("https://grids.so");
  });

  it("/button inserts a smart button", async () => {
    const { editor, done } = run("button", {
      requestFields: async () => ({ url: "grids.so/a", label: "Go" }),
    });
    await done;
    expect(json(editor)).toContain('"type":"smartButton"');
    expect(json(editor)).toContain('"label":"Go"');
  });

  it.each(["image", "link", "button"])(
    "cancelling /%s removes the query and inserts nothing",
    async (id) => {
      const { editor, done } = run(id);
      await done;
      expect(editor.getText()).toBe("Hi ");
      expect(json(editor)).not.toMatch(/"type":"(image|smartButton)"|"link"/);
    },
  );

  it("validates the URL field of /link and /button", () => {
    for (const id of ["link", "button"]) {
      const requestFields = vi.fn(
        async (_request: InlineFieldsRequest) => null,
      );
      void run(id, { requestFields }).done;
      const request = requestFields.mock.calls[0]![0];
      const validate = request.fields.find((f) => f.key === "url")!.validate!;
      expect(validate("grids.so")).toBeNull();
      expect(validate("")).not.toBeNull();
      expect(validate("not a url")).not.toBeNull();
    }
  });
});
