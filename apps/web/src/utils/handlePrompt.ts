// Remembers "Skip for now" on the claim-handle prompt for the rest of the
// browser session, so the dashboard doesn't re-open it right after a skip but
// does ask again on the next visit.
const SKIPPED_KEY = "grids.handlePrompt.skipped";

export function markHandlePromptSkipped(): void {
  try {
    window.sessionStorage.setItem(SKIPPED_KEY, "1");
  } catch {
    // Storage blocked (private mode etc.) — worst case we ask again.
  }
}

export function wasHandlePromptSkipped(): boolean {
  try {
    return window.sessionStorage.getItem(SKIPPED_KEY) === "1";
  } catch {
    return false;
  }
}
