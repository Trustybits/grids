<template>
  <slot ref="slotRef" />
  <Teleport to="body">
    <transition name="floating-tooltip">
      <div
        v-if="visible && text"
        class="floating-tooltip"
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

export default defineComponent({
  props: {
    text: {
      type: [String, null] as PropType<string | null | undefined>,
      default: undefined,
    },
  },
  setup() {
    const visible = ref(false);
    const posStyle = ref<Record<string, string>>({});
    let triggerEl: HTMLElement | null = null;

    const onEnter = () => {
      if (!triggerEl) return;
      const r = triggerEl.getBoundingClientRect();
      const gap = 6;
      posStyle.value = {
        top: `${r.top - gap}px`,
        left: `${r.left + r.width / 2}px`,
      };
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

    return { visible, posStyle };
  },
});
</script>

<style>
.floating-tooltip {
  position: fixed;
  transform: translateX(-50%) translateY(-100%);
  white-space: nowrap;
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
  pointer-events: none;
  z-index: var(--z-tooltip);
}

.floating-tooltip-enter-active,
.floating-tooltip-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing-ease-out),
    transform var(--duration-fast) var(--easing-ease-out);
}

.floating-tooltip-enter-from,
.floating-tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%) scale(0.9);
}
</style>
