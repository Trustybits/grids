# Contributing Tiles to TrustyBits Grids

This guide walks you through everything you need to add a new tile type to the project so it integrates cleanly with the existing system.

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
- Default new tile size: **2 wide × 2 tall** (the `addTile` method in the layout store handles placement)

---

## Architecture at a Glance

```
src/
├── types/
│   ├── Tile.ts            # Tile interface (i, x, y, w, h, content, caption)
│   └── TileContent.ts     # ContentType enum + per-type content interfaces
├── utils/
│   └── TileUtils.ts       # createTileContent(), getContentComponent(), validateTileContent()
├── components/
│   ├── GridTile.vue        # Shell that wraps every tile (drag, resize, toolbar, caption)
│   └── tilecontent/        # One Vue component per tile type
│       ├── TextContent.vue
│       ├── ImageContent.vue
│       ├── ClickerContent.vue
│       ├── ...             # 14 tile types today
├── stores/
│   └── layout.ts           # Pinia store: addTile(), patchTileContent(), saveLayout()
└── styles/
    ├── tokens.scss          # Design tokens (spacing, radius, shadows, typography)
    └── themes.scss          # Light / dark theme CSS custom properties
```

### How a tile renders

1. `Grid.vue` iterates the grid's `tiles[]` array and renders a `<GridTile>` for each.
2. `GridTile.vue` calls `getContentComponent(tile.content)` from `TileUtils.ts` to resolve the async component.
3. The resolved component (e.g. `ClickerContent.vue`) receives `content` as a prop.
4. `GridTile` also **provides** via Vue's provide/inject:
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

### 1. Define the content type enum value

In `src/types/TileContent.ts`, add a new member to the `ContentType` enum:

```ts
export enum ContentType {
  // ... existing types ...
  MY_NEW_TILE = "my_new_tile",
}
```

### 2. Define the content interface

In the same file, create an interface that extends `TileContent`:

```ts
export interface MyNewTileContent extends TileContent {
  type: ContentType.MY_NEW_TILE;
  // Add whatever data your tile needs to persist:
  someValue: string;
  someNumber: number;
}
```

Then add it to the `AnyTileContent` union at the bottom of the file:

```ts
export type AnyTileContent =
  | TextContent
  // ... existing types ...
  | MyNewTileContent;
```

### 3. Register the content factory

In `src/utils/TileUtils.ts`, do **three** things:

#### a) Import your new type

```ts
import {
  // ... existing imports ...
  type MyNewTileContent,
} from "@/types/TileContent";
```

#### b) Add a case to `createTileContent()`

This factory provides sensible defaults when the tile is first created:

```ts
case ContentType.MY_NEW_TILE:
  return {
    type,
    someValue: (data as Partial<MyNewTileContent>).someValue || "",
    someNumber: (data as Partial<MyNewTileContent>).someNumber ?? 0,
  } as MyNewTileContent;
```

#### c) Add a case to `validateTileContent()`

Return `true` if the content is in a valid, renderable state:

```ts
case ContentType.MY_NEW_TILE:
  return true; // or real validation
```

#### d) Add a case to `getContentComponent()`

Point to your new Vue component (use async import for code-splitting):

```ts
case ContentType.MY_NEW_TILE:
  return markRaw(
    defineAsyncComponent(
      () => import("@/components/tilecontent/MyNewTileContent.vue"),
    ),
  );
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

    // The tile's unique ID — use this for patchTileContent calls
    const tileId = inject<string | null>("tileId", null);

    // Current grid dimensions (in cells) — useful for responsive layouts
    const gridW = inject<import("vue").ComputedRef<number>>("gridTileW");
    const gridH = inject<import("vue").ComputedRef<number>>("gridTileH");

    // Example: updating persisted state
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

### 5. (Optional) Hide the caption

If your tile handles its own header/label, add its `ContentType` to the `hiddenTypes` array in `GridTile.vue` (around line 253):

```ts
const hiddenTypes = [
  // ... existing types ...
  ContentType.MY_NEW_TILE,
];
```

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

When submitting a new tile, make sure you've touched all of these:

- [ ] `src/types/TileContent.ts` — enum value + content interface + union type
- [ ] `src/utils/TileUtils.ts` — `createTileContent()` + `validateTileContent()` + `getContentComponent()` (and add to the import + type union in the function signature)
- [ ] `src/components/tilecontent/YourContent.vue` — the actual component
- [ ] (If applicable) `GridTile.vue` `hiddenTypes` array — if you don't want the default caption
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
| `ClickerContent.vue` | Simple | Firebase real-time subs, leaderboard drawer, cleanup |
| `TextContent.vue` | Medium | TipTap editor, inject tileId, auto-focus, colour picker |
| `MapContent.vue` | Complex | External library (Mapbox), canonical store lookup |
| `MusicContent.vue` | Complex | Multi-platform embed, size-responsive layout |
| `CampfireContent.vue` | Simple | Game state, minimal persisted data |

Start by reading `ClickerContent.vue` — it's the simplest end-to-end example of a tile with interaction and Firestore persistence.
