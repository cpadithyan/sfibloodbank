import { useEffect, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';

const BASE = ['artifacts', 'sfibbank', 'public', 'data'];
const col = (n) => collection(db, ...BASE, n);
const ref = (n, id) => doc(db, ...BASE, n, id);
const toEmail = (u) => `${u.trim().toLowerCase()}@sfibbank.app`;
// Firebase needs 6+ chars; old passwords can be shorter, so a fixed suffix is added behind the scenes
const toPw = (p) => p + '@SFIB';
const GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const waLink = (phone, text = '') => {
  const d = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? '91' + d : d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
};
const copy = (t) => navigator.clipboard?.writeText(t).then(() => alert('Copied'));

function useCol(name) {
  const [rows, setRows] = useState([]);
  useEffect(() => onSnapshot(col(name), (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(name, e)), [name]);
  return rows;
}
const log = (me, action, targetId, targetName) =>
  addDoc(col('admin_logs'), { action, adminName: me.name, targetId, targetName, timestamp: new Date().toISOString() });

function Login({ error }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const go = async (e) => {
    e.preventDefault();
    setErr('');
    try { await signInWithEmailAndPassword(auth, toEmail(u), toPw(p)); }
    catch (er) { setErr(er.code === 'auth/invalid-credential' ? 'Wrong username or password' : er.code || er.message); }
  };
  return (
    <form className="login" onSubmit={go}>
      <div className="card grid">
        <h2 style={{ margin: 0 }}>🩸 SFIB Blood Bank</h2>
        <p className="muted" style={{ margin: 0 }}>Authorised organisers only</p>
        <input placeholder="Username" autoCapitalize="none" autoCorrect="off" value={u} onChange={(e) => setU(e.target.value)} />
        <input type="password" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} />
        <button className="btn full">Login</button>
        <p className="err" style={{ margin: 0 }}>{err || error}</p>
      </div>
    </form>
  );
}

function Donors({ me, isSuper }) {
  const donors = useCol('donors');
  const [q, setQ] = useState('');
  const [bg, setBg] = useState('');
  const del = async (d) => {
    if (!confirm(`Delete ${d.name}?`)) return;
    await deleteDoc(ref('donors', d.id));
    await log(me, 'DONOR_DELETE', d.id, d.name);
  };
  const shown = donors
    .filter((d) => (!bg || d.bloodGroup === bg) && `${d.name} ${d.place} ${d.phone}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  return (
    <>
      <input placeholder="🔍 Search name, place or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">{['', ...GROUPS].map((g) => <button key={g} className={'chip' + (bg === g ? ' on' : '')} onClick={() => setBg(g)}>{g || 'All'}</button>)}</div>
      <p className="muted">{shown.length} donors</p>
      {shown.map((d) => (
        <div className="card donor" key={d.id}>
          <div className="bg">{d.bloodGroup}</div>
          <div className="grow">
            <b>{d.name}</b>
            <div className="muted">{d.gender}, {d.age} · {d.place}</div>
            <div className="acts">
              <a className="btn sm" href={`tel:${d.phone}`}>📞 Call</a>
              <a className="btn sm wa" target="_blank" rel="noreferrer" href={waLink(d.phone)}>WhatsApp</a>
              {isSuper && <button className="btn sm ghost" onClick={() => del(d)}>Delete</button>}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function Register() {
  const empty = { name: '', age: '', gender: 'Male', bloodGroup: 'A+', phone: '', place: '' };
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.phone.trim()) return setMsg('Name and phone are required');
    await addDoc(col('donors'), { ...f, name: f.name.trim(), age: Number(f.age), registeredBy: auth.currentUser.uid, timestamp: serverTimestamp() });
    setF(empty);
    setMsg('✅ Donor registered');
  };
  return (
    <form className="card grid" onSubmit={add}>
      <h3 style={{ margin: 0 }}>Register donor</h3>
      <input placeholder="Full name" value={f.name} onChange={set('name')} />
      <input placeholder="Age" type="number" inputMode="numeric" value={f.age} onChange={set('age')} />
      <select value={f.gender} onChange={set('gender')}><option>Male</option><option>Female</option><option>Other</option></select>
      <select value={f.bloodGroup} onChange={set('bloodGroup')}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select>
      <input placeholder="Phone" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} />
      <input placeholder="Place" value={f.place} onChange={set('place')} />
      <button className="btn full">Save donor</button>
      <p className={msg.startsWith('✅') ? 'ok' : 'err'} style={{ margin: 0 }}>{msg}</p>
    </form>
  );
}

function Emergency({ isSuper }) {
  const rows = useCol('emergency_contacts');
  const [f, setF] = useState({ name: '', phone: '', place: '' });
  const add = async (e) => {
    e.preventDefault();
    if (!f.name || !f.phone) return;
    await addDoc(col('emergency_contacts'), { ...f, timestamp: serverTimestamp() });
    setF({ name: '', phone: '', place: '' });
  };
  return (
    <>
      {isSuper && (
        <details className="card"><summary>➕ Add emergency contact</summary>
          <form className="grid" style={{ marginTop: 10 }} onSubmit={add}>
            <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input placeholder="Phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <input placeholder="Place / role" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} />
            <button className="btn full">Add</button>
          </form>
        </details>
      )}
      {rows.map((r) => (
        <div className="card" key={r.id}>
          <b>{r.name}</b> <span className="muted">{r.place}</span>
          <div className="acts">
            <a className="btn sm" href={`tel:${r.phone}`}>📞 {r.phone}</a>
            {isSuper && <button className="btn sm ghost" onClick={() => deleteDoc(ref('emergency_contacts', r.id))}>Delete</button>}
          </div>
        </div>
      ))}
    </>
  );
}

function Admins({ me }) {
  const admins = useCol('admin_users');
  const creds = useCol('admin_credentials');
  const pw = Object.fromEntries(creds.map((c) => [c.id, c.password]));
  const [show, setShow] = useState({});
  const empty = { name: '', username: '', password: '', phone: '', role: 'admin', designation: '', location: '' };
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    setMsg('');
    const username = f.username.trim().toLowerCase();
    if (!f.name || !username || f.password.length < 4) return setMsg('Name, username and a password of 4+ characters are required');
    try {
      // secondary app instance so the superadmin stays signed in
      const sec = getApps().find((a) => a.name === 'sec') ? getApp('sec') : initializeApp(firebaseConfig, 'sec');
      const secAuth = getAuth(sec);
      const cred = await createUserWithEmailAndPassword(secAuth, toEmail(username), toPw(f.password));
      await signOut(secAuth);
      const { password, ...profile } = f;
      await setDoc(ref('admin_users', cred.user.uid), { ...profile, username, timestamp: serverTimestamp() });
      await setDoc(ref('admin_credentials', cred.user.uid), { username, password });
      await log(me, 'ADMIN_CREATE', cred.user.uid, f.name);
      setF(empty);
      setMsg('✅ Admin created. Share the login with them on WhatsApp below.');
    } catch (er) { setMsg(er.code === 'auth/email-already-in-use' ? 'That username already exists' : er.message); }
  };
  const remove = async (a) => {
    if (a.id === auth.currentUser.uid) return alert('You cannot remove yourself');
    if (!confirm(`Remove access for ${a.name}?`)) return;
    await deleteDoc(ref('admin_users', a.id)); // no profile = no access
    await deleteDoc(ref('admin_credentials', a.id));
    await log(me, 'ADMIN_REMOVE', a.id, a.name);
  };
  const text = (a) => `Hi ${a.name}, your SFIB Blood Bank login:\nUsername: ${a.username}\nPassword: ${pw[a.id]}\n${location.origin}`;

  return (
    <>
      <details className="card"><summary>➕ Create admin</summary>
        <form className="grid" style={{ marginTop: 10 }} onSubmit={add}>
          <input placeholder="Name" value={f.name} onChange={set('name')} />
          <input placeholder="Username" autoCapitalize="none" value={f.username} onChange={set('username')} />
          <input placeholder="Password" autoCapitalize="none" value={f.password} onChange={set('password')} />
          <input placeholder="Phone (for WhatsApp)" type="tel" value={f.phone} onChange={set('phone')} />
          <input placeholder="Designation" value={f.designation} onChange={set('designation')} />
          <input placeholder="Location" value={f.location} onChange={set('location')} />
          <select value={f.role} onChange={set('role')}><option value="admin">admin</option><option value="superadmin">superadmin</option></select>
          <button className="btn full">Create</button>
        </form>
      </details>
      {msg && <p className={msg.startsWith('✅') ? 'ok' : 'err'}>{msg}</p>}
      {admins.map((a) => (
        <div className="card" key={a.id}>
          <b>{a.name}</b> <span className="tag">{a.role}</span>
          <div className="muted">{a.designation} · {a.location} · {a.phone}</div>
          <div className="cred">
            <div><span className="muted">Username</span><br /><b>{a.username}</b></div>
            <div><span className="muted">Password</span><br /><b>{pw[a.id] ? (show[a.id] ? pw[a.id] : '••••••••') : 'Not recorded'}</b></div>
          </div>
          <div className="acts">
            {pw[a.id] && (
              <>
                <button className="btn sm" onClick={() => setShow({ ...show, [a.id]: !show[a.id] })}>{show[a.id] ? 'Hide' : 'Show'}</button>
                <button className="btn sm" onClick={() => copy(text(a))}>Copy</button>
                <a className="btn sm wa" target="_blank" rel="noreferrer" href={waLink(a.phone, text(a))}>Send on WhatsApp</a>
              </>
            )}
            <button className="btn sm ghost" onClick={() => remove(a)}>Remove</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Logs() {
  const logs = useCol('admin_logs').sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return logs.map((l) => (
    <div className="card" key={l.id}><b>{l.action}</b> · {l.targetName}<div className="muted">by {l.adminName} · {new Date(l.timestamp).toLocaleString()}</div></div>
  ));
}

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('donors');

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setMe(null); return setReady(true); }
    const s = await getDoc(ref('admin_users', u.uid)).catch(() => null);
    if (s?.exists()) { setError(''); setMe(s.data()); }
    else { setError('This account has no access'); await signOut(auth); }
    setReady(true);
  }), []);

  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;
  if (!me) return <Login error={error} />;
  const isSuper = me.role === 'superadmin';
  const tabs = [['donors', '🔍', 'Donors'], ['add', '➕', 'Register'], ['emergency', '🚑', 'Emergency'], ...(isSuper ? [['admins', '👤', 'Admins'], ['logs', '📜', 'Logs']] : [])];

  return (
    <>
      <header>
        <div><b>🩸 SFIB Blood Bank</b><small>{me.name} · {me.role}</small></div>
        <button className="btn sm ghost" onClick={() => signOut(auth)}>Logout</button>
      </header>
      <div className="wrap">
        {tab === 'donors' && <Donors me={me} isSuper={isSuper} />}
        {tab === 'add' && <Register />}
        {tab === 'emergency' && <Emergency isSuper={isSuper} />}
        {tab === 'admins' && isSuper && <Admins me={me} />}
        {tab === 'logs' && isSuper && <Logs />}
      </div>
      <nav>{tabs.map(([k, i, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{l}</button>)}</nav>
    </>
  );
}
