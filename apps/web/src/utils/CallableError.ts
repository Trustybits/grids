/**
 * Firebase callable errors surface a human-readable `.message` for the
 * HttpsErrors our Cloud Functions throw on purpose (e.g. "You cannot transfer a
 * grid to yourself."), so we can show those directly. But an *unhandled* server
 * failure collapses to the opaque code `functions/internal`, whose message is
 * just "internal" — never worth showing a user. Return the server message when
 * it carries real meaning, otherwise a caller-supplied fallback.
 */
const OPAQUE_MESSAGES = new Set(["internal", "unknown", ""]);

export function describeCallableError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) {
    const message = error.message?.trim() ?? "";
    if (message && !OPAQUE_MESSAGES.has(message.toLowerCase())) {
      return message;
    }
  }
  return fallback;
}
