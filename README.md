# Red Connect (rebuild)
1. `npm install`
2. Web config is already filled in `src/firebase.js`
3. Firebase Console > Authentication > Sign-in method: enable **Email/Password**
4. Run `scripts/migrate-admins.js` once (see top of file) to convert old admins
5. Firestore > Rules: paste `firestore.rules`, Publish
6. `npm run dev` to test, then deploy (Vercel or `firebase deploy`)
