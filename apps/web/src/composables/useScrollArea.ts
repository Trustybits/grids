import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

/**
 * Tracks a scroll container's reserved scrollbar gutter width (it depends on
 * the platform and zoom level, so it is measured rather than assumed) and
 * whether its content currently overflows. Content that grows later, such as
 * images finishing loading, is picked up through the container's first child.
 */
export function useScrollArea(el: Ref<HTMLElement | null>): {
  gutter: Ref<number>;
  isOverflowing: Ref<boolean>;
} {
  const gutter = ref(0);
  const isOverflowing = ref(false);
  let observer: ResizeObserver | null = null;

  const measure = () => {
    const node = el.value;
    gutter.value = node ? node.offsetWidth - node.clientWidth : 0;
    isOverflowing.value = node ? node.scrollHeight > node.clientHeight + 1 : false;
  };

  const observe = () => {
    observer?.disconnect();
    const node = el.value;
    if (!node || typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
  };

  watch(
    el,
    () => {
      measure();
      observe();
    },
    { flush: "post" },
  );
  onMounted(() => {
    measure();
    observe();
    window.addEventListener("resize", measure);
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener("resize", measure);
  });

  return { gutter, isOverflowing };
}
