export interface GridFacadeLoadingState {
  collectionLoading: boolean;
  sessionLoading: boolean;
}

/**
 * Intentional behavior change from the legacy shared loading field.
 *
 * The legacy store lets the first completed overlapping operation clear
 * loading. The focused-store facade instead remains loading until every
 * tracked operation has finished.
 */
export function selectGridFacadeLoading({
  collectionLoading,
  sessionLoading,
}: GridFacadeLoadingState): boolean {
  return collectionLoading || sessionLoading;
}
