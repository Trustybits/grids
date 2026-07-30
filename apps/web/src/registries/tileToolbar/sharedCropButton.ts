import { markRaw } from "vue";
import type { ToolbarButton } from "@/types/TileToolbar";
import CropIcon from "@/components/icons/toolbar/CropIcon.vue";

export const CROP_BUTTON: ToolbarButton = {
  id: "crop",
  icon: markRaw(CropIcon),
  // State-aware, matching BORDER_TOGGLE — the only other toggle in this group.
  // The static "Crop / Zoom" described the button rather than what pressing it
  // would do, so once crop mode was on there was nothing saying how to leave.
  // Shared by the image and video tiles, so the wording stays medium-agnostic.
  title: (ctx) => (ctx.isEditing.value ? "Finish cropping" : "Crop & zoom"),
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
