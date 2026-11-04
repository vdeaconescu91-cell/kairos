/* KAIROS · sincronizare prin Firebase: login Google, rundown comun, starea Live comună, comentarii.
   Expune window.KSYNC. Fără login, aplicația merge local, ca înainte. */
(() => {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyDhcqSP82re3I8XnAsEfOEQT3SoCefVsu8",
    authDomain: "kairos-rundown.firebaseapp.com",
    projectId: "kairos-rundown",
    storageBucket: "kairos-rundown.firebasestorage.app",
    messagingSenderId: "413217755948",
    appId: "1:413217755948:web:865ca830ccebe5e1ca9289"
  };
  // proprietarii pot schimba lista de editori; trebuie să fie identici cu cei din firestore.rules
  const OWNERS = ["vdeaconescu91@gmail.com", "vlad@nexusclub.ro"];
  const SHOW_ID = "ta-2026";

  const listeners = { auth: [], show: [], live: [], comments: [], status: [] };
  const emit = (k, v) => listeners[k].forEach((f) => { try { f(v); } catch (e) { console.error(e); } });

  const K = window.KSYNC = {
    ready: false, user: null, role: "local", offset: 0, status: "local",
    editors: [], comments: [],
    on(k, f) { listeners[k].push(f); return () => { listeners[k] = listeners[k].filter((x) => x !== f); }; },
    now() { return Date.now() + K.offset; },
    canEdit() { return K.role === "owner" || K.role === "editor" || K.role === "local"; },
    isOwner() { return K.role === "owner"; },
    signIn, signOut, field, items, live, addComment, resolveComment, deleteComment, setEditors
  };

  if (!window.firebase) { console.warn("Firebase nu s-a încărcat; KAIROS merge local."); return; }
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  const showRef = db.doc(`shows/${SHOW_ID}`);
  const liveRef = db.doc(`shows/${SHOW_ID}/live/state`);
  const commentsRef = db.collection(`shows/${SHOW_ID}/comments`);
  const rolesRef = db.doc("config/roles");
  K.ready = true;

  let unsub = [];
  const setStatus = (s) => { K.status = s; emit("status", s); };

  async function signIn() {
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
        await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
      } else if (!(e && e.code === "auth/popup-closed-by-user")) { throw e; }
    }
  }
  function signOut() { return auth.signOut(); }

  // ceasul serverului: toată lumea vede același timer, oricât de decalat ar fi ceasul unui laptop
  async function measureOffset(uid) {
    const ref = db.doc(`pings/${uid}`); let best = null;
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await ref.set({ t: TS() });
      const snap = await ref.get({ source: "server" });
      const t1 = Date.now();
      const srv = snap.get("t"); if (!srv) continue;
      const rtt = t1 - t0, off = srv.toMillis() - (t0 + t1) / 2;
      if (!best || rtt < best.rtt) best = { rtt, off };
    }
    if (best) K.offset = Math.round(best.off);
  }

  auth.onAuthStateChanged(async (user) => {
    unsub.forEach((f) => f()); unsub = [];
    K.user = user ? { uid: user.uid, name: user.displayName || user.email, email: (user.email || "").toLowerCase(), photo: user.photoURL || "" } : null;
    if (!user) { K.role = "local"; K.offset = 0; K.comments = []; setStatus("local"); emit("auth", K.user); emit("comments", []); return; }

    setStatus("connecting");
    measureOffset(user.uid).catch(() => {});
    // rolul: proprietar, editor (din config/roles) sau vizitator
    unsub.push(rolesRef.onSnapshot((s) => {
      K.editors = (s.exists && Array.isArray(s.get("editors"))) ? s.get("editors") : [];
      const email = K.user.email;
      K.role = OWNERS.includes(email) ? "owner" : K.editors.includes(email) ? "editor" : "viewer";
      watchComments(); emit("auth", K.user);
    }, () => { K.role = OWNERS.includes(K.user.email) ? "owner" : "viewer"; watchComments(); emit("auth", K.user); }));

    unsub.push(showRef.onSnapshot((s) => {
      if (s.metadata.hasPendingWrites) return;
      setStatus("online");
      if (!s.exists) { emit("show", null); return; }
      const d = s.data();
      const order = Array.isArray(d.order) ? d.order : [];
      const map = d.items || {};
      const list = order.filter((id) => map[id]).map((id) => ({ id, ...map[id] }));
      emit("show", { show: d.show || {}, items: list, by: d.updatedBy || "" });
    }, (e) => { setStatus("error"); console.error(e); }));

    unsub.push(liveRef.onSnapshot((s) => {
      if (s.metadata.hasPendingWrites || !s.exists) return;
      emit("live", s.data());
    }, () => {}));

  });

  // editorii văd toate comentariile; ceilalți doar pe ale lor (așa cer și regulile din Firestore)
  let commentsUnsub = null, commentsScope = "";
  function watchComments() {
    if (!K.user) return;
    const all = K.role === "owner" || K.role === "editor";
    const scope = (all ? "all:" : "own:") + K.user.uid;
    if (scope === commentsScope) return;
    if (commentsUnsub) commentsUnsub();
    commentsScope = scope;
    const q = all ? commentsRef : commentsRef.where("uid", "==", K.user.uid);
    commentsUnsub = q.onSnapshot((qs) => {
      K.comments = qs.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.get("createdAt") ? d.get("createdAt").toMillis() : Date.now() }))
        .sort((a, b) => a.createdAt - b.createdAt);
      emit("comments", K.comments);
    }, (e) => console.error(e));
    unsub.push(() => { if (commentsUnsub) commentsUnsub(); commentsUnsub = null; commentsScope = ""; });
  }

  /* ---------- scrieri ---------- */
  const canWrite = () => K.user && (K.role === "owner" || K.role === "editor");
  const pending = new Map(); let flushT = null;
  function field(id, f, value) {
    if (!canWrite()) return;
    pending.set(`items.${id}.${f}`, value);
    clearTimeout(flushT); flushT = setTimeout(flush, 400);
  }
  async function flush() {
    if (!pending.size) return;
    const upd = Object.fromEntries(pending); pending.clear();
    upd.updatedAt = TS(); upd.updatedBy = K.user.email;
    try { await showRef.update(upd); } catch (e) { setStatus("error"); console.error(e); }
  }
  async function items(show, list) {
    if (!canWrite()) return;
    clearTimeout(flushT); pending.clear();
    const map = {}; const order = [];
    for (const it of list) { const { id, ...rest } = it; order.push(id); map[id] = rest; }
    try { await showRef.set({ show, order, items: map, updatedAt: TS(), updatedBy: K.user.email }); }
    catch (e) { setStatus("error"); console.error(e); }
  }
  async function live(data) {
    if (!canWrite()) return;
    try { await liveRef.set({ ...data, by: K.user.email, at: TS() }); } catch (e) { console.error(e); }
  }

  async function addComment({ segId, segTitle, text, kind }) {
    if (!K.user) throw new Error("not_signed_in");
    await commentsRef.add({ segId, segTitle: segTitle || "", text: String(text).slice(0, 4000), kind: kind === "text" ? "text" : "comment",
      uid: K.user.uid, name: K.user.name || "", email: K.user.email, photo: K.user.photo, createdAt: TS(), resolved: false });
  }
  function resolveComment(id, resolved) { return commentsRef.doc(id).update({ resolved: !!resolved, resolvedBy: K.user ? K.user.email : "" }); }
  function deleteComment(id) { return commentsRef.doc(id).delete(); }
  function setEditors(list) {
    const clean = [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e)))];
    return rolesRef.set({ editors: clean, updatedBy: K.user.email, updatedAt: TS() });
  }
})();
