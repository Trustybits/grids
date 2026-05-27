# Contributing Tiles to TrustyBits Grids

This guide walks you through adding a new tile type to the project.

---

## Project Overview

**TrustyBits Grids** is a Vue 3 + TypeScript app that lets users build customisable grid pages (think link-in-bio on steroids). Each grid is a collection of **tiles** arranged on a drag-and-drop canvas powered by `vue3-grid-layout`.

| Layer | Tech |
|---|---|
| Framework | Vue 3 (Composition API / `defineComponent`) |
| State | Pinia (`src/stores/grid.ts`) |
| Styling | Scoped SCSS with design tokens (`src/styles/tokens.scss`, `src/styles/themes.scss`) |
| Backend | Firebase (Firestore for persistence, Cloud Functions in `functions/`) |
| Build | Vite |

### Grid Unit System

- **1 cell = 75 px**, gap = 48 px
- Tile pixel size: `n × 123 − 48` (e.g. a 2×2 tile = 198 × 198 px)
- Default new tile size: **2 wide × 2 tall** (configurable per tile type via `defaultSize`)

---

## Architecture at a Glance

```
src/
├── types/
│   ├── Tile.ts              # Tile interface (i, x, y, w, h, content, caption)
│   ├── TileContent.ts       # ContentType enum + per-type content interfaces
│   └── TileDefinition.ts    # TileDefinition interface (the registry contract)
├── registries/
│   ├── tileRegistry.ts      # Central registry: Map<ContentType, TileDefinition>
│   ├── tileToolbar/         # Modular toolbar button definitions
│   │   ├── baseButtons.ts             # Resize presets, border toggle, color button
│   │   ├── sharedCropButton.ts        # Crop/zoom button (image & video tiles)
│   │   ├── sharedTileLinkButton.ts    # Tile link button (image & video tiles)
│   │   ├── mapButtons.ts     # Map-specific buttons (pan, search, recenter, etc.)
│   │   ├── linkButtons.ts    # Link tile buttons (background toggle, more menu)
│   │   ├── textButtons.ts    # Text tile buttons (align, more menu)
│   │   └── index.ts          # Re-exports all + getTileToolbarButtons()
│   └── tiles/               # One definition file per tile type
│       ├── index.ts          # Registers all tiles on import
│       ├── text.ts
│       ├── image.ts
│       ├── chat.ts
│       └── ...
├── components/
│   ├── grid/
│   │   ├── Grid.vue          # Layout engine
│   │   └── Tile.vue          # Shell that wraps every tile (drag, resize, toolbar, caption)
│   └── tilecontent/          # One Vue component per tile type
│       ├── TextContent.vue
│       ├── ImageContent.vue
│       └── ...
├── stores/
│   └── grid.ts              # Pinia store: addTile(), patchTileContent(), etc.
└── styles/
    ├── tokens.scss           # Design tokens (spacing, radius, shadows, typography)
    └── themes.scss           # Light / dark theme CSS custom properties
```

### How a tile renders

1. `Grid.vue` iterates the grid's `tiles[]` array and renders a `<Tile>` for each.
2. `Tile.vue` calls `getContentComponent(tile.content)` which looks up the tile's `component` from the registry.
3. The resolved component (e.g. `ImageContent.vue`) receives `content` as a prop (plus any `extraProps` declared in the definition).
4. `Tile.vue` also **provides** via Vue's provide/inject:
   - `"tileId"` — the tile's unique `i` string
   - `"gridTileW"` / `"gridTileH"` — reactive computed refs of the tile's current grid width/height
   - `"tileX"` / `"tileY"` — reactive position

### How state flows

- The **grid store** (`src/stores/grid.ts`) holds `currentGrid` which contains a `tiles: Tile[]` array.
- To update your tile's persisted data, call `gridStore.patchTileContent(tileId, { ...partialUpdate })`.
- `saveGrid()` deep-clones the tiles, strips Vue reactivity, and writes to Firestore.
- **Important:** `props.content` in your component is a deep copy (vue3-grid-layout clones layout items). If you need the canonical store object, look up the tile by ID in `gridStore.currentGrid.tiles`.

---

## Step-by-Step: Adding a New Tile Type

### 1. Define the content type and interface

In `src/types/TileContent.ts`:

```ts
// Add to the ContentType enum
export enum ContentType {
  // ... existing types ...
  MY_NEW_TILE = "my_new_tile",
}

// Define the content interface
export interface MyNewTileContent extends TileContent {
  type: ContentType.MY_NEW_TILE;
  someValue: string;
  someNumber: number;
}

// Add to AnyTileContent union at the bottom
export type AnyTileContent =
  | TextContent
  // ... existing types ...
  | MyNewTileContent;
```

### 2. Create the tile definition

Create `src/registries/tiles/myNewTile.ts`:

```ts
import { ContentType, type MyNewTileContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE } from "@/registries/tileToolbar/baseButtons";

export const myNewTileDefinition: TileDefinition<MyNewTileContent> = {
  type: ContentType.MY_NEW_TILE,
  label: "My New Tile",
  category: "utility",

  // Async import for code-splitting
  component: () => import("@/components/tilecontent/MyNewTileContent.vue"),

  // Factory: returns sensible defaults when the tile is first created
  defaultContent: (data) => ({
    type: ContentType.MY_NEW_TILE,
    someValue: data?.someValue || "",
    someNumber: data?.someNumber ?? 0,
  }),

  // Return true when the content is in a valid, renderable state
  validate: (content) => content.someValue.length > 0,

  // Shell behavior flags (all default to true if omitted)
  capabilities: {
    caption: true,       // Show caption below tile
    border: true,        // Support border toggle
    // tileLink: false,  // Uncomment to support click-through link
  },

  // Optional: declare color theming support
  colorTheming: {
    backgroundColor: true,
  },

  // What kind of editing does this tile support?
  editMode: "fields",  // "richtext" | "crop" | "fields" | "interactive" | "composer" | "settings" | "none"

  // Optional: what shows up in TileActions (top-right corner)
  actions: {
    externalUrl: (content) => null,       // "Follow link" button
    copyContent: (content) => null,       // "Copy" button
    downloadUrl: (content) => null,       // "Download" button
  },

  // Toolbar buttons (bottom bar when selected)
  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE],

  // Optional: extra props passed to the component beyond `content`
  // extraProps: (tile) => ({ tileId: tile.i }),

  // Optional: max instances per grid (e.g. 1 for campfire)
  // maxPerGrid: 1,

  // Optional: custom default size (default is 2x2)
  // defaultSize: { w: 4, h: 4 },

  // Optional: gate behind a feature flag
  // featureFlag: "beta-my-new-tile",

  // Optional: claim URLs from paste/embed routing
  // matchUrl: (url) => url.includes("example.com"),
  // parseUrl: (url) => ({ someValue: url }),
};
```

### 3. Register the definition

In `src/registries/tiles/index.ts`, add:

```ts
import { myNewTileDefinition } from "./myNewTile";

// Inside registerAllTiles():
registerTile(myNewTileDefinition);
```

### 4. Create the Vue component

Create `src/components/tilecontent/MyNewTileContent.vue`:

```vue
<template>
  <div class="my-tile-container">
    <!-- Your tile UI here -->
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, computed } from "vue";
import type { MyNewTileContent } from "@/types/TileContent";
import { useGridStore } from "@/stores/grid";

export default defineComponent({
  props: {
    content: {
      type: Object as () => MyNewTileContent,
      required: true,
    },
  },
  setup(props) {
    const gridStore = useGridStore();
    const tileId = inject<string | null>("tileId", null);
    const gridW = inject<import("vue").ComputedRef<number>>("gridTileW");
    const gridH = inject<import("vue").ComputedRef<number>>("gridTileH");

    const updateValue = (newVal: string) => {
      if (!tileId || !gridStore.canEdit) return;
      gridStore.patchTileContent(tileId, { someValue: newVal });
    };

    return { updateValue };
  },
});
</script>

<style scoped lang="scss">
.my-tile-container {
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
</style>
```

That's it. The registry handles component resolution, content factory, validation, caption visibility, toolbar, tile actions, and size defaults automatically.

---

## TileDefinition Reference

| Field | Required | Purpose |
|-------|----------|---------|
| `type` | Yes | `ContentType` enum value |
| `label` | Yes | Human-readable name for UI and toasts |
| `category` | No | `"media"` / `"text"` / `"social"` / `"embed"` / `"utility"` / `"game"` |
| `featureFlag` | No | PostHog flag key — tile is hidden in add-menu when disabled |
| `component` | Yes | `() => import(...)` for the Vue component |
| `defaultContent` | Yes | Factory function returning default content |
| `validate` | Yes | Returns true when content is renderable |
| `defaultSize` | No | `{ w, h }` — defaults to `{ w: 2, h: 2 }` |
| `capabilities` | Yes | `{ caption?, border?, tileLink?, duplicate?, resizable? }` |
| `colorTheming` | No | `{ backgroundColor?, textColor? }` |
| `editMode` | No | What editing means for this tile |
| `actions` | No | Functions for copy/download/external-link buttons |
| `toolbar` | No | Array of `ToolbarItem` objects |
| `extraProps` | No | Additional props passed to the component |
| `maxPerGrid` | No | Limit instances per grid |
| `matchUrl` | No | Claim URLs from paste/embed routing |
| `parseUrl` | No | Extract content fields from a matched URL |

---

## Styling Guidelines

### Use design tokens — don't hard-code values

| Token | Example values |
|---|---|
| `--spacing-xs` through `--spacing-4xl` | 4px → 80px |
| `--radius-sm` through `--radius-full` | 8px → 9999px |
| `--color-text-primary` | Adapts to light/dark theme |
| `--color-content-high / default / low` | Semantic text opacity levels |
| `--color-tile-background` | Tile surface color |
| `--transition-fast / normal / slow` | 150ms / 250ms / 400ms ease-in-out |
| `--font-family-base` / `--font-family-mono` | System font stacks |

### Theme awareness

The app has **light** and **dark** themes (`themes.scss`). All `--color-*` tokens switch automatically. Never hard-code colors like `#fff` or `#000` — use the semantic tokens so your tile looks correct in both themes.

### Scoped styles

Always use `<style scoped lang="scss">` so your styles don't leak into other tiles.

---

## Common Patterns & Gotchas

### Persisting state

```ts
// Good — goes through the store and triggers Firestore save
gridStore.patchTileContent(tileId, { someValue: "new" });

// Bad — mutates the deep copy, lost on next layout rebuild
props.content.someValue = "new";
```

### Reading canonical store data

If you need to read the latest persisted state (not the display copy), resolve it from the store:

```ts
const storeContent = computed(() => {
  const tile = gridStore.currentGrid?.tiles.find(t => t.i === tileId);
  return tile?.content as MyNewTileContent | undefined;
});
```

### Owner vs visitor

Check `gridStore.canEdit` before showing edit controls. Visitors can interact with the tile (click, view) but should not be able to modify persisted content.

### Responsive layout

Use the injected `gridTileW` / `gridTileH` to adapt your UI to different tile sizes. The tile container always fills 100% width/height — you control internal layout.

### Cleanup

If your tile sets up subscriptions, timers, or event listeners, clean them up in `onUnmounted`.

---

## Checklist

When submitting a new tile, make sure you've done:

- [ ] `src/types/TileContent.ts` — enum value + content interface + union type
- [ ] `src/registries/tiles/yourTile.ts` — tile definition (factory, validation, toolbar, capabilities)
- [ ] `src/registries/tiles/index.ts` — import and register your definition
- [ ] `src/components/tilecontent/YourContent.vue` — the actual component
- [ ] Uses design tokens from `tokens.scss` for spacing, radii, colours
- [ ] Works in both light and dark theme
- [ ] Uses `<style scoped lang="scss">`
- [ ] Persists state via `patchTileContent`, not direct prop mutation
- [ ] Cleans up listeners/timers in `onUnmounted`
- [ ] `gridStore.canEdit` gated for any edit affordances

---

## Existing Tiles for Reference

| Tile | Complexity | Good example of |
|---|---|---|
| `CampfireContent.vue` | Simple | Game state, minimal persisted data, `maxPerGrid` constraint |
| `TextContent.vue` | Medium | TipTap editor, inject tileId, auto-focus, colour picker |
| `MapContent.vue` | Complex | External library (Mapbox), canonical store lookup |
| `MusicContent.vue` | Complex | Multi-platform embed, size-responsive layout, URL matching |
| `YouTubeContent.vue` | Medium | Metadata enrichment, external URL action |

Start by reading `CampfireContent.vue` — it's the simplest end-to-end example of a tile with interaction and Firestore persistence.
