<template>
  <slot ref="slotRef" />
  <Teleport to="body">
    <transition name="floating-tooltip">
      <div
        v-if="visible && text"
        class="floating-tooltip"
        :class="{
          'floating-tooltip--right': placement === 'right',
          'floating-tooltip--bottom': placement === 'bottom',
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

export default defineComponent({
  props: {
    text: {
      type: [String, null] as PropType<string | null | undefined>,
      default: undefined,
    },
    placement: {
      type: String as PropType<"top" | "right" | "bottom">,
      default: "top",
    },
  },
  setup(props) {
    const visible = ref(false);
    const posStyle = ref<Record<string, string>>({});
    let triggerEl: HTMLElement | null = null;

    const onEnter = () => {
      if (!triggerEl) return;
      const r = triggerEl.getBoundingClientRect();
      const gap = 6;
      if (props.placement === "right") {
        posStyle.value = {
          top: `${r.top + r.height / 2}px`,
          left: `${r.right + gap}px`,
        };
      } else if (props.placement === "bottom") {
        posStyle.value = {
          top: `${r.bottom + gap}px`,
          left: `${r.left + r.width / 2}px`,
        };
      } else {
        posStyle.value = {
          top: `${r.top - gap}px`,
          left: `${r.left + r.width / 2}px`,
        };
      }
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

