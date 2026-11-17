import { ref } from 'vue';
import { defineStore } from 'pinia';

/** A button on the toast, e.g. "Undo" after a delete. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
  action?: ToastAction;
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  let nextId = 0;

  const addToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    duration = 3000,
    action?: ToastAction,
  ) => {
    const id = nextId++;
    const toast: Toast = { id, message, type, duration, action };
    toasts.value.push(toast);

    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  };

  const removeToast = (id: number) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  /** Run a toast's action, then dismiss it. */
  const runToastAction = (id: number) => {
    const toast = toasts.value.find(t => t.id === id);
    removeToast(id);
    toast?.action?.run();
  };

  return {
    toasts,
    addToast,
    removeToast,
    runToastAction,
  };
});
