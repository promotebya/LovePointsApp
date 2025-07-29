// firebase/firebaseConfig.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA9GMS43chgVSHXCH7i0A8FgACapq7uC38",
  authDomain: "lovepointsapp-23880.firebaseapp.com",
  projectId: "lovepointsapp-23880",
  storageBucket: "lovepointsapp-23880.appspot.com",
  messagingSenderId: "9974481581",
  appId: "1:9974481581:web:870b7f9ab8f50cdebdfc24",
  measurementId: "G-2PCYJEGDT5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };

