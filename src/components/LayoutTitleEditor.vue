<template>
  <div class="layout-title">
    <h2
      class="editable-text"
      contenteditable="true"
      spellcheck="false"
      @blur="saveName"
      @keydown.enter.prevent="blurOnEnter"
    >
      {{ editableName }}
    </h2>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useLayoutStore } from '@/stores/layout';

const layoutStore = useLayoutStore();
const editableName = ref(layoutStore.currentLayout?.name || '');

watch(
  () => layoutStore.currentLayout?.name,
  (newVal) => {
    editableName.value = newVal || '';
  }
);

const saveName = (event) => {
  const newName = event.target.innerText.trim();
  if (newName !== layoutStore.currentLayout?.name) {
    layoutStore.currentLayout.name = newName;
    layoutStore.saveLayout();
    editableName.value = newName;
  }
};

const blurOnEnter = (event) => {
  event.target.blur();
};
</script>

<style scoped>
.layout-title {
  color: var(--color-base-76);
}

.editable-text {
  cursor: text;
  font-size: 1.5rem;
  font-weight: bold;
  outline: none;
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
}

.editable-text:focus {
  color: var(--color-text-primary);
  background-color: var(--color-content-low);
}

.editable-text:hover {
  /* color: var(--color-base-100); */
}
</style>
