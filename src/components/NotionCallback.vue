<template>
  <div class="notion-callback">
    <div class="notion-callback-card">
      <!-- Spinner shown while exchanging the OAuth code -->
      <div v-if="status === 'loading'" class="notion-callback-spinner" aria-label="Connecting…">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="spin">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="40 20" stroke-linecap="round"/>
        </svg>
        <p>Connecting to Notion…</p>
      </div>

      <!-- Success state — window will close automatically -->
      <div v-else-if="status === 'success'" class="notion-callback-success">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Connected! Closing…</p>
      </div>

      <!-- Error state -->
      <div v-else-if="status === 'error'" class="notion-callback-error">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>{{ errorMessage }}</p>
        <button @click="closeWindow">Close</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

// Module-level set: tracks which OAuth state values have already been exchanged.
// Using the state string (not a boolean) means a fresh OAuth attempt with a new
// state (new tileId/layoutId combo) is always allowed, while dev-mode double-mounts
// for the same state are still deduplicated.
const exchangedStates = new Set<string>();

export default defineComponent({
  name: "NotionCallback",

  setup() {
    const route = useRoute();

    const status = ref<"loading" | "success" | "error">("loading");
    const errorMessage = ref("Something went wrong. Please try again.");

    const closeWindow = () => window.close();

    onMounted(async () => {
      // Extract the authorization code and state from the query string.
      // Notion appends ?code=...&state=... to the redirect URI.
      const code = route.query.code as string | undefined;
      const stateRaw = route.query.state as string | undefined;

      // Deduplicate: bail if this exact state has already been exchanged.
      // Using the state string (rather than a boolean) means a fresh OAuth
      // attempt with a new state is always allowed; only dev-mode double-mounts
      // of the same request are skipped.
      if (stateRaw && exchangedStates.has(stateRaw)) return;
      if (stateRaw) exchangedStates.add(stateRaw);
      const notionError = route.query.error as string | undefined;

      // If Notion returned an error (e.g. user denied access), relay it back
      if (notionError || !code) {
        status.value = "error";
        errorMessage.value = notionError === "access_denied"
          ? "Access was denied. Please try connecting again."
          : "Authorization failed. Please try again.";

        // Post the error back to the opener so the tile can show it
        window.opener?.postMessage(
          { type: "notion-oauth-complete", error: errorMessage.value },
          window.location.origin
        );
        return;
      }

      // Decode the state parameter to recover layoutId, tileId, and the redirectUri
      // that was used in the authorize request (required for the token exchange).
      let layoutId = "";
      let tileId = "";
      let redirectUri = "";
      try {
        const state = JSON.parse(decodeURIComponent(stateRaw ?? "{}"));
        layoutId = state.layoutId ?? "";
        tileId = state.tileId ?? "";
        redirectUri = state.redirectUri ?? "";
      } catch {
        status.value = "error";
        errorMessage.value = "Invalid OAuth state. Please try again.";
        window.opener?.postMessage(
          { type: "notion-oauth-complete", error: errorMessage.value },
          window.location.origin
        );
        return;
      }

      if (!layoutId || !tileId) {
        status.value = "error";
        errorMessage.value = "Missing context. Please try connecting again.";
        window.opener?.postMessage(
          { type: "notion-oauth-complete", error: errorMessage.value },
          window.location.origin
        );
        return;
      }

      try {
        // Exchange the authorization code for an access token via the Cloud Function.
        // The token is stored server-side; this page never sees it.
        // redirectUri is read from state so it exactly matches what was used in the authorize step.
        const notionOAuthExchange = httpsCallable(functions, "notionOAuthExchange");
        await notionOAuthExchange({ code, layoutId, tileId, redirectUri });

        status.value = "success";

        // Write result to localStorage so the opener can pick it up via a storage event
        // or polling. postMessage is unreliable here because the popup navigated away
        // from the opener's origin during the OAuth flow, which clears window.opener
        // in some browsers.
        localStorage.setItem("notion-oauth-result", JSON.stringify({ error: null, ts: Date.now() }));

        // Small delay so the user sees the success state before the window closes
        setTimeout(() => window.close(), 1200);
      } catch (err: any) {
        status.value = "error";
        errorMessage.value = err?.message || "Failed to connect Notion. Please try again.";
        // Write error to localStorage so the opener can display it
        localStorage.setItem("notion-oauth-result", JSON.stringify({ error: errorMessage.value, ts: Date.now() }));
      }
    });

    return { status, errorMessage, closeWindow };
  },
});
</script>

<style scoped>
.notion-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background, #0f0f0f);
  color: var(--color-text-primary, #ffffff);
  font-family: var(--font-sans, system-ui, sans-serif);
}

.notion-callback-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 48px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-text-primary, #fff) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-text-primary, #fff) 10%, transparent);
  text-align: center;
  min-width: 280px;
}

.notion-callback-spinner,
.notion-callback-success,
.notion-callback-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.notion-callback-spinner p,
.notion-callback-success p,
.notion-callback-error p {
  font-size: 15px;
  margin: 0;
  opacity: 0.8;
}

/* Spinning animation for the loading icon */
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.notion-callback-success { color: var(--color-green, #B3EFBD); }
.notion-callback-error { color: var(--color-red, #FFAFA3); }

.notion-callback-error button {
  margin-top: 8px;
  padding: 8px 20px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.15s ease;
}
.notion-callback-error button:hover { opacity: 1; }
</style>
