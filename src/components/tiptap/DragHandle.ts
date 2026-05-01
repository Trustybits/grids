import { Extension } from "@tiptap/core";
import type { Ref } from "vue";

const GRIP_SVG = [
  '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">',
  '<circle cx="2" cy="2" r="1.2"/>',
  '<circle cx="8" cy="2" r="1.2"/>',
  '<circle cx="2" cy="7" r="1.2"/>',
  '<circle cx="8" cy="7" r="1.2"/>',
  '<circle cx="2" cy="12" r="1.2"/>',
  '<circle cx="8" cy="12" r="1.2"/>',
  "</svg>",
].join("");

export interface DragHandleOptions {
  isEditing: Ref<boolean>;
}

/**
 * Walk up the DOM from `target` to find the direct child of `editorDom`,
 * i.e. the top-level block element the cursor is over.
 */
function resolveTopBlock(
  target: HTMLElement | null,
  editorDom: HTMLElement,
): HTMLElement | null {
  let el = target;
  while (el && el !== editorDom && el.parentElement !== editorDom) {
    el = el.parentElement;
  }
  if (!el || el === editorDom || el.parentElement !== editorDom) return null;
  return el;
}

export const DragHandle = Extension.create<DragHandleOptions>({
  name: "dragHandle",

  addOptions() {
    return {
      isEditing: { value: false } as unknown as Ref<boolean>,
    };
  },

  addStorage() {
    return {
      handle: null as HTMLDivElement | null,
      wrapper: null as HTMLElement | null,
      hoveredBlockEl: null as HTMLElement | null,
      cleanup: null as (() => void) | null,
    };
  },

  onCreate() {
    const { editor, options, storage } = this;
    const view = editor.view;
    const editorDom = view.dom;
    const wrapper = editorDom.parentElement;

    if (!wrapper) return;
    wrapper.style.position = "relative";

    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.draggable = true;
    handle.setAttribute("contenteditable", "false");
    handle.innerHTML = GRIP_SVG;
    wrapper.appendChild(handle);

    storage.handle = handle;
    storage.wrapper = wrapper;

    const isEditing = options.isEditing;

    function showHandle(blockEl: HTMLElement) {
      storage.hoveredBlockEl = blockEl;
      const blockRect = blockEl.getBoundingClientRect();
      const wrapperRect = wrapper?.getBoundingClientRect() ?? { top: 120 };
      handle.style.top = `${blockRect.top - wrapperRect.top}px`;
      handle.classList.add("visible");
    }

    function hideHandle() {
      handle.classList.remove("visible");
      storage.hoveredBlockEl = null;
    }

    function onMouseMove(event: MouseEvent) {
      if (!isEditing.value || !view.editable) {
        hideHandle();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (handle.contains(target)) return;

      const block = resolveTopBlock(target, editorDom);
      if (block) {
        showHandle(block);
      }
      // When no block is found (e.g. mouse in padding area between
      // content and handle), keep the current handle visible so the
      // user can reach it. It hides on mouseleave instead.
    }

    function onMouseLeave() {
      hideHandle();
    }

    let internalDrag = false;
    let dragFrom: number | null = null;
    let dragTo: number | null = null;

    function onDragStart(event: DragEvent) {
      const blockEl = storage.hoveredBlockEl;
      if (!blockEl || !event.dataTransfer) return;
      try {
        const pos = view.posAtDOM(blockEl, 0);
        const $pos = view.state.doc.resolve(pos);
        if ($pos.depth < 1) return;
        const from = $pos.before(1);
        const node = $pos.node(1);
        const to = from + node.nodeSize;

        dragFrom = from;
        dragTo = to;
        internalDrag = true;

        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-smarttext-drag", "1");
        blockEl.classList.add("drag-handle-dragging");
        event.dataTransfer.setDragImage(blockEl, 0, 0);

        // Nullify view.dragging so ProseMirror's own drop handler
        // treats the drop as external (we handle everything ourselves
        // in the capture-phase handler below).
        (view as unknown as Record<string, unknown>).dragging = null;
      } catch (e) {
        console.error("[DragHandle] dragstart failed:", e);
      }
    }

    // Capture-phase handler on the editor DOM so it fires BEFORE
    // ProseMirror's bubble-phase drop handler.
    function onEditorDrop(event: DragEvent) {
      if (!internalDrag || dragFrom === null || dragTo === null) return;

      // Stop ProseMirror (and the browser) from handling this drop
      event.preventDefault();
      event.stopImmediatePropagation();

      const coords = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      if (!coords) return;

      const doc = view.state.doc;
      const $mouse = doc.resolve(coords.pos);

      // Determine where to insert relative to the nearest top-level block
      let insertPos: number;
      if ($mouse.depth >= 1) {
        const blockStart = $mouse.before(1);
        const blockNode = $mouse.node(1);
        const blockEnd = blockStart + blockNode.nodeSize;
        const midOffset = blockNode.nodeSize / 2;
        insertPos = coords.pos - blockStart < midOffset ? blockStart : blockEnd;
      } else {
        insertPos = coords.pos;
      }

      // No-op when dropping in the same position
      if (insertPos >= dragFrom && insertPos <= dragTo) return;

      const blockContent = doc.slice(dragFrom, dragTo).content;
      const tr = view.state.tr;

      if (insertPos <= dragFrom) {
        tr.insert(insertPos, blockContent);
        tr.delete(tr.mapping.map(dragFrom), tr.mapping.map(dragTo));
      } else {
        tr.delete(dragFrom, dragTo);
        tr.insert(tr.mapping.map(insertPos), blockContent);
      }

      view.dispatch(tr.scrollIntoView());
    }

    function onDragEnd() {
      internalDrag = false;
      dragFrom = null;
      dragTo = null;
      const el = editorDom.querySelector(".drag-handle-dragging");
      if (el) el.classList.remove("drag-handle-dragging");
      hideHandle();
    }

    function containDrag(event: DragEvent) {
      if (internalDrag) {
        event.stopPropagation();
        event.preventDefault();
      }
    }

    // Prevent GridTile click detection from firing when interacting
    // with the drag handle (would reset the editor selection mid-drag)
    function onHandleMouseDown(event: MouseEvent) {
      event.stopPropagation();
    }

    wrapper.addEventListener("mousemove", onMouseMove);
    wrapper.addEventListener("mouseleave", onMouseLeave);
    handle.addEventListener("mousedown", onHandleMouseDown);
    handle.addEventListener("dragstart", onDragStart);
    handle.addEventListener("dragend", onDragEnd);
    editorDom.addEventListener("drop", onEditorDrop, true);
    wrapper.addEventListener("dragover", containDrag);
    wrapper.addEventListener("dragenter", containDrag);
    wrapper.addEventListener("dragleave", containDrag);
    wrapper.addEventListener("drop", containDrag);

    storage.cleanup = () => {
      wrapper?.removeEventListener("mousemove", onMouseMove);
      wrapper?.removeEventListener("mouseleave", onMouseLeave);
      handle.removeEventListener("mousedown", onHandleMouseDown);
      handle.removeEventListener("dragstart", onDragStart);
      handle.removeEventListener("dragend", onDragEnd);
      editorDom.removeEventListener("drop", onEditorDrop, true);
      wrapper?.removeEventListener("dragover", containDrag);
      wrapper?.removeEventListener("dragenter", containDrag);
      wrapper?.removeEventListener("dragleave", containDrag);
      wrapper?.removeEventListener("drop", containDrag);
      handle.remove();
      editorDom.classList.remove("has-drag-handles");
    };
  },

  onTransaction() {
    const { editor, options, storage } = this;
    const view = editor.view;
    if (options.isEditing.value && view.editable) {
      view.dom.classList.add("has-drag-handles");
      if (
        storage.hoveredBlockEl &&
        storage.hoveredBlockEl.parentElement === view.dom &&
        storage.handle
      ) {
        const blockRect = storage.hoveredBlockEl.getBoundingClientRect();
        const wrapperRect = storage.wrapper?.getBoundingClientRect();
        if (!wrapperRect) return;
        storage.handle.style.top = `${blockRect.top - wrapperRect.top}px`;
      }
    } else {
      view.dom.classList.remove("has-drag-handles");
      if (storage.handle) storage.handle.classList.remove("visible");
      storage.hoveredBlockEl = null;
    }
  },

  onDestroy() {
    this.storage.cleanup?.();
  },
});
