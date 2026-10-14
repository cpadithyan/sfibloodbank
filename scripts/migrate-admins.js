// One-time: converts old admin_users (plain-text passwords) into Firebase Auth users, keeping the same passwords.
// Windows CMD:  set GOOGLE_APPLICATION_CREDENTIALS=key.json   then   node scripts/migrate-admins.js
// Run it ONLY on your own machine. Never share or commit key.json.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'sfibbank' });
const auth = getAuth();
const db = getFirestore();
const base = db.collection('artifacts').doc('sfibbank').collection('public').doc('data');

const snap = await base.collection('admin_users').get();
console.log(`Found ${snap.size} admin records`);
for (const d of snap.docs) {
  const old = d.data();
  if (typeof old.password !== 'string' || !old.username) continue; // already migrated
  const username = old.username.trim().toLowerCase();
  try {
    const user = await auth.createUser({
      email: `${username}@sfibbank.app`,
      password: old.password + '@SFIB', // keeps the OLD password working in the new app
      displayName: old.name,
    });
    const { password, ...profile } = old;
    await base.collection('admin_users').doc(user.uid).set({ ...profile, username });
    await d.ref.delete();
    console.log(`migrated ${String(old.role).padEnd(10)} ${username}`);
  } catch (e) {
    console.log(`FAILED   ${username}: ${e.message}`);
  }
}
console.log('Done. Admins log in with their OLD username and password.');
