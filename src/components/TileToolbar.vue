<template>
  <div
    v-if="items.length"
    ref="toolbarRef"
    class="tile-toolbar"
    :class="{ 'tile-toolbar-force-show': menuOpen || panelOpen }"
    @mousedown.stop
  >
    <template v-for="(item, idx) in visibleItems" :key="item.id">
      <div v-if="shouldShowDivider(idx)" class="toolbar-divider"></div>
      <button
        class="toolbar-btn"
        :class="[
          item.cssClass,
          {
            'is-active':
              item.isActive?.(ctx) ||
              (item.panelId && panelOpen && activePanelId === item.panelId),
          },
        ]"
        :data-tooltip="resolveTitle(item)"
        @click.stop="onItemClick($event, item)"
      >
        <component :is="resolveIcon(item)" />
      </button>
    </template>
  </div>

  <!-- Search Panel -->
  <div
    v-if="panelOpen && activePanelId === 'search'"
    ref="searchPanelRef"
    class="toolbar-search-panel glass"
    @mousedown.stop
  >
    <button
      class="search-panel-btn"
      data-tooltip="My location"
      @click.stop="onLocateClick"
    >
      <CurrentLocationIcon />
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
      data-tooltip="Search map"
      @click.stop="onSearchSubmit"
    >
      <SearchIcon />
    </button>
  </div>

  <!-- Color Picker Panel -->
  <teleport to="body">
    <transition name="panel">
      <ColorPicker
        v-if="panelOpen && activePanelId === 'colorSelect'"
        ref="colorPickerRef"
        :tile="tile"
        :childComponent="childComponent"
        :buttonEl="panelAnchorRef"
      />
    </transition>
  </teleport>

  <!-- Text Align Panel -->
  <teleport to="body">
    <transition name="panel">
      <TextAlignPanel
        v-if="panelOpen && activePanelId === 'textAlign'"
        ref="textAlignPanelRef"
        :tile="tile"
        :childComponent="childComponent"
        :buttonEl="panelAnchorRef"
      />
    </transition>
  </teleport>

  <teleport to="body">
    <transition name="tile-toolbar-menu">
      <div
        v-if="menuOpen && activeMenuItems.length"
        ref="menuRef"
        class="tile-toolbar-menu"
        :style="[menuStyle, { 'flex-direction': menuItemLayoutDirection }]"
        @mousedown.stop
        @click.stop
        @dragstart.prevent
      >
        <template v-for="mi in visibleMenuItems" :key="mi.id">
          <button
            v-if="mi.id !== 'font-size' && mi.id !== 'font-family'"
            type="button"
            class="tile-toolbar-menu-item"
            :class="[
              { 'tile-toolbar-menu-item--danger': mi.danger },
              { 'is-active': mi.isActive?.(ctx) },
            ]"
            :data-tooltip="mi.tooltip"
            @mousedown.prevent
            @click="onMenuItemClick(mi)"
          >
            <component v-if="mi.icon" :is="mi.icon" />
            <template v-if="mi.label">{{ mi.label }}</template>
          </button>
          <div
            v-if="mi.id === 'font-size'"
            class="tile-toolbar-menu-item"
            :data-tooltip="mi.tooltip"
            style="display: flex; flex: 1; align-self: stretch; padding: 0"
          >
            <FontSizeSelector
              ref="fontSizeSelectorRef"
              :childComponent="childComponent"
              @open-intent="onFontSelectorIntent"
              style="flex: 1; align-self: stretch"
            />
          </div>
          <div
            v-if="mi.id === 'font-family'"
            class="tile-toolbar-menu-item"
            :data-tooltip="mi.tooltip"
            style="display: flex; flex: 1; align-self: stretch; padding: 0"
          >
            <FontSelector
              ref="fontSelectorRef"
              :childComponent="childComponent"
              @open-intent="onFontSelectorIntent"
              style="flex: 1; align-self: stretch"
            />
          </div>
        </template>
      </div>
    </transition>
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
} from "vue";
import type { Tile } from "@/types/Tile";
import type { TextContent } from "@/types/TileContent";
import type {
  ToolbarItem,
  ToolbarMenuItem,
  ToolbarContext,
} from "@/types/TileToolbar";
import { getToolbarItems } from "@/utils/toolbarRegistry";
import { useLayoutStore } from "@/stores/layout";
import LocateFixedIcon from "./icons/toolbar/LocateFixedIcon.vue";
import CurrentLocationIcon from "./icons/toolbar/CurrentLocationIcon.vue";
import SearchIcon from "./icons/toolbar/SearchIcon.vue";
import AlignLeftIcon from "./icons/toolbar/AlignLeftIcon.vue";
import AlignCenterIcon from "./icons/toolbar/AlignCenterIcon.vue";
import AlignRightIcon from "./icons/toolbar/AlignRightIcon.vue";
import ColorPicker from "./ColorPicker.vue";
import TextAlignPanel from "./TextAlignPanel.vue";
import FontSizeSelector from "./FontSizeSelector.vue";
import FontSelector from "./FontSelector.vue";

export default defineComponent({
  components: {
    LocateFixedIcon,
    CurrentLocationIcon,
    SearchIcon,
    ColorPicker,
    FontSizeSelector,
    FontSelector,
    TextAlignPanel,
  },
  props: {
    tile: {
      type: Object as PropType<Tile>,
      required: true,
    },
    toolbarRefs: {
      type: Object as PropType<{
        childComponent: any;
        isEditing: any;
        isExitingCropMode: any;
      }>,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();

    const toolbarRef = ref<HTMLDivElement | null>(null);
    const menuAnchorRef = ref<HTMLButtonElement | null>(null);
    const menuRef = ref<HTMLDivElement | null>(null);
    const menuPosition = ref({ x: 0, y: 0 });

    // Panel state (e.g. search bar)
    const panelAnchorRef = ref<HTMLButtonElement | null>(null);
    const searchPanelRef = ref<HTMLDivElement | null>(null);
    const searchInputRef = ref<HTMLInputElement | null>(null);
    const searchQuery = ref("");

    const colorPickerRef = ref<{ $el?: HTMLElement } | null>(null);
    const textAlignPanelRef = ref<{ $el?: HTMLElement } | null>(null);
    const fontSizeSelectorRef = ref<any>(null);
    const fontSelectorRef = ref<any>(null);
    const childComponent = props.toolbarRefs.childComponent;

    const isActiveTile = computed(
      () => layoutStore?.activeTileId === props.tile.i,
    );
    const activePanelId = computed(() => layoutStore?.activePanelId);

    const panelOpen = computed(
      () => activePanelId.value !== null && isActiveTile.value,
    );

    const menuOpen = computed(
      () => activePanelId.value === null && isActiveTile.value,
    );

    const ctx = computed<ToolbarContext>(() => ({
      tile: props.tile,
      childComponent: props.toolbarRefs.childComponent,
      layoutStore,
      isEditing: props.toolbarRefs.isEditing,
      isExitingCropMode: props.toolbarRefs.isExitingCropMode,
    }));

    const items = computed(() => getToolbarItems(props.tile.content.type));

    const visibleItems = computed(() =>
      items.value.filter((item) => item.visible?.(ctx.value) ?? true),
    );

    const menuItemLayoutDirection = computed(() => {
      const menuItem = items.value.find((i) => i.menuItems);
      if (menuItem?.menuItemsLayoutDirection === "horizontal") {
        return "row";
      }
      return "column";
    });

    const activeMenuItems = computed<ToolbarMenuItem[]>(() => {
      const menuItem = items.value.find((i) => i.menuItems);
      return menuItem?.menuItems ?? [];
    });

    const visibleMenuItems = computed(() =>
      activeMenuItems.value.filter((mi) => mi.visible?.(ctx.value) ?? true),
    );

    const resolveTitle = (item: ToolbarItem): string => {
      return typeof item.title === "function"
        ? item.title(ctx.value)
        : item.title;
    };

    const resolveIcon = (item: ToolbarItem) => {
      if (item.id !== "text-align") return item.icon;

      const content = props.tile.content as TextContent;
      const align = content?.textAlign ?? "left";

      if (align === "center") return AlignCenterIcon;
      if (align === "right") return AlignRightIcon;
      return AlignLeftIcon;
    };

    const shouldShowDivider = (idx: number): boolean => {
      if (idx === 0) return false;
      const prev = visibleItems.value[idx - 1];
      const curr = visibleItems.value[idx];
      return !!prev.group && !!curr.group && prev.group !== curr.group;
    };

    const clampToViewport = (x: number, y: number, w: number, h: number) => {
      const pad = 8;
      return {
        x: Math.max(pad, Math.min(x, window.innerWidth - w - pad)),
        y: Math.max(pad, Math.min(y, window.innerHeight - h - pad)),
      };
    };

    const positionMenu = () => {
      const btn = menuAnchorRef.value;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const fallbackW = 190;
      const fallbackH = 112;
      const fallbackX = rect.right - fallbackW;
      const fallbackY = rect.bottom + 8;
      menuPosition.value = clampToViewport(
        fallbackX,
        fallbackY,
        fallbackW,
        fallbackH,
      );

      nextTick(() => {
        const menu = menuRef.value;
        if (!menu) return;
        // Use layout dimensions (not transformed visual bounds) so
        // scale/translate entrance animations don't skew initial positioning.
        const menuWidth = menu.offsetWidth;
        const height = menu.offsetHeight;
        const toolbar = toolbarRef.value;
        const toolbarRect = toolbar?.getBoundingClientRect();

        let nextX: number;
        if (toolbarRect && menuWidth > toolbarRect.width) {
          // Menu is wider than toolbar – center it under the toolbar
          nextX = toolbarRect.left + toolbarRect.width / 2 - menuWidth / 2;
        } else {
          // Menu fits within toolbar width – align right edge to button
          nextX = rect.right - menuWidth;
        }
        const nextY = rect.bottom + 8;
        menuPosition.value = clampToViewport(nextX, nextY, menuWidth, height);
      });
    };

    const menuStyle = computed(() => ({
      top: `${menuPosition.value.y}px`,
      left: `${menuPosition.value.x}px`,
    }));

    const closeMenu = () => {
      layoutStore.closeMenus();
    };

    const onItemClick = (event: MouseEvent, item: ToolbarItem) => {
      // Handle panel items (e.g. search)
      const button = event.currentTarget as HTMLButtonElement | null;
      if (!button) return;

      if (item.panelId) panelAnchorRef.value = button;
      if (item.menuItems) menuAnchorRef.value = button;

      if (item.panelId) {
        layoutStore.togglePanelActive(props.tile.i, item.panelId);
        if (item.panelId === "search")
          nextTick(() => {
            searchInputRef.value?.focus();
          });

        return;
      }

      // Handle menu items
      if (item.menuItems) {
        layoutStore.toggleMenuActive(props.tile.i);
        nextTick(positionMenu);
        return;
      }

      item.action(ctx.value);
    };

    const onMenuItemClick = (mi: ToolbarMenuItem) => {
      if (mi.id === "text-link") {
        closeMenu();
      }
      mi.action(ctx.value);
    };

    const resolveSelectorRef = (selectorRef: { value: any }) => {
      const refValue = selectorRef.value;
      if (Array.isArray(refValue)) {
        return refValue[0] ?? null;
      }
      return refValue;
    };

    const onFontSelectorIntent = (selector: "size" | "family") => {
      const sizeSelector = resolveSelectorRef(fontSizeSelectorRef);
      const familySelector = resolveSelectorRef(fontSelectorRef);

      if (selector === "size") {
        if (familySelector?.isActive) {
          familySelector.isActive = false;
        }
        return;
      }

      if (sizeSelector?.isActive) {
        sizeSelector.isActive = false;
      }
    };

    const onLocateClick = () => {
      props.toolbarRefs.childComponent?.value?.useMyLocation?.();
    };

    const onSearchSubmit = () => {
      const query = searchQuery.value.trim();
      const child = props.toolbarRefs.childComponent?.value;
      if (!child) return;
      child.searchInput = query;
      child.handleSearch?.();
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const colorPickerEl = colorPickerRef.value?.$el;
      const textAlignPanelEl = textAlignPanelRef.value?.$el;

      // Close menu if open
      if (menuOpen.value) {
        if (menuRef.value?.contains(target)) return;
        if (menuAnchorRef.value?.contains(target)) return;
        closeMenu();
      }

      // Close panel if open
      if (panelOpen.value) {
        if (searchPanelRef.value?.contains(target)) return;
        if (panelAnchorRef.value?.contains(target)) return;
        if (colorPickerEl?.contains(target)) return;
        if (textAlignPanelEl?.contains(target)) return;
        closeMenu();
      }
    };

    let rafId: number | null = null;

    const schedulePositionMenu = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        positionMenu();
      });
    };

    // Reposition the menu when it opens
    watch(menuOpen, (open, _prev, onCleanup) => {
      if (!open) return;

      nextTick(positionMenu);

      window.addEventListener("resize", schedulePositionMenu);
      window.addEventListener("scroll", schedulePositionMenu, {
        capture: true,
        passive: true,
      });

      onCleanup(() => {
        if (rafId != null) cancelAnimationFrame(rafId);
        rafId = null;
        window.removeEventListener("resize", schedulePositionMenu);
        window.removeEventListener("scroll", schedulePositionMenu, {
          capture: true,
        });
      });
    });

    onMounted(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside);
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    });

    return {
      items,
      visibleItems,
      visibleMenuItems,
      activeMenuItems,
      ctx,
      isActiveTile,
      menuOpen,
      menuAnchorRef,
      toolbarRef,
      menuRef,
      menuStyle,
      menuPosition,
      menuItemLayoutDirection,
      resolveTitle,
      resolveIcon,
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
      colorPickerRef,
      textAlignPanelRef,
      fontSizeSelectorRef,
      fontSelectorRef,
      childComponent,
      onLocateClick,
      onSearchSubmit,
      onFontSelectorIntent,
    };
  },
});
</script>

<style scoped lang="scss">
/* Tile Toolbar */
.tile-toolbar {
  position: absolute;
  bottom: 4px;
  left: 50%;
  z-index: 10000;
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
  transition:
    opacity var(--duration-fast) var(--easing-ease-out),
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
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
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
  transition:
    stroke-dashoffset var(--duration-normal) var(--easing-spring),
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

  /* Positioned above the toolbar */
  transform: translate(-50%, calc(-4px));

  border-radius: 12px;
  padding: 4px;

  animation: searchPanelSlideIn var(--duration-normal) var(--easing-spring);
}

@keyframes searchPanelSlideIn {
  from {
    opacity: 0;
    transform: translate(-50%, calc(4px)) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, calc(-4px)) scale(1);
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
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
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
  // flex-direction: column;
  gap: 2px;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-tile-hover);
}

.tile-toolbar-menu-enter-active {
  animation: tileToolbarMenuSlideIn var(--duration-normal) var(--easing-spring);
}

.tile-toolbar-menu-leave-active {
  animation: tileToolbarMenuSlideOut var(--duration-normal) var(--easing-spring);
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

.is-active {
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
  border-radius: var(--radius-sm);
  transform: none;
}

/* Tooltip via data-tooltip attribute (shared across toolbar, search panel, and menu items) */
[data-tooltip] {
  position: relative;

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) scale(0.9);
    white-space: nowrap;
    font-size: 11px;
    line-height: 1;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    background-color: var(--color-text-primary);
    color: var(--color-tile-background);
    pointer-events: none;
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--easing-ease-out),
      transform var(--duration-fast) var(--easing-ease-out);
    z-index: var(--z-tooltip);
  }

  &:hover::after {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

.panel-enter-active {
  animation: panelSlideIn var(--duration-normal) var(--easing-spring);
}

.panel-leave-active {
  animation: panelSlideOut var(--duration-normal) var(--easing-spring);
}

@keyframes tileToolbarMenuSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes tileToolbarMenuSlideOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes panelSlideOut {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.95);
  }
}
</style>
