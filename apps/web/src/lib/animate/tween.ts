/**
 * Lightweight tweening. Pure functions, no dependencies — drives numeric
 * object properties over time via requestAnimationFrame.
 */

export type EasingFn = (t: number) => number;

export const ease: Record<string, EasingFn> = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) ** 2,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t ** 3,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) =>
    t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  inElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * c4);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export interface TweenOptions {
  from: Record<string, number>;
  to: Record<string, number>;
  duration: number;
  easing?: EasingFn;
  onUpdate: (values: Record<string, number>) => void;
  onComplete?: () => void;
}

export interface TweenHandle {
  cancel: () => void;
}

export function tween(opts: TweenOptions): TweenHandle {
  const { from, to, duration, easing = ease.linear, onUpdate, onComplete } = opts;
  const keys = Object.keys(to);
  let rafId: number | null = null;
  let cancelled = false;
  const start = performance.now();

  const step = (now: number) => {
    if (cancelled) return;
    const elapsed = now - start;
    const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
    const eased = easing(t);

    const values: Record<string, number> = {};
    for (const key of keys) {
      values[key] = lerp(from[key] ?? 0, to[key], eased);
    }
    onUpdate(values);

    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  };

  rafId = requestAnimationFrame(step);

  return {
    cancel: () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}

export interface TweenStep {
  from: Record<string, number>;
  to: Record<string, number>;
  duration: number;
  easing?: EasingFn;
  onUpdate: (values: Record<string, number>) => void;
  onComplete?: () => void;
}

export interface TimelineHandle {
  cancel: () => void;
  play: () => void;
}

export function timeline(steps: TweenStep[]): TimelineHandle {
  let cancelled = false;
  let current: TweenHandle | null = null;

  const runStep = (index: number) => {
    if (cancelled || index >= steps.length) return;
    const step = steps[index];
    current = tween({
      ...step,
      onComplete: () => {
        step.onComplete?.();
        runStep(index + 1);
      },
    });
  };

  return {
    play: () => {
      cancelled = false;
      runStep(0);
    },
    cancel: () => {
      cancelled = true;
      current?.cancel();
    },
  };
}
