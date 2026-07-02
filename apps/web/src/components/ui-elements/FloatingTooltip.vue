<template>
  <slot ref="slotRef" />
  <Teleport to="body">
    <transition name="floating-tooltip">
      <div
        v-if="visible && text"
        class="floating-tooltip"
        :class="{
          'floating-tooltip--right': resolvedPlacement === 'right',
          'floating-tooltip--left': resolvedPlacement === 'left',
          'floating-tooltip--bottom': resolvedPlacement === 'bottom',
        }"
        :style="posStyle"
      >
        {{ text }}
      </div>
    </transition>
  </Teleport>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  onMounted,
  onBeforeUnmount,
  getCurrentInstance,
  type PropType,
} from "vue";

type Placement = "top" | "right" | "bottom" | "left";

const GAP = 6;
const EDGE_MARGIN = 8;

export default defineComponent({
  props: {
    text: {
      type: [String, null] as PropType<string | null | undefined>,
      default: undefined,
    },
    placement: {
      type: String as PropType<Placement>,
      default: "top",
    },
  },
  setup(props) {
    const visible = ref(false);
    const posStyle = ref<Record<string, string>>({});
    // The placement actually used; may differ from props.placement when a
    // horizontal tooltip is flipped to avoid overflowing the viewport edge.
    const resolvedPlacement = ref<Placement>(props.placement);
    let triggerEl: HTMLElement | null = null;

    // Measure the tooltip's rendered width off-screen so we can decide which
    // side to show it on *before* it appears — flipping after render would make
    // it visibly slide across the trigger.
    const measureTooltipWidth = (text: string): number => {
      const probe = document.createElement("div");
      probe.className = "floating-tooltip";
      probe.textContent = text;
      probe.style.position = "fixed";
      probe.style.top = "0";
      probe.style.left = "0";
      probe.style.visibility = "hidden";
      probe.style.transform = "none";
      probe.style.pointerEvents = "none";
      document.body.appendChild(probe);
      const width = probe.offsetWidth;
      probe.remove();
      return width;
    };

    // Pick the side up front: keep the requested side unless a right/left
    // tooltip would overflow the viewport, in which case flip to the opposite.
    const resolvePlacement = (): Placement => {
      if (
        !triggerEl ||
        (props.placement !== "right" && props.placement !== "left")
      ) {
        return props.placement;
      }
      const r = triggerEl.getBoundingClientRect();
      const width = measureTooltipWidth(props.text ?? "");
      if (
        props.placement === "right" &&
        r.right + GAP + width > window.innerWidth - EDGE_MARGIN
      ) {
        return "left";
      }
      if (props.placement === "left" && r.left - GAP - width < EDGE_MARGIN) {
        return "right";
      }
      return props.placement;
    };

    const computePosition = () => {
      if (!triggerEl) return;
      const r = triggerEl.getBoundingClientRect();
      switch (resolvedPlacement.value) {
        case "right":
          posStyle.value = {
            top: `${r.top + r.height / 2}px`,
            left: `${r.right + GAP}px`,
          };
          break;
        case "left":
          posStyle.value = {
            top: `${r.top + r.height / 2}px`,
            left: `${r.left - GAP}px`,
          };
          break;
        case "bottom":
          posStyle.value = {
            top: `${r.bottom + GAP}px`,
            left: `${r.left + r.width / 2}px`,
          };
          break;
        default:
          posStyle.value = {
            top: `${r.top - GAP}px`,
            left: `${r.left + r.width / 2}px`,
          };
      }
    };

    const onEnter = () => {
      if (!triggerEl) return;
      resolvedPlacement.value = resolvePlacement();
      computePosition();
      visible.value = true;
    };

    const onLeave = () => {
      visible.value = false;
    };

    onMounted(() => {
      const instance = getCurrentInstance();
      const el = instance?.vnode.el as HTMLElement | null;
      if (!el) return;
      triggerEl = el.nodeType === Node.ELEMENT_NODE ? el : el.nextElementSibling as HTMLElement;
      if (!triggerEl) return;
      triggerEl.addEventListener("mouseenter", onEnter);
      triggerEl.addEventListener("mouseleave", onLeave);
    });

    onBeforeUnmount(() => {
      if (!triggerEl) return;
      triggerEl.removeEventListener("mouseenter", onEnter);
      triggerEl.removeEventListener("mouseleave", onLeave);
    });

    return { visible, posStyle, resolvedPlacement };
  },
});
</script>

