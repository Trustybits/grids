/**
 * useBadges — reactive view of a user's earned badges
 *
 * Subscribes to `userBadges/{userId}` via BadgeService and exposes the
 * badges as a reactive list, plus per-badge metadata (label, description,
 * icon component) for rendering.
 *
 * The `userBadges` collection is publicly readable, so this works for any
 * user — pass a slug page visitor's resolved userId to display their badges.
 *
 * ── Adding a new badge ────────────────────────────────────────────────────
 *
 *   1. Add the ID to `BadgeId` / `BADGE_IDS` in `@/types/Badge.ts`
 *   2. Add a metadata entry to `BADGE_META` below (label, description, icon)
 *   3. Decide how it's granted (Cloud Function trigger, admin script, etc.)
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   // Static user ID
 *   const { earnedBadges, hasBadge } = useBadges('uid-abc')
 *
 *   // Reactive user ID (e.g. from an async slug resolution)
 *   const userId = ref<string | null>(null)
 *   const { earnedBadges } = useBadges(userId)
 */

import {
  computed,
  onUnmounted,
  ref,
  toValue,
  watch,
  type Component,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { getServiceFactory } from '@/services/ServiceFactorySingleton'
import { BADGE_IDS, type BadgeId, type UserBadges } from '@/types/Badge'
import EarlyAdopterBadgeIcon from '@/components/icons/badges/EarlyAdopterBadgeIcon.vue'
import SupporterBadgeIcon from '@/components/icons/badges/SupporterBadgeIcon.vue'

// ── Display metadata ───────────────────────────────────────────────────────

export interface BadgeMeta {
  /** Short human-readable name shown in tooltips and UI */
  label: string
  /** Longer description for hover cards / settings pages */
  description: string
  /** Vue component rendered as the badge icon */
  icon: Component
}

/**
 * Per-badge display metadata. Keep keys aligned with `BadgeId` so the
 * compiler enforces full coverage when adding new badges.
 */
export const BADGE_META: Record<BadgeId, BadgeMeta> = {
  earlyAdopter: {
    label: 'Early Adopter',
    description: 'Joined Grids in its earliest days.',
    icon: EarlyAdopterBadgeIcon,
  },
  supporter: {
    label: 'Supporter',
    description: 'Backed Grids through the pay-what-you-want supporter tier.',
    icon: SupporterBadgeIcon,
  },
}

// ── Earned badge view model ────────────────────────────────────────────────

export interface EarnedBadge {
  id: BadgeId
  earnedAt: Date
  meta: BadgeMeta
}

// ── Composable ─────────────────────────────────────────────────────────────

export interface UseBadgesReturn {
  badges: ComputedRef<UserBadges>
  earnedBadges: ComputedRef<EarnedBadge[]>
  hasBadge: (id: BadgeId) => boolean
  isLoading: ComputedRef<boolean>
}

export function useBadges(
  userId: MaybeRefOrGetter<string | null | undefined>,
): UseBadgesReturn {
  const _badges = ref<UserBadges>({})
  const _loading = ref(true)
  let unsub: (() => void) | null = null

  const stop = watch(
    () => toValue(userId),
    (uid) => {
      unsub?.()
      unsub = null
      _badges.value = {}

      if (!uid) {
        _loading.value = false
        return
      }

      _loading.value = true
      unsub = getServiceFactory()
        .getBadgeService()
        .subscribeToBadges(uid, (badges) => {
          _badges.value = badges ?? {}
          _loading.value = false
        })
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stop()
    unsub?.()
    unsub = null
  })

  const badges = computed(() => _badges.value)
  const isLoading = computed(() => _loading.value)

  const earnedBadges = computed<EarnedBadge[]>(() => {
    const list: EarnedBadge[] = []
    for (const id of BADGE_IDS) {
      const entry = _badges.value[id]
      if (entry) {
        list.push({ id, earnedAt: entry.earnedAt, meta: BADGE_META[id] })
      }
    }
    // Most recent first — flip if you want chronological order.
    return list.sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())
  })

  function hasBadge(id: BadgeId): boolean {
    return Boolean(_badges.value[id])
  }

  return { badges, earnedBadges, hasBadge, isLoading }
}
