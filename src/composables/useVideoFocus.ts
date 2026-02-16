import { ref } from 'vue';

interface VideoTileEntry {
  id: string;
  x: number;
  y: number;
  element: HTMLElement;
  isVisible: boolean;
}

const ROTATION_INTERVAL = 3; // seconds per video in the round-robin

// ── Singleton state shared across all callers ──
const videoTiles = new Map<string, VideoTileEntry>();
const activeVideoId = ref<string | null>(null);
const hoveredVideoId = ref<string | null>(null);
let observer: IntersectionObserver | null = null;

// ── Round-robin rotation across ALL visible videos ──
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

  // Collect all visible videos, sorted by grid position (top→bottom, left→right)
  const visible = Array.from(videoTiles.values()).filter((e) => e.isVisible);
  if (visible.length === 0) {
    clearRotation();
    activeVideoId.value = null;
    rotationGroup = [];
    return;
  }

  visible.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  const newIds = visible.map((v) => v.id);

  // Single visible video — no rotation needed
  if (newIds.length === 1) {
    clearRotation();
    rotationGroup = newIds;
    rotationIndex = 0;
    activeVideoId.value = newIds[0];
    return;
  }

  // Multiple visible videos — round-robin through all of them
  const groupChanged =
    newIds.length !== rotationGroup.length ||
    newIds.some((id, i) => id !== rotationGroup[i]);

  if (groupChanged) {
    // Try to keep the current active video if it's still in the new group
    const currentId = activeVideoId.value;
    const currentIdx = currentId ? newIds.indexOf(currentId) : -1;

    clearRotation();
    rotationGroup = newIds;
    rotationIndex = currentIdx >= 0 ? currentIdx : 0;
    activeVideoId.value = rotationGroup[rotationIndex];
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
