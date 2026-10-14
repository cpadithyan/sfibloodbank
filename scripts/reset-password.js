// Usage (Windows CMD):  set GOOGLE_APPLICATION_CREDENTIALS=key.json
//                       node scripts/reset-password.js <username> <newpassword>
// Updates the login AND the superadmin vault, so the Admins tab shows the new password.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [username, newPassword] = process.argv.slice(2);
if (!username || !newPassword) { console.log('Usage: node scripts/reset-password.js <username> <newpassword>'); process.exit(1); }

initializeApp({ credential: applicationDefault(), projectId: 'sfibbank' });
const u = username.trim().toLowerCase();
const user = await getAuth().getUserByEmail(`${u}@sfibbank.app`);
await getAuth().updateUser(user.uid, { password: newPassword + '@SFIB' });
await getFirestore().collection('artifacts').doc('sfibbank').collection('public').doc('data')
  .collection('admin_credentials').doc(user.uid).set({ username: u, password: newPassword });
console.log(`Password for ${u} is now: ${newPassword}`);
