import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyDovKVGIyOCgTSTAE4YcPQq2dTxsIXPAuI',
  authDomain: 'sfibbank.firebaseapp.com',
  projectId: 'sfibbank',
  storageBucket: 'sfibbank.firebasestorage.app',
  messagingSenderId: '891751958403',
  appId: '1:891751958403:web:5d158bc3f88474613398b6',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
