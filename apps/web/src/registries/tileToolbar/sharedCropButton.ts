import { markRaw } from "vue";
import type { ToolbarButton } from "@/types/TileToolbar";
import CropIcon from "@/components/icons/toolbar/CropIcon.vue";

export const CROP_BUTTON: ToolbarButton = {
  id: "crop",
  icon: markRaw(CropIcon),
  title: "Crop / Zoom",
  group: "appearance",
  action: (ctx) => {
    if (!ctx.childComponent.value?.toggleEditMode) return;

    if (ctx.isEditing.value) {
      ctx.isExitingCropMode.value = true;
      setTimeout(() => {
        if (ctx.childComponent.value?.toggleEditMode !== undefined) {
          ctx.childComponent.value?.toggleEditMode();
        }
        if (ctx.childComponent.value?.isEditing !== undefined) {
          ctx.isEditing.value = ctx.childComponent.value.isEditing;
        }
        ctx.isExitingCropMode.value = false;
      }, 450);
    } else {
      ctx.childComponent.value.toggleEditMode();
      if (ctx.childComponent.value?.isEditing !== undefined) {
        ctx.isEditing.value = ctx.childComponent.value.isEditing;
      }
    }
  },
  isActive: (ctx) => ctx.isEditing.value,
};
