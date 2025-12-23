// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCjmQ3Bn0Qtvzmx5a4RL1syPDCdGnALbXk",
  authDomain: "joju-stage.firebaseapp.com",
  projectId: "joju-stage",
  storageBucket: "joju-stage.firebasestorage.app",
  messagingSenderId: "891449053644",
  appId: "1:891449053644:web:350b514613b3ec43ac4d69",
  measurementId: "G-DLS95BF0WQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };