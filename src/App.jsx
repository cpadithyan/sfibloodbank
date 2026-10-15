import { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';

const APP_NAME = 'RedConnect';
const BASE = ['artifacts', 'sfibbank', 'public', 'data'];
const col = (n) => collection(db, ...BASE, n);
const ref = (n, id) => doc(db, ...BASE, n, id);
const toEmail = (u) => `${u.trim().toLowerCase()}@sfibbank.app`;
// Firebase needs 6+ chars; old passwords can be shorter, so a fixed suffix is added behind the scenes
const toPw = (p) => p + '@SFIB';
const GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const PAGE = 30;
const waLink = (phone, text = '') => {
  const d = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? '91' + d : d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
};
const copy = (t) => navigator.clipboard?.writeText(t).then(() => alert('Copied'));
const placeKey = (p) => String(p || '').trim().toLowerCase().replace(/\s+/g, ' ');
const titleCase = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
const ACTION_LABEL = {
  DONOR_DELETE: 'Donor deleted', ADMIN_CREATE: 'Admin created', ADMIN_REMOVE: 'Admin removed',
  ADMIN_PASSWORD: 'Password changed', ADMIN_ROLE: 'Role changed',
};
// unique locations taken from the donors already in the database
const placesFrom = (donors) => {
  const m = new Map();
  donors.forEach((d) => {
    const k = placeKey(d.place);
    if (!k) return;
    const e = m.get(k) || { key: k, label: titleCase(d.place), count: 0 };
    e.count++;
    m.set(k, e);
  });
  return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
};
const secondaryAuth = () => getAuth(getApps().find((a) => a.name === 'sec') ? getApp('sec') : initializeApp(firebaseConfig, 'sec'));

/* ---------- SVG icons (no emoji) ---------- */
const PATHS = {
  drop: <path d="M12 2.7c3.5 4.2 6 7.2 6 10.3a6 6 0 0 1-12 0c0-3.1 2.5-6.1 6-10.3z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  userPlus: <><path d="M15 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9" cy="8" r="3.5" /><path d="M19 8v6M16 11h6" /></>,
  pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="8" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />,
};
const Icon = ({ n }) => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">{PATHS[n]}</svg>;

const Msg = ({ m }) => (m ? <div className={'msg ' + m.type}><Icon n={m.type === 'ok' ? 'check' : 'alert'} />{m.text}</div> : null);

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
  const shownErr = err || error;
  return (
    <form className="login" onSubmit={go}>
      <div className="card form">
        <div className="logo"><Icon n="drop" /></div>
        <h2>{APP_NAME}</h2>
        <p className="muted">Authorised organisers only</p>
        <label className="f"><span>Username</span><input autoCapitalize="none" autoCorrect="off" value={u} onChange={(e) => setU(e.target.value)} /></label>
        <label className="f"><span>Password</span><input type="password" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <button className="btn full">Login</button>
        {shownErr && <Msg m={{ type: 'err', text: shownErr }} />}
      </div>
    </form>
  );
}

function Donors({ me, isSuper }) {
  const donors = useCol('donors');
  const [q, setQ] = useState('');
  const [bg, setBg] = useState('');
  const [loc, setLoc] = useState('');
  const [gender, setGender] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const locations = useMemo(() => placesFrom(donors), [donors]);
  useEffect(() => setLimit(PAGE), [q, bg, loc, gender]);

  const del = async (d) => {
    if (!confirm(`Delete ${d.name}?`)) return;
    await deleteDoc(ref('donors', d.id));
    await log(me, 'DONOR_DELETE', d.id, d.name);
  };
  const needle = q.trim().toLowerCase();
  const shown = donors
    .filter((d) => (!bg || d.bloodGroup === bg)
      && (!loc || placeKey(d.place) === loc)
      && (!gender || d.gender === gender)
      && `${d.name} ${d.place} ${d.phone}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  const filtered = q || bg || loc || gender;
  const clear = () => { setQ(''); setBg(''); setLoc(''); setGender(''); };
  const visible = shown.slice(0, limit);

  return (
    <>
      <div className="card filters">
        <div className="inwrap">
          <Icon n="search" />
          <input placeholder="Search name, place or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <div className="filter-label">Blood group</div>
          <div className="chips">
            {['', ...GROUPS].map((g) => (
              <button key={g} className={'chip' + (bg === g ? ' on' : '')} onClick={() => setBg(g)}>{g || 'All'}</button>
            ))}
          </div>
        </div>
        <div className="row2">
          <div>
            <div className="filter-label">Location</div>
            <select value={loc} onChange={(e) => setLoc(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.key} value={l.key}>{l.label} ({l.count})</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label">Gender</div>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">All genders</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="resbar">
        <span className="count">{shown.length} {shown.length === 1 ? 'donor' : 'donors'}</span>
        {filtered ? <button className="linkbtn" onClick={clear}><Icon n="x" />Clear filters</button> : null}
      </div>

      {visible.map((d) => (
        <div className="card row" key={d.id}>
          <div className="bg">{d.bloodGroup}</div>
          <div className="grow">
            <div className="dname">{d.name}</div>
            <div className="meta">
              <span>{[d.gender, d.age].filter(Boolean).join(', ')}</span>
              {d.place && <span><Icon n="pin" />{d.place}</span>}
            </div>
            <div className="phoneline">
              <span><Icon n="phone" />{d.phone}</span>
              {isSuper && <button className="iconbtn" title="Delete donor" aria-label="Delete donor" onClick={() => del(d)}><Icon n="trash" /></button>}
            </div>
          </div>
          <div className="qa">
            <a className="qbtn" href={`tel:${d.phone}`} title="Call" aria-label={`Call ${d.name}`}><Icon n="phone" /></a>
            <a className="qbtn wa" target="_blank" rel="noreferrer" href={waLink(d.phone)} title="WhatsApp" aria-label={`WhatsApp ${d.name}`}><Icon n="chat" /></a>
          </div>
        </div>
      ))}
      {shown.length > limit && (
        <button className="btn soft full more" onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</button>
      )}
      {!shown.length && (
        <div className="card empty"><Icon n="search" /><div>No donors found</div></div>
      )}
    </>
  );
}

function Register() {
  const donors = useCol('donors');
  const places = useMemo(() => placesFrom(donors), [donors]);
  const empty = { name: '', age: '', gender: 'Male', bloodGroup: 'A+', phone: '', place: '' };
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pick = (k, v) => setF({ ...f, [k]: v });
  const add = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.phone.trim()) return setMsg({ type: 'err', text: 'Name and phone are required' });
    if (!f.place) return setMsg({ type: 'err', text: 'Please select a place' });
    try {
      await addDoc(col('donors'), { ...f, name: f.name.trim(), place: f.place.trim(), phone: f.phone.trim(), age: Number(f.age), registeredBy: auth.currentUser.uid, timestamp: serverTimestamp() });
      setF(empty);
      setMsg({ type: 'ok', text: 'Donor registered' });
    } catch (er) { setMsg({ type: 'err', text: er.message }); }
  };
  return (
    <>
      <div className="page-title">Register donor</div>
      <form className="card form" onSubmit={add}>
        <label className="f"><span>Full name</span><input placeholder="Enter full name" value={f.name} onChange={set('name')} /></label>
        <div className="row2">
          <label className="f"><span>Age</span><input placeholder="Years" type="number" inputMode="numeric" value={f.age} onChange={set('age')} /></label>
          <label className="f"><span>Phone</span><input placeholder="Mobile number" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} /></label>
        </div>
        <div>
          <div className="flabel">Gender</div>
          <div className="seg">
            {['Male', 'Female', 'Other'].map((g) => <button type="button" key={g} className={f.gender === g ? 'on' : ''} onClick={() => pick('gender', g)}>{g}</button>)}
          </div>
        </div>
        <div>
          <div className="flabel">Blood group</div>
          <div className="bgrid">
            {GROUPS.map((g) => <button type="button" key={g} className={f.bloodGroup === g ? 'on' : ''} onClick={() => pick('bloodGroup', g)}>{g}</button>)}
          </div>
        </div>
        <label className="f">
          <span>Place</span>
          <select value={f.place} onChange={set('place')} disabled={!places.length}>
            <option value="">{places.length ? 'Select place' : 'No locations available'}</option>
            {places.map((p) => <option key={p.key} value={p.label}>{p.label}</option>)}
          </select>
        </label>
        <button className="btn full">Save donor</button>
        <Msg m={msg} />
      </form>
    </>
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
      <div className="page-title">Emergency contacts</div>
      {isSuper && (
        <details className="card"><summary><span className="plus"><Icon n="plus" /></span>Add emergency contact</summary>
          <form className="form" onSubmit={add}>
            <label className="f"><span>Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="f"><span>Phone</span><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
            <label className="f"><span>Place / role</span><input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></label>
            <button className="btn full">Add contact</button>
          </form>
        </details>
      )}
      {rows.map((r) => (
        <div className="card row" key={r.id}>
          <div className="avatar"><Icon n="pulse" /></div>
          <div className="grow">
            <div className="dname">{r.name}</div>
            {r.place && <div className="meta"><span><Icon n="pin" />{r.place}</span></div>}
            <div className="phoneline">
              <span><Icon n="phone" />{r.phone}</span>
              {isSuper && <button className="iconbtn" title="Delete" aria-label="Delete contact" onClick={() => deleteDoc(ref('emergency_contacts', r.id))}><Icon n="trash" /></button>}
            </div>
          </div>
          <div className="qa">
            <a className="qbtn" href={`tel:${r.phone}`} title="Call" aria-label={`Call ${r.name}`}><Icon n="phone" /></a>
            <a className="qbtn wa" target="_blank" rel="noreferrer" href={waLink(r.phone)} title="WhatsApp" aria-label={`WhatsApp ${r.name}`}><Icon n="chat" /></a>
          </div>
        </div>
      ))}
      {!rows.length && <div className="card empty"><Icon n="pulse" /><div>No emergency contacts yet</div></div>}
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
  const [msg, setMsg] = useState(null);
  const [edit, setEdit] = useState(null); // { id, role, pw }
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    setMsg(null);
    const username = f.username.trim().toLowerCase();
    if (!f.name || !username || f.password.length < 4) return setMsg({ type: 'err', text: 'Name, username and a password of 4+ characters are required' });
    try {
      // secondary app instance so the superadmin stays signed in
      const secAuth = secondaryAuth();
      const cred = await createUserWithEmailAndPassword(secAuth, toEmail(username), toPw(f.password));
      await signOut(secAuth);
      const { password, ...profile } = f;
      await setDoc(ref('admin_users', cred.user.uid), { ...profile, username, timestamp: serverTimestamp() });
      await setDoc(ref('admin_credentials', cred.user.uid), { username, password });
      await log(me, 'ADMIN_CREATE', cred.user.uid, f.name);
      setF(empty);
      setMsg({ type: 'ok', text: 'Admin created. Share the login with them on WhatsApp below.' });
    } catch (er) { setMsg({ type: 'err', text: er.code === 'auth/email-already-in-use' ? 'That username already exists' : er.message }); }
  };
  const remove = async (a) => {
    if (a.id === auth.currentUser.uid) return alert('You cannot remove yourself');
    if (!confirm(`Remove access for ${a.name}?`)) return;
    await deleteDoc(ref('admin_users', a.id)); // no profile = no access
    await deleteDoc(ref('admin_credentials', a.id));
    await log(me, 'ADMIN_REMOVE', a.id, a.name);
  };

  const startEdit = (a) => { setMsg(null); setEdit({ id: a.id, role: a.role || 'admin', pw: '' }); };
  const saveEdit = async (a) => {
    setMsg(null);
    const isSelf = a.id === auth.currentUser.uid;
    const roleChanged = edit.role !== a.role;
    const newPw = edit.pw.trim();
    if (!roleChanged && !newPw) return setEdit(null);
    if (roleChanged && isSelf) return setMsg({ type: 'err', text: 'You cannot change your own role' });
    if (newPw && newPw.length < 4) return setMsg({ type: 'err', text: 'New password must be 4+ characters' });
    if (newPw && !pw[a.id]) return setMsg({ type: 'err', text: 'This admin\'s current password is not recorded, so it cannot be changed here. Use the reset-password script instead.' });
    setBusy(true);
    try {
      if (newPw) {
        // sign in as that admin on the secondary app using the stored password, then change it
        const secAuth = secondaryAuth();
        const cred = await signInWithEmailAndPassword(secAuth, toEmail(a.username), toPw(pw[a.id]));
        await updatePassword(cred.user, toPw(newPw));
        await signOut(secAuth);
        await setDoc(ref('admin_credentials', a.id), { username: a.username, password: newPw });
        await log(me, 'ADMIN_PASSWORD', a.id, a.name);
      }
      if (roleChanged) {
        await setDoc(ref('admin_users', a.id), { role: edit.role }, { merge: true });
        await log(me, 'ADMIN_ROLE', a.id, `${a.name} (${a.role} to ${edit.role})`);
      }
      setEdit(null);
      if (newPw && isSelf) { alert('Password changed. Please log in again.'); return signOut(auth); }
      setMsg({ type: 'ok', text: `${a.name} updated` });
    } catch (er) {
      setMsg({ type: 'err', text: er.code === 'auth/invalid-credential' ? 'Stored password does not match this account, so it cannot be changed here. Use the reset-password script instead.' : er.message });
    }
    setBusy(false);
  };
  const text = (a) => `Hi ${a.name}, your ${APP_NAME} login:\nUsername: ${a.username}\nPassword: ${pw[a.id]}\n${location.origin}`;

  return (
    <>
      <div className="page-title">Admins</div>
      <details className="card"><summary><span className="plus"><Icon n="plus" /></span>Create admin</summary>
        <form className="form" onSubmit={add}>
          <label className="f"><span>Name</span><input value={f.name} onChange={set('name')} /></label>
          <div className="row2">
            <label className="f"><span>Username</span><input autoCapitalize="none" value={f.username} onChange={set('username')} /></label>
            <label className="f"><span>Password</span><input autoCapitalize="none" value={f.password} onChange={set('password')} /></label>
          </div>
          <div className="row2">
            <label className="f"><span>Phone (WhatsApp)</span><input type="tel" value={f.phone} onChange={set('phone')} /></label>
            <label className="f"><span>Role</span>
              <select value={f.role} onChange={set('role')}><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select>
            </label>
          </div>
          <div className="row2">
            <label className="f"><span>Designation</span><input value={f.designation} onChange={set('designation')} /></label>
            <label className="f"><span>Location</span><input value={f.location} onChange={set('location')} /></label>
          </div>
          <button className="btn full">Create admin</button>
        </form>
      </details>
      <Msg m={msg} />
      {admins.map((a) => (
        <div className="card" key={a.id}>
          <div className="person">
            <div className="avatar">{initials(a.name)}</div>
            <div className="grow">
              <div className="ptitle"><b>{a.name}</b><span className={'tag' + (a.role === 'superadmin' ? ' dark' : '')}>{a.role}</span></div>
              <div className="meta">
                {a.designation && <span><Icon n="user" />{a.designation}</span>}
                {a.location && <span><Icon n="pin" />{a.location}</span>}
                {a.phone && <span><Icon n="phone" />{a.phone}</span>}
              </div>
            </div>
          </div>
          <div className="cred">
            <div><small>Username</small><b>{a.username}</b></div>
            <div><small>Password</small><b>{pw[a.id] ? (show[a.id] ? pw[a.id] : '••••••••') : 'Not recorded'}</b></div>
          </div>
          {edit?.id === a.id ? (
            <div className="editbox">
              <label className="f"><span>Role</span>
                <select value={edit.role} disabled={a.id === auth.currentUser.uid} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </label>
              <label className="f"><span>New password</span>
                <input autoCapitalize="none" placeholder="Leave blank to keep current" value={edit.pw} onChange={(e) => setEdit({ ...edit, pw: e.target.value })} />
              </label>
              <div className="editbtns">
                <button className="btn sm soft" disabled={busy} onClick={() => setEdit(null)}>Cancel</button>
                <button className="btn sm" disabled={busy} onClick={() => saveEdit(a)}>{busy ? 'Saving…' : 'Save changes'}</button>
              </div>
            </div>
          ) : (
            <div className="acts5">
              {pw[a.id] && (
                <>
                  <button className="btn sm soft s2" onClick={() => setShow({ ...show, [a.id]: !show[a.id] })}><Icon n={show[a.id] ? 'eyeOff' : 'eye'} />{show[a.id] ? 'Hide' : 'Show'}</button>
                  <button className="btn sm soft s2" onClick={() => copy(text(a))}><Icon n="copy" />Copy</button>
                  <a className="btn sm wa s2" target="_blank" rel="noreferrer" href={waLink(a.phone, text(a))}><Icon n="chat" />Send</a>
                </>
              )}
              <button className="btn sm soft s3" onClick={() => startEdit(a)}><Icon n="edit" />Edit</button>
              <button className="btn sm ghost s3" onClick={() => remove(a)}><Icon n="trash" />Remove</button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function Logs() {
  const logs = useCol('admin_logs').sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return (
    <>
      <div className="page-title">Activity log</div>
      {logs.map((l) => (
        <div className="card log" key={l.id}>
          <div className="dot"><Icon n="list" /></div>
          <div className="grow">
            <b>{ACTION_LABEL[l.action] || l.action}</b>
            <div>{l.targetName}</div>
            <div className="muted">by {l.adminName} · {new Date(l.timestamp).toLocaleString()}</div>
          </div>
        </div>
      ))}
      {!logs.length && <div className="card empty"><Icon n="list" /><div>No activity yet</div></div>}
    </>
  );
}

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('donors');
  const [menu, setMenu] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setMe(null); return setReady(true); }
    const s = await getDoc(ref('admin_users', u.uid)).catch(() => null);
    if (s?.exists()) { setError(''); setMe(s.data()); }
    else { setError('This account has no access'); await signOut(auth); }
    setReady(true);
  }), []);

  if (!ready) return <div className="loading">Loading…</div>;
  if (!me) return <Login error={error} />;
  const isSuper = me.role === 'superadmin';
  const go = (t) => { setTab(t); setMenu(false); window.scrollTo(0, 0); };
  const items = [['emergency', 'pulse', 'Emergency contacts'], ...(isSuper ? [['admins', 'users', 'Admins'], ['logs', 'list', 'Activity log']] : [])];
  const inMenu = items.some(([k]) => k === tab);

  return (
    <>
      <header>
        <div className="brand">
          <div className="logo"><Icon n="drop" /></div>
          <div style={{ minWidth: 0 }}><b>{APP_NAME}</b><small>{me.name} · {me.role}</small></div>
        </div>
        <div className="hav">{initials(me.name)}</div>
      </header>
      <div className="wrap">
        {tab === 'donors' && <Donors me={me} isSuper={isSuper} />}
        {tab === 'add' && <Register />}
        {tab === 'emergency' && <Emergency isSuper={isSuper} />}
        {tab === 'admins' && isSuper && <Admins me={me} />}
        {tab === 'logs' && isSuper && <Logs />}
      </div>
      <nav>
        <button className={tab === 'donors' ? 'on' : ''} onClick={() => go('donors')}><Icon n="search" />Donors</button>
        <button className={tab === 'add' ? 'on' : ''} onClick={() => go('add')}><Icon n="userPlus" />Register</button>
        <button className={inMenu || menu ? 'on' : ''} onClick={() => setMenu(true)}><Icon n="menu" />Menu</button>
      </nav>
      {menu && (
        <>
          <div className="scrim" onClick={() => setMenu(false)} />
          <aside className="drawer">
            <div className="dhead">
              <div className="hav">{initials(me.name)}</div>
              <div style={{ minWidth: 0 }}><b>{me.name}</b><small>{me.role}</small></div>
              <button className="dclose" aria-label="Close menu" onClick={() => setMenu(false)}><Icon n="x" /></button>
            </div>
            <div className="dlist">
              <div className="dsec">More</div>
              {items.map(([k, i, l]) => (
                <button key={k} className={'mitem' + (tab === k ? ' on' : '')} onClick={() => go(k)}>
                  <span className="mi"><Icon n={i} /></span>{l}<span className="chev"><Icon n="chevron" /></span>
                </button>
              ))}
            </div>
            <div className="dfoot">
              <button className="btn ghost full" onClick={() => { setMenu(false); signOut(auth); }}><Icon n="logout" />Logout</button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
