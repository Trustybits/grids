<template>
  <div class="doc-details-fields">
    <div
      class="tile-field-wrap tile-field-wrap--title scrollable-thin"
      :class="{
        'is-visible': isEditing || !!displayTitle,
        'has-overflow': !isEditing,
      }"
    >
      <textarea
        ref="titleEl"
        :value="draftTitle"
        class="tile-field tile-field--title"
        :readonly="!isEditing"
        :tabindex="isEditing ? 0 : -1"
        placeholder="Add a title"
        rows="1"
        @input="onTitleInput"
      />
    </div>
    <div
      class="tile-field-wrap tile-field-wrap--description scrollable-thin"
      :class="{
        'is-visible': isEditing || !!displayDescription,
        'has-overflow': !isEditing,
      }"
    >
      <textarea
        ref="descriptionEl"
        :value="draftDescription"
        class="tile-field tile-field--description"
        :readonly="!isEditing"
        :tabindex="isEditing ? 0 : -1"
        placeholder="Add a description"
        rows="1"
        @input="onDescriptionInput"
      />
    </div>
    <div
      class="tile-field-wrap tile-field-wrap--subtitle"
      :class="{ 'is-visible': isEditing || !!displaySubtitle }"
    >
      <input
        ref="subtitleEl"
        :value="draftSubtitle"
        class="tile-field tile-field--subtitle"
        type="text"
        :readonly="!isEditing"
        :tabindex="isEditing ? 0 : -1"
        placeholder="Add a subtitle"
        @input="onSubtitleInput"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch } from "vue";
import type { PropType } from "vue";

export default defineComponent({
  name: "DocumentDetailsFields",
  props: {
    isEditing: { type: Boolean, required: true },
    displayTitle: { type: String, required: true },
    displayDescription: { type: String, required: true },
    displaySubtitle: { type: String, required: true },
    draftTitle: { type: String, required: true },
    draftDescription: { type: String, required: true },
    draftSubtitle: { type: String, required: true },
    titleInputRef: {
      type: Function as PropType<(el: HTMLTextAreaElement | null) => void>,
      default: () => () => undefined,
    },
    descriptionInputRef: {
      type: Function as PropType<(el: HTMLTextAreaElement | null) => void>,
      default: () => () => undefined,
    },
    subtitleInputRef: {
      type: Function as PropType<(el: HTMLInputElement | null) => void>,
      default: () => () => undefined,
    },
  },
  emits: [
    "update:draftTitle",
    "update:draftDescription",
    "update:draftSubtitle",
  ],
  setup(props, { emit }) {
    const titleEl = ref<HTMLTextAreaElement | null>(null);
    const descriptionEl = ref<HTMLTextAreaElement | null>(null);
    const subtitleEl = ref<HTMLInputElement | null>(null);

    const onTitleInput = (e: Event) => {
      emit("update:draftTitle", (e.target as HTMLTextAreaElement).value);
    };
    const onDescriptionInput = (e: Event) => {
      emit("update:draftDescription", (e.target as HTMLTextAreaElement).value);
    };
    const onSubtitleInput = (e: Event) => {
      emit("update:draftSubtitle", (e.target as HTMLInputElement).value);
    };

    onMounted(() => {
      props.titleInputRef(titleEl.value);
      props.descriptionInputRef(descriptionEl.value);
      props.subtitleInputRef(subtitleEl.value);
    });

    watch(titleEl, (el) => props.titleInputRef(el));
    watch(descriptionEl, (el) => props.descriptionInputRef(el));
    watch(subtitleEl, (el) => props.subtitleInputRef(el));

    return {
      titleEl,
      descriptionEl,
      subtitleEl,
      onTitleInput,
      onDescriptionInput,
      onSubtitleInput,
    };
  },
});
</script>

<style scoped>
.doc-details-fields {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tile-field-wrap {
  overflow: hidden;
  border-radius: 4px;
  margin-left: -2px;
  margin-right: -2px;
  max-height: 0;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    max-height 0.3s ease,
    padding 0.3s ease,
    opacity 0.25s ease,
    background-color 0.15s ease;
}

.tile-field-wrap.is-visible {
  opacity: 1;
  pointer-events: auto;
  transition:
    max-height 0.35s ease,
    padding 0.35s ease,
    opacity 0.3s ease,
    background-color 0.15s ease;
}

.tile-field-wrap--title {
  margin-top: -2px;
  flex: 1 1 auto;
  min-height: 0;
}

.tile-field-wrap--title.is-visible {
  max-height: none;
  min-height: 28px;
  padding: 4px 6px;
  padding-top: 6px;
}

.tile-field-wrap--description {
  flex: 1 1 auto;
  min-height: 0;
}

.tile-field-wrap--description.is-visible {
  max-height: none;
  min-height: 28px;
  padding: 4px 6px;
}

.tile-field-wrap--subtitle {
  margin-bottom: -2px;
  flex: 0 0 auto;
}

.tile-field-wrap--subtitle.is-visible {
  max-height: 32px;
  min-height: 24px;
  padding: 4px 6px;
}

/* Mask off when not editing */
:global(.doc-details.is-editing) .tile-field-wrap {
  -webkit-mask-image: none;
  mask-image: none;
}

:global(.doc-details.is-editing) .tile-field-wrap:hover {
  background-color: color-mix(
    in srgb,
    var(--color-input-edit) 97%,
    var(--tile-text-color) 3%
  );
}

.tile-field {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--tile-text-color);
  font-family: "Inter", sans-serif;
  cursor: inherit;
  resize: none;
  field-sizing: content;
  padding: 8px 8px;
  margin: -8px -8px;
}

.tile-field:focus {
  outline: none;
}

.tile-field[readonly]::placeholder {
  color: transparent;
}

.tile-field::placeholder {
  color: color-mix(in srgb, var(--tile-text-color) 55%, transparent 45%);
}

.tile-field--title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  padding: 0;
  margin: 0;
  border: none;
}

.tile-field--description {
  font-size: 12px;
  line-height: 16px;
  color: var(--tile-text-color);
  padding: 0;
  margin: 0;
  border: none;
}

.tile-field--subtitle {
  font-size: 12px;
  line-height: 16px;
  color: var(--tile-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
