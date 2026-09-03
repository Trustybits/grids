/**
 * Background preset registry. Each preset renders CSS and/or an inline SVG
 * pattern from a `BackgroundConfig`, plus an optional `@keyframes` block for
 * animated variants. Used by the OG Studio, `BackgroundLayer.vue`, and any
 * tile/grid background that wants one of these presets.
 */

export type BackgroundCategory = "solid" | "gradient" | "image" | "animated" | "pattern";

export type GradientType = "linear" | "radial" | "conic";

export interface GradientStop {
  color: string;
  offset: number; // 0-100
}

export interface BackgroundConfig {
  presetId: string;

  // Solid
  color?: string;

  // Image
  imageUrl?: string;
  imageFit?: "cover" | "contain";
  imageBlur?: number; // px blur
  imageOverlayOpacity?: number; // 0 to 1
  imageOverlayColor?: string; // hex color tint

  // Gradient (linear / radial / conic)
  gradientType?: GradientType;
  stops?: GradientStop[];
  angle?: number; // degrees, linear/conic
  centerX?: number; // %, radial/conic
  centerY?: number; // %, radial/conic

  // Animated presets (aurora/shimmer/spotlight/pulse) reuse `stops`/`color`
  // plus a shared speed knob.
  speed?: number; // seconds per cycle

  // Pattern presets
  patternColor?: string;
  patternBackground?: string;
  patternSize?: number; // px spacing between repeats
  patternStrokeWidth?: number;
  animated?: boolean;
}

export interface BackgroundRenderResult {
  css?: string;
  svgPattern?: string;
  filterDef?: string;
}

export interface BackgroundPreset {
  id: string;
  label: string;
  category: BackgroundCategory;
  render(config: BackgroundConfig): BackgroundRenderResult;
  animation?(config: BackgroundConfig): string;
}

export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  presetId: "solid",
  color: "#18181b",
  imageUrl: "",
  imageFit: "cover",
  imageBlur: 0,
  imageOverlayOpacity: 0.35,
  imageOverlayColor: "#000000",
  gradientType: "linear",
  stops: [
    { color: "#6366f1", offset: 0 },
    { color: "#8b5cf6", offset: 100 },
  ],
  angle: 135,
  centerX: 50,
  centerY: 50,
  speed: 12,
  patternColor: "rgba(255,255,255,0.35)",
  patternBackground: "#18181b",
  patternSize: 28,
  patternStrokeWidth: 1,
  animated: false,
};

function withDefaults(config: BackgroundConfig): Required<BackgroundConfig> {
  return { ...DEFAULT_BACKGROUND_CONFIG, ...config } as Required<BackgroundConfig>;
}

function gradientStopsCss(stops: GradientStop[]): string {
  return stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${s.offset}%`)
    .join(", ");
}

let uidCounter = 0;
function nextUid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

// ─── Solid ──────────────────────────────────────────────────────────────

const solid: BackgroundPreset = {
  id: "solid",
  label: "Solid",
  category: "solid",
  render(config) {
    const c = withDefaults(config);
    return { css: `background: ${c.color};` };
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || "#000000").replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}

const imageBackground: BackgroundPreset = {
  id: "image-background",
  label: "Image",
  category: "image",
  render(config) {
    const c = withDefaults(config);
    const url = c.imageUrl?.trim() || "";
    if (!url) {
      return { css: `background-color: ${c.color || "#18181b"};` };
    }
    const [r, g, b] = hexToRgb(c.imageOverlayColor || "#000000");
    const alpha = c.imageOverlayOpacity ?? 0.35;
    const blur = c.imageBlur ?? 0;
    const fit = c.imageFit ?? "cover";
    const filter = blur > 0 ? `filter: blur(${blur}px);` : "";
    return {
      css: `background: linear-gradient(rgba(${r}, ${g}, ${b}, ${alpha}), rgba(${r}, ${g}, ${b}, ${alpha})), url("${url}"); background-size: ${fit}; background-position: center; background-repeat: no-repeat; ${filter}`,
    };
  },
};

// ─── Gradients ──────────────────────────────────────────────────────────

const linearGradient: BackgroundPreset = {
  id: "linear-gradient",
  label: "Linear Gradient",
  category: "gradient",
  render(config) {
    const c = withDefaults(config);
    const stopsCss = gradientStopsCss(c.stops);
    if (c.animated) {
      return {
        css: `background: linear-gradient(var(--bg-angle, ${c.angle}deg), ${stopsCss}); background-size: 200% 200%; animation: bg-linear-rotate ${c.speed}s linear infinite;`,
      };
    }
    return { css: `background: linear-gradient(${c.angle}deg, ${stopsCss});` };
  },
  animation(config) {
    const c = withDefaults(config);
    return `@keyframes bg-linear-rotate { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`.replace(
      /bg-linear-rotate/g,
      `bg-linear-rotate-${c.speed}`,
    );
  },
};

const radialGradient: BackgroundPreset = {
  id: "radial-gradient",
  label: "Radial Gradient",
  category: "gradient",
  render(config) {
    const c = withDefaults(config);
    const stopsCss = gradientStopsCss(c.stops);
    if (c.animated) {
      return {
        css: `background: radial-gradient(circle at ${c.centerX}% ${c.centerY}%, ${stopsCss}); animation: bg-radial-pulse ${c.speed}s ease-in-out infinite;`,
      };
    }
    return {
      css: `background: radial-gradient(circle at ${c.centerX}% ${c.centerY}%, ${stopsCss});`,
    };
  },
  animation() {
    return `@keyframes bg-radial-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }`;
  },
};

const conicGradient: BackgroundPreset = {
  id: "conic-gradient",
  label: "Conic Gradient",
  category: "gradient",
  render(config) {
    const c = withDefaults(config);
    const stopsCss = gradientStopsCss(c.stops);
    if (c.animated) {
      return {
        css: `background: conic-gradient(from ${c.angle}deg at ${c.centerX}% ${c.centerY}%, ${stopsCss}); animation: bg-conic-spin ${c.speed}s linear infinite;`,
      };
    }
    return {
      css: `background: conic-gradient(from ${c.angle}deg at ${c.centerX}% ${c.centerY}%, ${stopsCss});`,
    };
  },
  animation() {
    return `@keyframes bg-conic-spin { to { filter: hue-rotate(360deg); } }`;
  },
};

// ─── Animated ───────────────────────────────────────────────────────────

const aurora: BackgroundPreset = {
  id: "aurora",
  label: "Aurora",
  category: "animated",
  render(config) {
    const c = withDefaults(config);
    const [a, b, cc] = [c.stops[0]?.color ?? "#6366f1", c.stops[1]?.color ?? "#8b5cf6", c.color];
    return {
      css: `background: ${cc}; background-image:
        radial-gradient(at 20% 30%, ${a} 0px, transparent 55%),
        radial-gradient(at 80% 20%, ${b} 0px, transparent 55%),
        radial-gradient(at 50% 80%, ${a} 0px, transparent 55%);
        background-size: 200% 200%;
        animation: bg-aurora-drift ${c.speed}s ease-in-out infinite;`,
    };
  },
  animation() {
    return `@keyframes bg-aurora-drift {
      0% { background-position: 0% 0%, 100% 0%, 50% 100%; }
      50% { background-position: 100% 50%, 0% 100%, 50% 0%; }
      100% { background-position: 0% 0%, 100% 0%, 50% 100%; }
    }`;
  },
};

const shimmer: BackgroundPreset = {
  id: "shimmer",
  label: "Shimmer",
  category: "animated",
  render(config) {
    const c = withDefaults(config);
    const stopsCss = gradientStopsCss(c.stops);
    return {
      css: `background: ${c.color}; background-image: linear-gradient(115deg, transparent 35%, ${stopsCss.split(",")[0] ?? "rgba(255,255,255,0.4)"} 50%, transparent 65%);
        background-size: 250% 250%;
        animation: bg-shimmer-sweep ${c.speed}s linear infinite;`,
    };
  },
  animation() {
    return `@keyframes bg-shimmer-sweep {
      0% { background-position: -100% -100%; }
      100% { background-position: 100% 100%; }
    }`;
  },
};

const spotlight: BackgroundPreset = {
  id: "spotlight",
  label: "Spotlight",
  category: "animated",
  render(config) {
    const c = withDefaults(config);
    const highlight = c.stops[0]?.color ?? "rgba(255,255,255,0.25)";
    return {
      css: `background: ${c.color}; background-image: radial-gradient(circle at 50% 50%, ${highlight}, transparent 45%);
        animation: bg-spotlight-drift ${c.speed}s ease-in-out infinite;`,
    };
  },
  animation() {
    return `@keyframes bg-spotlight-drift {
      0% { background-position: 20% 30%; }
      25% { background-position: 75% 20%; }
      50% { background-position: 80% 75%; }
      75% { background-position: 25% 70%; }
      100% { background-position: 20% 30%; }
    }`;
  },
};

const pulse: BackgroundPreset = {
  id: "pulse",
  label: "Pulse",
  category: "animated",
  render(config) {
    const c = withDefaults(config);
    const inner = c.stops[0]?.color ?? c.color;
    const outer = c.stops[1]?.color ?? c.color;
    return {
      css: `background: radial-gradient(circle at ${c.centerX}% ${c.centerY}%, ${inner}, ${outer});
        animation: bg-pulse-breathe ${c.speed}s ease-in-out infinite;`,
    };
  },
  animation() {
    return `@keyframes bg-pulse-breathe {
      0%, 100% { filter: brightness(1); background-size: 100% 100%; }
      50% { filter: brightness(1.15); background-size: 130% 130%; }
    }`;
  },
};

// ─── Patterns ───────────────────────────────────────────────────────────

function patternWrapper(
  id: string,
  size: number,
  animated: boolean,
  speed: number,
  body: string,
  bgColor = "#18181b",
  extraDefs = "",
): BackgroundRenderResult {
  const animAttr = animated
    ? `<animateTransform attributeName="patternTransform" type="translate" from="0 0" to="${size} ${size}" dur="${speed}s" repeatCount="indefinite" />`
    : "";
  return {
    css: `background-color: ${bgColor};`,
    svgPattern: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <pattern id="${id}" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
          ${animAttr}
          ${body}
        </pattern>
        ${extraDefs}
      </defs>
      <rect width="100%" height="100%" fill="${bgColor}" />
      <rect width="100%" height="100%" fill="url(#${id})" />
    </svg>`,
  };
}

const dotGrid: BackgroundPreset = {
  id: "dot-grid",
  label: "Dot Grid",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const id = nextUid("dots");
    const r = Math.max(1, c.patternStrokeWidth * 1.5);
    return patternWrapper(
      id,
      c.patternSize,
      c.animated,
      c.speed,
      `<circle cx="${c.patternSize / 2}" cy="${c.patternSize / 2}" r="${r}" fill="${c.patternColor}" />`,
      c.patternBackground || "#18181b",
    );
  },
};

const lineGrid: BackgroundPreset = {
  id: "line-grid",
  label: "Line Grid",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const id = nextUid("lines");
    const s = c.patternSize;
    const sw = c.patternStrokeWidth;
    const body = `
      <line x1="0" y1="0" x2="${s}" y2="0" stroke="${c.patternColor}" stroke-width="${sw}" />
      <line x1="0" y1="0" x2="0" y2="${s}" stroke="${c.patternColor}" stroke-width="${sw}" />
    `;
    return patternWrapper(id, s, c.animated, c.speed, body, c.patternBackground || "#18181b");
  },
};

const lineGridDiagonal: BackgroundPreset = {
  id: "line-grid-diagonal",
  label: "Diagonal Lines",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const id = nextUid("diag");
    const s = c.patternSize;
    const sw = c.patternStrokeWidth;
    return patternWrapper(
      id,
      s,
      c.animated,
      c.speed,
      `<line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${c.patternColor}" stroke-width="${sw}" />`,
      c.patternBackground || "#18181b",
    );
  },
};

const crosshatch: BackgroundPreset = {
  id: "crosshatch",
  label: "Crosshatch",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const id = nextUid("cross");
    const s = c.patternSize;
    const sw = c.patternStrokeWidth;
    const body = `
      <line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${c.patternColor}" stroke-width="${sw}" />
      <line x1="0" y1="0" x2="${s}" y2="${s}" stroke="${c.patternColor}" stroke-width="${sw}" />
    `;
    return patternWrapper(id, s, c.animated, c.speed, body, c.patternBackground || "#18181b");
  },
};

const hexagons: BackgroundPreset = {
  id: "hexagons",
  label: "Hexagons",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const id = nextUid("hex");
    const s = c.patternSize;
    const sw = c.patternStrokeWidth;
    // Flat-top hexagon points scaled to the pattern tile.
    const w = s;
    const h = s * 1.1547; // s / cos(30deg)
    const points = [
      [w * 0.25, 0],
      [w * 0.75, 0],
      [w, h * 0.5],
      [w * 0.75, h],
      [w * 0.25, h],
      [0, h * 0.5],
    ]
      .map((p) => p.join(","))
      .join(" ");
    return patternWrapper(
      id,
      s,
      c.animated,
      c.speed,
      `<polygon points="${points}" fill="none" stroke="${c.patternColor}" stroke-width="${sw}" />`,
      c.patternBackground || "#18181b",
    );
  },
};

const plusCross: BackgroundPreset = {
  id: "plus-cross",
  label: "Plus / Cross",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const id = nextUid("plus");
    const s = c.patternSize;
    const armLen = s * 0.28;
    const armThick = Math.max(1, c.patternStrokeWidth * 1.5);
    const cx = s / 2;
    const cy = s / 2;
    const body = `
      <rect x="${cx - armThick / 2}" y="${cy - armLen / 2}" width="${armThick}" height="${armLen}" fill="${c.patternColor}" />
      <rect x="${cx - armLen / 2}" y="${cy - armThick / 2}" width="${armLen}" height="${armThick}" fill="${c.patternColor}" />
    `;
    return patternWrapper(id, s, c.animated, c.speed, body, c.patternBackground || "#18181b");
  },
};

const triangles: BackgroundPreset = {
  id: "triangles",
  label: "Triangles",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const id = nextUid("tri");
    const s = c.patternSize;
    const points = [
      [s / 2, 0],
      [s, s],
      [0, s],
    ]
      .map((p) => p.join(","))
      .join(" ");
    return patternWrapper(
      id,
      s,
      c.animated,
      c.speed,
      `<polygon points="${points}" fill="none" stroke="${c.patternColor}" stroke-width="${c.patternStrokeWidth}" />`,
      c.patternBackground || "#18181b",
    );
  },
};

const noiseGrain: BackgroundPreset = {
  id: "noise-grain",
  label: "Noise / Grain",
  category: "pattern",
  render(config) {
    const c = withDefaults(config);
    const filterId = nextUid("noise");
    const freq = 0.9;
    const animAttr = c.animated
      ? `<animate attributeName="baseFrequency" values="${freq};${freq * 1.6};${freq}" dur="${c.speed}s" repeatCount="indefinite" />`
      : "";
    return {
      css: `background-color: ${c.patternBackground};`,
      filterDef: `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">
        <filter id="${filterId}">
          <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch">
            ${animAttr}
          </feTurbulence>
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0" />
        </filter>
      </svg>`,
      svgPattern: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <rect width="100%" height="100%" fill="${c.patternBackground || "#18181b"}" />
        <rect width="100%" height="100%" filter="url(#${filterId})" />
      </svg>`,
    };
  },
};

// ─── Registry ───────────────────────────────────────────────────────────

const PRESETS: BackgroundPreset[] = [
  solid,
  linearGradient,
  radialGradient,
  conicGradient,
  imageBackground,
  aurora,
  shimmer,
  spotlight,
  pulse,
  dotGrid,
  lineGrid,
  lineGridDiagonal,
  crosshatch,
  hexagons,
  plusCross,
  triangles,
  noiseGrain,
];

const registry = new Map<string, BackgroundPreset>(PRESETS.map((p) => [p.id, p]));

export function getBackgroundPreset(id: string): BackgroundPreset | undefined {
  return registry.get(id);
}

export function getAllBackgroundPresets(): BackgroundPreset[] {
  return PRESETS.slice();
}

export function getBackgroundPresetsByCategory(
  category: BackgroundCategory,
): BackgroundPreset[] {
  return PRESETS.filter((p) => p.category === category);
}

export function renderBackground(config: BackgroundConfig): BackgroundRenderResult {
  const preset = getBackgroundPreset(config.presetId) ?? solid;
  return preset.render(config);
}
