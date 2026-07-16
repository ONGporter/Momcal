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
  signInWithCustomToken,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  getIdTokenResult,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
// v0.3.5: 카카오 로그인 — Kakao access token을 functions/index.js의 kakaoLogin()에 보내서
// Firebase 커스텀 토큰을 발급받고, 그 토큰으로 로그인함(Kakao는 Firebase Auth 기본 제공
// provider가 아니라서 이렇게 다리를 놔야 함). js/auth.js의 signInKakao() 참고.
import {
  getFunctions,
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js';
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
// v0.3.5: 카카오 로그인용 Cloud Functions 호출 인스턴스 — asia-northeast3(서울) 리전으로
// 맞춤(functions/index.js의 setGlobalOptions와 일치해야 함, 안 맞으면 함수를 못 찾음)
export const functionsApp   = getFunctions(app, 'asia-northeast3');

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  getIdTokenResult,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getMessaging,
  getToken,
  onMessage,
  isMessagingSupported,
  httpsCallable,
};
