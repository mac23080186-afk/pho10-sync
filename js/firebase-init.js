// ══════════════════════════════════════════════════════════
//  Firebase Web App Config — SAFE for browser (client-side)
//  ⚠️  Fill in YOUR values from:
//      Firebase Console → Project Settings → Your Apps → Web App → Config
//  ✋  DO NOT use the Admin SDK JSON file here — that is server-only
// ══════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyCHS1r9Q1Z0tv_TwsAvNCedkBYiPsww3aQ",
  authDomain: "pho10-sync-db.firebaseapp.com",
  projectId: "pho10-sync-db",
  storageBucket: "pho10-sync-db.firebasestorage.app",
  messagingSenderId: "406712943079",
  appId: "1:406712943079:web:98e59b57d9497261de3d42",
};

firebase.initializeApp(firebaseConfig);

// Expose Firebase services as globals.
// Both customer.html and kitchen.html use Firestore.
// Auth CDN is only loaded by kitchen.html, so guard before calling firebase.auth().
window._pho10Db   = firebase.firestore();
if (typeof firebase.auth === 'function') {
  window._pho10Auth = firebase.auth();
}
