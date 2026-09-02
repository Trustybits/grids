export { ease, lerp, tween, timeline } from "./tween";
export type { EasingFn, TweenOptions, TweenHandle, TweenStep, TimelineHandle } from "./tween";

export {
  DEFAULT_BACKGROUND_CONFIG,
  getBackgroundPreset,
  getAllBackgroundPresets,
  getBackgroundPresetsByCategory,
  renderBackground,
} from "./backgrounds";
export type {
  BackgroundCategory,
  GradientType,
  GradientStop,
  BackgroundConfig,
  BackgroundRenderResult,
  BackgroundPreset,
} from "./backgrounds";

export { useAnimatedBackground } from "./useAnimatedBackground";
export { useDraggable } from "./draggable";
export type {
  DraggablePosition,
  DraggableMoveEvent,
  UseDraggableOptions,
  UseDraggableReturn,
} from "./draggable";

export { default as BackgroundLayer } from "./BackgroundLayer.vue";
