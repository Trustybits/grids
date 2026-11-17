<!--
  MobileToolButton.vue

  One tool in the phone toolbar (Figma "Toolbar / Tool", 161:12283): a 58×64
  tile with a 21px icon over a 10px label, in one of four states —

    default   white icon, label at 90%
    selected  its popover is open: see-through grey background (never the
              solid Figma grey) and the active primary color
    on        a toggle that is enabled (Border shown, link set): primary tint
    danger    destructive (Delete): red
    mixed     multi-edit, the tiles disagree: a half tint and a small dash
              under the icon

  Renders an <a> when given `href`, so Open is a real link the phone follows
  without a popup blocker getting in the way.
-->
<template>
  <component
    :is="href ? 'a' : 'button'"
    class="mtb"
    :class="[`mtb--${state}`, { 'mtb--disabled': disabled }]"
    :type="href ? undefined : 'button'"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
    :aria-pressed="
      state === 'mixed'
        ? 'mixed'
        : state === 'on' || state === 'selected'
          ? 'true'
          : undefined
    "
    :aria-disabled="disabled ? 'true' : undefined"
    :data-tool-id="toolId"
    @click="onClick"
  >
    <MobileToolIcon :name="icon" />
    <span class="mtb__label">{{ label }}</span>
  </component>
</template>

<script setup lang="ts">
import MobileToolIcon from "./MobileToolIcon.vue";

export type MobileToolState =
  | "default"
  | "selected"
  | "on"
  | "danger"
  | "mixed";

const props = withDefaults(
  defineProps<{
    toolId: string;
    icon: string;
    label: string;
    state?: MobileToolState;
    href?: string;
    disabled?: boolean;
  }>(),
  { state: "default", href: undefined, disabled: false },
);

const emit = defineEmits<{ select: [] }>();

const onClick = (event: MouseEvent) => {
  if (props.disabled) {
    event.preventDefault();
    return;
  }
  emit("select");
};
</script>

<style scoped>
.mtb {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 58px;
  height: 64px;
  padding: 0;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--color-text-primary);
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth),
    transform var(--duration-instant) var(--easing-smooth);
}

.mtb:active {
  transform: scale(0.94);
}

.mtb__label {
  font-family: "Inter", sans-serif;
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: var(--color-content-high);
}

.mtb--selected {
  background: var(--color-tool-selected-bg);
  color: var(--color-tool-active);
}

.mtb--selected .mtb__label {
  color: var(--color-text-primary);
}

.mtb--on {
  background: var(--color-tool-on-bg);
  color: var(--color-tool-on);
}

.mtb--on .mtb__label {
  color: var(--color-tool-on);
}

.mtb--mixed {
  position: relative;
  background: color-mix(in srgb, var(--color-tool-on-bg) 50%, transparent);
}

/* The dash under the icon that says "some on, some off". */
.mtb--mixed::after {
  content: "";
  position: absolute;
  top: 34px;
  left: 50%;
  width: 10px;
  height: 2px;
  border-radius: 1px;
  background: var(--color-tool-on);
  transform: translateX(-50%);
}

.mtb--danger,
.mtb--danger .mtb__label {
  color: var(--color-tool-danger);
}

.mtb--disabled {
  opacity: 0.35;
  cursor: default;
}

.mtb:focus-visible {
  outline: 2px solid var(--color-tool-active);
  outline-offset: -2px;
}
</style>
