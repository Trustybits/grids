# Contributing Tiles to Grids

This guide walks through adding a new tile type to the Grids web app.

For the higher-level architecture, see [docs/architecture/tiles.md](../../docs/architecture/tiles.md).

## Current Tile Architecture

Tiles are defined across two workspaces:

```text
packages/contracts/src/types/
  TileContent.ts        ContentType enum, per-type content interfaces, AnyTileContent
  Tile.ts               Shared Tile shape

apps/web/src/
  types/TileDefinition.ts         TileDefinition registry contract
  registries/tileRegistry.ts      Runtime registry keyed by ContentType
  registries/tiles/               One definition file per tile type
  registries/tileToolbar/         Shared toolbar button definitions
  components/grid/Tile.vue        Tile shell
  components/tilecontent/         Tile content components
  stores/grid.ts                  addTile, patchTileContent, saveGrid, layout updates
  utils/TileUtils.ts              createTileContent, validateTileContent, URL routing helpers
```

Tile content types live in `@grids/contracts` because tile data is persisted user data and may be shared across app/runtime boundaries. App-only registry behavior lives in `apps/web`.

## Existing Tile Types

`ContentType` currently includes:

- `TEXT`
- `SMART_TEXT`
- `CHAT`
- `IMAGE`
- `VIDEO`
- `LINK`
- `EMBED`
- `MAP`
- `CAMPFIRE`
- `SUGGESTION` (internal-only)
- `PROFILE`
- `YOUTUBE`
- `ROADMAP_FEED`
- `MUSIC`
- `DOCUMENT`

All public tile definitions are registered in `apps/web/src/registries/tiles/index.ts`. If you add a new tile definition file, import and register it there.

## Grid Unit System

- 1 cell = 75 px
- Gap = 48 px
- Tile pixel size on one axis is `cells * 123 - 48`
- A 2 by 2 tile is 198 px by 198 px
- Default new tile size is 2 wide by 2 tall unless the tile definition sets `defaultSize`

## How a Tile Renders

1. `Grid.vue` renders the grid's `tiles` through `Tile.vue`.
2. `Tile.vue` calls `getContentComponent(tile.content)` from `TileUtils.ts`.
3. `getContentComponent` finds the tile definition in `tileRegistry.ts` and async-loads its `component`.
4. The content component receives `content` as a prop, plus any props returned by the tile definition's `extraProps`.
5. `Tile.vue` provides tile context with Vue provide/inject:

```text
tileId       Tile id string
gridTileW    ComputedRef<number> for current tile width in grid cells
gridTileH    ComputedRef<number> for current tile height in grid cells
tileX        ComputedRef<number> for current x position
tileY        ComputedRef<number> for current y position
```

## How State Flows

Use `useGridStore()` for persisted tile updates.

```ts
gridStore.patchTileContent(tileId, { someValue: "new value" });
```

Do not directly mutate `props.content`. The layout layer can render copied tile objects, so direct prop mutation can be lost on the next layout rebuild.

`patchTileContent` updates the canonical tile in `gridStore.currentGrid.tiles`, records undo state when appropriate, and triggers the grid update/save path. Depending on local mode, the active runtime may be stubbed, Firebase emulator-backed, or production Firebase-backed.

## Step-by-Step: Adding a Tile Type

### 1. Add the Content Type and Content Interface

Edit `packages/contracts/src/types/TileContent.ts`.

Add an enum value:

```ts
export enum ContentType {
  // existing values...
  MY_NEW_TILE = "my_new_tile",
}
```

Add the content interface:

```ts
export interface MyNewTileContent extends TileContent {
  type: ContentType.MY_NEW_TILE;
  someValue: string;
  someNumber: number;
}
```

Add the interface to `AnyTileContent`:

```ts
export type AnyTileContent =
  | TextContent
  // existing content types...
  | MyNewTileContent;
```

Because this package is consumed through built workspace output, run a contracts build before depending on the new type from `apps/web`:

```bash
npm --workspace @grids/contracts run build
```

### 2. Create the Tile Definition

Create `apps/web/src/registries/tiles/myNewTile.ts`.

```ts
import {
  ContentType,
  type MyNewTileContent,
} from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import {
  RESIZE_PRESETS,
  BORDER_TOGGLE,
} from "@/registries/tileToolbar/baseButtons";

export const myNewTileDefinition: TileDefinition<MyNewTileContent> = {
  type: ContentType.MY_NEW_TILE,
  label: "My New Tile",
  category: "utility",

  component: () => import("@/components/tilecontent/MyNewTileContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.MY_NEW_TILE,
    someValue: data?.someValue || "",
    someNumber: data?.someNumber ?? 0,
  }),

  validate: (content) => content.someValue.trim().length > 0,

  capabilities: {
    caption: true,
    border: true,
    tileLink: false,
    duplicate: true,
    resizable: true,
  },

  colorTheming: {
    backgroundColor: true,
  },

  editMode: "fields",

  actions: {
    externalUrl: () => null,
    copyContent: (content) => content.someValue || null,
    downloadUrl: () => null,
  },

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE],

  // Optional: pass props beyond `content` to the content component.
  // extraProps: (tile) => ({ tileId: tile.i }),

  // Optional: limit instances per grid.
  // maxPerGrid: 1,

  // Optional: custom default size. Default is { w: 2, h: 2 }.
  // defaultSize: { w: 4, h: 4 },

  // Optional: hide behind a PostHog feature flag.
  // featureFlag: "beta-my-new-tile",

  // Optional: claim pasted/embed URLs.
  // matchUrl: (url) => url.includes("example.com"),
  // parseUrl: (url) => ({ someValue: url }),
};
```

### 3. Register the Definition

Edit `apps/web/src/registries/tiles/index.ts`.

```ts
import { myNewTileDefinition } from "./myNewTile";

export function registerAllTiles(): void {
  // existing registrations...
  registerTile(myNewTileDefinition);
}

export {
  // existing exports...
  myNewTileDefinition,
};
```

`apps/web/src/main.ts` imports `@/registries/tiles` before services initialize, so registration happens during app startup and before `createTileContent` is used at module scope.

### 4. Create the Content Component

Create `apps/web/src/components/tilecontent/MyNewTileContent.vue`.

Most existing tile content components use `defineComponent`, so this example follows that local pattern.

```vue
<template>
  <div class="my-tile-container">
    <input
      v-if="gridStore.canEdit"
      :value="content.someValue"
      @input="onInput"
    />
    <span v-else>{{ content.someValue }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, computed, type ComputedRef } from "vue";
import type { MyNewTileContent } from "@grids/contracts/types";
import { useGridStore } from "@/stores/grid";

export default defineComponent({
  props: {
    content: {
      type: Object as () => MyNewTileContent,
      required: true,
    },
  },
  setup() {
    const gridStore = useGridStore();
    const tileId = inject<string | null>("tileId", null);
    const gridW = inject<ComputedRef<number>>("gridTileW", computed(() => 2));
    const gridH = inject<ComputedRef<number>>("gridTileH", computed(() => 2));

    const updateValue = (someValue: string) => {
      if (!tileId || !gridStore.canEdit) return;
      gridStore.patchTileContent(tileId, { someValue });
    };

    const onInput = (event: Event) => {
      updateValue((event.target as HTMLInputElement).value);
    };

    return {
      gridStore,
      gridW,
      gridH,
      onInput,
      updateValue,
    };
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

You can use `<script setup>` for new Vue code if it fits the surrounding file, but match nearby tile conventions when modifying an existing tile.

### 5. Add Tests

At minimum, update `apps/web/src/utils/__tests__/TileUtils.test.ts` to cover:

- default content from `createTileContent(ContentType.MY_NEW_TILE)`
- validation through `validateTileContent`
- URL routing if the tile uses `matchUrl` / `parseUrl`

Add component, store, service, or function tests when the tile has behavior outside its definition.

## TileDefinition Reference

The current registry contract is `apps/web/src/types/TileDefinition.ts`.

| Field | Required | Purpose |
| --- | --- | --- |
| `type` | Yes | `ContentType` enum value |
| `label` | Yes | Human-readable name for UI |
| `icon` | No | Optional Vue component icon |
| `category` | No | `"media"`, `"text"`, `"social"`, `"embed"`, `"utility"`, or `"game"` |
| `featureFlag` | No | PostHog flag key for add-menu visibility |
| `component` | Yes | Async component import used by `Tile.vue` |
| `headerComponent` | No | Optional async header component |
| `defaultContent` | Yes | Factory returning valid default content |
| `validate` | Yes | Returns true when content is renderable |
| `defaultSize` | No | `{ w, h }`; defaults to `{ w: 2, h: 2 }` |
| `capabilities` | Yes | Shell behavior flags: `caption`, `duplicate`, `border`, `tileLink`, `resizable` |
| `colorTheming` | No | Background/text color support flags |
| `editMode` | No | `"richtext"`, `"crop"`, `"fields"`, `"interactive"`, `"composer"`, `"settings"`, or `"none"` |
| `actions` | No | Copy, download, and external-link action callbacks |
| `toolbar` | No | `ToolbarButton[]` or `(ctx: ToolbarContext) => ToolbarButton[]` |
| `extraProps` | No | Additional props passed to the content component |
| `maxPerGrid` | No | Limit instances per grid |
| `matchUrl` | No | Claim URLs from paste/embed routing |
| `parseUrl` | No | Extract content fields from a matched URL |

## Common Patterns

### Persist Through the Store

```ts
// Good: updates the canonical tile and uses the grid update/save path.
gridStore.patchTileContent(tileId, { someValue: "new" });

// Bad: mutates a rendered copy and can be lost on layout rebuild.
props.content.someValue = "new";
```

### Read Canonical Store Data When Needed

If your component needs the latest canonical tile data rather than the rendered copy:

```ts
const storeContent = computed(() => {
  const tile = gridStore.currentGrid?.tiles.find((t) => t.i === tileId);
  return tile?.content.type === ContentType.MY_NEW_TILE
    ? tile.content
    : undefined;
});
```

### Gate Editing

Check `gridStore.canEdit` before showing edit controls or mutating persisted content. Visitors can view and interact with public tiles, but they should not be able to modify saved tile data.

### Use Tile Dimensions for Responsive UI

Use injected `gridTileW` and `gridTileH` to adapt controls, labels, and dense layouts across tile sizes. The content component fills the shell; your component controls internal layout.

### Clean Up Side Effects

If your tile starts timers, subscriptions, global listeners, or third-party SDK instances, clean them up in `onUnmounted`.

## Styling Guidelines

- Use `<style scoped lang="scss">`.
- Use design tokens from `apps/web/src/styles/tokens.scss`.
- Use theme-aware CSS variables instead of hard-coded light/dark colors.
- Verify the tile in light and dark themes.
- Avoid leaking styles into shared tile shell components.

Useful tokens include:

| Token | Purpose |
| --- | --- |
| `--spacing-xs` through `--spacing-4xl` | Spacing |
| `--radius-sm` through `--radius-full` | Radius |
| `--color-text-primary` | Primary text |
| `--color-content-high`, `--color-content-default`, `--color-content-low` | Text emphasis |
| `--color-tile-background` | Tile surface |
| `--transition-fast`, `--transition-normal`, `--transition-slow` | Motion |
| `--font-family-base`, `--font-family-mono` | Font stacks |

## Checklist

- [ ] Add `ContentType`, content interface, and `AnyTileContent` entry in `packages/contracts/src/types/TileContent.ts`
- [ ] Build contracts with `npm --workspace @grids/contracts run build`
- [ ] Add `apps/web/src/registries/tiles/yourTile.ts`
- [ ] Register and export the tile in `apps/web/src/registries/tiles/index.ts`
- [ ] Add `apps/web/src/components/tilecontent/YourTileContent.vue`
- [ ] Persist content changes with `gridStore.patchTileContent` or an existing store/service helper
- [ ] Gate edit affordances with `gridStore.canEdit`
- [ ] Add or update tests, especially `TileUtils.test.ts`
- [ ] Verify light and dark themes
- [ ] Verify small and large tile sizes
- [ ] Clean up timers, listeners, subscriptions, or SDK instances in `onUnmounted`
- [ ] Update docs if the tile introduces a new pattern or external integration

## Good Existing References

| Tile | Why to read it |
| --- | --- |
| `apps/web/src/registries/tiles/image.ts` | URL matching, crop toolbar, tile link, color theming |
| `apps/web/src/registries/tiles/document.ts` | Feature flag, `extraProps`, document item validation |
| `apps/web/src/registries/tiles/music.ts` | Custom resize toolbar and external URL action |
| `apps/web/src/components/tilecontent/CampfireContent.vue` | Interactive tile with injected dimensions |
| `apps/web/src/components/tilecontent/MapContent.vue` | External library lifecycle and canonical store updates |
| `apps/web/src/components/tilecontent/DocumentsContent.vue` | Multi-item persisted content and extra props |
