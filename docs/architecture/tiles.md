# Tiles

Tiles are the core building blocks of a grid. A tile has layout information and content-specific data, and each tile type has registration, rendering, and editing behavior.

## Main Locations

- `apps/web/src/registries/tiles` - tile definitions and registration.
- `apps/web/src/registries/tileRegistry.ts` - tile registry infrastructure.
- `apps/web/src/registries/tileToolbar` - toolbar button definitions.
- `apps/web/src/components/tilecontent` - tile content renderers.
- `apps/web/src/components/tile` - shared tile chrome and controls.
- `apps/web/src/types` and `packages/contracts/src/types` - tile-related types.
- `apps/web/CONTRIBUTING_TILES.md` - step-by-step contribution guide.

## Contribution Path

Read [the tile contribution guide](../../apps/web/CONTRIBUTING_TILES.md) before adding a tile type.

In general, a new tile may need:

- A content type and content shape.
- Default content creation.
- Validation.
- A tile content component.
- Registry entry.
- Toolbar behavior.
- Tests for content creation, validation, and user-facing behavior.

## Compatibility

Tile content is user data. Changes to existing tile content shapes need compatibility analysis and, when needed, migration handling.
