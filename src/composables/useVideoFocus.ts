import { ref } from 'vue';

interface VideoTileEntry {
  id: string;
  x: number;
  y: number;
  element: HTMLElement;
  isVisible: boolean;
}

const ROTATION_INTERVAL = 15; // seconds – matches preview duration

// ── Singleton state shared across all callers ──
const videoTiles = new Map<string, VideoTileEntry>();
const activeVideoId = ref<string | null>(null);
const hoveredVideoId = ref<string | null>(null);
let observer: IntersectionObserver | null = null;

// ── Round-robin rotation for same-row videos ──
let rotationTimer: ReturnType<typeof setTimeout> | null = null;
let rotationGroup: string[] = [];
let rotationIndex = 0;

function clearRotation() {
  if (rotationTimer !== null) {
    clearTimeout(rotationTimer);
    rotationTimer = null;
  }
}

function scheduleNextRotation() {
  clearRotation();
  if (rotationGroup.length <= 1) return;

  rotationTimer = setTimeout(() => {
    // Don't rotate while user is hovering a specific tile
    if (hoveredVideoId.value && videoTiles.has(hoveredVideoId.value)) {
      scheduleNextRotation();
      return;
    }
    rotationIndex = (rotationIndex + 1) % rotationGroup.length;
    activeVideoId.value = rotationGroup[rotationIndex];
    scheduleNextRotation();
  }, ROTATION_INTERVAL * 1000);
}

function pickActive() {
  // Hover takes priority – pause rotation
  if (hoveredVideoId.value && videoTiles.has(hoveredVideoId.value)) {
    const entry = videoTiles.get(hoveredVideoId.value)!;
    if (entry.isVisible) {
      clearRotation();
      activeVideoId.value = hoveredVideoId.value;
      return;
    }
  }

  // Among visible tiles, pick earliest in reading order (top→bottom, left→right)
  const visible = Array.from(videoTiles.values()).filter((e) => e.isVisible);
  if (visible.length === 0) {
    clearRotation();
    activeVideoId.value = null;
    rotationGroup = [];
    return;
  }

  visible.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

  // Group by the top-most y row
  const topY = visible[0].y;
  const sameRow = visible.filter((v) => v.y === topY);

  if (sameRow.length === 1) {
    clearRotation();
    rotationGroup = [];
    activeVideoId.value = sameRow[0].id;
    return;
  }

  // Multiple videos at the same row – set up round-robin
  const newIds = sameRow.map((v) => v.id);
  const groupChanged =
    newIds.length !== rotationGroup.length ||
    newIds.some((id, i) => id !== rotationGroup[i]);

  if (groupChanged) {
    clearRotation();
    rotationGroup = newIds;
    rotationIndex = 0;
    activeVideoId.value = rotationGroup[0];
    scheduleNextRotation();
  }
  // If group hasn't changed, keep current rotation running
}

function ensureObserver() {
  if (observer) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.videoTileId;
        if (id && videoTiles.has(id)) {
          videoTiles.get(id)!.isVisible = entry.isIntersecting;
        }
      }
      pickActive();
    },
    { threshold: 0.5 }
  );
}

export function useVideoFocus() {
  function register(id: string, x: number, y: number, element: HTMLElement) {
    ensureObserver();
    element.dataset.videoTileId = id;
    videoTiles.set(id, { id, x, y, element, isVisible: false });
    observer!.observe(element);
    // Defer pick so the observer callback can fire first
    requestAnimationFrame(() => pickActive());
  }

  function unregister(id: string) {
    const entry = videoTiles.get(id);
    if (entry) {
      observer?.unobserve(entry.element);
      videoTiles.delete(id);
      if (hoveredVideoId.value === id) hoveredVideoId.value = null;
      pickActive();
    }
  }

  function setHovered(id: string | null) {
    hoveredVideoId.value = id;
    pickActive();
  }

  function updatePosition(id: string, x: number, y: number) {
    const entry = videoTiles.get(id);
    if (entry) {
      entry.x = x;
      entry.y = y;
      pickActive();
    }
  }

  return {
    register,
    unregister,
    setHovered,
    updatePosition,
    activeVideoId,
  };
}
