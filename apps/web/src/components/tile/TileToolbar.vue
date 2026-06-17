<template>
  <div
    v-if="items.length"
    ref="toolbarRef"
    class="tile-toolbar"
    :class="{ 'tile-toolbar-force-show': menuOpen || panelOpen }"
    @mousedown.stop
    @touchstart.stop
    @mouseenter="hoveredToolbarZone = 'toolbar'"
    @mouseleave="hoveredToolbarZone = null"
  >
    <template v-for="(item, idx) in visibleItems" :key="item.id">
      <div v-if="shouldShowDivider(idx)" class="toolbar-divider"></div>
      <FloatingTooltip :text="resolveTitle(item)">
        <button
          class="toolbar-btn"
          :class="[
            item.cssClass,
            {
              'is-active':
                item.isActive?.(ctx) ||
                (item.panelId && panelOpen && activePanelId === item.panelId),
            },
            { 'toolbar-btn--danger': resolveDanger(item) },
          ]"
          :style="resolveButtonStyle(item)"
          @click.stop="onItemClick($event, item)"
        >
          <component :is="resolveIcon(item)" />
        </button>
      </FloatingTooltip>
    </template>
  </div>

  <!-- Search Panel -->
  <div
    v-if="panelOpen && activePanelId === 'search'"
    ref="searchPanelRef"
    class="toolbar-search-panel glass"
    @mousedown.stop
    @touchstart.stop
  >
    <FloatingTooltip text="My location">
      <button
        class="search-panel-btn"
        @click.stop="onLocateClick"
      >
        <CurrentLocationIcon />
      </button>
    </FloatingTooltip>
    <div class="search-panel-divider"></div>
    <input
      ref="searchInputRef"
      class="search-panel-input"
      type="text"
      placeholder="address or zip"
      v-model="searchQuery"
      @keydown.enter.stop="onSearchSubmit"
    />
    <FloatingTooltip text="Search map">
      <button
        class="search-panel-btn"
        @click.stop="onSearchSubmit"
      >
        <SearchIcon />
      </button>
    </FloatingTooltip>
  </div>

  <!-- Image URL Panel -->
  <div
    v-if="panelOpen && activePanelId === 'imageUrl'"
    ref="imageUrlPanelRef"
    class="toolbar-image-url-panel"
    @mousedown.stop
    @touchstart.stop
  >
    <div class="image-url-panel-row">
      <input
        ref="imageUrlInputRef"
        class="image-url-panel-input"
        type="url"
        placeholder="https://example.com/image.jpg"
        aria-label="Image URL"
        v-model="imageUrlDraft"
        @keydown.enter.stop.prevent="onImageUrlSubmit"
      />
      <FloatingTooltip text="Submit">
        <button
          class="image-url-panel-btn"
          @click.stop="onImageUrlSubmit"
        >
          <ArrowUpRightIcon />
        </button>
      </FloatingTooltip>
    </div>
    <p v-if="imageUrlError" class="image-url-panel-error">
      {{ imageUrlError }}
    </p>
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
        :currentColor="currentBackgroundColor"
        :supportsOverlay="supportsColorOverlay"
        :currentOverlayColor="currentOverlayColor"
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
        @touchstart.stop
        @click.stop
        @dragstart.prevent
      >
        <template v-for="mi in visibleMenuItems" :key="mi.id">
          <button
            v-if="mi.id !== 'font-size' && mi.id !== 'font-family'"
            type="button"
            class="tile-toolbar-menu-item"
            :class="[
              { 'tile-toolbar-menu-item--danger': resolveMenuDanger(mi) },
              { 'is-active': mi.isActive?.(ctx) },
            ]"
            :data-tooltip="resolveMenuTooltip(mi)"
            @mousedown.prevent
            @click="onMenuItemClick(mi)"
          >
            <component v-if="mi.icon" :is="resolveMenuIcon(mi)" />
            <template v-if="mi.label">{{ resolveMenuLabel(mi) }}</template>
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
  inject,
  type PropType,
  type Ref,
  type Component,
} from "vue";
import type { TileChildComponent } from "@/types/Tile";
import type { Tile, TextContent } from "@grids/contracts/types";
import type {
  ToolbarButton,
  ToolbarMenuItem,
  ToolbarContext,
} from "@/types/TileToolbar";
import { getTileToolbarButtons } from "@/registries/tileToolbar";
import { computeTextColor } from "@/composables/useColorPicker";
import { useGridStore } from "@/stores/grid";
import { isDirectImageUrl } from "@/utils/TileUtils";
import LocateFixedIcon from "@/components/icons/toolbar/LocateFixedIcon.vue";
import CurrentLocationIcon from "@/components/icons/toolbar/CurrentLocationIcon.vue";
import SearchIcon from "@/components/icons/toolbar/SearchIcon.vue";
import ArrowUpRightIcon from "@/components/icons/toolbar/ArrowUpRightIcon.vue";
import AlignLeftIcon from "@/components/icons/toolbar/AlignLeftIcon.vue";
import AlignCenterIcon from "@/components/icons/toolbar/AlignCenterIcon.vue";
import AlignRightIcon from "@/components/icons/toolbar/AlignRightIcon.vue";
import ColorPicker from "@/components/ui-controls/ColorPicker.vue";
import TextAlignPanel from "@/components/ui-controls/TextAlignPanel.vue";
import FontSizeSelector from "@/components/ui-controls/FontSizeSelector.vue";
import FontSelector from "@/components/ui-controls/FontFamilySelector.vue";
import FloatingTooltip from "@/components/ui-elements/FloatingTooltip.vue";

export default defineComponent({
  components: {
    LocateFixedIcon,
    CurrentLocationIcon,
    SearchIcon,
    ArrowUpRightIcon,
    ColorPicker,
    FontSizeSelector,
    FontSelector,
    TextAlignPanel,
    FloatingTooltip,
  },
  props: {
    tile: {
      type: Object as PropType<Tile>,
      required: true,
    },
    toolbarRefs: {
      type: Object as PropType<{
        childComponent: Ref<TileChildComponent | null>;
        isEditing: Ref<boolean>;
        isExitingCropMode: Ref<boolean>;
      }>,
      required: true,
    },
  },
  setup(props) {
    const gridStore = useGridStore();
    const hoveredToolbarZone = inject<Ref<string | null>>("hoveredToolbarZone");

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

    // Image URL panel state
    const imageUrlPanelRef = ref<HTMLDivElement | null>(null);
    const imageUrlInputRef = ref<HTMLInputElement | null>(null);
    const imageUrlDraft = ref("");
    const imageUrlError = ref("");
    const fontSizeSelectorRef = ref<InstanceType<
      typeof FontSizeSelector
    > | null>(null);
    const fontSelectorRef = ref<InstanceType<typeof FontSelector> | null>(null);
    const childComponent = props.toolbarRefs.childComponent;

    const isActiveTile = computed(
      () => gridStore?.activeTileId === props.tile.i,
    );
    const activePanelId = computed(() => gridStore?.activePanelId);

    const panelOpen = computed(
      () => activePanelId.value !== null && isActiveTile.value,
    );

    const menuOpen = computed(
      () => activePanelId.value === null && isActiveTile.value,
    );

    const ctx = computed<ToolbarContext>(() => ({
      tile: props.tile,
      childComponent: props.toolbarRefs.childComponent,
      gridStore,
      isEditing: props.toolbarRefs.isEditing,
      isExitingCropMode: props.toolbarRefs.isExitingCropMode,
    }));

    const items = computed(() => getTileToolbarButtons(props.tile.content.type));

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

    const resolveTitle = (item: ToolbarButton): string => {
      return typeof item.title === "function"
        ? item.title(ctx.value)
        : item.title;
    };

    const resolveIcon = (item: ToolbarButton) => {
      // Special case for text-align icon
      if (item.id === "text-align") {
        const content = props.tile.content as TextContent;
        const align = content?.textAlign ?? "left";
        if (align === "center") return AlignCenterIcon;
        if (align === "right") return AlignRightIcon;
        return AlignLeftIcon;
      }
      if (typeof item.icon === "function") {
        return (item.icon as (ctx: ToolbarContext) => Component)(ctx.value);
      }
      return item.icon;
    };

    const resolveDanger = (item: ToolbarButton): boolean => {
      return typeof item.danger === "function"
        ? item.danger(ctx.value)
        : !!item.danger;
    };

    const currentBackgroundColor = computed(() => {
      // Overlay-capable tiles expose a resolved fill that matches what's
      // rendered (handling legacy data); fall back to the raw field otherwise.
      const resolved = childComponent.value?.pickerFillColor;
      if (typeof resolved === "string") return resolved;
      const content = props.tile.content as { backgroundColor?: unknown };
      return typeof content.backgroundColor === "string"
        ? content.backgroundColor
        : "";
    });

    const currentOverlayColor = computed(() => {
      const resolved = childComponent.value?.pickerOverlayColor;
      if (typeof resolved === "string") return resolved;
      const content = props.tile.content as { overlayColor?: unknown };
      return typeof content.overlayColor === "string"
        ? content.overlayColor
        : "";
    });

    // The tile supports a separate color overlay when its content component
    // exposes an overlay handler (image, video, link, document).
    const supportsColorOverlay = computed(
      () =>
        typeof childComponent.value?.handleOverlayColorChange === "function",
    );

    const resolveButtonStyle = (
      item: ToolbarButton,
    ): Record<string, string> | undefined => {
      if (item.id !== "color") return undefined;

      // While the color panel is open on the Overlay target, the swatch should
      // reflect the overlay color being edited; otherwise it shows the fill.
      const showingOverlay =
        isActiveTile.value &&
        activePanelId.value === "colorSelect" &&
        gridStore.activeColorTarget === "overlay";

      const active = showingOverlay
        ? currentOverlayColor.value
        : currentBackgroundColor.value;
      const swatch = active || "var(--color-tile-background)";

      const contrast = computeTextColor(swatch) || "#000000";

      return {
        "--toolbar-color-swatch": swatch,
        "--toolbar-color-swatch-contrast": contrast,
      };
    };

    const resolveMenuIcon = (mi: ToolbarMenuItem) => {
      if (typeof mi.icon === "function") {
        return (mi.icon as (ctx: ToolbarContext) => Component)(ctx.value);
      }
      return mi.icon;
    };

    const resolveMenuTooltip = (mi: ToolbarMenuItem): string | undefined => {
      return typeof mi.tooltip === "function"
        ? mi.tooltip(ctx.value)
        : mi.tooltip;
    };

    const resolveMenuLabel = (mi: ToolbarMenuItem): string | undefined => {
      return typeof mi.label === "function" ? mi.label(ctx.value) : mi.label;
    };

    const resolveMenuDanger = (mi: ToolbarMenuItem): boolean => {
      return typeof mi.danger === "function"
        ? mi.danger(ctx.value)
        : !!mi.danger;
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
      gridStore.closeMenus();
    };

    const onItemClick = (event: MouseEvent, item: ToolbarButton) => {
      // Handle panel items (e.g. search)
      const button = event.currentTarget as HTMLButtonElement | null;
      if (!button) return;

      if (item.panelId) panelAnchorRef.value = button;
      if (item.menuItems) menuAnchorRef.value = button;

      if (item.panelId) {
        gridStore.togglePanelActive(props.tile.i, item.panelId);
        if (item.panelId === "search")
          nextTick(() => {
            searchInputRef.value?.focus();
          });

        return;
      }

      // Handle menu items
      if (item.menuItems) {
        gridStore.toggleMenuActive(props.tile.i);
        nextTick(positionMenu);
        return;
      }

      if (
        item.id === "tile-link" &&
        !(ctx.value.tile.content as { tileLink?: string })?.tileLink
      ) {
        closeMenu();
      }

      item.action(ctx.value);
    };

    const onMenuItemClick = (mi: ToolbarMenuItem) => {
      if (
        mi.id === "tile-link" &&
        !(ctx.value.tile.content as { tileLink?: string })?.tileLink
      ) {
        closeMenu();
      }
      mi.action(ctx.value);
    };

    const resolveSelectorRef = (selectorRef: { value: unknown }) => {
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
      if (
        props.toolbarRefs.childComponent?.value?.useMyLocation !== undefined
      ) {
        props.toolbarRefs.childComponent?.value?.useMyLocation?.();
      }
    };

    const onSearchSubmit = () => {
      const query = searchQuery.value.trim();
      const child = props.toolbarRefs.childComponent?.value;
      if (!child) return;
      child.searchInput = query;
      child.handleSearch?.();
    };

    const normalizeImageUrl = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const normalized =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;
      try {
        new URL(normalized);
        return normalized;
      } catch {
        return "";
      }
    };

    const onImageUrlSubmit = () => {
      const normalized = normalizeImageUrl(imageUrlDraft.value);
      if (!normalized) {
        imageUrlError.value = "Enter a valid URL.";
        return;
      }
      if (!isDirectImageUrl(normalized)) {
        imageUrlError.value =
          "Only direct image URLs are supported (png, jpg, gif, webp, svg).";
        return;
      }

      const child = props.toolbarRefs.childComponent?.value;
      if (child?.applyImageUrlFromToolbar) {
        child.applyImageUrlFromToolbar(normalized);
      }
      imageUrlDraft.value = "";
      imageUrlError.value = "";
      closeMenu();
    };

    // Pre-fill image URL draft when panel opens
    watch(activePanelId, (id) => {
      if (id === "imageUrl") {
        const child = props.toolbarRefs.childComponent?.value;
        imageUrlDraft.value = child?.content?.customImageUrl || "";
        imageUrlError.value = "";
        nextTick(() => imageUrlInputRef.value?.focus());
      }
    });

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
        if (imageUrlPanelRef.value?.contains(target)) return;
        if (panelAnchorRef.value?.contains(target)) return;
        if (colorPickerEl?.contains(target)) return;
        if (textAlignPanelEl?.contains(target)) return;
        imageUrlError.value = "";
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
      resolveButtonStyle,
      currentBackgroundColor,
      currentOverlayColor,
      supportsColorOverlay,
      resolveDanger,
      resolveMenuIcon,
      resolveMenuTooltip,
      resolveMenuLabel,
      resolveMenuDanger,
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
      hoveredToolbarZone,

      // Image URL panel
      imageUrlPanelRef,
      imageUrlInputRef,
      imageUrlDraft,
      imageUrlError,
      onImageUrlSubmit,
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

.toolbar-btn--danger {
  color: #ff3737;
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

/* Image URL Panel */
.toolbar-image-url-panel {
  position: absolute;
  bottom: 4px;
  left: 50%;
  z-index: 99;
  display: flex;
  flex-direction: column;
  gap: 0;
  white-space: nowrap;

  transform: translate(-50%, calc(-4px));

  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 12px;
  padding: 4px;

  animation: imageUrlPanelSlideIn var(--duration-normal) var(--easing-spring);
}

@keyframes imageUrlPanelSlideIn {
  from {
    opacity: 0;
    transform: translate(-50%, calc(4px)) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, calc(-4px)) scale(1);
  }
}

.image-url-panel-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
}

.image-url-panel-input {
  flex: 1;
  min-width: 200px;
  height: 36px;
  padding: 0 10px;
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

.image-url-panel-btn {
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

.image-url-panel-error {
  margin: 0;
  padding: 2px 10px 4px;
  font-size: 11px;
  line-height: 1.3;
  color: #ff3737;
  white-space: normal;
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
