import type { Editor } from "@tiptap/core";
import type { RichTextFeature, TextEditorProfile } from "./profiles";

/** The `/query` text a command replaces. */
export interface SlashRange {
  from: number;
  to: number;
}

export interface InlineField {
  key: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  inputmode?: "text" | "url";
  /** Returns an error message, or null when the value is acceptable. */
  validate?: (value: string) => string | null;
}

export interface InlineFieldsRequest {
  title: string;
  submitLabel: string;
  fields: InlineField[];
}

export interface InsertedImage {
  src: string;
  alt: string;
  hash?: string;
}

/**
 * What a command needs from the component hosting the editor. Anything that
 * shows UI or talks to storage goes through here, so commands stay testable.
 */
export interface SlashCommandContext {
  editor: Editor;
  range: SlashRange;
  /** Let the user choose and upload an image; null when they cancel. */
  pickImage: () => Promise<InsertedImage | null>;
  /** Ask for values inline at the caret; null when the user cancels. */
  requestFields: (
    request: InlineFieldsRequest,
  ) => Promise<Record<string, string> | null>;
}

export interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  feature: RichTextFeature;
  /** Runs the command. Commands remove the `/query` text themselves. */
  run: (context: SlashCommandContext) => void | Promise<void>;
}

export const normalizeHttpUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

/** Error message for a link field, or null when it is a usable URL. */
export const requireUrl = (value: string): string | null => {
  const href = normalizeHttpUrl(value);
  if (!href) return "Enter a link";
  try {
    const url = new URL(href);
    return url.hostname.includes(".") ? null : "Enter a valid link";
  } catch {
    return "Enter a valid link";
  }
};

const removeQuery = ({ editor, range }: SlashCommandContext) => {
  editor.chain().focus().deleteRange(range).run();
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: "h1",
    label: "Heading 1",
    hint: "/h1",
    keywords: ["h1", "heading", "title"],
    feature: "heading",
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "/h2",
    keywords: ["h2", "heading", "subtitle"],
    feature: "heading",
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    id: "bullet",
    label: "Bulleted list",
    hint: "/bullet",
    keywords: ["bullet", "list", "ul"],
    feature: "bulletList",
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "numbered",
    label: "Numbered list",
    hint: "/numbered",
    keywords: ["numbered", "ordered", "ol", "list"],
    feature: "orderedList",
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "todo",
    label: "To-do list",
    hint: "/todo",
    keywords: ["todo", "task", "checkbox", "list"],
    feature: "taskList",
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "quote",
    label: "Quote",
    hint: "/quote",
    keywords: ["quote", "blockquote"],
    feature: "blockquote",
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "divider",
    label: "Divider",
    hint: "/divider",
    keywords: ["divider", "rule", "hr", "line"],
    feature: "horizontalRule",
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    id: "image",
    label: "Image",
    hint: "/image",
    keywords: ["image", "photo", "picture", "upload"],
    feature: "image",
    run: async (context) => {
      const image = await context.pickImage();
      if (!image) {
        removeQuery(context);
        return;
      }
      context.editor
        .chain()
        .focus()
        .deleteRange(context.range)
        .setImage(image)
        .splitBlock()
        .run();
    },
  },
  {
    id: "link",
    label: "Link",
    hint: "/link",
    keywords: ["link", "url", "href"],
    feature: "link",
    run: async (context) => {
      const values = await context.requestFields({
        title: "Add link",
        submitLabel: "Insert",
        fields: [
          {
            key: "url",
            label: "Link",
            placeholder: "Paste or type a link",
            inputmode: "url",
            validate: requireUrl,
          },
          { key: "text", label: "Text", placeholder: "Link text (optional)" },
        ],
      });
      if (!values) {
        removeQuery(context);
        return;
      }
      const href = normalizeHttpUrl(values.url ?? "");
      const text = values.text?.trim() || href;
      context.editor
        .chain()
        .focus()
        .deleteRange(context.range)
        .insertContent([
          { type: "text", text, marks: [{ type: "link", attrs: { href } }] },
          // A plain space after the link so typing continues unlinked.
          { type: "text", text: " " },
        ])
        .run();
    },
  },
  {
    id: "button",
    label: "Button link",
    hint: "/button",
    keywords: ["button", "cta", "link"],
    feature: "smartButton",
    run: async (context) => {
      const values = await context.requestFields({
        title: "Add button",
        submitLabel: "Insert",
        fields: [
          {
            key: "url",
            label: "Link",
            placeholder: "Paste or type a link",
            inputmode: "url",
            validate: requireUrl,
          },
          {
            key: "label",
            label: "Label",
            placeholder: "Button",
            initialValue: "Button",
          },
        ],
      });
      if (!values) {
        removeQuery(context);
        return;
      }
      const href = normalizeHttpUrl(values.url ?? "");
      const label = values.label?.trim() || "Button";
      context.editor
        .chain()
        .focus()
        .deleteRange(context.range)
        .insertContent({ type: "smartButton", attrs: { href, label } })
        .splitBlock()
        .run();
    },
  },
  {
    id: "table",
    label: "Table",
    hint: "/table",
    keywords: ["table", "grid", "spreadsheet"],
    feature: "table",
    run: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
];

/** The commands a profile allows, in menu order. */
export function commandsForProfile(
  profile: TextEditorProfile,
): SlashCommand[] {
  if (!profile.slashMenu) return [];
  return SLASH_COMMANDS.filter((command) =>
    profile.features.has(command.feature),
  );
}

/** Commands whose keywords contain the typed query. */
export function filterSlashCommands<T extends Pick<SlashCommand, "keywords">>(
  commands: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  return commands.filter((command) =>
    command.keywords.some((keyword) => keyword.includes(q)),
  );
}

/**
 * The `/query` the caret is in, if any: a `/` at the start of the text block
 * or after whitespace, followed by no spaces up to the caret.
 */
export function findSlashQuery(
  textBeforeCaret: string,
): { offset: number; query: string } | null {
  const slash = textBeforeCaret.lastIndexOf("/");
  if (slash === -1) return null;
  if (slash > 0 && !/\s/.test(textBeforeCaret[slash - 1] ?? "")) return null;
  const query = textBeforeCaret.slice(slash + 1);
  if (/\s/.test(query)) return null;
  return { offset: slash, query };
}
