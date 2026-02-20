<template>
  <div class="roadmap-feed" :class="{ 'is-setup': !isConnected, 'is-owner': isOwner }">

    <!-- ── Disconnected / Setup state ─────────────────────────────── -->
    <!-- Only show the connect prompt when truly disconnected (not mid-setup) -->
    <template v-if="!isConnected && setupPhase === 'idle'">
      <div class="roadmap-empty">
        <div class="roadmap-empty-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p class="roadmap-empty-title">Roadmap</p>
        <p class="roadmap-empty-subtitle" v-if="isOwner">Connect a Notion database to display your roadmap.</p>
        <p class="roadmap-empty-subtitle" v-else>No roadmap connected yet.</p>
        <button v-if="isOwner" class="roadmap-connect-btn" @click.stop="startOAuth" :disabled="isConnecting">
          <span v-if="isConnecting">Connecting…</span>
          <span v-else>Connect Notion</span>
        </button>
        <p v-if="connectError" class="roadmap-error">{{ connectError }}</p>
      </div>
    </template>

    <!-- ── Connected state (includes picking/configuring phases) ──── -->
    <template v-else>
      <!-- Header: title + refresh + settings gear (owner only) -->
      <div class="roadmap-header" @mousedown.stop>
        <span class="roadmap-title">Roadmap</span>
        <div class="roadmap-header-actions">
          <span v-if="content.lastSyncedAt" class="roadmap-synced-at">Updated {{ relativeTime(content.lastSyncedAt) }}</span>
          <button class="roadmap-icon-btn" title="Refresh from Notion" @click.stop="refresh" :disabled="isLoading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :class="{ 'is-spinning': isLoading }">
              <path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button v-if="isOwner" class="roadmap-icon-btn" title="Configure" @click.stop="showSettings = !showSettings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Database picker — shown right after OAuth until a database is selected -->
      <div v-if="setupPhase === 'picking' && isOwner" class="roadmap-settings" @mousedown.stop>
        <p class="roadmap-settings-title">Choose a database</p>
        <p class="roadmap-settings-hint">Select the Notion database you want to display as your roadmap.</p>
        <div v-if="isLoadingDatabases" class="roadmap-settings-loading">Loading databases…</div>
        <div v-else-if="availableDatabases.length === 0" class="roadmap-settings-hint">
          No databases found. Make sure you shared at least one database with the integration in Notion.
        </div>
        <div v-else class="roadmap-db-list">
          <button
            v-for="db in availableDatabases"
            :key="db.id"
            class="roadmap-db-item"
            @click.stop="selectDatabase(db.id)"
          >{{ db.title || 'Untitled' }}</button>
        </div>
        <button class="roadmap-settings-disconnect-btn" style="margin-top:12px" @click.stop="reconnect">Reconnect Notion</button>
      </div>

      <!-- Settings panel (owner only) — configure property mappings -->
      <!-- Shown when gear icon is toggled OR immediately after database selection -->
      <div v-if="(showSettings || setupPhase === 'configuring') && isOwner" class="roadmap-settings" @mousedown.stop>
        <p class="roadmap-settings-title">Database settings</p>

        <label class="roadmap-settings-label">Status property</label>
        <select v-model="draftStatusProp" class="roadmap-settings-select" @change="saveStatusProp">
          <option value="">— select property —</option>
          <option v-for="p in statusProperties" :key="p.name" :value="p.name">{{ p.name }} ({{ p.type }})</option>
        </select>

        <!-- Per-option mapping: each Notion select value → backlog / in_progress / done -->
        <template v-if="draftStatusProp && currentStatusOptions.length">
          <label class="roadmap-settings-label">Map statuses</label>
          <div class="roadmap-status-map">
            <div v-for="opt in currentStatusOptions" :key="opt" class="roadmap-status-map-row">
              <span class="roadmap-status-map-label">{{ opt }}</span>
              <select
                :value="draftStatusMapping[opt] || 'backlog'"
                class="roadmap-settings-select roadmap-settings-select--sm"
                @change="(e) => setStatusMapping(opt, (e.target as HTMLSelectElement).value)"
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
        </template>

        <label class="roadmap-settings-label">Upvote count property (number)</label>
        <select v-model="draftUpvoteProp" class="roadmap-settings-select" @change="saveUpvoteProp">
          <option value="">— none —</option>
          <option v-for="p in numberProperties" :key="p.name" :value="p.name">{{ p.name }}</option>
        </select>

        <button class="roadmap-settings-save-btn" @click.stop="saveAllSettings">Save &amp; Refresh</button>
        <button class="roadmap-settings-disconnect-btn" @click.stop="reconnect">Reconnect Notion</button>
      </div>

      <!-- Loading skeleton shown on first load before any cached items exist -->
      <div v-if="isLoading && !hasItems" class="roadmap-loading">
        <div v-for="i in 3" :key="i" class="roadmap-skeleton-card"></div>
      </div>

      <!-- Error state -->
      <div v-else-if="fetchError" class="roadmap-fetch-error">
        <p>{{ fetchError }}</p>
        <button class="roadmap-icon-btn" @click.stop="refresh">Retry</button>
      </div>

      <!-- Kanban columns: Backlog / In Progress / Done -->
      <div v-else class="roadmap-columns" @mousedown.stop>
        <div v-for="col in columns" :key="col.key" class="roadmap-column">
          <div class="roadmap-column-header">
            <span class="roadmap-column-dot" :class="`roadmap-column-dot--${col.key}`"></span>
            <span class="roadmap-column-label">{{ col.label }}</span>
            <span class="roadmap-column-count">{{ col.items.length }}</span>
          </div>
          <div class="roadmap-column-items">
            <div v-for="item in col.items" :key="item.notionPageId" class="roadmap-card">
              <p class="roadmap-card-title">{{ item.title }}</p>
              <p v-if="item.description" class="roadmap-card-desc">{{ item.description }}</p>
              <div class="roadmap-card-footer">
                <!-- Upvote button: disabled for unauthenticated visitors, toggles on click -->
                <button
                  class="roadmap-upvote-btn"
                  :class="{ 'is-voted': myVotedPageId === item.notionPageId, 'is-pending': pendingVoteId === item.notionPageId }"
                  :disabled="!canVote || pendingVoteId === item.notionPageId"
                  :title="canVote ? (myVotedPageId === item.notionPageId ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'"
                  @click.stop="toggleUpvote(item)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="roadmap-upvote-count">{{ optimisticCount(item) }}</span>
                </button>
              </div>
            </div>
            <div v-if="!col.items.length" class="roadmap-column-empty">Nothing here yet</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { getAuth } from "firebase/auth";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";
import type { RoadmapFeedContent, RoadmapItem, RoadmapStatus } from "@/types/TileContent";

// Shape returned by the listNotionDatabases Cloud Function
interface NotionDatabase {
  id: string;
  title: string;
}

// Shape returned by the fetchNotionRoadmap Cloud Function
interface FetchRoadmapResult {
  items: RoadmapItem[];
  propertyOptions: { name: string; type: string; selectOptions?: string[] }[];
}

// Shape returned by the upvoteRoadmapItem Cloud Function
interface UpvoteResult {
  isNowUpvoted: boolean;
}

export default defineComponent({
  props: {
    content: {
      type: Object as () => RoadmapFeedContent,
      required: true,
    },
  },

  setup(props) {
    const layoutStore = useLayoutStore();
    const auth = getAuth();

    // tileId is injected by GridTile so we can scope Firestore paths to this tile instance
    const tileId = inject<string>("tileId", "");

    const isOwner = computed(() => layoutStore.isOwner);
    const layoutId = computed(() => layoutStore.currentLayout?.id ?? "");

    // ── Connection state ─────────────────────────────────────────────
    // A tile is "connected" once the owner has set a real notionDatabaseId
    const isConnected = computed(() => !!props.content.notionDatabaseId && props.content.notionDatabaseId !== "pending");
    // Local phase ref so UI transitions happen synchronously without waiting
    // for the Firestore-backed prop to update after patchTileContent.
    // 'picking'     = OAuth done, showing database list
    // 'configuring' = DB selected, showing property mapping settings
    // 'idle'        = normal connected view
    const setupPhase = ref<"idle" | "picking" | "configuring">(
      props.content.notionDatabaseId === "pending" ? "picking" : "idle"
    );
    const isConnecting = ref(false);
    const connectError = ref("");

    // ── Database picker ──────────────────────────────────────────────
    const availableDatabases = ref<NotionDatabase[]>([]);
    const isLoadingDatabases = ref(false);
    const listDatabasesFn = httpsCallable<unknown, { databases: NotionDatabase[] }>(functions, "listNotionDatabases");

    // ── Feed data ────────────────────────────────────────────────────
    const isLoading = ref(false);
    const fetchError = ref("");
    // Start from cached items so the tile renders immediately on load
    const items = ref<RoadmapItem[]>(props.content.cachedItems ?? []);
    const hasItems = computed(() => items.value.length > 0);
    // Property options from the Notion DB schema — used to populate settings dropdowns
    const propertyOptions = ref<{ name: string; type: string; selectOptions?: string[] }[]>([]);

    // ── Settings panel state ─────────────────────────────────────────
    // showSettings controls the gear-icon settings panel for already-connected tiles
    const showSettings = ref(false);
    // Draft copies so the owner can edit without immediately mutating the tile content.
    // "pending" is a sentinel meaning the token is stored but no DB ID has been entered yet.
    const draftDatabaseId = ref(props.content.notionDatabaseId === "pending" ? "" : props.content.notionDatabaseId);
    const draftStatusProp = ref(props.content.statusPropertyName);
    const draftUpvoteProp = ref(props.content.upvotePropertyName);
    const draftStatusMapping = ref<Record<string, string>>({ ...props.content.statusMapping });

    // Filtered property lists for the settings dropdowns
    const statusProperties = computed(() =>
      propertyOptions.value.filter((p) => p.type === "select" || p.type === "status")
    );
    const numberProperties = computed(() =>
      propertyOptions.value.filter((p) => p.type === "number")
    );
    // The select options available for the currently chosen status property
    const currentStatusOptions = computed(() => {
      const prop = propertyOptions.value.find((p) => p.name === draftStatusProp.value);
      return prop?.selectOptions ?? [];
    });

    // ── Upvote state ─────────────────────────────────────────────────
    // The Notion page ID this user has upvoted in this tile (null = no active vote)
    const myVotedPageId = ref<string | null>(null);
    // While a vote is in-flight, we disable the button to prevent double-clicks
    const pendingVoteId = ref<string | null>(null);
    // Applied locally before the server responds so the count feels instant
    const optimisticDelta = ref<{ pageId: string; delta: number } | null>(null);

    const currentUser = computed(() => auth.currentUser);
    // Only signed-in users may vote; unauthenticated visitors see the count but can't click
    const canVote = computed(() => !!currentUser.value && isConnected.value);

    // ── Firestore upvote listener ────────────────────────────────────
    // Watches layouts/{layoutId}/tiles/{tileId}/upvotes/{userId} so that
    // myVotedPageId stays in sync across tabs without a full page refresh.
    let unsubscribeUpvotes: Unsubscribe | null = null;

    const subscribeToMyUpvote = () => {
      if (unsubscribeUpvotes) { unsubscribeUpvotes(); unsubscribeUpvotes = null; }
      const uid = currentUser.value?.uid;
      if (!uid || !layoutId.value || !tileId) return;
      const upvoteDocRef = doc(db, "layouts", layoutId.value, "tiles", tileId, "upvotes", uid);
      unsubscribeUpvotes = onSnapshot(upvoteDocRef, (snap) => {
        myVotedPageId.value = snap.exists() ? (snap.data()?.notionPageId ?? null) : null;
      });
    };

    // ── Kanban columns ───────────────────────────────────────────────
    const COLUMNS: { key: RoadmapStatus; label: string }[] = [
      { key: "backlog",     label: "Backlog" },
      { key: "in_progress", label: "In Progress" },
      { key: "done",        label: "Done" },
    ];

    const columns = computed(() =>
      COLUMNS.map((col) => ({
        ...col,
        items: items.value.filter((item) => item.status === col.key),
      }))
    );

    // ── Optimistic upvote count ──────────────────────────────────────
    // Returns the displayed count for an item, applying any in-flight delta
    // so the UI feels instant even before the Cloud Function responds.
    const optimisticCount = (item: RoadmapItem): number => {
      if (optimisticDelta.value?.pageId === item.notionPageId) {
        return Math.max(0, item.upvoteCount + optimisticDelta.value.delta);
      }
      return item.upvoteCount;
    };

    // ── Relative time helper ─────────────────────────────────────────
    const relativeTime = (ms: number): string => {
      const diff = Date.now() - ms;
      const minutes = Math.floor(diff / 60_000);
      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    };

    // ── Cloud Function callers ───────────────────────────────────────
    const fetchRoadmapFn = httpsCallable<unknown, FetchRoadmapResult>(functions, "fetchNotionRoadmap");
    const upvoteRoadmapItemFn = httpsCallable<unknown, UpvoteResult>(functions, "upvoteRoadmapItem");

    // ── Database picker helpers ──────────────────────────────────────
    const loadDatabases = async () => {
      if (!layoutId.value || !tileId) return;
      isLoadingDatabases.value = true;
      try {
        const result = await listDatabasesFn({ layoutId: layoutId.value, tileId });
        availableDatabases.value = result.data.databases;
      } catch (err: any) {
        connectError.value = err?.message || "Failed to load databases.";
      } finally {
        isLoadingDatabases.value = false;
      }
    };

    const selectDatabase = async (databaseId: string) => {
      // Immediately transition to configuring phase so the picker closes and
      // settings panel opens — don't wait for the Firestore-backed prop to update.
      layoutStore.patchTileContent(tileId, { notionDatabaseId: databaseId });
      setupPhase.value = "configuring";
      isLoading.value = true;
      fetchError.value = "";
      try {
        const result = await fetchRoadmapFn({ layoutId: layoutId.value, tileId, databaseIdOverride: databaseId });
        items.value = result.data.items;
        propertyOptions.value = result.data.propertyOptions;
        layoutStore.patchTileContent(tileId, {
          cachedItems: result.data.items,
          lastSyncedAt: Date.now(),
        });
      } catch (err: any) {
        fetchError.value = err?.message || "Failed to load roadmap.";
      } finally {
        isLoading.value = false;
      }
    };

    // ── Fetch / refresh ──────────────────────────────────────────────
    const refresh = async () => {
      // Skip if not connected or if the database ID is still the post-OAuth sentinel
      if (!layoutId.value || !tileId || !isConnected.value || props.content.notionDatabaseId === "pending") return;
      isLoading.value = true;
      fetchError.value = "";
      try {
        const result = await fetchRoadmapFn({ layoutId: layoutId.value, tileId });
        items.value = result.data.items;
        propertyOptions.value = result.data.propertyOptions;
        // Persist refreshed items + timestamp into tile content so the next page load
        // can render from cache without waiting for a Notion round-trip.
        layoutStore.patchTileContent(tileId, {
          cachedItems: result.data.items,
          lastSyncedAt: Date.now(),
        });
      } catch (err: any) {
        fetchError.value = err?.message || "Failed to load roadmap.";
      } finally {
        isLoading.value = false;
      }
    };

    // ── Upvote toggle ────────────────────────────────────────────────
    const toggleUpvote = async (item: RoadmapItem) => {
      if (!canVote.value || pendingVoteId.value) return;

      const isCurrentlyVoted = myVotedPageId.value === item.notionPageId;
      const delta = isCurrentlyVoted ? -1 : 1;

      // Apply optimistic update immediately so the button flips without waiting
      pendingVoteId.value = item.notionPageId;
      optimisticDelta.value = { pageId: item.notionPageId, delta };

      try {
        const result = await upvoteRoadmapItemFn({
          layoutId: layoutId.value,
          tileId,
          notionPageId: item.notionPageId,
        });

        // Commit the count change to the local items array and persist to cache
        const idx = items.value.findIndex((i) => i.notionPageId === item.notionPageId);
        if (idx !== -1) {
          items.value[idx] = { ...items.value[idx], upvoteCount: Math.max(0, items.value[idx].upvoteCount + delta) };
          layoutStore.patchTileContent(tileId, { cachedItems: items.value });
        }

        // myVotedPageId is kept in sync by the Firestore listener, but we also
        // update it here so the button state flips immediately on this tab.
        myVotedPageId.value = result.data.isNowUpvoted ? item.notionPageId : null;
      } catch (err: any) {
        console.error("Upvote failed:", err?.message);
      } finally {
        pendingVoteId.value = null;
        optimisticDelta.value = null;
      }
    };

    // ── Notion OAuth ─────────────────────────────────────────────────
    // Opens a popup to Notion's OAuth authorization page. The popup lands on
    // /notion-callback, which calls notionOAuthExchange and posts a message
    // back to this window when the exchange is complete.
    const startOAuth = () => {
      if (!layoutId.value || !tileId) return;
      isConnecting.value = true;
      connectError.value = "";

      const clientId = import.meta.env.VITE_NOTION_CLIENT_ID as string;
      // Build the redirect URI from the current origin so both localhost and prod work.
      // It must be registered in the Notion integration settings for both environments.
      const callbackUri = `${window.location.origin}/notion-callback`;
      // Embed redirectUri in state so the callback page can pass the exact same value
      // back to the Cloud Function — Notion requires it to match the authorize request
      // when multiple redirect URIs are registered on the integration.
      const state = encodeURIComponent(JSON.stringify({ layoutId: layoutId.value, tileId, redirectUri: callbackUri }));
      const notionAuthUrl =
        `https://api.notion.com/v1/oauth/authorize` +
        `?client_id=${clientId}&response_type=code&owner=user` +
        `&redirect_uri=${encodeURIComponent(callbackUri)}&state=${state}`;

      // Clear any stale result from a previous OAuth attempt before opening the popup
      localStorage.removeItem("notion-oauth-result");

      const popup = window.open(notionAuthUrl, "notion-oauth", "width=600,height=700");

      // Poll localStorage for the result written by NotionCallback.vue.
      // We use localStorage instead of postMessage because the popup navigates
      // away from the opener's origin during the OAuth flow, which nulls out
      // window.opener in some browsers making postMessage unreliable.
      let handled = false;
      const handleResult = (error: string | null) => {
        if (handled) return;
        handled = true;
        clearInterval(pollResult);
        localStorage.removeItem("notion-oauth-result");
        isConnecting.value = false;
        if (error) { connectError.value = error; return; }
        // Mark the tile as connected (token stored server-side) so the settings
        // panel becomes visible. The owner will replace "pending" with the real
        // Notion database ID in the settings panel.
        layoutStore.patchTileContent(tileId, { notionDatabaseId: "pending" });
        // Immediately show the database picker and start loading the list
        setupPhase.value = "picking";
        loadDatabases();
      };

      const pollResult = setInterval(() => {
        const raw = localStorage.getItem("notion-oauth-result");
        if (raw) {
          try {
            const result = JSON.parse(raw);
            handleResult(result.error ?? null);
          } catch {
            handleResult("Unexpected response from Notion callback.");
          }
          return;
        }
        // If the popup was closed without writing a result, the user cancelled manually
        if (popup?.closed) {
          if (handled) return;
          handled = true;
          clearInterval(pollResult);
          isConnecting.value = false;
        }
      }, 500);
    };

    const reconnect = () => {
      // Clear the database ID so the tile reverts to disconnected state, then re-trigger OAuth
      layoutStore.patchTileContent(tileId, { notionDatabaseId: "", cachedItems: undefined, lastSyncedAt: undefined });
      showSettings.value = false;
      setupPhase.value = "idle";
      startOAuth();
    };

    // ── Settings save helpers ────────────────────────────────────────
    const saveDatabaseId = () => {
      if (draftDatabaseId.value !== props.content.notionDatabaseId) {
        layoutStore.patchTileContent(tileId, { notionDatabaseId: draftDatabaseId.value.trim() });
      }
    };
    const saveStatusProp = () => layoutStore.patchTileContent(tileId, { statusPropertyName: draftStatusProp.value });
    const saveUpvoteProp = () => layoutStore.patchTileContent(tileId, { upvotePropertyName: draftUpvoteProp.value });
    const setStatusMapping = (notionOption: string, bucket: string) => {
      draftStatusMapping.value = { ...draftStatusMapping.value, [notionOption]: bucket };
      layoutStore.patchTileContent(tileId, { statusMapping: { ...draftStatusMapping.value } });
    };
    const saveAllSettings = () => {
      saveDatabaseId(); saveStatusProp(); saveUpvoteProp();
      layoutStore.patchTileContent(tileId, { statusMapping: { ...draftStatusMapping.value } });
      showSettings.value = false;
      setupPhase.value = "idle";
      refresh();
    };

    // ── Lifecycle ────────────────────────────────────────────────────
    onMounted(() => {
      subscribeToMyUpvote();
      if (props.content.notionDatabaseId === "pending") {
        // Page reloaded while in pending state — reload the database picker
        setupPhase.value = "picking";
        loadDatabases();
      } else if (isConnected.value) {
        // Already fully connected — fetch fresh data and property options
        refresh();
      }
    });

    // Re-subscribe to upvotes if the user signs in or out while the tile is mounted
    watch(currentUser, () => subscribeToMyUpvote());

    // Keep draft fields in sync if content is updated externally (e.g. another browser tab)
    watch(() => props.content.notionDatabaseId, (val) => { draftDatabaseId.value = val === "pending" ? "" : val; });
    watch(() => props.content.statusPropertyName, (val) => { draftStatusProp.value = val; });
    watch(() => props.content.upvotePropertyName, (val) => { draftUpvoteProp.value = val; });
    watch(() => props.content.statusMapping, (val) => { draftStatusMapping.value = { ...val }; });

    onUnmounted(() => {
      if (unsubscribeUpvotes) { unsubscribeUpvotes(); unsubscribeUpvotes = null; }
    });

    return {
      isOwner, isConnected, setupPhase, isConnecting, connectError,
      isLoading, fetchError, hasItems, columns,
      showSettings, draftDatabaseId, draftStatusProp, draftUpvoteProp, draftStatusMapping,
      statusProperties, numberProperties, currentStatusOptions,
      availableDatabases, isLoadingDatabases, selectDatabase,
      myVotedPageId, pendingVoteId, canVote,
      optimisticCount, relativeTime,
      refresh, toggleUpvote, startOAuth, reconnect,
      saveDatabaseId, saveStatusProp, saveUpvoteProp, setStatusMapping, saveAllSettings,
    };
  },
});
</script>

<style scoped>
/* ── Root container ─────────────────────────────────────────────── */
.roadmap-feed {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--tile-padding);
  gap: var(--spacing-sm);
  box-sizing: border-box;
}

/* ── Empty / disconnected state ─────────────────────────────────── */
.roadmap-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  text-align: center;
  color: var(--color-text-primary);
}
.roadmap-empty-icon { opacity: 0.4; margin-bottom: var(--spacing-xs); }
.roadmap-empty-title { font-size: 15px; font-weight: 600; margin: 0; }
.roadmap-empty-subtitle { font-size: 12px; opacity: 0.55; margin: 0; max-width: 200px; }

.roadmap-connect-btn {
  margin-top: var(--spacing-xs);
  padding: 8px 18px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}
.roadmap-connect-btn:hover { opacity: 0.85; }
.roadmap-connect-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.roadmap-error { font-size: 11px; color: var(--color-red); margin: 0; }

/* ── Header ─────────────────────────────────────────────────────── */
.roadmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.roadmap-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
  color: var(--color-text-primary);
}
.roadmap-header-actions { display: flex; align-items: center; gap: var(--spacing-xs); }
.roadmap-synced-at { font-size: 10px; opacity: 0.4; color: var(--color-text-primary); }

.roadmap-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}
.roadmap-icon-btn:hover { opacity: 1; }
.roadmap-icon-btn:disabled { opacity: 0.25; cursor: not-allowed; }

/* Spin animation for the refresh icon while loading */
.is-spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Settings panel ─────────────────────────────────────────────── */
.roadmap-settings {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
  flex-shrink: 0;
  overflow-y: auto;
  max-height: 260px;
}
.roadmap-settings-title {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.5;
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
}
.roadmap-settings-label {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.6;
  margin: 4px 0 2px;
  color: var(--color-text-primary);
}
.roadmap-settings-input,
.roadmap-settings-select {
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  background: color-mix(in srgb, var(--color-tile-background) 90%, var(--color-text-primary) 10%);
  color: var(--color-text-primary);
  font-size: 12px;
  box-sizing: border-box;
}
.roadmap-settings-select--sm { width: auto; flex: 1; }

.roadmap-status-map { display: flex; flex-direction: column; gap: 4px; }
.roadmap-status-map-row { display: flex; align-items: center; gap: 8px; }
.roadmap-status-map-label {
  font-size: 12px;
  flex: 1;
  opacity: 0.8;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.roadmap-settings-save-btn {
  margin-top: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}
.roadmap-settings-save-btn:hover { opacity: 0.85; }

/* ── Database picker ─────────────────────────────────────────────── */
.roadmap-settings-hint {
  font-size: 11px;
  opacity: 0.55;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}
.roadmap-settings-loading {
  font-size: 12px;
  opacity: 0.5;
  color: var(--color-text-primary);
  padding: 8px 0;
}
.roadmap-db-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.roadmap-db-item {
  text-align: left;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  background: color-mix(in srgb, var(--color-tile-background) 90%, var(--color-text-primary) 10%);
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--duration-fast) var(--easing-ease-in-out);
}
.roadmap-db-item:hover {
  background: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}

.roadmap-settings-disconnect-btn {
  padding: 5px 10px;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  background: transparent;
  color: var(--color-text-primary);
  font-size: 11px;
  cursor: pointer;
  opacity: 0.6;
  align-self: flex-start;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}
.roadmap-settings-disconnect-btn:hover { opacity: 1; }

/* ── Loading skeleton ───────────────────────────────────────────── */
.roadmap-loading { display: flex; gap: var(--spacing-sm); flex: 1; }
.roadmap-skeleton-card {
  flex: 1;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* ── Error state ────────────────────────────────────────────────── */
.roadmap-fetch-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-size: 12px;
  opacity: 0.6;
  color: var(--color-text-primary);
}

/* ── Kanban columns ─────────────────────────────────────────────── */
.roadmap-columns {
  display: flex;
  gap: var(--spacing-sm);
  flex: 1;
  min-height: 0; /* allow flex children to shrink below their content height */
  overflow: hidden;
}
.roadmap-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.roadmap-column-header {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-text-primary) 10%, transparent);
}

/* Status indicator dots */
.roadmap-column-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.roadmap-column-dot--backlog     { background: var(--color-blue); }
.roadmap-column-dot--in_progress { background: var(--color-yellow); }
.roadmap-column-dot--done        { background: var(--color-green); }

.roadmap-column-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.55;
  color: var(--color-text-primary);
  flex: 1;
}
.roadmap-column-count {
  font-size: 11px;
  opacity: 0.35;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.roadmap-column-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
  /* Subtle scrollbar so it doesn't feel heavy inside a tile */
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent) transparent;
}

.roadmap-column-empty {
  font-size: 11px;
  opacity: 0.3;
  color: var(--color-text-primary);
  text-align: center;
  padding: var(--spacing-sm) 0;
}

/* ── Roadmap cards ──────────────────────────────────────────────── */
.roadmap-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  transition: background var(--duration-fast) var(--easing-ease-in-out);
}
.roadmap-card:hover {
  background: color-mix(in srgb, var(--color-text-primary) 9%, transparent);
}

.roadmap-card-title {
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
  line-height: 1.4;
}
.roadmap-card-desc {
  font-size: 11px;
  opacity: 0.55;
  margin: 0;
  color: var(--color-text-primary);
  line-height: 1.4;
  /* Clamp to two lines so cards stay compact */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.roadmap-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 2px;
}

/* ── Upvote button ──────────────────────────────────────────────── */
.roadmap-upvote-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  background: transparent;
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.6;
  transition:
    opacity var(--duration-fast) var(--easing-ease-in-out),
    background var(--duration-fast) var(--easing-ease-in-out),
    border-color var(--duration-fast) var(--easing-ease-in-out),
    color var(--duration-fast) var(--easing-ease-in-out);
}
.roadmap-upvote-btn:hover:not(:disabled) { opacity: 1; }
.roadmap-upvote-btn:disabled { cursor: not-allowed; }

/* Active / voted state — filled accent */
.roadmap-upvote-btn.is-voted {
  opacity: 1;
  background: var(--color-blue);
  border-color: var(--color-blue);
  color: #1a1a2e; /* dark text for contrast on the blue accent */
}

/* In-flight state while the Cloud Function is running */
.roadmap-upvote-btn.is-pending {
  opacity: 0.5;
  cursor: wait;
}

.roadmap-upvote-count {
  font-variant-numeric: tabular-nums;
  min-width: 12px;
  text-align: center;
}
</style>
