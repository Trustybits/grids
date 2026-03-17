<template>
  <div
    class="flight-tile"
    :class="[`tile-${effectiveTileSize}`, { 'flight-tile--loading': isLoading }]"
  >
    <!-- Loading spinner overlay -->
    <div v-if="isLoading" class="flight-loading">
      <div class="flight-spinner" />
      <p class="flight-loading-text">Loading flight data...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="flight-error">
      <svg class="flight-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p>{{ errorMessage }}</p>
      <button class="flight-retry-btn" @click="fetchFlightData">Retry</button>
    </div>

    <!-- ════════════════════════════════════════════════════════════
         1×1: Minimal — just status badge + airport codes
         ════════════════════════════════════════════════════════════ -->
    <template v-else-if="effectiveTileSize === '1x1'">
      <div class="flight-mini">
        <div class="flight-mini-header">
          <span class="flight-status-dot" :class="statusClass" />
          <span class="flight-ident-mini">{{ displayFlightNumber }}</span>
        </div>
        <div class="flight-mini-route">
          <span class="airport-code">{{ content.originCode || '---' }}</span>
          <svg class="flight-arrow-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
          <span class="airport-code">{{ content.destinationCode || '---' }}</span>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════════
         2×2: Compact card — route + times + progress bar
         ════════════════════════════════════════════════════════════ -->
    <template v-else-if="effectiveTileSize === '2x2'">
      <div class="flight-card">
        <!-- Header: flight number + status -->
        <div class="flight-card-header">
          <div class="flight-card-ident">
            <span class="flight-number">{{ displayFlightNumber }}</span>
            <span v-if="content.aircraftType" class="flight-aircraft">{{ content.aircraftType }}</span>
          </div>
          <span class="flight-status-badge" :class="statusClass">{{ content.status || 'Unknown' }}</span>
        </div>

        <!-- Route: origin → destination -->
        <div class="flight-route">
          <div class="flight-airport flight-airport--origin">
            <span class="airport-code-lg">{{ content.originCode || '---' }}</span>
            <span class="airport-city">{{ originCityShort }}</span>
          </div>
          <div class="flight-route-line">
            <div class="route-line" />
            <svg class="flight-plane-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"
              :style="{ left: `${content.progressPercent ?? 0}%` }">
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
          <div class="flight-airport flight-airport--dest">
            <span class="airport-code-lg">{{ content.destinationCode || '---' }}</span>
            <span class="airport-city">{{ destCityShort }}</span>
          </div>
        </div>

        <!-- Times row -->
        <div class="flight-times">
          <div class="flight-time flight-time--dep">
            <span class="time-label">Depart</span>
            <span class="time-value">{{ formattedDeparture }}</span>
          </div>
          <div class="flight-time flight-time--arr">
            <span class="time-label">Arrive</span>
            <span class="time-value">{{ formattedArrival }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════════
         4×4 / wide: Full detail card with delays, gate, altitude
         ════════════════════════════════════════════════════════════ -->
    <template v-else>
      <div class="flight-full">
        <!-- Header -->
        <div class="flight-full-header">
          <div class="flight-full-ident">
            <span class="flight-number-lg">{{ displayFlightNumber }}</span>
            <span v-if="content.airlineName" class="flight-airline">{{ content.airlineName }}</span>
          </div>
          <span class="flight-status-badge flight-status-badge--lg" :class="statusClass">{{ content.status || 'Unknown' }}</span>
        </div>

        <!-- Route with progress -->
        <div class="flight-route flight-route--full">
          <div class="flight-airport flight-airport--origin">
            <span class="airport-code-xl">{{ content.originCode || '---' }}</span>
            <span class="airport-name">{{ content.originName || '' }}</span>
            <span class="airport-city">{{ originCityShort }}</span>
          </div>
          <div class="flight-route-center">
            <div class="flight-route-line flight-route-line--full">
              <div class="route-line" />
              <svg class="flight-plane-icon" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"
                :style="{ left: `${content.progressPercent ?? 0}%` }">
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
            <span v-if="formattedDuration" class="flight-duration">{{ formattedDuration }}</span>
          </div>
          <div class="flight-airport flight-airport--dest">
            <span class="airport-code-xl">{{ content.destinationCode || '---' }}</span>
            <span class="airport-name">{{ content.destinationName || '' }}</span>
            <span class="airport-city">{{ destCityShort }}</span>
          </div>
        </div>

        <!-- Times detail grid -->
        <div class="flight-detail-grid">
          <div class="flight-detail-col">
            <div class="flight-detail-row">
              <span class="detail-label">Scheduled Dep</span>
              <span class="detail-value">{{ formatTime(content.scheduledDeparture, content.originTimezone) }}</span>
            </div>
            <div class="flight-detail-row">
              <span class="detail-label">Actual Dep</span>
              <span class="detail-value" :class="{ 'delay-positive': (content.departureDelay ?? 0) > 60 }">
                {{ formatTime(content.actualDeparture, content.originTimezone) || '—' }}
                <span v-if="content.departureDelay && content.departureDelay > 60" class="delay-badge">+{{ formatDelayMinutes(content.departureDelay) }}</span>
              </span>
            </div>
            <div v-if="content.originGate || content.originTerminal" class="flight-detail-row">
              <span class="detail-label">Gate / Terminal</span>
              <span class="detail-value">{{ [content.originGate, content.originTerminal].filter(Boolean).join(' / ') }}</span>
            </div>
          </div>
          <div class="flight-detail-col">
            <div class="flight-detail-row">
              <span class="detail-label">Scheduled Arr</span>
              <span class="detail-value">{{ formatTime(content.scheduledArrival, content.destinationTimezone) }}</span>
            </div>
            <div class="flight-detail-row">
              <span class="detail-label">{{ content.actualArrival ? 'Actual Arr' : 'Est. Arr' }}</span>
              <span class="detail-value" :class="{ 'delay-positive': (content.arrivalDelay ?? 0) > 60 }">
                {{ formatTime(content.actualArrival || content.estimatedArrival, content.destinationTimezone) || '—' }}
                <span v-if="content.arrivalDelay && content.arrivalDelay > 60" class="delay-badge">+{{ formatDelayMinutes(content.arrivalDelay) }}</span>
              </span>
            </div>
            <div v-if="content.destinationGate || content.destinationTerminal" class="flight-detail-row">
              <span class="detail-label">Gate / Terminal</span>
              <span class="detail-value">{{ [content.destinationGate, content.destinationTerminal].filter(Boolean).join(' / ') }}</span>
            </div>
          </div>
        </div>

        <!-- Live stats (altitude, speed, heading) — only when en route -->
        <div v-if="content.status === 'En Route' && hasLiveStats" class="flight-live-stats">
          <div v-if="content.altitude != null" class="live-stat">
            <span class="live-stat-value">{{ content.altitude.toLocaleString() }}</span>
            <span class="live-stat-unit">ft</span>
          </div>
          <div v-if="content.groundspeed != null" class="live-stat">
            <span class="live-stat-value">{{ content.groundspeed }}</span>
            <span class="live-stat-unit">kts</span>
          </div>
          <div v-if="content.heading != null" class="live-stat">
            <span class="live-stat-value">{{ content.heading }}°</span>
            <span class="live-stat-unit">hdg</span>
          </div>
          <div v-if="content.aircraftType" class="live-stat">
            <span class="live-stat-value">{{ content.aircraftType }}</span>
            <span class="live-stat-unit">type</span>
          </div>
        </div>

        <!-- FlightAware attribution link -->
        <a
          class="flight-attribution"
          :href="content.flightAwareUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on FlightAware ↗
        </a>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, onMounted, type ComputedRef } from "vue";
import { type FlightContent } from "@/types/TileContent";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => FlightContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const tileId = inject<string | null>("tileId", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);

    const isLoading = ref(false);
    const hasError = ref(false);
    const errorMessage = ref("Failed to load flight data");

    const w = computed(() => gridTileW?.value ?? 2);
    const h = computed(() => gridTileH?.value ?? 2);

    // Determine tile size bucket based on grid dimensions
    const effectiveTileSize = computed(() => {
      const cw = w.value;
      const ch = h.value;
      if (cw <= 1 && ch <= 1) return "1x1";
      if (cw <= 2 && ch <= 2) return "2x2";
      return "4x4"; // 3+ wide or tall gets the full layout
    });

    // ── Derived display values ───────────────────────────────────────

    const displayFlightNumber = computed(() =>
      props.content.flightNumber || props.content.flightIdent || "—"
    );

    // Truncate city names for compact layouts (e.g. "Salt Lake City, UT" → "Salt Lake City")
    const originCityShort = computed(() => truncateCity(props.content.originCity));
    const destCityShort = computed(() => truncateCity(props.content.destinationCity));

    // Status CSS class for color-coding
    const statusClass = computed(() => {
      switch (props.content.status) {
        case "En Route": return "status--enroute";
        case "Arrived": return "status--arrived";
        case "Scheduled": return "status--scheduled";
        case "Cancelled": return "status--cancelled";
        case "Diverted": return "status--diverted";
        default: return "status--unknown";
      }
    });

    const hasLiveStats = computed(() =>
      props.content.altitude != null ||
      props.content.groundspeed != null ||
      props.content.heading != null
    );

    // Formatted scheduled duration (e.g. "4h 32m")
    const formattedDuration = computed(() => {
      const secs = props.content.durationScheduled;
      if (!secs || secs <= 0) return "";
      const hrs = Math.floor(secs / 3600);
      const mins = Math.round((secs % 3600) / 60);
      return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    });

    // ── Time formatting ──────────────────────────────────────────────

    /**
     * Format an ISO 8601 timestamp to a short local time string.
     * Uses the airport's timezone if available for accurate local times.
     */
    function formatTime(iso?: string | null, tz?: string): string {
      if (!iso) return "—";
      try {
        const d = new Date(iso);
        const options: Intl.DateTimeFormatOptions = {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        };
        if (tz) options.timeZone = tz;
        return d.toLocaleTimeString("en-US", options);
      } catch {
        return "—";
      }
    }

    // Formatted departure/arrival for the compact 2×2 layout
    const formattedDeparture = computed(() =>
      formatTime(
        props.content.actualDeparture || props.content.scheduledDeparture,
        props.content.originTimezone
      )
    );
    const formattedArrival = computed(() =>
      formatTime(
        props.content.actualArrival || props.content.estimatedArrival || props.content.scheduledArrival,
        props.content.destinationTimezone
      )
    );

    /**
     * Convert a delay in seconds to a human-readable minutes string.
     */
    function formatDelayMinutes(seconds?: number): string {
      if (!seconds || seconds <= 0) return "";
      const mins = Math.round(seconds / 60);
      return `${mins}m`;
    }

    function truncateCity(city?: string): string {
      if (!city) return "";
      // Remove state/country suffix after comma for compact display
      const comma = city.indexOf(",");
      return comma > 0 ? city.substring(0, comma) : city;
    }

    // ── Data fetching ────────────────────────────────────────────────

    // Stale threshold: refetch if data is older than 5 minutes
    const STALE_MS = 5 * 60 * 1000;

    async function fetchFlightData() {
      if (!props.content.flightIdent) return;

      isLoading.value = true;
      hasError.value = false;

      try {
        const getFlightData = httpsCallable(functions, "getFlightData");
        const result = await getFlightData({ flightIdent: props.content.flightIdent });
        const data = result.data as Record<string, any>;

        // Patch the tile content with the fetched flight data.
        // This persists the data to Firestore so subsequent renders
        // don't need to re-fetch until the data goes stale.
        if (tileId) {
          layoutStore.patchTileContent(tileId, {
            ...data,
            lastFetchedAt: Date.now(),
          });
        }
      } catch (err: any) {
        hasError.value = true;
        errorMessage.value = err?.message || "Failed to load flight data";
        console.error("[FlightContent] fetch error:", err);
      } finally {
        isLoading.value = false;
      }
    }

    onMounted(() => {
      // Fetch flight data if we don't have it yet or if it's stale
      const lastFetched = props.content.lastFetchedAt;
      const isStale = !lastFetched || Date.now() - lastFetched > STALE_MS;
      const hasData = !!props.content.status;

      if (!hasData || isStale) {
        fetchFlightData();
      }
    });

    return {
      isLoading,
      hasError,
      errorMessage,
      effectiveTileSize,
      displayFlightNumber,
      originCityShort,
      destCityShort,
      statusClass,
      hasLiveStats,
      formattedDuration,
      formattedDeparture,
      formattedArrival,
      formatTime,
      formatDelayMinutes,
      fetchFlightData,
    };
  },
});
</script>

<style scoped>
/* ── Base container ────────────────────────────────────────────────── */
.flight-tile {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: inherit;
  color: var(--color-text, #e0e0e0);
  display: flex;
  flex-direction: column;
}

/* ── Loading state ─────────────────────────────────────────────────── */
.flight-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  opacity: 0.6;
}

.flight-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.flight-loading-text {
  font-size: 12px;
  margin: 0;
}

/* ── Error state ───────────────────────────────────────────────────── */
.flight-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  text-align: center;
  padding: 12px;
}

.flight-error-icon {
  opacity: 0.5;
}

.flight-error p {
  margin: 0;
  font-size: 13px;
  opacity: 0.7;
}

.flight-retry-btn {
  margin-top: 4px;
  padding: 4px 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.flight-retry-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* ── Status colors ─────────────────────────────────────────────────── */
.status--enroute { --status-color: #3b82f6; }
.status--arrived { --status-color: #22c55e; }
.status--scheduled { --status-color: #a3a3a3; }
.status--cancelled { --status-color: #ef4444; }
.status--diverted { --status-color: #f59e0b; }
.status--unknown { --status-color: #737373; }

.flight-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-color);
  flex-shrink: 0;
}

.flight-status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--status-color);
  color: #fff;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.flight-status-badge--lg {
  font-size: 12px;
  padding: 3px 10px;
}

/* ── 1×1 Mini layout ──────────────────────────────────────────────── */
.flight-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 6px;
  padding: 8px;
}

.flight-mini-header {
  display: flex;
  align-items: center;
  gap: 5px;
}

.flight-ident-mini {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.flight-mini-route {
  display: flex;
  align-items: center;
  gap: 4px;
}

.flight-arrow-icon {
  opacity: 0.5;
  transform: rotate(90deg);
}

.airport-code {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
}

/* ── 2×2 Card layout ──────────────────────────────────────────────── */
.flight-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 8px;
}

.flight-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.flight-card-ident {
  display: flex;
  flex-direction: column;
}

.flight-number {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.flight-aircraft {
  font-size: 11px;
  opacity: 0.5;
}

/* Route visualization */
.flight-route {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.flight-airport {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.airport-code-lg {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.airport-code-xl {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.airport-city {
  font-size: 10px;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.airport-name {
  font-size: 10px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  text-align: center;
}

/* The progress line between origin and destination */
.flight-route-line {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  min-width: 40px;
}

.route-line {
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 1px;
}

/* Animated plane icon along the route line */
.flight-plane-icon {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
  transition: left 0.5s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* Times row */
.flight-times {
  display: flex;
  justify-content: space-between;
}

.flight-time {
  display: flex;
  flex-direction: column;
}

.time-label {
  font-size: 10px;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.time-value {
  font-size: 14px;
  font-weight: 600;
}

.flight-time--arr {
  text-align: right;
}

/* ── 4×4 Full layout ──────────────────────────────────────────────── */
.flight-full {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 12px;
}

.flight-full-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.flight-full-ident {
  display: flex;
  flex-direction: column;
}

.flight-number-lg {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.flight-airline {
  font-size: 12px;
  opacity: 0.5;
}

.flight-route--full {
  padding: 8px 0;
}

.flight-route-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 60px;
}

.flight-route-line--full {
  width: 100%;
}

.flight-duration {
  font-size: 11px;
  opacity: 0.45;
}

/* Detail grid: departure info on left, arrival on right */
.flight-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}

.flight-detail-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Right column aligns text to the right */
.flight-detail-col:last-child {
  text-align: right;
}

.flight-detail-row {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 10px;
  opacity: 0.45;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-value {
  font-size: 13px;
  font-weight: 500;
}

/* Red highlight for delayed times */
.delay-positive {
  color: #f87171;
}

.delay-badge {
  font-size: 10px;
  font-weight: 600;
  color: #fca5a5;
  margin-left: 4px;
}

/* Live statistics bar (altitude, speed, heading) */
.flight-live-stats {
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.live-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.live-stat-value {
  font-size: 14px;
  font-weight: 600;
}

.live-stat-unit {
  font-size: 10px;
  opacity: 0.4;
  text-transform: uppercase;
}

/* Attribution link */
.flight-attribution {
  font-size: 10px;
  opacity: 0.35;
  text-decoration: none;
  color: inherit;
  text-align: center;
  margin-top: auto;
  transition: opacity 0.15s;
}

.flight-attribution:hover {
  opacity: 0.6;
}
</style>
