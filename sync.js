/* KAIROS · sincronizare prin Firebase: login Google, rundown-uri comune, Live comun, comentarii.
   Expune window.KSYNC. Fără login, editorul merge local, ca înainte.
   Rundown-ul se alege din link: rundown.html?id=<id>. Fără id, e rundown-ul Turneului Artiștilor (ta-2026).
   Pe pagina de start (window.KSYNC_MODE = "landing") se încarcă doar contul și lista de rundown-uri. */
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
  // administratorii KAIROS: văd și pot edita orice rundown; identici cu cei din firestore.rules
  const ADMINS = ["vdeaconescu91@gmail.com", "vlad@nexusclub.ro"];
  const LEGACY_ID = "ta-2026";
  const LANDING = window.KSYNC_MODE === "landing";
  const urlId = new URLSearchParams(location.search).get("id");
  const SHOW_ID = urlId && /^[A-Za-z0-9_-]{3,60}$/.test(urlId) ? urlId : LEGACY_ID;

  const listeners = { auth: [], show: [], live: [], comments: [], status: [] };
  const emit = (k, v) => listeners[k].forEach((f) => { try { f(v); } catch (e) { console.error(e); } });

  const K = window.KSYNC = {
    ready: false, user: null, role: "local", offset: 0, status: "local",
    showId: SHOW_ID, isLegacy: SHOW_ID === LEGACY_ID, showMeta: { ownerEmail: "", editors: [] },
    team: [], isTeam: false, isAdmin: false, comments: [], missing: false,
    on(k, f) { listeners[k].push(f); return () => { listeners[k] = listeners[k].filter((x) => x !== f); }; },
    now() { return Date.now() + K.offset; },
    canEdit() { return K.role === "owner" || K.role === "editor" || (K.role === "local" && K.isLegacy); },
    isOwner() { return K.role === "owner"; },
    signIn, signOut, field, items, live, addComment, resolveComment, deleteComment, setEditors, setTeam, listShows, createShow,
    createInvite, getInvite, acceptInvite, revokeInvites
  };
  // compatibilitate: lista de editori a rundown-ului curent
  Object.defineProperty(K, "editors", { get: () => K.showMeta.editors || [] });

  if (!window.firebase) { console.warn("Firebase nu s-a încărcat; KAIROS merge local."); return; }
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  const showsCol = db.collection("shows");
  const showRef = showsCol.doc(SHOW_ID);
  const liveRef = db.doc(`shows/${SHOW_ID}/live/state`);
  const commentsRef = db.collection(`shows/${SHOW_ID}/comments`);
  const rolesRef = db.doc("config/roles");
  K.ready = true;

  let unsub = [];
  const setStatus = (s) => { K.status = s; emit("status", s); };
  const cleanEmails = (list) => [...new Set((list || []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];

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

  function computeRole() {
    if (!K.user) { K.role = "local"; return; }
    const e = K.user.email, m = K.showMeta;
    K.role = K.isAdmin || (m.ownerEmail && m.ownerEmail === e) ? "owner" : (m.editors || []).includes(e) ? "editor" : "viewer";
  }

  auth.onAuthStateChanged(async (user) => {
    unsub.forEach((f) => f()); unsub = [];
    K.user = user ? { uid: user.uid, name: user.displayName || user.email, email: (user.email || "").toLowerCase(), photo: user.photoURL || "" } : null;
    K.isAdmin = !!(K.user && ADMINS.includes(K.user.email));
    if (!user) { K.role = "local"; K.offset = 0; K.comments = []; K.isTeam = false; setStatus("local"); emit("auth", K.user); emit("comments", []); return; }

    setStatus("connecting");
    // echipa KAIROS: cine poate porni rundown-uri noi
    unsub.push(rolesRef.onSnapshot((s) => {
      K.team = (s.exists && Array.isArray(s.get("editors"))) ? s.get("editors") : [];
      K.isTeam = K.isAdmin || K.team.includes(K.user.email);
      emit("auth", K.user);
    }, () => { K.team = []; K.isTeam = K.isAdmin; emit("auth", K.user); }));

    if (LANDING) { setStatus("online"); emit("auth", K.user); return; }

    measureOffset(user.uid).catch(() => {});
    computeRole(); emit("auth", K.user);

    unsub.push(showRef.onSnapshot((s) => {
      if (s.metadata.hasPendingWrites) return;
      setStatus("online");
      if (!s.exists) { K.missing = true; K.showMeta = { ownerEmail: "", editors: [] }; computeRole(); emit("auth", K.user); emit("show", null); return; }
      K.missing = false;
      const d = s.data();
      K.showMeta = { ownerEmail: d.ownerEmail || "", editors: Array.isArray(d.editors) ? d.editors : [] };
      computeRole(); watchComments(); emit("auth", K.user);
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
    if (!K.user || LANDING) return;
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

  /* ---------- scrieri în rundown ---------- */
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
    const body = { show, order, items: map, updatedAt: TS(), updatedBy: K.user.email };
    try {
      if (K.missing) {          // primul upload al rundown-ului (doar pentru cel vechi, ta-2026)
        const owner = K.user.email;
        await showRef.set({ ...body, ownerEmail: owner, editors: [], access: [owner], createdAt: TS() });
      } else {
        await showRef.update(body); // update păstrează proprietarul și editorii
      }
    } catch (e) { setStatus("error"); console.error(e); }
  }
  async function live(data) {
    if (!canWrite()) return;
    try { await liveRef.set({ ...data, by: K.user.email, at: TS() }); } catch (e) { console.error(e); }
  }

  /* ---------- comentarii ---------- */
  async function addComment({ segId, segTitle, text, kind }) {
    if (!K.user) throw new Error("not_signed_in");
    await commentsRef.add({ segId, segTitle: segTitle || "", text: String(text).slice(0, 4000), kind: kind === "text" ? "text" : "comment",
      uid: K.user.uid, name: K.user.name || "", email: K.user.email, photo: K.user.photo, createdAt: TS(), resolved: false });
  }
  function resolveComment(id, resolved) { return commentsRef.doc(id).update({ resolved: !!resolved, resolvedBy: K.user ? K.user.email : "" }); }
  function deleteComment(id) { return commentsRef.doc(id).delete(); }

  /* ---------- acces ---------- */
  // editorii rundown-ului curent (îi alege proprietarul lui)
  async function setEditors(list, showId = SHOW_ID) {
    const ref = showsCol.doc(showId);
    const snap = await ref.get();
    const owner = (snap.exists && snap.get("ownerEmail")) || K.user.email;
    const editors = cleanEmails(list).filter((e) => e !== owner);
    await ref.set({ ownerEmail: owner, editors, access: [owner, ...editors], updatedAt: TS(), updatedBy: K.user.email }, { merge: true });
  }
  // echipa KAIROS: cine are voie să pornească rundown-uri noi (doar administratorii o schimbă)
  function setTeam(list) { return rolesRef.set({ editors: cleanEmails(list), updatedBy: K.user.email, updatedAt: TS() }); }

  /* ---------- invitații ---------- */
  const invitesCol = db.collection("invites");
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
  // un link valabil 7 zile, care îl face editor pe cine îl acceptă (și, dacă vrea un administrator, membru al echipei KAIROS)
  async function createInvite({ showId = SHOW_ID, showTitle = "", team = false, days = 7 } = {}) {
    if (!K.user) throw new Error("not_signed_in");
    const t = token();
    await invitesCol.doc(t).set({ showId, showTitle, team: !!(team && K.isAdmin), createdBy: K.user.email, createdAt: TS(),
      expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + days * 86400000), active: true });
    const base = location.href.replace(/[^/]*([?#].*)?$/, "");
    return { token: t, url: `${base}join.html?t=${t}`, expires: Date.now() + days * 86400000 };
  }
  async function getInvite(t) {
    const s = await invitesCol.doc(t).get();
    if (!s.exists) return null;
    const d = s.data();
    return { ...d, expiresAt: d.expiresAt ? d.expiresAt.toMillis() : 0 };
  }
  async function acceptInvite(t) {
    if (!K.user) throw new Error("not_signed_in");
    const inv = await getInvite(t);
    if (!inv || !inv.active || inv.expiresAt < Date.now()) throw Object.assign(new Error("invalid"), { code: "invite/invalid" });
    const me = K.user.email;
    const ref = showsCol.doc(inv.showId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error("missing"), { code: "invite/show-missing" });
    const owner = snap.get("ownerEmail") || "", editors = snap.get("editors") || [], access = snap.get("access") || [];
    if (owner !== me && !editors.includes(me)) {
      await ref.update({ editors: [...editors, me], access: access.includes(me) ? access : [...access, me], lastInvite: t });
    }
    if (inv.team) {
      const r = await rolesRef.get(); const team = (r.exists && r.get("editors")) || [];
      if (!team.includes(me)) await rolesRef.set({ editors: [...team, me], lastInvite: t }, { merge: true });
    }
    return inv.showId;
  }
  async function revokeInvites(showId = SHOW_ID) {
    const qs = await invitesCol.where("createdBy", "==", K.user.email).where("showId", "==", showId).get();
    await Promise.all(qs.docs.filter((d) => d.get("active")).map((d) => d.ref.update({ active: false })));
    return qs.size;
  }

  /* ---------- pagina de start ---------- */
  function listShows(cb) {
    if (!K.user) { cb([]); return () => {}; }
    const q = K.isAdmin ? showsCol : showsCol.where("access", "array-contains", K.user.email);
    return q.onSnapshot((qs) => {
      cb(qs.docs.map((d) => {
        const x = d.data(); const order = Array.isArray(x.order) ? x.order : []; const map = x.items || {};
        let min = 0, n = 0;
        for (const id of order) { const it = map[id]; if (it && it.type !== "header") { min += Number(it.min) || 0; n++; } }
        return { id: d.id, show: x.show || {}, ownerEmail: x.ownerEmail || "", editors: x.editors || [], minutes: min, segments: n,
          updatedAt: x.updatedAt ? x.updatedAt.toMillis() : 0, updatedBy: x.updatedBy || "" };
      }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (e) => { console.error(e); cb(null, e); });
  }

  function slug(s) {
    return String(s || "rundown").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "rundown";
  }
  async function createShow({ title, date, start, venue, copyFrom }) {
    if (!K.user) throw new Error("not_signed_in");
    const id = `${slug(title)}-${Math.random().toString(36).slice(2, 8)}`;
    let order = [], map = {};
    if (copyFrom) {
      const src = await showsCol.doc(copyFrom).get();
      if (src.exists) { order = src.get("order") || []; map = src.get("items") || {}; }
    }
    if (!order.length) {
      const h = Math.random().toString(36).slice(2, 10), s1 = Math.random().toString(36).slice(2, 10);
      order = [h, s1];
      map = { [h]: { type: "header", title: "PRE-SHOW" },
        [s1]: { type: "segment", title: "Starting Soon", min: 10, cat: "grafica", video: "", gfx: "", talk: "", script: "", who: "" } };
    }
    const owner = K.user.email;
    await showsCol.doc(id).set({
      show: { title: title || "Rundown nou", date: date || "", start: start || "18:00", venue: venue || "" },
      order, items: map, ownerEmail: owner, editors: [], access: [owner],
      createdAt: TS(), updatedAt: TS(), updatedBy: owner
    });
    return id;
  }
})();
