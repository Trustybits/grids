// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD1SapZGG49zaIfBv3QqZWxobQmws263zQ",
  authDomain: "grids-one.firebaseapp.com",
  projectId: "grids-one",
  storageBucket: "grids-one.firebasestorage.app",
  messagingSenderId: "598562210148",
  appId: "1:598562210148:web:6bfd6ef229fcd9fd5b3a71",
  measurementId: "G-8Q904761XS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const analytics = getAnalytics(app);
const functions = getFunctions(app);

export { app, auth, db, rtdb, analytics, functions };