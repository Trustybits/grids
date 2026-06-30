type GridSnapshot = Record<string, unknown>;

export type MeaningfulGridChanges = {
  nameChanged: boolean;
  tilesChanged: boolean;
  privacyChanged: boolean;
};

export function getMeaningfulGridChanges(
  beforeData: GridSnapshot,
  afterData: GridSnapshot,
): MeaningfulGridChanges {
  return {
    nameChanged: beforeData.name !== afterData.name,
    tilesChanged:
      JSON.stringify(beforeData.tiles || []) !==
      JSON.stringify(afterData.tiles || []),
    privacyChanged: beforeData.isPublic !== afterData.isPublic,
  };
}

export function hasMeaningfulGridChanges(changes: MeaningfulGridChanges): boolean {
  return (
    changes.nameChanged ||
    changes.tilesChanged ||
    changes.privacyChanged
  );
}

/** User-driven content edits (excludes privacy-only toggles). */
export function hasUserGridContentEdit(changes: MeaningfulGridChanges): boolean {
  return changes.nameChanged || changes.tilesChanged;
}
