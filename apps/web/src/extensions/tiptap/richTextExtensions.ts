import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { FontSize } from "./FontSize";
import { SmartButton } from "./SmartButton";
import { ResizableImage } from "./ResizableImage";

/**
 * The node and mark schema shared by every text-tile editor.
 *
 * Every editor that can open a text tile's document must register all of
 * these, even when its UI can't insert some of them. Tiptap does not drop a
 * node type it doesn't know: it rejects the whole document and loads an empty
 * one in its place, which the next autosave then writes back. `text` and
 * `smart_text` tiles are converging on one type, so a text tile can hold
 * anything smart text can insert.
 *
 * Only schema lives here. Editing behaviour (drag handle, slash menu) is added
 * by the component on top.
 */
export function richTextSchemaExtensions(): AnyExtension[] {
  return [
    StarterKit,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    TaskList,
    TaskItem,
    SmartButton,
    Link.configure({
      autolink: true,
      openOnClick: true,
    }),
    ResizableImage.configure({ inline: true }),
    Table.configure({
      resizable: true,
      cellMinWidth: 40,
      allowTableNodeSelection: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
