// One-time: fills the superadmin password vault for admins that were migrated earlier.
// Admins whose password is in KNOWN keep it. Everyone else gets a NEW password (shown in the Admins tab).
// Windows CMD:  set GOOGLE_APPLICATION_CREDENTIALS=key.json   then   node scripts/sync-vault.js
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

const KNOWN = { thiruvali: 'tly12', rajeeshp: 'rajeesh12', porur: 'pru12' };

initializeApp({ credential: applicationDefault(), projectId: 'sfibbank' });
const auth = getAuth();
const db = getFirestore();
const base = db.collection('artifacts').doc('sfibbank').collection('public').doc('data');

const snap = await base.collection('admin_users').get();
for (const d of snap.docs) {
  const username = d.data().username;
  const vault = base.collection('admin_credentials').doc(d.id);
  if ((await vault.get()).exists) continue;
  let password = KNOWN[username];
  let note = 'kept old password';
  if (!password) {
    password = crypto.randomBytes(4).toString('hex');
    await auth.updateUser(d.id, { password: password + '@SFIB' });
    note = 'NEW password set';
  }
  await vault.set({ username, password });
  console.log(`${username.padEnd(16)} ${note}`);
}
console.log('Done. Open the Admins tab as superadmin to see the logins.');
