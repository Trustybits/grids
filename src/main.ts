import './assets/main.css';

import { createApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';
import { app as firebaseApp } from './firebase'; 
import router from './router';

import '@fortawesome/fontawesome-free/css/all.css';
import 'bootstrap/dist/css/bootstrap.min.css'; // CSS
// import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // JS

import './styles/custom.scss';

const app = createApp(App);
const pinia = createPinia();

app.use(router)

app.use(pinia);
app.mount('#app');
