import { markRaw, type Component } from "vue";
import type { MobileToolId } from "@/registries/tileToolbar/mobileTools";
import FontPopover from "./FontPopover.vue";
import StylePopover from "./StylePopover.vue";
import TextColorPopover from "./TextColorPopover.vue";
import FillPopover from "./FillPopover.vue";
import PositionPopover from "./PositionPopover.vue";
import LinkPopover from "./LinkPopover.vue";
import BorderPopover from "./BorderPopover.vue";
import CaptionPopover from "./CaptionPopover.vue";
import MorePopover from "./MorePopover.vue";
import LinkImagePopover from "./LinkImagePopover.vue";
import ProfilePhotoPopover from "./ProfilePhotoPopover.vue";
import ProfileShapePopover from "./ProfileShapePopover.vue";
import MapSearchPopover from "./MapSearchPopover.vue";
import MapStylePopover from "./MapStylePopover.vue";

/** The body each popover tool shows in the card. */
export const MOBILE_POPOVER_BODIES: Partial<Record<MobileToolId, Component>> =
  {
    font: markRaw(FontPopover),
    style: markRaw(StylePopover),
    color: markRaw(TextColorPopover),
    fill: markRaw(FillPopover),
    position: markRaw(PositionPopover),
    link: markRaw(LinkPopover),
    border: markRaw(BorderPopover),
    caption: markRaw(CaptionPopover),
    more: markRaw(MorePopover),
    image: markRaw(LinkImagePopover),
    photo: markRaw(ProfilePhotoPopover),
    shape: markRaw(ProfileShapePopover),
    search: markRaw(MapSearchPopover),
    mapStyle: markRaw(MapStylePopover),
  };
