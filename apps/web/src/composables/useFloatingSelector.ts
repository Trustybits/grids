import { nextTick, onMounted, onUnmounted, watch, type Ref } from "vue";

interface UseFloatingSelectorOptionsForElement<T extends HTMLElement> {
  isActive: Ref<boolean>;
  menuRef: Ref<T | null>;
  positionMenu: () => void;
  buttonAction: (value: string) => void;
  emitter?: () => void;
}

export const useFloatingSelector = <T extends HTMLElement>({
  isActive,
  menuRef,
  positionMenu,
  buttonAction,
  emitter = () => {},
}: UseFloatingSelectorOptionsForElement<T>) => {
  let rafId: number | null = null;

  const handleClick = () => {
    if (isActive.value) {
      isActive.value = false;
      return;
    }

    emitter();
    isActive.value = true;
    nextTick(() => positionMenu());
  };

  const handleButtonClick = (value: string) => {
    buttonAction(value);
    isActive.value = false;
    // gridStore.closeMenus();
  };

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (!target) return;

    if (menuRef.value?.contains(target)) {
      return;
    }

    isActive.value = false;
  };

  const schedulePositionMenu = () => {
    if (!isActive.value || rafId != null) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      positionMenu();
    });
  };

  watch(isActive, (open, _prev, onCleanup) => {
    if (!open) return;

    nextTick(positionMenu);

    window.addEventListener("resize", schedulePositionMenu);
    window.addEventListener("scroll", schedulePositionMenu, {
      capture: true,
      passive: true,
    });

    onCleanup(() => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
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
    if (rafId != null) {
      cancelAnimationFrame(rafId);
    }

    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("contextmenu", handleClickOutside);
  });

  return {
    handleClick,
    handleButtonClick,
  };
};
