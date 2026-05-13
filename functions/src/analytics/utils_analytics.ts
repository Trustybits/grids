const MAX_ID_LENGTH = 128;
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

export function isSafeFirestoreDocId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    SAFE_ID_RE.test(value)
  );
}
