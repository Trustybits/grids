// BaseIcon.vue
<template>
  <component :is="iconComponent" class="icon" />
</template>

<script>
import HomeIcon from './icons/home.vue';
// import UserIcon from './icons/UserIcon.vue';
// Import other icons similarly

const icons = {
  home: HomeIcon,
  user: UserIcon,
  // Add other icons to this object
};

export default {
  name: 'BaseIcon',
  props: {
    name: {
      type: String,
      required: true,
      validator: (value) => Object.keys(icons).includes(value),
    },
  },
  computed: {
    iconComponent() {
      return icons[this.name];
    },
  },
};
</script>