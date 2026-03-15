import type { Component, Ref } from "vue";
import type { Tile } from "./Tile";

export interface ToolbarContext {
  tile: Tile;
  childComponent: Ref<any>;
  layoutStore: any;
  isEditing: Ref<boolean>;
  isExitingCropMode: Ref<boolean>;
}

export interface ToolbarMenuItem {
  id: string;
  label?: string | ((ctx: ToolbarContext) => string);
  icon?: Component | ((ctx: ToolbarContext) => Component);
  tooltip?: string | ((ctx: ToolbarContext) => string);
  action: (ctx: ToolbarContext) => void;
  isActive?: (cts: ToolbarContext) => boolean;
  visible?: (ctx: ToolbarContext) => boolean;
  getProps?: (ctx: ToolbarContext) => any;
  panelId?: string;
  danger?: boolean | ((ctx: ToolbarContext) => boolean);
}

export interface ToolbarItem {
  id: string;
  icon: Component | ((ctx: ToolbarContext) => Component);
  title: string | ((ctx: ToolbarContext) => string);
  action: (ctx: ToolbarContext) => void;
  isActive?: (ctx: ToolbarContext) => boolean;
  visible?: (ctx: ToolbarContext) => boolean;
  cssClass?: string;
  group?: "resize" | "appearance" | "actions" | "map-style";
  menuItems?: ToolbarMenuItem[];
  panelId?: string;
  menuItemsLayoutDirection?: "horizontal" | "vertical";
  danger?: boolean | ((ctx: ToolbarContext) => boolean);
}
