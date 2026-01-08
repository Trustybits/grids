<!-- src/views/HomePage.vue -->
<template>
  <div class="home">
    <h1>Welcome to Joju!</h1>
    <p>This is the home page</p>
    <router-link to="/signup">Create an Account</router-link>
    <router-link to="/login">Login to Your Account</router-link>
  </div>
</template>

<script setup>
</script>

<style scoped>
.home {
  text-align: center;
  margin-top: var(--spacing-2xl);
  padding: var(--spacing-xl);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
}

h1 {
  font-size: var(--font-size-2xl);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-lg);
}

p {
  font-size: var(--font-size-lg);
  margin: var(--spacing-lg) 0;
  color: var(--color-content-default);
}

a {
  display: block;
  margin: var(--spacing-md);
  text-decoration: none;
  color: var(--primary-color);
  font-size: var(--font-size-base);
  transition: color var(--duration-fast) var(--easing-smooth);
}

a:hover {
  text-decoration: underline;
  color: var(--color-content-high);
}
</style>
