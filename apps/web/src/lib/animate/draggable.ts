import { onBeforeUnmount, ref, watch, type Ref } from "vue";

export interface DraggablePosition {
  x: number;
  y: number;
}

export interface DraggableMoveEvent extends DraggablePosition {
  dx: number;
  dy: number;
}

export interface UseDraggableOptions {
  el: Ref<HTMLElement | null>;
  /** Constrain drag to this rect (in the same coordinate space as clientX/Y). */
  bounds?: Ref<DOMRect | null>;
  onDragStart?: (pos: DraggablePosition) => void;
  onDrag?: (pos: DraggableMoveEvent) => void;
  onDragEnd?: (pos: DraggablePosition) => void;
}

export interface UseDraggableReturn {
  isDragging: Ref<boolean>;
  x: Ref<number>;
  y: Ref<number>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pointer-event draggable — unifies mouse and touch via the Pointer Events API
 * and `setPointerCapture`. Reports positions in client (viewport) coordinates;
 * callers translate into their own layout space (e.g. % of a canvas).
 */
export function useDraggable(opts: UseDraggableOptions): UseDraggableReturn {
  const isDragging = ref(false);
  const x = ref(0);
  const y = ref(0);

  let startX = 0;
  let startY = 0;
  let activePointerId: number | null = null;

  const clampToBounds = (pos: DraggablePosition): DraggablePosition => {
    const rect = opts.bounds?.value;
    if (!rect) return pos;
    return {
      x: clamp(pos.x, rect.left, rect.right),
      y: clamp(pos.y, rect.top, rect.bottom),
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging.value || e.pointerId !== activePointerId) return;
    const clamped = clampToBounds({ x: e.clientX, y: e.clientY });
    x.value = clamped.x;
    y.value = clamped.y;
    opts.onDrag?.({
      x: clamped.x,
      y: clamped.y,
      dx: clamped.x - startX,
      dy: clamped.y - startY,
    });
  };

  const endDrag = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    isDragging.value = false;
    activePointerId = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    opts.onDragEnd?.({ x: x.value, y: y.value });
  };

  const onPointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement | null;
    if (!target) return;
    isDragging.value = true;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    x.value = e.clientX;
    y.value = e.clientY;
    target.setPointerCapture?.(e.pointerId);
    opts.onDragStart?.({ x: x.value, y: y.value });

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  watch(
    opts.el,
    (next, prev) => {
      prev?.removeEventListener("pointerdown", onPointerDown);
      next?.addEventListener("pointerdown", onPointerDown);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    opts.el.value?.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  });

  return { isDragging, x, y };
}
