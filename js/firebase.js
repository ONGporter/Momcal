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
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
// v0.0.36: FCM 진짜 푸시 알림 — 웹 푸시 지원 여부 확인(isSupported)·토큰 발급(getToken)·
// 포그라운드 수신(onMessage). 실제 사용 로직은 js/push.js에 있음(이 파일은 기존 관례대로
// Firebase SDK를 직접 import하는 유일한 파일 역할만 유지)
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported as isMessagingSupported,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js';

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
export const firebaseApp    = app; // v0.0.36: js/push.js에서 getMessaging(firebaseApp) 호출용

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getMessaging,
  getToken,
  onMessage,
  isMessagingSupported,
};
