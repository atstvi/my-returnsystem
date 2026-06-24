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
  var ALL_VIEWS = ["loading", "auth", "habits", "timeline", "workstation", "calendar", "quickinput", "error"];

  // The data view this window lands on after auth.
  function mainViewName() {
    return VIEW_MODE === "timeline"    ? "timeline"
         : VIEW_MODE === "workstation" ? "workstation"
         : VIEW_MODE === "calendar"    ? "calendar"
         : VIEW_MODE === "quickinput"  ? "quickinput"
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
  on("ws-sign-out-btn",  signOut);

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

    // (no early return here — workstation needs live updates for timer state sync)

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
        {label: "timeline",    key: "showTimeline"},
        {label: "workstation", key: "showWorkstation"},
        {label: "calendar",    key: "showCalendar"},
        {label: "quickinput",  key: "showQuickinput"}
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
    } else if (VIEW_MODE === "workstation") {
      // Absorb timer state from main app
      var ts = safeJson(keys["widget_timer_state_v1"], null);
      if (ts && typeof ts === "object") wsApplyTimerState(ts);
      // Absorb which task is linked
      var ws = safeJson(keys["widget_workstation_v1"], null);
      if (ws && typeof ws === "object") wsApplyWorkstationState(ws);
      // Absorb task notes
      wsTaskNotes = safeJson(keys["task_notes_v1"], {}) || {};
      renderWorkstation();
    } else if (VIEW_MODE === "calendar") {
      renderCalendar();
    } else if (VIEW_MODE === "quickinput") {
      // Absorb category list from main app (return_inbox_cats syncs via Firestore)
      var cats = safeJson(keys["return_inbox_cats"], []);
      if (Array.isArray(cats) && cats.length) qiInboxCats = cats;
      renderQuickinput();
    } else {
      // habits window: watch timer state changes to auto-show/hide workstation
      var hbTs = safeJson(keys["widget_timer_state_v1"], null);
      habitsApplyTimerActive(hbTs);
      // Also auto-show workstation when a task is linked via 🖥 from main app
      var hbWs = safeJson(keys["widget_workstation_v1"], null);
      habitsApplyWorkstationLink(hbWs);
      renderHabits(lastData.habits, lastData.bundles, lastData.logs);
    }
  }

  // ── Habits window: auto-show workstation when timer becomes active ──────────
  var _lastTimerActive = false;
  var _wsHideTimer = null;
  var _lastWorkstationOpenedAt = 0;

  function habitsApplyTimerActive(ts) {
    if (VIEW_MODE !== "") return;  // only habits window (VIEW_MODE === "")
    var active = !!(ts && ts.active);
    if (active === _lastTimerActive) return;
    _lastTimerActive = active;
    var tauriCore = window.__TAURI__ && window.__TAURI__.core;
    if (!tauriCore) return;
    if (active) {
      if (_wsHideTimer) { clearTimeout(_wsHideTimer); _wsHideTimer = null; }
      tauriCore.invoke("set_window_visible", {label: "workstation", visible: true}).catch(function() {});
    } else {
      // Delay hide so the user can see the final state for a moment
      _wsHideTimer = setTimeout(function() {
        _wsHideTimer = null;
        tauriCore.invoke("set_window_visible", {label: "workstation", visible: false}).catch(function() {});
      }, 4000);
    }
  }

  // Show workstation window when user clicks 🖥 on a task in the main app
  function habitsApplyWorkstationLink(ws) {
    if (VIEW_MODE !== "") return;
    var openedAt = ws && ws.openedAt ? Number(ws.openedAt) : 0;
    if (!openedAt || openedAt <= _lastWorkstationOpenedAt) return;
    _lastWorkstationOpenedAt = openedAt;
    if (Date.now() - openedAt < 15000) {  // show if link was set < 15s ago
      var tauriCore = window.__TAURI__ && window.__TAURI__.core;
      if (tauriCore) {
        if (_wsHideTimer) { clearTimeout(_wsHideTimer); _wsHideTimer = null; }
        tauriCore.invoke("set_window_visible", {label: "workstation", visible: true}).catch(function() {});
      }
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
    var dotId = VIEW_MODE === "timeline"    ? "tbl-sync-dot"
              : VIEW_MODE === "calendar"    ? "cal-sync-dot"
              : VIEW_MODE === "quickinput"  ? "qi-sync-dot"
              : VIEW_MODE === "workstation" ? null
              : "sync-dot";
    if (!dotId) return;
    var dot = $id(dotId);
    if (dot) dot.className = "w-sync-dot" + (active ? " syncing" : "");
  }

  function updateSyncTime() {
    var timeId = VIEW_MODE === "timeline"    ? "tbl-sync-time"
               : VIEW_MODE === "calendar"    ? "cal-sync-time"
               : VIEW_MODE === "quickinput"  ? "qi-sync-time"
               : VIEW_MODE === "workstation" ? "ws-sync-time"
               : "sync-time";
    var el = $id(timeId);
    if (!el) return;
    var d = new Date();
    el.textContent = String(d.getHours()).padStart(2, "0") + ":" +
                     String(d.getMinutes()).padStart(2, "0") + " 동기화됨";
  }

  // ── Workstation window (task goal + timer + notes) ──────────────────────────
  // The workstation is a unified focus widget that replaces the old separate
  // timer and memo windows. It:
  //   • Shows the linked task's title as a standby goal
  //   • Runs a Pomodoro/countdown/stopwatch timer (state synced with the main
  //     app via Firestore key widget_timer_state_v1)
  //   • Lets the user search/create a task when the timer is running but no
  //     task is linked
  //   • Offers a quick-notes textarea saved to task_notes_v1[taskId]
  //
  // The main app writes widget_timer_state_v1 on every timer transition, and
  // the workstation window applies that state reactively. The workstation can
  // also pause/resume/stop the timer, writing back to the same key.
  //
  // widget_workstation_v1: { taskId, taskTitle, due?, openedAt }
  // task_notes_v1:         { [taskId]: { text, updatedAt } }

  // ── Workstation state ────────────────────────────────────────────────────────
  var WS_TIMER_KEY  = "widget_timer_state_v1";
  var WS_CFG_KEY    = "widget_timer_cfg";
  var TASK_NOTES_KEY = "task_notes_v1";

  // Timer config (device-local)
  var wsCfg = {
    mode: "pomodoro",
    pomodoro: { work: 25, short: 5, long: 15, longAfter: 4 },
    countdown: { minutes: 25 }
  };
  // Timer runtime state (synced with main app via Firestore)
  var wsTimer = {
    running: false, startedAt: 0, elapsed: 0,
    mode: "pomodoro", phase: "work", pomCount: 0,
    targetMs: 0, tick: null
  };
  var wsTimerFootMsg = "";
  // Linked task (from widget_workstation_v1, set by main app when user clicks 📌)
  var wsTaskId    = "";
  var wsTaskTitle = "";
  var wsTaskDue   = "";
  // Notes (task_notes_v1)
  var wsTaskNotes = {};        // full map { taskId: { text, updatedAt } }
  var _wsNotesSaveTimer = null;

  function wsLoadCfg() {
    var s = safeJson(localStorage.getItem(WS_CFG_KEY), null);
    if (s && typeof s === "object") {
      if (s.mode) wsCfg.mode = s.mode;
      if (s.pomodoro) wsCfg.pomodoro = Object.assign({}, wsCfg.pomodoro, s.pomodoro);
      if (s.countdown) wsCfg.countdown = Object.assign({}, wsCfg.countdown, s.countdown);
    }
    wsTimer.mode = wsCfg.mode;
  }
  function wsSaveCfg() {
    try { localStorage.setItem(WS_CFG_KEY, JSON.stringify(wsCfg)); } catch (_) {}
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Apply timer state received from Firestore (written by main app or by us)
  function wsApplyTimerState(ts) {
    if (!ts || typeof ts !== "object") return;
    var newMode = ts.mode || "pomodoro";
    wsCfg.mode = newMode;
    wsTimer.mode  = newMode;
    wsTimer.phase = ts.phase || "work";
    wsTimer.pomCount = ts.pomCount || 0;
    wsTimer.targetMs = ts.targetMs || 0;
    wsTimer.elapsed  = ts.elapsed  || 0;
    wsTimer.running  = !!ts.running;
    wsTimer.startedAt = wsTimer.running ? (ts.startedAt || Date.now()) : 0;
    // Adjust local tick
    if (wsTimer.running) {
      if (!wsTimer.tick) wsTimer.tick = setInterval(wsTimerTick, 1000);
    } else {
      if (wsTimer.tick) { clearInterval(wsTimer.tick); wsTimer.tick = null; }
    }
  }

  // Apply which task is linked (from widget_workstation_v1)
  function wsApplyWorkstationState(ws) {
    if (!ws || typeof ws !== "object") return;
    var newId = String(ws.taskId || "");
    var changed = newId !== wsTaskId;
    wsTaskId    = newId;
    wsTaskTitle = ws.taskTitle || "";
    wsTaskDue   = ws.due || "";
    // If task changed, populate notes from our cached map
    if (changed) {
      var el = $id("ws-notes-area");
      if (el) el.value = wsTaskNotes[wsTaskId] ? wsTaskNotes[wsTaskId].text || "" : "";
    }
  }

  function wsTimerElapsedMs() {
    return (wsTimer.elapsed || 0) +
      (wsTimer.running && wsTimer.startedAt ? Date.now() - wsTimer.startedAt : 0);
  }
  function wsTimerRemainingMs() {
    if (!wsTimer.targetMs) return null;
    return Math.max(0, wsTimer.targetMs - wsTimerElapsedMs());
  }
  function wsTimerFormatMs(ms) {
    var total = Math.max(0, Math.floor((ms || 0) / 1000));
    var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return (h ? String(h).padStart(2, "0") + ":" : "") +
      String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function wsTimerPhaseLabel() {
    var ph = wsTimer.phase;
    if (ph === "short_break") return "짧은 휴식";
    if (ph === "long_break")  return "긴 휴식";
    return "집중";
  }
  function wsTimerSetTarget() {
    var m = wsCfg.mode;
    if (m === "stopwatch") { wsTimer.targetMs = 0; return; }
    if (m === "countdown") { wsTimer.targetMs = (wsCfg.countdown.minutes || 25) * 60000; return; }
    var p = wsCfg.pomodoro, ph = wsTimer.phase;
    if (ph === "short_break")     wsTimer.targetMs = (p.short || 5) * 60000;
    else if (ph === "long_break") wsTimer.targetMs = (p.long  || 15) * 60000;
    else                          wsTimer.targetMs = (p.work  || 25) * 60000;
  }
  function wsTimerNextPhase() {
    var longAfter = wsCfg.pomodoro.longAfter || 4;
    if (wsTimer.phase === "work") {
      wsTimer.pomCount = (wsTimer.pomCount || 0) + 1;
      wsTimer.phase = (wsTimer.pomCount % longAfter === 0) ? "long_break" : "short_break";
    } else {
      wsTimer.phase = "work";
    }
    wsTimer.elapsed = 0; wsTimer.startedAt = 0; wsTimer.running = false;
    wsTimerSetTarget();
  }

  // Write current timer state to Firestore (notify main app)
  function wsTimerSync() {
    var ref = userRef(); if (!ref) return;
    var val = JSON.stringify({
      active:    wsTimer.running || wsTimerElapsedMs() > 0,
      running:   wsTimer.running,
      mode:      wsCfg.mode,
      phase:     wsTimer.phase,
      pomCount:  wsTimer.pomCount,
      targetMs:  wsTimer.targetMs,
      elapsed:   wsTimerElapsedMs(),
      startedAt: wsTimer.running ? wsTimer.startedAt : 0,
      taskId:    wsTaskId || null,
      taskTitle: wsTaskTitle || null,
      updatedAt: Date.now()
    });
    var now = Date.now();
    ref.collection("data").doc(docIdForKey(WS_TIMER_KEY))
      .set({ key: WS_TIMER_KEY, value: val, updatedAtMs: now })
      .then(function() {
        return ref.set({ updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true }, { merge: true });
      })
      .catch(function(e) { console.warn("[widget/ws] timer sync ERR:", e && e.message || e); });
  }

  function wsTimerStart() {
    wsTimer.mode = wsCfg.mode;
    if (wsTimer.elapsed === 0) wsTimerSetTarget();
    wsTimer.startedAt = Date.now(); wsTimer.running = true;
    if (wsTimer.tick) clearInterval(wsTimer.tick);
    wsTimer.tick = setInterval(wsTimerTick, 1000);
    wsRequestNotify();
    renderWorkstation();
    wsTimerSync();
  }
  function wsTimerPause() {
    if (!wsTimer.running) return;
    if (wsTimer.tick) clearInterval(wsTimer.tick);
    wsTimer.elapsed += (Date.now() - wsTimer.startedAt);
    wsTimer.startedAt = 0; wsTimer.running = false; wsTimer.tick = null;
    renderWorkstation();
    wsTimerSync();
  }
  function wsTimerResume() {
    if (wsTimer.running) return;
    if (!wsTimer.targetMs && wsCfg.mode !== "stopwatch") wsTimerSetTarget();
    wsTimer.startedAt = Date.now(); wsTimer.running = true;
    if (wsTimer.tick) clearInterval(wsTimer.tick);
    wsTimer.tick = setInterval(wsTimerTick, 1000);
    renderWorkstation();
    wsTimerSync();
  }
  function wsTimerReset() {
    if (wsTimer.tick) clearInterval(wsTimer.tick);
    wsTimer.running = false; wsTimer.startedAt = 0; wsTimer.elapsed = 0; wsTimer.tick = null;
    wsTimerSetTarget();
    renderWorkstation();
    wsTimerSync();
  }
  function wsTimerFinish() {
    var elapsed = wsTimerElapsedMs();
    var mode = wsCfg.mode, phase = wsTimer.phase;
    if (wsTimer.tick) clearInterval(wsTimer.tick);
    wsTimer.tick = null; wsTimer.running = false;
    wsTimerLogSession(elapsed, mode, phase);
    wsNotifyDone(wsTimerPhaseLabel(), elapsed);
    if (mode === "pomodoro") {
      wsTimerNextPhase();
    } else {
      wsTimer.elapsed = 0; wsTimer.startedAt = 0; wsTimerSetTarget();
    }
    renderWorkstation();
    wsTimerSync();
  }
  function wsTimerTick() {
    var remaining = wsTimerRemainingMs();
    if (remaining !== null && remaining <= 0) { wsTimerFinish(); return; }
    var disp = remaining !== null ? wsTimerFormatMs(remaining) : wsTimerFormatMs(wsTimerElapsedMs());
    var cl = $id("ws-timer-clock"); if (cl) cl.textContent = disp;
    if (wsTimer.targetMs && remaining !== null) {
      var fill = $id("ws-progress-fill");
      if (fill) fill.style.width = clamp((1 - remaining / wsTimer.targetMs) * 100, 0, 100) + "%";
    }
  }

  function wsTimerLogSession(ms, mode, phase) {
    if (!ms || ms < 1000) return;
    var rec = {
      id: "wts_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
      mode: mode, phase: phase, durationMs: Math.round(ms),
      taskId: wsTaskId || "", taskText: wsTaskTitle || "",
      completedAt: Date.now(), source: "widget"
    };
    var label = wsTimerPhaseLabel();
    var user = fbAuth.currentUser;
    if (!user || !fbDb) {
      wsTimerFootMsg = "로그인 필요 — 기록 안 됨";
      renderWorkstation();
      return;
    }
    wsTimerFootMsg = label + " " + wsTimerFormatMs(ms) + " 기록 중…";
    fbDb.collection("users").doc(user.uid)
      .collection("widget_focus_sessions").doc(rec.id).set(rec)
      .then(function() {
        wsTimerFootMsg = "✓ " + label + " " + wsTimerFormatMs(ms) + " 기록됨";
        renderWorkstation();
      })
      .catch(function(e) {
        wsTimerFootMsg = "기록 실패";
        renderWorkstation();
      });
  }

  function wsRequestNotify() {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(function() {});
      }
    } catch (_) {}
  }
  function wsNotifyDone(label, ms) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Return 타이머", { body: label + " 완료! (" + wsTimerFormatMs(ms) + ")" });
      }
    } catch (_) {}
  }

  // ── Task search / create (when timer active, no task linked) ─────────────────
  var _wsSearchDebounce = null;

  function wsSearchTasks(query) {
    var resultsEl = $id("ws-search-results");
    if (!resultsEl) return;
    var q = (query || "").trim().toLowerCase();
    var tasks = lastData.tasks || [];
    var open = tasks.filter(function(t) { return !t.done; });
    var matches = q
      ? open.filter(function(t) { return (t.text || "").toLowerCase().indexOf(q) !== -1; }).slice(0, 6)
      : open.slice(0, 6);

    var html = "";
    matches.forEach(function(t) {
      html += '<div class="ws-search-item" data-task-id="' + esc(String(t.id)) +
              '" data-task-title="' + esc(t.text || "") + '">' +
              '<span class="ws-search-icon">◈</span>' +
              '<span class="ws-search-text">' + esc(t.text || "") + '</span></div>';
    });
    if (q && !matches.length) {
      html += '<div class="ws-search-item ws-search-create" data-create="1" data-task-title="' + esc(query) + '">' +
              '<span class="ws-search-icon">+</span>' +
              '<span class="ws-search-text">"' + esc(query) + '" 할일 생성</span></div>';
    } else if (q) {
      html += '<div class="ws-search-item ws-search-create" data-create="1" data-task-title="' + esc(query) + '">' +
              '<span class="ws-search-icon">+</span>' +
              '<span class="ws-search-text">"' + esc(query) + '" 새 할일로 생성</span></div>';
    }
    resultsEl.innerHTML = html;
  }

  function wsLinkTask(taskId, taskTitle, create) {
    if (create) {
      // Create new task and link it
      var newTask = {
        id: Date.now(),
        text: taskTitle,
        done: false,
        cat: "task",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: "widget"
      };
      var ref = userRef(); if (!ref) return;
      ref.collection("data").doc(docIdForKey("task_items_v1")).get().then(function(doc) {
        var arr = [];
        if (doc.exists) { try { arr = JSON.parse(doc.data().value || "[]"); } catch (_) {} }
        if (!Array.isArray(arr)) arr = [];
        arr.unshift(newTask);
        var val = JSON.stringify(arr);
        var now = Date.now();
        var batch = fbDb.batch();
        batch.set(ref.collection("data").doc(docIdForKey("task_items_v1")),
                  { key: "task_items_v1", value: val, updatedAtMs: now });
        batch.set(ref, { updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true }, { merge: true });
        return batch.commit();
      }).then(function() {
        wsTaskId = String(newTask.id);
        wsTaskTitle = taskTitle;
        wsTimerSync();
        renderWorkstation();
        wsWriteWorkstationKey();
      }).catch(function(e) { console.warn("[widget/ws] create task ERR:", e && e.message || e); });
    } else {
      wsTaskId = String(taskId);
      wsTaskTitle = taskTitle;
      wsTimerSync();
      renderWorkstation();
      wsWriteWorkstationKey();
    }
    var inp = $id("ws-search-inp");
    if (inp) inp.value = "";
    wsSearchTasks("");
  }

  function wsWriteWorkstationKey() {
    var ref = userRef(); if (!ref) return;
    var val = JSON.stringify({ taskId: wsTaskId, taskTitle: wsTaskTitle, due: wsTaskDue, openedAt: Date.now() });
    var now = Date.now();
    var batch = fbDb.batch();
    batch.set(ref.collection("data").doc(docIdForKey("widget_workstation_v1")),
              { key: "widget_workstation_v1", value: val, updatedAtMs: now });
    batch.set(ref, { updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true }, { merge: true });
    batch.commit().catch(function(e) { console.warn("[widget/ws] workstation key ERR:", e && e.message || e); });
  }

  // ── Notes save ───────────────────────────────────────────────────────────────
  function wsNotesSaveNow() {
    if (_wsNotesSaveTimer) { clearTimeout(_wsNotesSaveTimer); _wsNotesSaveTimer = null; }
    if (!wsTaskId) return;
    var ref = userRef(); if (!ref) return;
    var el = $id("ws-notes-area");
    var text = el ? el.value : "";
    wsTaskNotes[wsTaskId] = { text: text, updatedAt: Date.now() };
    var val = JSON.stringify(wsTaskNotes);
    var now = Date.now();
    var batch = fbDb.batch();
    batch.set(ref.collection("data").doc(docIdForKey(TASK_NOTES_KEY)),
              { key: TASK_NOTES_KEY, value: val, updatedAtMs: now });
    batch.set(ref, { updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true }, { merge: true });
    batch.commit()
      .then(function() {
        var savedEl = $id("ws-notes-saved");
        if (savedEl) {
          var d = new Date();
          savedEl.textContent = String(d.getHours()).padStart(2,"0") + ":" +
                                String(d.getMinutes()).padStart(2,"0") + " 저장됨";
        }
      })
      .catch(function(e) { console.warn("[widget/ws] notes save ERR:", e && e.message || e); });
  }
  function wsNotesScheduleSave() {
    if (_wsNotesSaveTimer) clearTimeout(_wsNotesSaveTimer);
    _wsNotesSaveTimer = setTimeout(wsNotesSaveNow, 1200);
  }

  // ── Workstation rendering ─────────────────────────────────────────────────────
  var WS_MODES = [
    ["pomodoro",  "🎯 집중"],
    ["countdown", "⏳ 카운트"],
    ["stopwatch", "▷ 스톱"]
  ];

  function wsTimerSettingRow(label, field, val, unit) {
    return '<div class="tm-set-row"><span class="tm-set-label">' + label + '</span>' +
      '<span class="tm-set-ctl">' +
        '<button class="tm-step" data-act="dec" data-field="' + field + '" type="button">−</button>' +
        '<span class="tm-set-val">' + val + '</span>' +
        '<button class="tm-step" data-act="inc" data-field="' + field + '" type="button">+</button>' +
        '<span class="tm-set-unit">' + unit + '</span>' +
      '</span></div>';
  }

  function renderWorkstation() {
    if (VIEW_MODE !== "workstation") return;

    var running = wsTimer.running;
    var paused  = !running && wsTimer.elapsed > 0;
    var active  = running || paused;

    // ── Task header ──────────────────────────────────────────────────────────
    var hdr = $id("ws-task-header");
    if (hdr) hdr.style.display = wsTaskId ? "" : "none";
    if (wsTaskId) {
      var titleEl = $id("ws-task-title");
      if (titleEl) titleEl.textContent = wsTaskTitle || wsTaskId;
      var metaEl = $id("ws-task-meta");
      if (metaEl) metaEl.textContent = wsTaskDue ? "마감: " + wsTaskDue : "";
    }

    // ── Timer ────────────────────────────────────────────────────────────────
    var root = $id("ws-timer-root");
    if (root) {
      var remaining = wsTimerRemainingMs();
      var display = remaining !== null ? wsTimerFormatMs(remaining) : wsTimerFormatMs(wsTimerElapsedMs());
      var pct = (wsTimer.targetMs && remaining !== null)
        ? clamp((1 - remaining / wsTimer.targetMs) * 100, 0, 100) : 0;

      var html = "";
      // Mode tabs
      html += '<div class="tm-tabs">';
      WS_MODES.forEach(function(m) {
        html += '<button class="tm-tab' + (wsCfg.mode === m[0] ? " active" : "") +
          '" data-act="mode" data-mode="' + m[0] + '" type="button"' + (active ? " disabled" : "") + '>' +
          m[1] + '</button>';
      });
      html += '</div>';

      // Phase / dots
      if (wsCfg.mode === "pomodoro") {
        html += '<div class="tm-phase' + (wsTimer.phase === "work" ? " work" : " brk") + '">' + wsTimerPhaseLabel() + '</div>';
        var longAfter = wsCfg.pomodoro.longAfter || 4;
        var done = wsTimer.pomCount % longAfter;
        var dots = "";
        for (var i = 0; i < longAfter; i++) dots += '<span class="tm-dot' + (i < done ? " on" : "") + '"></span>';
        html += '<div class="tm-dots">' + dots + '</div>';
      } else {
        html += '<div class="tm-phase brk">' + (wsCfg.mode === "countdown" ? "카운트다운" : "스톱워치") + '</div>';
      }

      html += '<div class="tm-clock" id="ws-timer-clock">' + display + '</div>';
      html += '<div class="tm-progress"><div class="tm-progress-fill" id="ws-progress-fill" style="width:' + pct + '%"></div></div>';

      html += '<div class="tm-controls">';
      if (running)     html += '<button class="tm-btn tm-btn-main" data-act="pause"  type="button">일시정지</button>';
      else if (paused) html += '<button class="tm-btn tm-btn-main" data-act="resume" type="button">계속</button>';
      else             html += '<button class="tm-btn tm-btn-main" data-act="start"  type="button">시작</button>';
      if (active)      html += '<button class="tm-btn" data-act="finish" type="button">완료</button>';
      html += '<button class="tm-btn tm-btn-icon" data-act="reset" type="button" title="초기화">⟲</button>';
      html += '</div>';

      if (!active) {
        html += '<div class="tm-settings">';
        if (wsCfg.mode === "pomodoro") {
          html += wsTimerSettingRow("집중",      "work",  wsCfg.pomodoro.work,  "분");
          html += wsTimerSettingRow("짧은 휴식", "short", wsCfg.pomodoro.short, "분");
          html += wsTimerSettingRow("긴 휴식",   "long",  wsCfg.pomodoro.long,  "분");
        } else if (wsCfg.mode === "countdown") {
          html += wsTimerSettingRow("시간", "cd", wsCfg.countdown.minutes, "분");
        } else {
          html += '<div class="tm-hint">시작하면 시간이 올라가요.<br>완료를 누르면 기록돼요.</div>';
        }
        html += '</div>';
      }

      if (wsTimerFootMsg) {
        html += '<div class="ws-timer-foot">' + esc(wsTimerFootMsg) + '</div>';
      }

      root.innerHTML = html;
    }

    // ── Task search (timer active, no task linked) ───────────────────────────
    var searchEl = $id("ws-task-search");
    if (searchEl) searchEl.style.display = (active && !wsTaskId) ? "" : "none";

    // ── Notes (task linked) ──────────────────────────────────────────────────
    var notesEl = $id("ws-notes-section");
    if (notesEl) {
      var showNotes = !!wsTaskId;
      notesEl.style.display = showNotes ? "" : "none";
      if (showNotes) {
        var ta = $id("ws-notes-area");
        if (ta && !ta._wsWired) {
          ta._wsWired = true;
          ta.addEventListener("input", wsNotesScheduleSave);
        }
        // Populate if empty and we have data
        if (ta && !ta._wsPopulated) {
          ta._wsPopulated = true;
          ta.value = (wsTaskNotes[wsTaskId] && wsTaskNotes[wsTaskId].text) || "";
        }
      }
    }
  }

  function wsAdjustCfg(field, delta) {
    if (field === "cd") {
      wsCfg.countdown.minutes = clamp(wsCfg.countdown.minutes + delta, 1, 180);
    } else {
      wsCfg.pomodoro[field] = clamp((wsCfg.pomodoro[field] || 0) + delta, 1, 120);
    }
    wsSaveCfg();
    if (!wsTimer.running && wsTimer.elapsed === 0) wsTimerSetTarget();
    renderWorkstation();
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

  // ── (Memo window removed — replaced by Workstation) ─────────────────────────

  // ── Sticky Memo stub (code kept for reference, no longer rendered) ──────────
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
    var now = Date.now();

    function onSuccess() {
      if (textEl) textEl.value = "";
      qiAttachedImage = null;
      _qiUpdateImgPreview();
      setSyncing(false);
      updateSyncTime();
      var sendBtn = $id("qi-send");
      if (sendBtn) {
        sendBtn.textContent = "✓";
        setTimeout(function () { sendBtn.textContent = "전송"; }, 1200);
      }
    }
    function onError(e) {
      console.warn("[widget/qi] send ERR:", e && e.message || e);
      setSyncing(false);
    }

    if (qiType === "task") {
      // Write to task_items_v1 as a proper task (appears in main app task list)
      var taskDocRef = ref.collection("data").doc(docIdForKey("task_items_v1"));
      taskDocRef.get().then(function (doc) {
        var arr = [];
        if (doc.exists) {
          try { arr = JSON.parse(doc.data().value || "[]"); } catch (_) {}
          if (!Array.isArray(arr)) arr = [];
        }
        var newTask = {
          id:        now,
          text:      text,
          done:      false,
          cat:       "task",
          createdAt: now,
          updatedAt: now,
          source:    "widget"
        };
        if (qiAttachedImage) newTask.imgs = [qiAttachedImage];
        arr.unshift(newTask);
        var batch = fbDb.batch();
        batch.set(taskDocRef, {key: "task_items_v1", value: JSON.stringify(arr), updatedAtMs: now});
        batch.set(ref, {updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true}, {merge: true});
        return batch.commit();
      }).then(onSuccess).catch(onError);
    } else {
      // Write to inbox_v1 (idea / memo / buy etc.)
      var inboxDocRef = ref.collection("data").doc(docIdForKey("inbox_v1"));
      inboxDocRef.get().then(function (doc) {
        var arr = [];
        if (doc.exists) {
          try { arr = JSON.parse(doc.data().value || "[]"); } catch (_) {}
          if (!Array.isArray(arr)) arr = [];
        }
        var item = {
          id:        now,
          text:      text,
          cat:       qiCat,
          ts:        now,
          updatedAt: now,
          done:      false,
          unread:    true   // 인박스 항목도 unread=true 로 홈 화면에 표시
        };
        if (qiAttachedImage) item.imgs = [qiAttachedImage];
        arr.unshift(item);
        var batch = fbDb.batch();
        batch.set(inboxDocRef, {key: "inbox_v1", value: JSON.stringify(arr), updatedAtMs: now});
        batch.set(ref, {updatedAtMs: now, clientId: WIDGET_CLIENT_ID, split: true}, {merge: true});
        return batch.commit();
      }).then(onSuccess).catch(onError);
    }
  }

  // Wire quick input window
  if (VIEW_MODE === "quickinput") {
    renderQuickinput();
  }

  // Wire workstation window
  if (VIEW_MODE === "workstation") {
    wsLoadCfg();
    wsTimerSetTarget();
    on("ws-sign-out-btn", signOut);

    var wsView = $id("view-workstation");
    if (wsView) {
      // Timer click delegation
      wsView.addEventListener("click", function(e) {
        var b = e.target.closest && e.target.closest("[data-act]");
        if (!b) return;
        var act = b.getAttribute("data-act");
        if (act === "mode") {
          if (wsTimer.running || wsTimer.elapsed > 0) return;
          wsCfg.mode = b.getAttribute("data-mode");
          wsTimer.mode = wsCfg.mode;
          wsTimer.phase = "work"; wsTimer.pomCount = 0;
          wsSaveCfg(); wsTimerSetTarget(); renderWorkstation();
        } else if (act === "start")  { wsTimerStart(); }
        else if (act === "pause")    { wsTimerPause(); }
        else if (act === "resume")   { wsTimerResume(); }
        else if (act === "finish")   { wsTimerFinish(); }
        else if (act === "reset")    { wsTimerReset(); }
        else if (act === "inc") {
          var f = b.getAttribute("data-field");
          wsAdjustCfg(f, f === "cd" ? 5 : 1);
        } else if (act === "dec") {
          var f2 = b.getAttribute("data-field");
          wsAdjustCfg(f2, f2 === "cd" ? -5 : -1);
        }

        // Task search result click
        var item = e.target.closest && e.target.closest(".ws-search-item");
        if (item) {
          var taskId    = item.getAttribute("data-task-id");
          var taskTitle = item.getAttribute("data-task-title");
          var create    = item.getAttribute("data-create") === "1";
          if (taskTitle) wsLinkTask(taskId, taskTitle, create);
        }
      });

      // Search input
      var searchInp = $id("ws-search-inp");
      if (searchInp) {
        searchInp.addEventListener("input", function() {
          if (_wsSearchDebounce) clearTimeout(_wsSearchDebounce);
          var q = this.value;
          _wsSearchDebounce = setTimeout(function() { wsSearchTasks(q); }, 200);
        });
        searchInp.addEventListener("focus", function() {
          wsSearchTasks(this.value);
        });
      }
    }

    renderWorkstation();
  }

})();
