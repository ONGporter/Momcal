/**
 * js/firebase.js
 * Firebase 초기화 및 Auth/Firestore 익스포트
 * 이 파일만 Firebase SDK를 직접 import합니다.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyDKJheEl_ZALpPdDza2ytPbeGw54oJ7c-0',
  authDomain:        'momcal-fd12b.firebaseapp.com',
  projectId:         'momcal-fd12b',
  storageBucket:     'momcal-fd12b.firebasestorage.app',
  messagingSenderId: '264078170764',
  appId:             '1:264078170764:web:e57a537d74a35f4afa79a9',
  measurementId:     'G-L4XJW8F9Z8',
};

const app = initializeApp(firebaseConfig);

export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  doc,
  setDoc,
  onSnapshot,
};
