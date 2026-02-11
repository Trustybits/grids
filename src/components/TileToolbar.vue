<template>
  <div
    v-if="items.length"
    class="tile-toolbar"
    :class="{ 'tile-toolbar-force-show': menuOpen || panelOpen }"
    @mousedown.stop
  >
    <template v-for="(item, idx) in visibleItems" :key="item.id">
      <div v-if="shouldShowDivider(idx)" class="toolbar-divider"></div>
      <button
        :ref="(el) => {
          if (item.menuItems) menuAnchorRef = el as HTMLButtonElement
          if (item.panelId) panelAnchorRef = el as HTMLButtonElement
        }"
        class="toolbar-btn"
        :class="[
          item.cssClass,
          { 'is-active': item.isActive?.(ctx) || (item.panelId && panelOpen && activePanelId === item.panelId) }
        ]"
        :title="resolveTitle(item)"
        @click.stop="onItemClick(item)"
      >
        <component :is="item.icon" />
      </button>
    </template>
  </div>

  <!-- Search Panel -->
  <div
    v-if="panelOpen && activePanelId === 'search'"
    ref="searchPanelRef"
    class="toolbar-search-panel"
    @mousedown.stop
  >
    <button
      class="search-panel-btn"
      title="My location"
      @click.stop="onLocateClick"
    >
      <LocateFixedIcon />
    </button>
    <div class="search-panel-divider"></div>
    <input
      ref="searchInputRef"
      class="search-panel-input"
      type="text"
      placeholder="address or zip"
      v-model="searchQuery"
      @keydown.enter.stop="onSearchSubmit"
    />
    <button
      class="search-panel-btn"
      title="Search map"
      @click.stop="onSearchSubmit"
    >
      <SearchIcon />
    </button>
  </div>

  <teleport to="body">
    <div
      v-if="menuOpen && activeMenuItems.length"
      ref="menuRef"
      class="tile-toolbar-menu"
      :style="menuStyle"
      @mousedown.stop
    >
      <template v-for="mi in visibleMenuItems" :key="mi.id">
        <button
          type="button"
          class="tile-toolbar-menu-item"
          :class="{ 'tile-toolbar-menu-item--danger': mi.danger }"
          @click.stop="onMenuItemClick(mi)"
        >
          <component v-if="mi.icon" :is="mi.icon" />
          <template v-if="mi.label">{{ mi.label }}</template>
        </button>
      </template>
    </div>
  </teleport>
</template>

<script lang="ts">
import {
  defineComponent,
  computed,
  ref,
  nextTick,
  onMounted,
  onUnmounted,
  watch,
  type PropType,
} from 'vue'
import type { Tile } from '@/types/Tile'
import type {
  ToolbarItem,
  ToolbarMenuItem,
  ToolbarContext,
} from '@/types/TileToolbar'
import { getToolbarItems } from '@/utils/toolbarRegistry'
import { useLayoutStore } from '@/stores/layout'
import LocateFixedIcon from './icons/toolbar/LocateFixedIcon.vue'
import SearchIcon from './icons/toolbar/SearchIcon.vue'

export default defineComponent({
  components: {
    LocateFixedIcon,
    SearchIcon,
  },
  props: {
    tile: {
      type: Object as PropType<Tile>,
      required: true,
    },
    toolbarRefs: {
      type: Object as PropType<{ childComponent: any; isEditing: any; isExitingCropMode: any }>,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore()

    const menuAnchorRef = ref<HTMLButtonElement | null>(null)
    const menuRef = ref<HTMLDivElement | null>(null)
    const menuPosition = ref({ x: 0, y: 0 })

    // Panel state (e.g. search bar)
    const panelOpen = ref(false)
    const activePanelId = ref<string | null>(null)
    const panelAnchorRef = ref<HTMLButtonElement | null>(null)
    const searchPanelRef = ref<HTMLDivElement | null>(null)
    const searchInputRef = ref<HTMLInputElement | null>(null)
    const searchQuery = ref('')

    const menuOpen = computed(() => layoutStore?.activeMenuTileId === props.tile.i)

    const ctx = computed<ToolbarContext>(() => ({
      tile: props.tile,
      childComponent: props.toolbarRefs.childComponent,
      layoutStore,
      isEditing: props.toolbarRefs.isEditing,
      isExitingCropMode: props.toolbarRefs.isExitingCropMode,
    }))

    const items = computed(() => getToolbarItems(props.tile.content.type))

    const visibleItems = computed(() =>
      items.value.filter((item) => item.visible?.(ctx.value) ?? true)
    )

    const activeMenuItems = computed<ToolbarMenuItem[]>(() => {
      const menuItem = items.value.find((i) => i.menuItems)
      return menuItem?.menuItems ?? []
    })

    const visibleMenuItems = computed(() =>
      activeMenuItems.value.filter((mi) => mi.visible?.(ctx.value) ?? true)
    )

    const resolveTitle = (item: ToolbarItem): string => {
      return typeof item.title === 'function' ? item.title(ctx.value) : item.title
    }

    const shouldShowDivider = (idx: number): boolean => {
      if (idx === 0) return false
      const prev = visibleItems.value[idx - 1]
      const curr = visibleItems.value[idx]
      return !!prev.group && !!curr.group && prev.group !== curr.group
    }

    const clampToViewport = (x: number, y: number, w: number, h: number) => {
      const pad = 8
      return {
        x: Math.max(pad, Math.min(x, window.innerWidth - w - pad)),
        y: Math.max(pad, Math.min(y, window.innerHeight - h - pad)),
      }
    }

    const positionMenu = () => {
      const btn = menuAnchorRef.value
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const fallbackW = 190
      const fallbackH = 112
      const fallbackX = rect.right - fallbackW
      const fallbackY = rect.bottom + 8
      menuPosition.value = clampToViewport(fallbackX, fallbackY, fallbackW, fallbackH)

      nextTick(() => {
        const menu = menuRef.value
        if (!menu) return
        const { width, height } = menu.getBoundingClientRect()
        const nextX = rect.right - width
        const nextY = rect.bottom + 8
        menuPosition.value = clampToViewport(nextX, nextY, width, height)
      })
    }

    const menuStyle = computed(() => ({
      top: `${menuPosition.value.y}px`,
      left: `${menuPosition.value.x}px`,
    }))

    const closeMenu = () => {
      layoutStore.closeAllMenus()
    }

    const closePanel = () => {
      panelOpen.value = false
      activePanelId.value = null
    }

    const onItemClick = (item: ToolbarItem) => {
      // Handle panel items (e.g. search)
      if (item.panelId) {
        if (panelOpen.value && activePanelId.value === item.panelId) {
          closePanel()
        } else {
          closeMenu()
          panelOpen.value = true
          activePanelId.value = item.panelId
          nextTick(() => {
            searchInputRef.value?.focus()
          })
        }
        return
      }

      // Handle menu items
      if (item.menuItems) {
        if (menuOpen.value) {
          closeMenu()
        } else {
          closePanel()
          layoutStore.setActiveMenuTile(props.tile.i)
          nextTick(positionMenu)
        }
        return
      }

      item.action(ctx.value)
    }

    const onMenuItemClick = (mi: ToolbarMenuItem) => {
      closeMenu()
      mi.action(ctx.value)
    }

    const onLocateClick = () => {
      props.toolbarRefs.childComponent?.value?.useMyLocation?.()
    }

    const onSearchSubmit = () => {
      const query = searchQuery.value.trim()
      const child = props.toolbarRefs.childComponent?.value
      if (!child) return
      child.searchInput = query
      child.handleSearch?.()
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Close menu if open
      if (menuOpen.value) {
        if (menuRef.value?.contains(target)) return
        if (menuAnchorRef.value?.contains(target)) return
        closeMenu()
      }

      // Close panel if open
      if (panelOpen.value) {
        if (searchPanelRef.value?.contains(target)) return
        if (panelAnchorRef.value?.contains(target)) return
        closePanel()
      }
    }

    // Reposition the menu when it opens
    watch(menuOpen, (open) => {
      if (open) {
        nextTick(positionMenu)
      }
    })

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('contextmenu', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('contextmenu', handleClickOutside)
    })

    return {
      items,
      visibleItems,
      visibleMenuItems,
      activeMenuItems,
      ctx,
      menuOpen,
      menuAnchorRef,
      menuRef,
      menuStyle,
      menuPosition,
      resolveTitle,
      shouldShowDivider,
      onItemClick,
      onMenuItemClick,

      // Panel
      panelOpen,
      activePanelId,
      panelAnchorRef,
      searchPanelRef,
      searchInputRef,
      searchQuery,
      onLocateClick,
      onSearchSubmit,
    }
  },
})
</script>

<style scoped lang="scss">
/* Tile Toolbar */
.tile-toolbar {
  position: absolute;
  bottom: 4px;
  left: 50%;
  z-index: 100;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-wrap: nowrap;
  
  /* Hidden by default with smooth animation properties */
  opacity: 0;
  transform: translate(-50%, calc(100% + 10px)) scale(0.9);
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-out),
              transform var(--duration-normal) var(--easing-spring);
  
  /* Toolbar styling matching close button */
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 12px;
  padding: 4px;
}

.tile-toolbar-force-show {
  opacity: 1;
  transform: translate(-50%, 100%) scale(1);
  pointer-events: auto;
}

.toolbar-btn {
  background-color: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-sm);
  height: 36px;
  width: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-ease-in-out),
              transform var(--duration-fast) var(--easing-ease-out),
              color var(--duration-fast) var(--easing-ease-in-out);

  :deep(svg) {
    width: 28px;
    height: 28px;
    display: block;
  }

  &:hover {
    background-color: var(--color-content-low);
    transform: scale(1.05);
  }

  &.is-active {
    background-color: var(--color-text-primary);
    color: var(--color-tile-background);
    border-radius: var(--radius-sm);
    transform: none;
  }
}

.toolbar-btn--border :deep(.border-slash) {
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
  opacity: 0;
  transition: stroke-dashoffset var(--duration-normal) var(--easing-spring),
    opacity var(--duration-fast) var(--easing-ease-in-out);
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  margin: 2px;
  background-color: var(--color-tile-stroke);
  border-radius: 20px;
}

/* Search Panel */
.toolbar-search-panel {
  position: absolute;
  bottom: 4px;
  left: 50%;
  z-index: 99;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  white-space: nowrap;

  /* Positioned below the toolbar */
  transform: translate(-50%, calc(100% + 48px));

  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 12px;
  padding: 4px;

  animation: searchPanelSlideIn var(--duration-normal) var(--easing-spring);
}

@keyframes searchPanelSlideIn {
  from {
    opacity: 0;
    transform: translate(-50%, calc(100% + 40px)) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, calc(100% + 48px)) scale(1);
  }
}

.search-panel-btn {
  background-color: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-sm);
  height: 36px;
  width: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--duration-fast) var(--easing-ease-in-out),
              transform var(--duration-fast) var(--easing-ease-out),
              color var(--duration-fast) var(--easing-ease-in-out);

  :deep(svg) {
    width: 22px;
    height: 22px;
    display: block;
  }

  &:hover {
    background-color: var(--color-content-low);
    transform: scale(1.05);
  }
}

.search-panel-divider {
  width: 1px;
  height: 24px;
  margin: 0 4px;
  background-color: var(--color-tile-stroke);
  border-radius: 20px;
  flex-shrink: 0;
}

.search-panel-input {
  flex: 1;
  min-width: 160px;
  height: 36px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 36px;
  outline: none;

  &::placeholder {
    color: var(--color-content-default);
    opacity: 0.6;
  }
}
</style>

<style lang="scss">
/* Unscoped styles for the teleported menu */
.tile-toolbar-menu {
  position: fixed;
  z-index: 1200;
  min-width: 50px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-tile-hover);
}

.tile-toolbar-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  text-align: left;
  font-size: 12px;
  line-height: 1;
}

.tile-toolbar-menu-item:hover {
  background: var(--color-content-low);
}

.tile-toolbar-menu-item--danger {
  color: #ff3737;
}
</style>
