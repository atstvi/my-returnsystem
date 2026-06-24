// Return Widget — multi-window, block-style timeblock calendar
//
// Two windows load this same file from different URLs:
//   http://localhost:14317/              → VIEW_MODE = "habits"  (habit list)
//   http://localhost:14317/?view=timeline → VIEW_MODE = "timeline" (block calendar)
// Auth state is shared via Firebase's IndexedDB (same origin).

(function () {
  "use strict";

  // ── Window mode ────────────────────────────────────────────────────────────
  var VIEW_MODE = (new URLSearchParams(location.search).get("view")) || "habits";

  // ── Tauri window controls ──────────────────────────────────────────────────
  var TAURI = window.__TAURI__;
  var hasTauri = !!(TAURI && TAURI.window && typeof TAURI.window.getCurrentWindow === "function");
  var appWindow = hasTauri ? TAURI.window.getCurrentWindow() : null;
  var pinned = false;

  function $id(id) { return document.getElementById(id); }
  function on(id, fn) { var el = $id(id); if (el) el.addEventListener("click", fn); }

  // ── Auth diagnostics ─────────────────────────────────────────────────────────
  var DBG_KEY = "__w_dbg";

  function dbgRead() {
    try { return JSON.parse(localStorage.getItem(DBG_KEY) || "[]"); }
    catch (_) { return []; }
  }

  function dbg(msg) {
    var line = new Date().toLocaleTimeString() + "  " + msg;
    var log = dbgRead();
    log.push(line);
    if (log.length > 40) log = log.slice(-40);
    try { localStorage.setItem(DBG_KEY, JSON.stringify(log)); } catch (_) {}
    dbgRender();
    try { console.log("[widget] " + msg); } catch (_) {}
  }

  function dbgRender() {
    var el = $id("dbg-log");
    if (el) el.textContent = dbgRead().join("\n");
  }

  dbgRender();
  dbg("page load · origin=" + location.origin + " · view=" + VIEW_MODE);

  on("pin-btn", function () {
    if (!appWindow) return;
    pinned = !pinned;
    appWindow.setAlwaysOnTop(pinned)
      .then(function () {
        var btn = $id("pin-btn");
        if (btn) {
          btn.classList.toggle("pinned", pinned);
          btn.title = pinned ? "고정 해제" : "항상 위에 고정";
        }
      })
      .catch(function (e) { console.error("[widget] setAlwaysOnTop:", e); pinned = !pinned; });
  });

  on("min-btn", function () { if (appWindow) appWindow.minimize().catch(console.error); });
  on("close-btn", function () { if (appWindow) appWindow.close().catch(console.error); });

  // ── Views ──────────────────────────────────────────────────────────────────
  var ALL_VIEWS = ["loading", "auth", "habits", "timeline", "timer", "calendar", "memo", "quickinput", "error"];

  // The data view this window lands on after auth.
  function mainViewName() {
    return VIEW_MODE === "timeline"   ? "timeline"
         : VIEW_MODE === "timer"      ? "timer"
         : VIEW_MODE === "calendar"   ? "calendar"
         : VIEW_MODE === "memo"       ? "memo"
         : VIEW_MODE === "quickinput" ? "quickinput"
         : "habits";
  }

  function showView(name) {
    ALL_VIEWS.forEach(function (v) {
      var el = $id("view-" + v);
      if (el) el.style.display = (v === name) ? "" : "none";
    });
  }

  function showError(msg) {
    var el = $id("err-msg");
    if (el) el.textContent = msg;
    showView("error");
  }

  // ── Firebase init ──────────────────────────────────────────────────────────
  var FB_CONFIG = {
    apiKey:     "AIzaSyA5zb3HtI4yZj0hJ9I66OMqpc7CPRuEVRY",
    authDomain: "my-return-system.firebaseapp.com",
    projectId:  "my-return-system"
  };

  var fbAuth, fbDb;
  try { firebase.app(); } catch (_) { firebase.initializeApp(FB_CONFIG); }
  fbAuth = firebase.auth();
  fbDb   = firebase.firestore();
  fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});

  // ── OAuth (system browser + loopback) ─────────────────────────────────────
  var OAUTH_REDIRECT = "http://127.0.0.1:14317/oauth2callback";
  var OAUTH_POLL     = "/oauth2result";
  var CFG_KEY        = "widget_oauth_cfg";

  function readCfg() { return safeJson(localStorage.getItem(CFG_KEY), {}); }
  function saveCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (_) {} }

  function b64url(bytes) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  function pkceVerifier() {
    var a = new Uint8Array(32); crypto.getRandomValues(a); return b64url(a);
  }
  function pkceChallenge(verifier) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(b64url);
  }

  function openExternal(url) {
    if (TAURI && TAURI.core && typeof TAURI.core.invoke === "function") {
      return TAURI.core.invoke("plugin:opener|open_url", { url: url, with: null });
    }
    window.open(url, "_blank");
    return Promise.resolve();
  }

  function resetSignInBtn() {
    var b = $id("sign-in-btn");
    if (b) { b.textContent = "Google로 로그인"; b.disabled = false; }
  }
  function failAuth(msg) {
    var e = $id("auth-err");
    if (e) e.textContent = msg;
    resetSignInBtn();
    showView("auth");
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  var unsubSnap = null;

  on("sign-in-btn", function () {
    var errEl = $id("auth-err");
    if (errEl) errEl.textContent = "";
    var clientId = ($id("oauth-client-id") && $id("oauth-client-id").value || "").trim();
    var clientSecret = ($id("oauth-client-secret") && $id("oauth-client-secret").value || "").trim();
    if (!clientId) {
      if (errEl) errEl.textContent = "OAuth 클라이언트 ID를 입력하세요 ('OAuth 설정' 펼치기).";
      var d = $id("oauth-cfg"); if (d) d.open = true;
      return;
    }
    saveCfg({ clientId: clientId, clientSecret: clientSecret });
    var btn = $id("sign-in-btn");
    if (btn) { btn.textContent = "브라우저에서 로그인 중…"; btn.disabled = true; }
    dbg("oauth start · clientId=" + clientId.slice(0, 12) + "…");
    var verifier = pkceVerifier();
    pkceChallenge(verifier).then(function (challenge) {
      var state = "w_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      var url = "https://accounts.google.com/o/oauth2/v2/auth"
        + "?response_type=code"
        + "&client_id=" + encodeURIComponent(clientId)
        + "&redirect_uri=" + encodeURIComponent(OAUTH_REDIRECT)
        + "&scope=" + encodeURIComponent("openid email profile")
        + "&code_challenge=" + encodeURIComponent(challenge)
        + "&code_challenge_method=S256"
        + "&prompt=select_account"
        + "&state=" + encodeURIComponent(state);
      return openExternal(url).then(function () {
        dbg("browser opened · polling for code");
        pollForCode(state, verifier, clientId, clientSecret);
      });
    }).catch(function (e) {
      dbg("oauth start ERR · " + (e && e.message ? e.message : String(e)));
      failAuth("로그인 시작 오류: " + (e.message || e));
    });
  });

  function pollForCode(state, verifier, clientId, clientSecret) {
    var tries = 0, MAX = 200;
    var timer = setInterval(function () {
      tries++;
      if (tries > MAX) {
        clearInterval(timer);
        dbg("oauth poll timeout");
        failAuth("로그인 시간이 초과됐어요. 다시 시도해주세요.");
        return;
      }
      fetch(OAUTH_POLL + "?state=" + encodeURIComponent(state), { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.code) {
            clearInterval(timer);
            dbg("oauth code received · exchanging");
            exchangeAndSignIn(d.code, verifier, clientId, clientSecret);
          }
        })
        .catch(function () {});
    }, 1500);
  }

  function exchangeAndSignIn(code, verifier, clientId, clientSecret) {
    var body = {
      code: code, client_id: clientId, redirect_uri: OAUTH_REDIRECT,
      code_verifier: verifier, grant_type: "authorization_code"
    };
    if (clientSecret) body.client_secret = clientSecret;
    fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString()
    }).then(function (resp) {
      if (!resp.ok) return resp.text().then(function (t) { throw new Error("토큰 교환 " + resp.status + ": " + t); });
      return resp.json();
    }).then(function (data) {
      if (!data.id_token) throw new Error("id_token 없음 (scope에 openid 필요)");
      dbg("token exchange OK · signInWithCredential");
      var cred = firebase.auth.GoogleAuthProvider.credential(data.id_token);
      return fbAuth.signInWithCredential(cred);
    }).then(function () {
      dbg("signInWithCredential OK");
    }).catch(function (e) {
      dbg("exchange/signIn ERR · " + (e && e.message ? e.message : String(e)));
      failAuth("로그인 오류: " + (e.message || e));
    });
  }

  function signOut() { teardownListener(); fbAuth.signOut(); }
  on("sign-out-btn",     signOut);
  on("tbl-sign-out-btn", signOut);
  on("cal-sign-out-btn", signOut);
  on("memo-sign-out-btn", signOut);

  on("dbg-toggle", function () {
    var el = $id("dbg-log");
    if (!el) return;
    var show = el.style.display === "none";
    el.style.display = show ? "" : "none";
    if (show) dbgRender();
  });

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text); return true;
      }
    } catch (_) {}
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta); return ok;
    } catch (_) { return false; }
  }

  on("dbg-copy", function () {
    var ok = copyText(dbgRead().join("\n"));
    var btn = $id("dbg-copy");
    if (btn) {
      btn.textContent = ok ? "복사됨" : "복사 실패";
      setTimeout(function () { if (btn) btn.textContent = "복사"; }, 1500);
    }
  });

  on("dbg-clear", function () {
    try { localStorage.removeItem(DBG_KEY); } catch (_) {}
    dbgRender();
  });

  on("retry-btn", function () {
    showView("loading");
    var user = fbAuth.currentUser;
    if (user) startListener(user); else showView("auth");
  });

  fbAuth.onAuthStateChanged(function (user) {
    teardownListener();
    if (!user) { dbg("onAuthStateChanged · null (signed out)"); showView("auth"); return; }
    dbg("onAuthStateChanged · user=" + (user.email || user.uid));
    showView("loading");
    startListener(user);
  });

  (function prefillCfg() {
    var c = readCfg();
    var idEl = $id("oauth-client-id"), secEl = $id("oauth-client-secret");
    if (idEl) idEl.value = c.clientId || "";
    if (secEl) secEl.value = c.clientSecret || "";
    if (!c.clientId) { var d = $id("oauth-cfg"); if (d) d.open = true; }
  })();

  // ── Firestore reader ───────────────────────────────────────────────────────
  function teardownListener() {
    if (unsubSnap) { unsubSnap(); unsubSnap = null; }
  }

  function startListener(user) {
    var ref = fbDb.collection("users").doc(user.uid);
    setSyncing(true);

    readAllKeys(ref)
      .then(function (keys) {
        applyData(keys);
        setSyncing(false);
        updateSyncTime();
        showView(mainViewName());
      })
      .catch(function (e) {
        console.error("[widget] initial load:", e);
        showError("데이터를 불러오지 못했어요.\n" + (e.message || String(e)));
        setSyncing(false);
      });

    // The timer window is data-independent (it only writes sessions). Skip the
    // live onSnapshot subscription — no need to re-read the whole keyspace on
    // every cloud change just to keep a clock ticking.
    if (VIEW_MODE === "timer") return;

    unsubSnap = ref.onSnapshot(
      function () {
        setSyncing(true);
        readAllKeys(ref)
          .then(function (keys) {
            applyData(keys);
            setSyncing(false);
            updateSyncTime();
          })
          .catch(function (e) { console.warn("[widget] snapshot re-read:", e); setSyncing(false); });
      },
      function (err) { console.warn("[widget] onSnapshot error:", err); }
    );
  }

  async function readAllKeys(ref) {
    var keys = {};
    var snap = await ref.get();
    if (snap.exists && snap.data() && snap.data().keys) Object.assign(keys, snap.data().keys);
    try {
      var qs = await ref.collection("data").get();
      var chunks = {};
      qs.forEach(function (doc) {
        var d = doc.data() || {};
        var key = d.key;
        if (!key) return;
        if (d.value != null && d.part == null) { keys[key] = d.value; return; }
        if (d.part != null) {
          if (!chunks[key]) chunks[key] = [];
          chunks[key][d.part] = d.value || "";
        }
      });
      Object.keys(chunks).forEach(function (k) { keys[k] = chunks[k].join(""); });
    } catch (e) { console.warn("[widget] split read skipped:", e.message || e); }
    return keys;
  }

  // ── Data extraction ────────────────────────────────────────────────────────
  function safeJson(s, fallback) {
    if (!s) return fallback;
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }

  var lastData = { habits: [], bundles: [], logs: {}, tasks: [] };

  // ── Widget prefs (set from the web app's Settings → 위젯 panel, synced via
  //    widget_prefs_v1). Applied across all three windows. ──────────────────
  var WIDGET_HABIT_LIMIT = 0;   // 0 = show all
  function applyWidgetPrefs(keys) {
    var p = safeJson(keys["widget_prefs_v1"], {}) || {};
    if (typeof p.timelineStartHour === "number") {
      TB_START_HOUR = Math.max(0, Math.min(23, p.timelineStartHour));
    }
    if (typeof p.timelineEndHour === "number") {
      TB_END_HOUR = Math.max(TB_START_HOUR + 1, Math.min(24, p.timelineEndHour));
    }
    WIDGET_HABIT_LIMIT = (typeof p.habitLimit === "number" && p.habitLimit > 0) ? p.habitLimit : 0;
    var followAccent = p.followAccent !== false;   // default on
    applyAccent(followAccent ? keys["return_theme_color"] : "");
    // Background base color — derive bg/bar/card levels from a single hex value
    if (p.widgetBgColor && /^#[0-9a-fA-F]{6}$/.test(p.widgetBgColor)) {
      var r = parseInt(p.widgetBgColor.slice(1, 3), 16);
      var g = parseInt(p.widgetBgColor.slice(3, 5), 16);
      var b = parseInt(p.widgetBgColor.slice(5, 7), 16);
      var shift = function (v, d) { return Math.min(255, Math.max(0, v + d)); };
      document.documentElement.style.setProperty("--w-bg",      "rgba("+r+","+g+","+b+",0.92)");
      document.documentElement.style.setProperty("--w-bg-bar",  "rgba("+shift(r,14)+","+shift(g,14)+","+shift(b,14)+",0.96)");
      document.documentElement.style.setProperty("--w-bg-card", "rgba("+shift(r,10)+","+shift(g,10)+","+shift(b,10)+",0.80)");
    }
    // Window visibility — only the habits window manages other windows to avoid
    // a window accidentally hiding itself before it can receive future prefs.
    if (!VIEW_MODE) {
      var WIN_VIS = [
        {label: "timeline",   key: "showTimeline"},
        {label: "timer",      key: "showTimer"},
        {label: "calendar",   key: "showCalendar"},
        {label: "memo",       key: "showMemo"},
        {label: "quickinput", key: "showQuickinput"}
      ];
      var tauriCore = window.__TAURI__ && window.__TAURI__.core;
      if (tauriCore) {
        WIN_VIS.forEach(function(w) {
          var visible = p[w.key] !== false;  // default true if not explicitly false
          tauriCore.invoke("set_window_visible", {label: w.label, visible: visible}).catch(function() {});
        });
        if (typeof p.autostart === "boolean") {
          tauriCore.invoke("set_autostart_enabled", {enabled: p.autostart}).catch(function() {});
        }
      }
    }
  }
  function applyAccent(color) {
    var c = (typeof color === "string") ? color.trim() : "";
    if (c && c[0] !== "#") c = "#" + c;
    var ok = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(c);
    var root = document.documentElement;
    if (ok) root.style.setProperty("--w-accent", c);
    else root.style.removeProperty("--w-accent");
  }

  function applyData(keys) {
    applyWidgetPrefs(keys);
    lastData = {
      habits:  safeJson(keys["routine_habits_v1"],  []),
      bundles: safeJson(keys["routine_bundles_v1"], []),
      logs:    safeJson(keys["routine_logs_v1"],    {}),
      tasks:   safeJson(keys["task_items_v1"],      [])
    };
    if (VIEW_MODE === "timeline") {
      renderTimelineBlocks();
    } else if (VIEW_MODE === "timer") {
      renderTimer();   // timer is data-independent; just make sure it's drawn
    } else if (VIEW_MODE === "calendar") {
      renderCalendar();
    } else if (VIEW_MODE === "memo") {
      // Only absorb cloud memos when not editing AND no save is in-flight.
      // Firestore echoes our own writes as stale snapshots before the commit
      // settles — absorbing them would revert adds/deletes just made locally.
      if (!activeMemoId && !_memoSaving) {
        memos = safeJson(keys[MEMO_KEY], []) || [];
        if (!Array.isArray(memos)) memos = [];
        renderMemoList();
      }
    } else if (VIEW_MODE === "quickinput") {
      // Absorb category list from main app (return_inbox_cats syncs via Firestore)
      var cats = safeJson(keys["return_inbox_cats"], []);
      if (Array.isArray(cats) && cats.length) qiInboxCats = cats;
      renderQuickinput();
    } else {
      renderHabits(lastData.habits, lastData.bundles, lastData.logs);
    }
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  var KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  // ── Habits rendering ───────────────────────────────────────────────────────
  var STATE_MARK  = { done: "✓", skip: "—", rest: "◑", "": "" };
  var STATE_CLASS = { done: "s-done", skip: "s-skip", rest: "s-rest", "": "s-none" };

  function renderHabits(habits, bundles, logs) {
    var dateEl = $id("today-label");
    if (dateEl) {
      var d = new Date();
      dateEl.textContent = (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + KO_DAYS[d.getDay()] + ")";
    }
    var list = $id("habit-list");
    if (!list) return;
    var todayLog = logs[todayKey()] || {};
    if (!habits.length) { list.innerHTML = '<div class="w-empty">등록된 습관이 없어요</div>'; return; }

    var byId = {};
    habits.forEach(function (h) { if (h && h.id) byId[String(h.id)] = h; });
    var rendered = {};
    var html = "";
    // Optional cap on total habit rows (web app's 위젯 설정 → habitLimit).
    var limit = WIDGET_HABIT_LIMIT > 0 ? WIDGET_HABIT_LIMIT : Infinity;
    var shown = 0;

    bundles.forEach(function (b) {
      if (shown >= limit) return;
      if (!b || !Array.isArray(b.habitIds) || !b.habitIds.length) return;
      var bHabits = b.habitIds.map(function (id) { return byId[String(id)]; }).filter(Boolean);
      if (!bHabits.length) return;
      var done = bHabits.filter(function (h) {
        var st = (todayLog[h.id] || {}).state || "";
        return st === "done" || st === "skip";
      }).length;
      var rows = "";
      bHabits.forEach(function (h) {
        if (shown >= limit) return;
        rendered[String(h.id)] = true;
        rows += habitRow(h, (todayLog[h.id] || {}).state || "");
        shown++;
      });
      if (!rows) return;
      html += '<div class="bundle"><div class="bundle-hd">';
      html += '<span class="bundle-icon">' + esc(b.icon || "") + '</span>';
      html += '<span class="bundle-name">' + esc(b.title || "") + '</span>';
      html += '<span class="bundle-prog">' + done + '/' + bHabits.length + '</span>';
      html += '</div>';
      html += rows;
      html += '</div>';
    });

    var loose = habits.filter(function (h) { return h && h.id && !rendered[String(h.id)]; });
    if (loose.length && shown < limit) {
      var looseRows = "";
      loose.forEach(function (h) {
        if (shown >= limit) return;
        looseRows += habitRow(h, (todayLog[h.id] || {}).state || "");
        shown++;
      });
      if (looseRows) html += '<div class="bundle">' + looseRows + '</div>';
    }
    list.innerHTML = html;
  }

  function habitRow(h, state) {
    var mark = STATE_MARK[state] || "";
    var cls  = STATE_CLASS[state] || "s-none";
    return '<div class="habit-row" data-habit-id="' + esc(String(h.id)) + '">' +
      '<span class="habit-mark ' + cls + '">' + esc(mark) + '</span>' +
      '<span class="habit-icon">' + esc(h.icon || h.emoji || "") + '</span>' +
      '<span class="habit-name">' + esc(h.title || h.name || "") + '</span>' +
      '</div>';
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── W6: habit state write-back (OFF by default) ─────────────────────────────
  // The widget can toggle today's habit state and write it back. This is the
  // highest-risk path in the project (routine_logs_v1 is blob-synced with a
  // per-date, cloud-wins-per-(date,habit) union merge — see index.html
  // fbApplyData), so it is GATED behind a device-local opt-in (default OFF) and
  // must pass the two-device verification matrix (docs/WIDGET_DESIGN.md §6.1)
  // before being relied on.
  //
  // Write strategy (minimise the clobber window): fresh-read cloud
  // routine_logs_v1, apply ONLY the single toggled (date,habit), write the doc
  // back with the SAME deterministic doc id the web app uses
  // (fbDocIdForKey → encodeURIComponent), then bump the user-doc header so the
  // web app's onSnapshot fires and union-merges our change.
  var WRITEBACK_KEY = "widget_writeback_enabled";
  var writebackOn = false;
  try { writebackOn = localStorage.getItem(WRITEBACK_KEY) === "1"; } catch (_) {}
  var _habitWriteBusy = false;
  var HABIT_STATES = ["", "done", "skip", "rest"];

  // Stable per-device client id, DISTINCT from the web app's, so the web app
  // never treats our write as a self-echo (and thus actually applies it).
  var WIDGET_CLIENT_ID = (function () {
    try {
      var k = "widget_fb_client_id", v = localStorage.getItem(k);
      if (!v) { v = "widget_" + Date.now() + "_" + Math.floor(Math.random() * 1e6); localStorage.setItem(k, v); }
      return v;
    } catch (_) { return "widget_" + Date.now(); }
  })();

  function docIdForKey(k) { return encodeURIComponent(k).replace(/\./g, "%2E"); }

  function userRef() {
    var u = fbAuth.currentUser;
    return (u && fbDb) ? fbDb.collection("users").doc(u.uid) : null;
  }

  // Fresh-read routine_logs_v1 straight from the cloud data subcollection
  // (handles the single-doc and chunked-doc layouts), falling back to the
  // last snapshot copy if the query is unavailable.
  function readRoutineLogsFresh(ref) {
    return ref.collection("data").where("key", "==", "routine_logs_v1").get()
      .then(function (qs) {
        var whole = null, parts = [];
        qs.forEach(function (doc) {
          var d = doc.data() || {};
          if (d.value != null && d.part == null) whole = d.value;
          else if (d.part != null) parts[d.part] = d.value || "";
        });
        var raw = whole != null ? whole : (parts.length ? parts.join("") : "{}");
        return safeJson(raw, {}) || {};
      })
      .catch(function () { return JSON.parse(JSON.stringify(lastData.logs || {})); });
  }

  function writeRoutineLogs(ref, logs) {
    var value = JSON.stringify(logs || {});
    // routine_logs_v1 is tiny in practice; refuse to write if it would need
    // chunking (the widget doesn't replicate the web app's chunk cleanup).
    if (value.length > 700000) return Promise.reject(new Error("routine_logs too large for widget write"));
    var now = Date.now();
    var batch = fbDb.batch();
    batch.set(ref.collection("data").doc(docIdForKey("routine_logs_v1")),
              { key: "routine_logs_v1", value: value, updatedAtMs: now });
    // Bump the user-doc header (merge) so the web app's onSnapshot fires.
    batch.set(ref, { updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true }, { merge: true });
    return batch.commit();
  }

  function cycleHabit(habitId) {
    if (!writebackOn || _habitWriteBusy) return;
    var ref = userRef();
    if (!ref) return;
    _habitWriteBusy = true;
    setSyncing(true);
    readRoutineLogsFresh(ref).then(function (logs) {
      var dk = todayKey();
      logs[dk] = logs[dk] || {};
      var entry = logs[dk][habitId] || {};
      var cur = entry.state || "";
      var next = HABIT_STATES[(HABIT_STATES.indexOf(cur) + 1) % HABIT_STATES.length];
      logs[dk][habitId] = { state: next, updatedAt: Date.now() };
      // Optimistic local update so the row reflects immediately.
      lastData.logs = logs;
      renderHabits(lastData.habits, lastData.bundles, lastData.logs);
      return writeRoutineLogs(ref, logs);
    }).then(function () {
      dbg("habit write OK · " + habitId);
      setSyncing(false); updateSyncTime();
    }).catch(function (e) {
      dbg("habit write ERR · " + (e && e.message ? e.message : String(e)));
      setSyncing(false);
    }).then(function () { _habitWriteBusy = false; });
  }

  function setWriteback(on) {
    writebackOn = !!on;
    try { localStorage.setItem(WRITEBACK_KEY, writebackOn ? "1" : "0"); } catch (_) {}
    var btn = $id("edit-toggle-btn");
    if (btn) {
      btn.classList.toggle("on", writebackOn);
      btn.title = writebackOn ? "쓰기 모드 ON — 해빗을 탭하면 상태가 바뀝니다" : "쓰기 모드 — 탭해서 해빗 상태 변경";
    }
    var list = $id("habit-list");
    if (list) list.classList.toggle("writable", writebackOn);
  }

  // Wire the habits window's write-back affordances (only in that window).
  if (VIEW_MODE === "habits") {
    on("edit-toggle-btn", function () { setWriteback(!writebackOn); });
    var _hl = $id("habit-list");
    if (_hl) {
      _hl.addEventListener("click", function (e) {
        if (!writebackOn) return;
        var row = e.target.closest && e.target.closest("[data-habit-id]");
        if (!row) return;
        var id = row.getAttribute("data-habit-id");
        if (id) cycleHabit(id);
      });
    }
    setWriteback(writebackOn);  // reflect persisted state on load
  }

  // ── Time helpers ───────────────────────────────────────────────────────────
  function parseHM(s) {
    var p = String(s || "").split(":");
    var h = parseInt(p[0], 10);
    if (isNaN(h)) return null;
    var m = parseInt(p[1], 10);
    return h * 60 + (isNaN(m) ? 0 : m);
  }

  function fmtMins(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }

  function nowMins() {
    var n = new Date(); return n.getHours() * 60 + n.getMinutes();
  }

  // ── Block calendar ─────────────────────────────────────────────────────────
  // Each task with a timeStart is drawn as a rectangle whose height is
  // proportional to its duration (timeEnd − timeStart). Blocks are positioned
  // absolutely on a fixed-height time grid.

  var TB_START_HOUR  = 6;    // grid starts at 06:00
  var TB_END_HOUR    = 24;   // grid ends at 24:00
  var TB_PX_PER_HOUR = 72;   // 72px = 1 hour; 36px = 30 min; 18px = 15 min
  var TB_LABEL_W     = 44;   // px reserved for hour labels on the left
  var tbScrolledOnce = false; // auto-scroll to "now" only on the first render

  function renderTimelineBlocks() {
    var grid = $id("tb-grid");
    if (!grid) return;

    var dateEl = $id("tbl-date-label");
    if (dateEl) {
      var d = new Date();
      dateEl.textContent = (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + KO_DAYS[d.getDay()] + ")";
    }

    var TK         = todayKey();
    var pxPerMin   = TB_PX_PER_HOUR / 60;
    var totalH     = (TB_END_HOUR - TB_START_HOUR) * TB_PX_PER_HOUR;
    var nm         = nowMins();

    // Collect today's timed tasks (same logic as main app)
    var items = [];
    (lastData.tasks || []).forEach(function (t) {
      if (!t || t._travelOnly) return;
      var isDeadlineToday = t.deadlineDate === TK;
      var date = isDeadlineToday ? t.deadlineDate : t.date;
      if (date !== TK) return;
      var timeS = isDeadlineToday ? (t.deadlineTime || t.timeStart) : t.timeStart;
      var startMins = parseHM(timeS);
      if (startMins == null) return;
      var endMins = parseHM(t.timeEnd);
      if (endMins == null || endMins <= startMins) endMins = startMins + 60;
      // Clamp to grid
      var s = Math.max(startMins, TB_START_HOUR * 60);
      var e = Math.min(endMins,   TB_END_HOUR   * 60);
      if (e <= s) return;
      items.push({
        startMins: s, endMins: e,
        text: t.text || t.title || "",
        done: !!t.done,
        deadline: isDeadlineToday && !t.timeStart
      });
    });

    // Overlap detection: assign column index so parallel tasks sit side by side.
    // Greedy left-first column packing.
    items.sort(function (a, b) { return a.startMins - b.startMins; });
    var colEnds = [];
    items.forEach(function (it) {
      var col = 0;
      while (col < colEnds.length && colEnds[col] > it.startMins) col++;
      it.col = col;
      colEnds[col] = it.endMins;
    });
    var numCols = colEnds.length || 1;

    var html = "";

    // Hour lines and labels
    for (var h = TB_START_HOUR; h <= TB_END_HOUR; h++) {
      var top = (h - TB_START_HOUR) * TB_PX_PER_HOUR;
      html += '<div class="tb-hour" style="top:' + top + 'px">';
      html += '<span class="tb-hour-label">' + (h < 10 ? "0" : "") + h + '</span>';
      html += '<div class="tb-hour-line"></div>';
      html += '</div>';
    }

    // Task blocks
    items.forEach(function (it) {
      var top    = (it.startMins - TB_START_HOUR * 60) * pxPerMin;
      var height = Math.max(18, (it.endMins - it.startMins) * pxPerMin);
      // Column positioning within the block zone (right of the label column).
      // Fractions are kept UNITLESS: CSS calc() forbids multiplying two
      // unit-bearing values (e.g. `25% * (100% - 46px)`), but unitless×length
      // is allowed (`0.25 * (100% - 46px)`).
      var leftFrac  = it.col / numCols;
      var widthFrac = 1 / numCols;

      var cls = "tb-block";
      if (it.done)                                 cls += " tb-block-done";
      else if (it.endMins <= nm)                   cls += " tb-block-past";
      else if (it.startMins <= nm && nm < it.endMins) cls += " tb-block-now";

      // left/width expressed via CSS calc so they respond to window resize.
      // Block zone spans from TB_LABEL_W+2 px to right-4px.
      var zoneStart = (TB_LABEL_W + 2) + "px";
      var zoneEnd   = "4px";
      var zoneW = "(100% - " + zoneStart + " - " + zoneEnd + ")";
      var left  = "calc(" + zoneStart + " + " + leftFrac  + " * " + zoneW + ")";
      var width = "calc(" + widthFrac + " * " + zoneW + " - 2px)";

      html += '<div class="' + cls + '" style="top:' + top + 'px;height:' + height + 'px;left:' + left + ';width:' + width + '">';
      html += '<div class="tb-block-title">' + esc(it.text);
      if (it.deadline) html += ' <span class="tb-tag">마감</span>';
      html += '</div>';
      if (height >= 34) {
        html += '<div class="tb-block-time">' + fmtMins(it.startMins) + '–' + fmtMins(it.endMins) + '</div>';
      }
      html += '</div>';
    });

    // Now-line (only when "now" falls inside the grid's hour range)
    var nowInGrid = nm >= TB_START_HOUR * 60 && nm <= TB_END_HOUR * 60;
    var nowTop = (nm - TB_START_HOUR * 60) * pxPerMin;
    if (nowInGrid) {
      html += '<div class="tb-now-line" style="top:' + nowTop + 'px">'
        + '<div class="tb-now-dot"></div>'
        + '</div>';
    }

    grid.style.height = totalH + "px";
    grid.innerHTML = html;

    // Scroll so the now-line sits roughly 1/3 from the top — but only once,
    // on the first render. Re-scrolling on every snapshot/minute refresh would
    // keep yanking the view back to "now" while the user is reading elsewhere.
    if (nowInGrid && !tbScrolledOnce) {
      var scroll = $id("tb-scroll");
      if (scroll && scroll.clientHeight) {
        scroll.scrollTop = Math.max(0, nowTop - scroll.clientHeight / 3);
        tbScrolledOnce = true;
      }
    }
  }

  // Refresh now-line every minute while the timeline window is active.
  setInterval(function () {
    if (VIEW_MODE === "timeline") renderTimelineBlocks();
  }, 60000);

  // ── Sync indicator ─────────────────────────────────────────────────────────
  function setSyncing(active) {
    if (VIEW_MODE === "timer") return;   // timer window has no sync indicator
    var dotId = VIEW_MODE === "timeline"   ? "tbl-sync-dot"
              : VIEW_MODE === "calendar"   ? "cal-sync-dot"
              : VIEW_MODE === "quickinput" ? "qi-sync-dot"
              : VIEW_MODE === "memo"       ? null
              : "sync-dot";
    if (!dotId) return;
    var dot = $id(dotId);
    if (dot) dot.className = "w-sync-dot" + (active ? " syncing" : "");
  }

  function updateSyncTime() {
    if (VIEW_MODE === "timer") return;
    var timeId = VIEW_MODE === "timeline"   ? "tbl-sync-time"
               : VIEW_MODE === "calendar"   ? "cal-sync-time"
               : VIEW_MODE === "memo"       ? "memo-sync-time"
               : VIEW_MODE === "quickinput" ? "qi-sync-time"
               : "sync-time";
    var el = $id(timeId);
    if (!el) return;
    var d = new Date();
    el.textContent = String(d.getHours()).padStart(2, "0") + ":" +
                     String(d.getMinutes()).padStart(2, "0") + " 동기화됨";
  }

  // ── Timer window (Pomodoro / countdown / stopwatch) ─────────────────────────
  // A standalone focus timer. Config lives device-local (the widget runs on its
  // own localhost origin, separate from the web app). Completed sessions are
  // written to Firestore as APPEND-ONLY immutable docs under
  //   users/{uid}/widget_focus_sessions/{id}
  // Each session is its own doc keyed by a unique id → two devices never touch
  // the same doc, so there is no array-merge hazard. A later web-app change will
  // fold these into the main app's focus_timer_log_v1 history (and delete the
  // consumed docs); until then the write is harmless and inert.

  var TIMER_CFG_KEY = "widget_timer_cfg";
  var timerCfg = {
    mode: "pomodoro",
    pomodoro: { work: 25, short: 5, long: 15, longAfter: 4 },
    countdown: { minutes: 25 }
  };
  var timerState = {
    running: false, startedAt: 0, elapsed: 0,
    mode: "pomodoro", phase: "work", pomCount: 0,
    targetMs: 0, tick: null
  };
  var timerFootMsg = "";

  function loadTimerCfg() {
    var s = safeJson(localStorage.getItem(TIMER_CFG_KEY), null);
    if (s && typeof s === "object") {
      if (s.mode) timerCfg.mode = s.mode;
      if (s.pomodoro) timerCfg.pomodoro = Object.assign({}, timerCfg.pomodoro, s.pomodoro);
      if (s.countdown) timerCfg.countdown = Object.assign({}, timerCfg.countdown, s.countdown);
    }
    timerState.mode = timerCfg.mode;
  }
  function saveTimerCfg() {
    try { localStorage.setItem(TIMER_CFG_KEY, JSON.stringify(timerCfg)); } catch (_) {}
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function timerElapsedMs() {
    return (timerState.elapsed || 0) +
      (timerState.running && timerState.startedAt ? Date.now() - timerState.startedAt : 0);
  }
  function timerRemainingMs() {
    if (!timerState.targetMs) return null;
    return Math.max(0, timerState.targetMs - timerElapsedMs());
  }
  function timerFormatMs(ms) {
    var total = Math.max(0, Math.floor((ms || 0) / 1000));
    var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return (h ? String(h).padStart(2, "0") + ":" : "") +
      String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function timerPhaseLabel() {
    var ph = timerState.phase;
    if (ph === "short_break") return "짧은 휴식";
    if (ph === "long_break")  return "긴 휴식";
    return "집중";
  }
  function timerSetTarget() {
    var m = timerCfg.mode;
    if (m === "stopwatch") { timerState.targetMs = 0; return; }
    if (m === "countdown") { timerState.targetMs = (timerCfg.countdown.minutes || 25) * 60000; return; }
    var p = timerCfg.pomodoro, ph = timerState.phase;
    if (ph === "short_break")     timerState.targetMs = (p.short || 5) * 60000;
    else if (ph === "long_break") timerState.targetMs = (p.long  || 15) * 60000;
    else                          timerState.targetMs = (p.work  || 25) * 60000;
  }
  function timerNextPhase() {
    var longAfter = timerCfg.pomodoro.longAfter || 4;
    if (timerState.phase === "work") {
      timerState.pomCount = (timerState.pomCount || 0) + 1;
      timerState.phase = (timerState.pomCount % longAfter === 0) ? "long_break" : "short_break";
    } else {
      timerState.phase = "work";
    }
    timerState.elapsed = 0; timerState.startedAt = 0; timerState.running = false;
    timerSetTarget();
  }

  function timerStart() {
    timerState.mode = timerCfg.mode;
    if (timerState.elapsed === 0) timerSetTarget();
    timerState.startedAt = Date.now(); timerState.running = true;
    if (timerState.tick) clearInterval(timerState.tick);
    timerState.tick = setInterval(timerTick, 1000);
    requestNotifyPermission();
    renderTimer();
  }
  function timerPause() {
    if (!timerState.running) return;
    if (timerState.tick) clearInterval(timerState.tick);
    timerState.elapsed += (Date.now() - timerState.startedAt);
    timerState.startedAt = 0; timerState.running = false; timerState.tick = null;
    renderTimer();
  }
  function timerResume() {
    if (timerState.running) return;
    if (!timerState.targetMs && timerCfg.mode !== "stopwatch") timerSetTarget();
    timerState.startedAt = Date.now(); timerState.running = true;
    if (timerState.tick) clearInterval(timerState.tick);
    timerState.tick = setInterval(timerTick, 1000);
    renderTimer();
  }
  function timerReset() {
    if (timerState.tick) clearInterval(timerState.tick);
    timerState.running = false; timerState.startedAt = 0; timerState.elapsed = 0; timerState.tick = null;
    timerSetTarget();
    renderTimer();
  }
  function timerFinish() {
    var elapsed = timerElapsedMs();
    var mode = timerCfg.mode, phase = timerState.phase;
    if (timerState.tick) clearInterval(timerState.tick);
    timerState.tick = null; timerState.running = false;
    timerLogSession(elapsed, mode, phase);
    notifyDone(timerPhaseLabel(), elapsed);
    if (mode === "pomodoro") {
      timerNextPhase();
    } else {
      timerState.elapsed = 0; timerState.startedAt = 0; timerSetTarget();
    }
    renderTimer();
  }
  function timerTick() {
    var remaining = timerRemainingMs();
    if (remaining !== null && remaining <= 0) { timerFinish(); return; }
    var disp = remaining !== null ? timerFormatMs(remaining) : timerFormatMs(timerElapsedMs());
    var cl = $id("timer-clock"); if (cl) cl.textContent = disp;
    if (timerState.targetMs) {
      var fill = $id("timer-progress-fill");
      if (fill) fill.style.width = clamp((1 - remaining / timerState.targetMs) * 100, 0, 100) + "%";
    }
  }

  // ── Session write (append-only) ─────────────────────────────────────────────
  function timerLogSession(ms, mode, phase) {
    if (!ms || ms < 1000) return;   // ignore trivially short sessions
    var rec = {
      id: "wts_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
      mode: mode, phase: phase, durationMs: Math.round(ms),
      taskId: "", taskText: "",
      completedAt: Date.now(),
      source: "widget"
    };
    var label = (phase === "work" ? "집중" : phase === "short_break" ? "짧은 휴식" : phase === "long_break" ? "긴 휴식" : "세션");
    var user = fbAuth.currentUser;
    if (!user || !fbDb) { timerFootMsg = "로그인 필요 — 기록 안 됨"; renderTimer(); return; }
    timerFootMsg = label + " " + timerFormatMs(ms) + " 기록 중…";
    fbDb.collection("users").doc(user.uid)
      .collection("widget_focus_sessions").doc(rec.id).set(rec)
      .then(function () {
        dbg("session logged · " + rec.mode + "/" + rec.phase + " " + Math.round(ms / 1000) + "s");
        timerFootMsg = "✓ " + label + " " + timerFormatMs(ms) + " 기록됨";
        renderTimer();
      })
      .catch(function (e) {
        dbg("session log ERR · " + (e && e.message ? e.message : String(e)));
        timerFootMsg = "기록 실패 — 다시 시도하세요";
        renderTimer();
      });
  }

  function requestNotifyPermission() {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(function () {});
      }
    } catch (_) {}
  }
  function notifyDone(label, ms) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Return 타이머", { body: label + " 완료! (" + timerFormatMs(ms) + ")" });
      }
    } catch (_) {}
  }

  // ── Timer rendering ─────────────────────────────────────────────────────────
  var TIMER_MODES = [
    ["pomodoro",  "🍅 포모"],
    ["countdown", "⏱ 카운트"],
    ["stopwatch", "⏲ 스톱"]
  ];

  function timerSettingRow(label, field, val, unit) {
    return '<div class="tm-set-row"><span class="tm-set-label">' + label + '</span>' +
      '<span class="tm-set-ctl">' +
        '<button class="tm-step" data-act="dec" data-field="' + field + '" type="button">−</button>' +
        '<span class="tm-set-val">' + val + '</span>' +
        '<button class="tm-step" data-act="inc" data-field="' + field + '" type="button">+</button>' +
        '<span class="tm-set-unit">' + unit + '</span>' +
      '</span></div>';
  }

  function renderTimer() {
    var root = $id("timer-root");
    if (!root) return;
    var running = timerState.running;
    var paused  = !running && timerState.elapsed > 0;
    var active  = running || paused;
    var remaining = timerRemainingMs();
    var display = remaining !== null ? timerFormatMs(remaining) : timerFormatMs(timerElapsedMs());

    var html = "";

    // Mode tabs (locked while a session is in progress)
    html += '<div class="tm-tabs">';
    TIMER_MODES.forEach(function (m) {
      html += '<button class="tm-tab' + (timerCfg.mode === m[0] ? " active" : "") + '"' +
        ' data-act="mode" data-mode="' + m[0] + '" type="button"' + (active ? " disabled" : "") + '>' +
        m[1] + '</button>';
    });
    html += '</div>';

    // Phase + pomodoro dots
    if (timerCfg.mode === "pomodoro") {
      html += '<div class="tm-phase' + (timerState.phase === "work" ? " work" : " brk") + '">' + timerPhaseLabel() + '</div>';
      var longAfter = timerCfg.pomodoro.longAfter || 4;
      var done = timerState.pomCount % longAfter;
      var dots = "";
      for (var i = 0; i < longAfter; i++) dots += '<span class="tm-dot' + (i < done ? " on" : "") + '"></span>';
      html += '<div class="tm-dots">' + dots + '</div>';
    } else {
      html += '<div class="tm-phase brk">' + (timerCfg.mode === "countdown" ? "카운트다운" : "스톱워치") + '</div>';
    }

    // Clock
    html += '<div class="tm-clock" id="timer-clock">' + display + '</div>';

    // Progress bar
    var pct = (timerState.targetMs && remaining !== null)
      ? clamp((1 - remaining / timerState.targetMs) * 100, 0, 100) : 0;
    html += '<div class="tm-progress"><div class="tm-progress-fill" id="timer-progress-fill" style="width:' + pct + '%"></div></div>';

    // Controls
    html += '<div class="tm-controls">';
    if (running)      html += '<button class="tm-btn tm-btn-main" data-act="pause"  type="button">일시정지</button>';
    else if (paused)  html += '<button class="tm-btn tm-btn-main" data-act="resume" type="button">계속</button>';
    else              html += '<button class="tm-btn tm-btn-main" data-act="start"  type="button">시작</button>';
    if (active)       html += '<button class="tm-btn" data-act="finish" type="button" title="현재 세션 기록하고 종료">완료</button>';
    html += '<button class="tm-btn tm-btn-icon" data-act="reset" type="button" title="초기화">↺</button>';
    html += '</div>';

    // Settings (only when idle)
    if (!active) {
      html += '<div class="tm-settings">';
      if (timerCfg.mode === "pomodoro") {
        html += timerSettingRow("집중",      "work",  timerCfg.pomodoro.work,  "분");
        html += timerSettingRow("짧은 휴식", "short", timerCfg.pomodoro.short, "분");
        html += timerSettingRow("긴 휴식",   "long",  timerCfg.pomodoro.long,  "분");
      } else if (timerCfg.mode === "countdown") {
        html += timerSettingRow("시간", "cd", timerCfg.countdown.minutes, "분");
      } else {
        html += '<div class="tm-hint">시작하면 시간이 위로 올라가요.<br>완료를 누르면 그 시간이 기록돼요.</div>';
      }
      html += '</div>';
    }

    // Footer: last-session message + sign out
    html += '<div class="tm-foot">';
    html += '<span class="tm-foot-msg">' + esc(timerFootMsg) + '</span>';
    html += '<button class="wbtn w-sign-out-btn" data-act="signout" type="button" title="로그아웃">⇱</button>';
    html += '</div>';

    root.innerHTML = html;
  }

  function adjustTimerCfg(field, delta) {
    if (field === "cd") {
      timerCfg.countdown.minutes = clamp(timerCfg.countdown.minutes + delta, 1, 180);
    } else {
      timerCfg.pomodoro[field] = clamp((timerCfg.pomodoro[field] || 0) + delta, 1, 120);
    }
    saveTimerCfg();
    if (!timerState.running && timerState.elapsed === 0) timerSetTarget();
    renderTimer();
  }

  // ── Monthly Calendar (W7) ──────────────────────────────────────────────────
  var calYear  = new Date().getFullYear();
  var calMonth = new Date().getMonth();   // 0-based

  function calDayKey(y, m, d) {
    return y + "-" +
      String(m + 1).padStart(2, "0") + "-" +
      String(d).padStart(2, "0");
  }

  function renderCalendar() {
    var grid  = $id("cal-grid");
    if (!grid) return;

    var label = $id("cal-month-label");
    if (label) label.textContent = calYear + "년 " + (calMonth + 1) + "월";

    // Build task index by date key
    var tasksByDate = {};
    (lastData.tasks || []).forEach(function (t) {
      if (!t) return;
      var dates = [];
      if (t.date) dates.push(t.date);
      if (t.deadlineDate && t.deadlineDate !== t.date) dates.push(t.deadlineDate);
      dates.forEach(function (dk) {
        if (!tasksByDate[dk]) tasksByDate[dk] = [];
        tasksByDate[dk].push(t);
      });
    });

    var today = new Date();
    var firstDay = new Date(calYear, calMonth, 1).getDay();   // 0=Sun
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var todayDayNum = (today.getFullYear() === calYear && today.getMonth() === calMonth)
      ? today.getDate() : -1;

    var html = "";
    // Leading blank cells before the 1st
    for (var b = 0; b < firstDay; b++) {
      html += '<div class="cal-cell cal-cell-blank"></div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var dk    = calDayKey(calYear, calMonth, d);
      var tasks = tasksByDate[dk] || [];
      var done  = tasks.filter(function (t) { return !!t.done; }).length;
      var total = tasks.length;
      var isToday = d === todayDayNum;
      var dow     = (firstDay + d - 1) % 7;
      var cls     = "cal-cell"
        + (isToday ? " cal-today" : "")
        + (dow === 0 ? " cal-sun" : "")
        + (dow === 6 ? " cal-sat" : "");
      html += '<div class="' + cls + '" data-cal-day="' + d + '">';
      html += '<span class="cal-day-num">' + d + '</span>';
      if (total > 0) {
        html += '<div class="cal-dots">';
        var maxDots = Math.min(total, 3);
        for (var i = 0; i < maxDots; i++) {
          html += '<span class="cal-dot' + (i < done ? " done" : "") + '"></span>';
        }
        if (total > 3) html += '<span class="cal-more">+' + (total - 3) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  function showCalDayPanel(d) {
    var dk = calDayKey(calYear, calMonth, d);
    var panel     = $id("cal-day-panel");
    var panelLabel = $id("cal-day-label");
    var panelList  = $id("cal-day-list");
    if (!panel || !panelList) return;

    if (panelLabel) panelLabel.textContent = (calMonth + 1) + "월 " + d + "일";

    var tasks = (lastData.tasks || []).filter(function (t) {
      return t && (t.date === dk || t.deadlineDate === dk);
    });

    if (!tasks.length) {
      panelList.innerHTML = '<div class="w-empty" style="padding:10px 12px">일정 없음</div>';
    } else {
      panelList.innerHTML = tasks.map(function (t) {
        var isDeadline = t.deadlineDate === dk && t.date !== dk;
        return '<div class="cal-task-row' + (t.done ? " done" : "") + '">' +
          '<span class="cal-task-dot' + (t.done ? " done" : "") + '"></span>' +
          '<span class="cal-task-text">' + esc(t.text || t.title || "") + '</span>' +
          (isDeadline ? '<span class="tb-tag">마감</span>' : '') +
          '</div>';
      }).join("");
    }
    panel.style.display = "";
  }

  // Wire calendar events (only in the calendar window)
  if (VIEW_MODE === "calendar") {
    on("cal-prev", function () {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      var p = $id("cal-day-panel"); if (p) p.style.display = "none";
      renderCalendar();
    });
    on("cal-next", function () {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      var p = $id("cal-day-panel"); if (p) p.style.display = "none";
      renderCalendar();
    });
    on("cal-day-close", function () {
      var p = $id("cal-day-panel"); if (p) p.style.display = "none";
    });

    var calGridEl = $id("cal-grid");
    if (calGridEl) {
      calGridEl.addEventListener("click", function (e) {
        var cell = e.target.closest && e.target.closest("[data-cal-day]");
        if (!cell) return;
        var day = parseInt(cell.getAttribute("data-cal-day"), 10);
        if (day) showCalDayPanel(day);
      });
    }
  }

  // Refresh calendar every minute (keeps today-highlight current at midnight rollover)
  setInterval(function () {
    if (VIEW_MODE === "calendar") renderCalendar();
  }, 60000);

  // ── Sticky Memo (W8) ───────────────────────────────────────────────────────
  var MEMO_KEY = "widget_memo_v1";
  var memos        = [];    // [{id, color, html, updatedAt}]
  var activeMemoId = null;  // id of memo currently open in editor
  var _memoSaveTimer = null;

  var MEMO_BG_COLORS = ["#23252b", "#2b2012", "#102030", "#1a2b1a", "#2b1a2b", "#291a1a"];
  // Guard: true while a Firestore batch.commit() is in-flight. applyData must
  // not overwrite memos during this window or deleted/added entries get reverted
  // by the stale snapshot Firestore echoes back before the write settles.
  var _memoSaving = false;

  function memoById(id) {
    for (var i = 0; i < memos.length; i++) { if (memos[i].id === id) return memos[i]; }
    return null;
  }

  function memoSaveNow() {
    if (_memoSaveTimer) { clearTimeout(_memoSaveTimer); _memoSaveTimer = null; }
    var ref = userRef(); if (!ref) return;
    var value = JSON.stringify(memos);
    if (value.length > 700000) { console.warn("[widget/memo] memos too large, skipping save"); return; }
    var now = Date.now();
    _memoSaving = true;   // block Firestore absorption until commit settles
    var batch = fbDb.batch();
    batch.set(ref.collection("data").doc(docIdForKey(MEMO_KEY)),
              { key: MEMO_KEY, value: value, updatedAtMs: now });
    batch.set(ref, { updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true }, { merge: true });
    batch.commit()
      .then(function () {
        _memoSaving = false;
        var el = $id("memo-sync-time");
        if (!el) return;
        var d = new Date();
        el.textContent = String(d.getHours()).padStart(2, "0") + ":" +
                         String(d.getMinutes()).padStart(2, "0") + " 저장됨";
      })
      .catch(function (e) {
        _memoSaving = false;
        console.warn("[widget/memo] save ERR:", e && e.message || e);
      });
  }

  function memoScheduleSave() {
    if (_memoSaveTimer) clearTimeout(_memoSaveTimer);
    _memoSaveTimer = setTimeout(memoSaveNow, 1200);
  }

  function renderMemoList() {
    var listEl = $id("memo-list");
    if (!listEl) return;
    if (!memos.length) {
      listEl.innerHTML = '<div class="w-empty">메모가 없어요<br><small style="font-size:10px">+ 새 메모 버튼으로 추가하세요</small></div>';
      return;
    }
    listEl.innerHTML = memos.map(function (m) {
      var raw = (m.html || "").replace(/<[^>]+>/g, "");
      var preview = raw.slice(0, 100) || "";
      return '<div class="memo-card" data-memo-id="' + esc(m.id) + '" style="background:' + esc(m.color || "#23252b") + '">' +
        (preview
          ? '<div class="memo-card-content">' + esc(preview) + '</div>'
          : '<div class="memo-card-content memo-card-empty">빈 메모</div>') +
        '</div>';
    }).join("");
  }

  function openMemoEditor(id) {
    var m = memoById(id);
    if (!m) return;
    activeMemoId = id;
    var listPane = $id("memo-list-pane");
    var editPane = $id("memo-edit-pane");
    if (listPane) listPane.style.display = "none";
    if (editPane) editPane.style.display = "";

    var content = $id("memo-content");
    if (content) {
      content.innerHTML = m.html || "";
      content.style.background = m.color || "#23252b";
      memoSetupImageResize(content);
      // Defer focus so display transition completes first
      setTimeout(function () { if (content) content.focus(); }, 50);
    }
    var colorPick = $id("memo-bg-color");
    if (colorPick) colorPick.value = m.color || "#23252b";
  }

  function closeMemoEditor() {
    // Flush pending save BEFORE clearing activeMemoId — memoSaveNow() raises
    // _memoSaving synchronously, so applyData won't absorb the stale echo.
    if (_memoSaveTimer) { clearTimeout(_memoSaveTimer); _memoSaveTimer = null; memoSaveNow(); }
    activeMemoId = null;
    var listPane = $id("memo-list-pane");
    var editPane = $id("memo-edit-pane");
    if (listPane) listPane.style.display = "";
    if (editPane) editPane.style.display = "none";
    renderMemoList();
  }

  function addMemo() {
    var id = "wm_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    var colorIdx = memos.length % MEMO_BG_COLORS.length;
    memos.unshift({ id: id, color: MEMO_BG_COLORS[colorIdx], html: "", updatedAt: Date.now() });
    openMemoEditor(id);
    memoScheduleSave();
  }

  function deleteMemo(id) {
    memos = memos.filter(function (m) { return m.id !== id; });
    // Start save BEFORE clearing activeMemoId so _memoSaving is raised first,
    // preventing the Firestore echo from restoring the just-deleted memo.
    memoSaveNow();
    activeMemoId = null;
    var listPane = $id("memo-list-pane");
    var editPane = $id("memo-edit-pane");
    if (listPane) listPane.style.display = "";
    if (editPane) editPane.style.display = "none";
    renderMemoList();
  }

  function execFmt(cmd) {
    document.execCommand(cmd, false, null);
    var c = $id("memo-content"); if (c) c.focus();
  }

  function applyFontSizePx(px) {
    var content = $id("memo-content");
    if (!content) return;
    content.focus();
    var sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      var range = sel.getRangeAt(0);
      var span = document.createElement("span");
      span.style.fontSize = px + "px";
      try {
        range.surroundContents(span);
      } catch (_) {
        // Selection spans multiple elements — wrap with execCommand fontSize marker then replace
        document.execCommand("fontSize", false, "7");
        content.querySelectorAll('font[size="7"]').forEach(function (f) {
          var s = document.createElement("span");
          s.style.fontSize = px + "px";
          while (f.firstChild) s.appendChild(f.firstChild);
          f.parentNode.replaceChild(s, f);
        });
      }
    }
  }

  // ── Memo image resize ─────────────────────────────────────────────────────
  // A grip div (fixed-positioned) appears at the bottom-right corner of a
  // clicked image. Dragging the grip resizes the image proportionally.
  var _memoResizeGrip = null;
  var _memoResizeImg  = null;

  function _removeMemoResizeGrip() {
    if (_memoResizeGrip) { _memoResizeGrip.remove(); _memoResizeGrip = null; }
    _memoResizeImg = null;
  }

  function _positionMemoGrip(img) {
    if (!_memoResizeGrip) return;
    var rect = img.getBoundingClientRect();
    _memoResizeGrip.style.left = (rect.right  - 8) + "px";
    _memoResizeGrip.style.top  = (rect.bottom - 8) + "px";
  }

  function _showMemoResizeGrip(img) {
    _removeMemoResizeGrip();
    var grip = document.createElement("div");
    grip.className = "img-resize-grip";
    document.body.appendChild(grip);
    _memoResizeGrip = grip;
    _positionMemoGrip(img);

    grip.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      var startX  = e.clientX;
      var startW  = img.offsetWidth  || img.naturalWidth  || 200;
      var aspect  = (img.offsetHeight && img.offsetWidth) ? img.offsetHeight / img.offsetWidth : 1;

      function onMove(e2) {
        var newW = Math.max(40, startW + (e2.clientX - startX));
        img.style.width  = newW + "px";
        img.style.height = Math.round(newW * aspect) + "px";
        _positionMemoGrip(img);
      }
      function onUp() {
        grip.removeEventListener("pointermove", onMove);
        grip.removeEventListener("pointerup",   onUp);
        memoScheduleSave();
      }
      grip.addEventListener("pointermove", onMove);
      grip.addEventListener("pointerup",   onUp);
    });
  }

  function memoSetupImageResize(contentEl) {
    contentEl.addEventListener("click", function (e) {
      if (e.target === _memoResizeGrip) return;
      if (e.target.tagName === "IMG") {
        _memoResizeImg = e.target;
        _showMemoResizeGrip(e.target);
      } else {
        _removeMemoResizeGrip();
      }
    });
  }

  // ── Quick input widget ─────────────────────────────────────────────────────
  // Quick input state
  var qiType          = "inbox";   // "inbox" | "task"
  var qiCat           = "task";
  var qiAttachedImage = null;      // base64 JPEG, or null
  // Populated from return_inbox_cats (synced from main app); fallback built-in
  var qiInboxCats = [
    {id: "task",  label: "할일",    emoji: "📋"},
    {id: "memo",  label: "메모",    emoji: "📝"},
    {id: "idea",  label: "아이디어", emoji: "💡"},
    {id: "buy",   label: "구매",    emoji: "🛒"}
  ];

  function _qiEffectiveCats() {
    // When type=task force category to "task"; otherwise show full list
    return qiType === "task"
      ? qiInboxCats.filter(function (c) { return c.id === "task"; })
      : qiInboxCats;
  }

  function _qiUpdateImgPreview() {
    var el = $id("qi-img-preview");
    if (!el) return;
    if (qiAttachedImage) {
      el.innerHTML = '<img src="' + qiAttachedImage + '"><button class="qi-img-clear" type="button">×</button>';
      el.querySelector(".qi-img-clear").addEventListener("click", function () {
        qiAttachedImage = null; _qiUpdateImgPreview();
      });
    } else {
      el.innerHTML = "";
    }
  }

  function qiResizeAndAttach(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var MAX = 900;
        var scale = Math.min(1, MAX / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        qiAttachedImage = canvas.toDataURL("image/jpeg", 0.82);
        _qiUpdateImgPreview();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderQuickinput() {
    // Type toggle
    var typeRow = $id("qi-type-row");
    if (typeRow && !typeRow._qiWired) {
      typeRow._qiWired = true;
      typeRow.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-qitype]");
        if (!btn) return;
        qiType = btn.getAttribute("data-qitype");
        if (qiType === "task") qiCat = "task";
        renderQuickinput();
      });
    }
    if (typeRow) {
      typeRow.querySelectorAll(".qi-type").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-qitype") === qiType);
      });
    }

    // Categories (hidden when type=task since cat is forced to "task")
    var catEl  = $id("qi-cats");
    var cats   = _qiEffectiveCats();
    if (catEl) {
      if (qiType === "task") {
        catEl.innerHTML = "";
      } else {
        catEl.innerHTML = cats.map(function (c) {
          return '<button class="qi-cat' + (c.id === qiCat ? " active" : "") +
                 '" data-qicat="' + c.id + '" type="button">' + c.emoji + " " + c.label + "</button>";
        }).join("");
        catEl.querySelectorAll("[data-qicat]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            qiCat = this.getAttribute("data-qicat"); renderQuickinput();
          });
        });
      }
    }

    on("qi-send",         qiSend);
    on("qi-sign-out-btn", function () { if (fbAuth) fbAuth.signOut(); });

    // Attach button
    on("qi-attach", function () { var f = $id("qi-file"); if (f) f.click(); });
    var fileEl = $id("qi-file");
    if (fileEl && !fileEl._qiWired) {
      fileEl._qiWired = true;
      fileEl.addEventListener("change", function () {
        if (this.files && this.files[0]) qiResizeAndAttach(this.files[0]);
        this.value = "";
      });
    }

    // Textarea: Enter=send, paste image
    var textEl = $id("qi-text");
    if (textEl && !textEl._qiWired) {
      textEl._qiWired = true;
      textEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); qiSend(); }
      });
      textEl.addEventListener("paste", function (e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            var blob = items[i].getAsFile();
            if (blob) { qiResizeAndAttach(blob); break; }
          }
        }
      });
    }
  }

  function qiSend() {
    var textEl = $id("qi-text");
    var text   = textEl ? (textEl.value || "").trim() : "";
    if (!text && !qiAttachedImage) return;
    var ref = userRef(); if (!ref) return;

    setSyncing(true);
    var key    = "inbox_v1";
    var docRef = ref.collection("data").doc(docIdForKey(key));
    docRef.get().then(function (doc) {
      var arr = [];
      if (doc.exists) {
        try { arr = JSON.parse(doc.data().value || "[]"); } catch (_) {}
        if (!Array.isArray(arr)) arr = [];
      }
      var now  = Date.now();
      var item = {
        id:     now,
        text:   text,
        cat:    qiType === "task" ? "task" : qiCat,
        ts:     now,
        done:   false,
        unread: qiType === "task"   // 할일은 "처리 필요"로 표시
      };
      if (qiAttachedImage) item.imgs = [qiAttachedImage];
      arr.unshift(item);
      var value = JSON.stringify(arr);
      var batch = fbDb.batch();
      batch.set(docRef, {key: key, value: value, updatedAtMs: now});
      batch.set(ref, {updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true}, {merge: true});
      return batch.commit();
    }).then(function () {
      if (textEl) textEl.value = "";
      qiAttachedImage = null;
      _qiUpdateImgPreview();
      setSyncing(false);
      updateSyncTime();
      // Brief send feedback
      var sendBtn = $id("qi-send");
      if (sendBtn) {
        sendBtn.textContent = "✓";
        setTimeout(function () { sendBtn.textContent = "전송"; }, 1200);
      }
    }).catch(function (e) {
      console.warn("[widget/qi] send ERR:", e && e.message || e);
      setSyncing(false);
    });
  }

  // Wire memo window events (only in the memo window)
  if (VIEW_MODE === "memo") {
    on("memo-add-btn", addMemo);

    var memoListEl = $id("memo-list");
    if (memoListEl) {
      memoListEl.addEventListener("click", function (e) {
        var card = e.target.closest && e.target.closest("[data-memo-id]");
        if (!card) return;
        var id = card.getAttribute("data-memo-id");
        if (id) openMemoEditor(id);
      });
    }

    var memoToolbarEl = $id("memo-toolbar");
    if (memoToolbarEl) {
      memoToolbarEl.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest("[data-act]");
        if (!btn) return;
        var act = btn.getAttribute("data-act");
        if      (act === "back")      { closeMemoEditor(); }
        else if (act === "bold")      { execFmt("bold"); }
        else if (act === "italic")    { execFmt("italic"); }
        else if (act === "underline") { execFmt("underline"); }
        else if (act === "link") {
          var url = window.prompt("링크 URL을 입력하세요:");
          if (url) {
            document.execCommand("createLink", false, url);
            var c = $id("memo-content"); if (c) c.focus();
          }
        } else if (act === "delete" && activeMemoId) {
          if (window.confirm("이 메모를 삭제할까요?")) deleteMemo(activeMemoId);
        }
      });
    }

    var fontsizeEl = $id("memo-fontsize");
    if (fontsizeEl) {
      fontsizeEl.addEventListener("change", function () {
        applyFontSizePx(parseInt(fontsizeEl.value, 10));
      });
    }

    var bgColorEl = $id("memo-bg-color");
    if (bgColorEl) {
      bgColorEl.addEventListener("input", function () {
        var m = memoById(activeMemoId);
        if (m) m.color = bgColorEl.value;
        var content = $id("memo-content");
        if (content) content.style.background = bgColorEl.value;
      });
      bgColorEl.addEventListener("change", function () { memoScheduleSave(); });
    }

    var memoContentEl = $id("memo-content");
    if (memoContentEl) {
      memoContentEl.addEventListener("input", function () {
        var m = memoById(activeMemoId);
        if (m) { m.html = memoContentEl.innerHTML; m.updatedAt = Date.now(); }
        memoScheduleSave();
      });
      // Open links in the system browser (Ctrl/Cmd+click on an anchor)
      memoContentEl.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest("a[href]");
        if (a && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          openExternal(a.getAttribute("href")).catch(function () {});
        }
      });
    }
  }

  // Wire quick input window
  if (VIEW_MODE === "quickinput") {
    renderQuickinput();
  }

  // Wire the timer window (delegated clicks) and prime it. Only in the timer
  // window so its interval/handlers never run in the habit/timeline windows.
  if (VIEW_MODE === "timer") {
    loadTimerCfg();
    timerSetTarget();
    var timerView = $id("view-timer");
    if (timerView) {
      timerView.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-act]");
        if (!b) return;
        var act = b.getAttribute("data-act");
        if (act === "mode") {
          if (timerState.running || timerState.elapsed > 0) return;  // locked mid-session
          timerCfg.mode = b.getAttribute("data-mode");
          timerState.mode = timerCfg.mode;
          timerState.phase = "work"; timerState.pomCount = 0;
          saveTimerCfg(); timerSetTarget(); renderTimer();
        } else if (act === "start")  { timerStart(); }
        else if (act === "pause")    { timerPause(); }
        else if (act === "resume")   { timerResume(); }
        else if (act === "finish")   { timerFinish(); }
        else if (act === "reset")    { timerReset(); }
        else if (act === "inc")      { adjustTimerCfg(b.getAttribute("data-field"), b.getAttribute("data-field") === "cd" ? 5 : 1); }
        else if (act === "dec")      { adjustTimerCfg(b.getAttribute("data-field"), b.getAttribute("data-field") === "cd" ? -5 : -1); }
        else if (act === "signout")  { signOut(); }
      });
    }
    renderTimer();
  }

})();
