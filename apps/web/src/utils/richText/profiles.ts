/**
 * Editor profiles for the unified rich-text component.
 *
 * Every text surface registers the full Tiptap schema (see
 * `extensions/tiptap/richTextExtensions.ts`) so stored content always loads.
 * A profile only limits what the user can *insert* there: the text tile gets
 * everything, while later surfaces (profile bio, link fields) opt into less.
 */

/** Insertable content a profile can allow, one per slash command family. */
export type RichTextFeature =
  | "heading"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "horizontalRule"
  | "image"
  | "link"
  | "smartButton"
  | "table";

export interface TextEditorProfile {
  id: string;
  /** Whether typing `/` opens the command menu. */
  slashMenu: boolean;
  features: ReadonlySet<RichTextFeature>;
}

export const FULL_PROFILE: TextEditorProfile = {
  id: "full",
  slashMenu: true,
  features: new Set<RichTextFeature>([
    "heading",
    "bulletList",
    "orderedList",
    "taskList",
    "blockquote",
    "horizontalRule",
    "image",
    "link",
    "smartButton",
    "table",
  ]),
};
