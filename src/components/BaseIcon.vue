// BaseIcon.vue
<template>
  <component :is="iconComponent" class="icon" />
</template>

<script lang="ts">
import HomeIcon from "./icons/home.vue";
// import UserIcon from './icons/UserIcon.vue';
// Import other icons similarly

// const icons = {
//   home: HomeIcon,
//   user: UserIcon,
//   // Add other icons to this object
// };

const icons = {
  home: HomeIcon,
};

export default {
  name: "BaseIcon",
  props: {
    name: {
      type: String,
      required: true,
      validator: (value: string) => Object.keys(icons).includes(value),
    },
  },
  computed: {
    iconComponent() {
      return icons[this.name as keyof typeof icons];
    },
  },
};
</script>
