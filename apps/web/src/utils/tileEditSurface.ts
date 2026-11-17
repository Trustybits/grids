/**
 * The phone editor's floating chrome — toolbars, popover cards, the mode and
 * typing bars, the quick menu — is marked `data-tile-edit-surface`. A tap
 * there acts on the tile being edited, so it is never a tap "outside" it:
 * tiles' own outside-click handlers must not end editing over it.
 */
export const TILE_EDIT_SURFACE = "[data-tile-edit-surface]";

export function isOnTileEditSurface(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(TILE_EDIT_SURFACE);
}
