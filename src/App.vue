<template>
  <div id="app">
    <!-- Navigation Bar -->
    <NavBar />

    <!-- Main Content Area -->
    <div v-if="isAuthChecked">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue';
import { useAuthGuard } from "@/composables/useAuthGuard";

const { isAuthChecked } = useAuthGuard();
</script>

<style lang="scss">

body {
  // background-color: #f8f9fa;
  // background-image: url("https://images.pexels.com/photos/247599/pexels-photo-247599.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1");
  // background-repeat: no-repeat;
}

.section {
  max-width: 1524px;
  margin: 0 auto;
  padding: 2rem;
}

.container {
  // margin: 0 !important;
}

.w-fit {
  width: fit-content;
}
</style>