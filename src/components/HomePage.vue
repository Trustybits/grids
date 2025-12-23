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
  margin-top: 50px;
}

h1 {
  font-size: 2.5rem;
  color: #333;
}

p {
  font-size: 1.2rem;
  margin: 20px 0;
}

a {
  display: block;
  margin: 10px;
  text-decoration: none;
  color: #007bff;
}

a:hover {
  text-decoration: underline;
}
</style>
