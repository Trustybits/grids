import { ref, shallowRef } from "vue";
import type { InlineFieldsRequest } from "@/utils/richText/slashCommands";
import type { FloatingPosition } from "@/composables/useSlashMenu";

/**
 * A promise-based inline form: `request()` opens it at a screen position and
 * resolves with the submitted values, or null when the user cancels. Only one
 * request is open at a time; opening another cancels the previous one.
 */
export function useInlineFields() {
  const current = shallowRef<InlineFieldsRequest | null>(null);
  const position = ref<FloatingPosition>({ top: 0, left: 0 });
  let settle: ((values: Record<string, string> | null) => void) | null = null;

  const finish = (values: Record<string, string> | null) => {
    const resolve = settle;
    settle = null;
    current.value = null;
    resolve?.(values);
  };

  const request = (
    fields: InlineFieldsRequest,
    at: FloatingPosition,
  ): Promise<Record<string, string> | null> => {
    if (settle) finish(null);
    position.value = at;
    current.value = fields;
    return new Promise((resolve) => {
      settle = resolve;
    });
  };

  return {
    current,
    position,
    request,
    submit: (values: Record<string, string>) => finish(values),
    cancel: () => finish(null),
  };
}
