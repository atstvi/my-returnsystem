// Return Widget — W1: Firebase auth + Firestore habit reader (read-only)
//
// Uses the global Tauri API (withGlobalTauri: true) so the widget stays
// buildless. Firebase compat SDK is loaded via <script> CDN tags in
// index.html, same pattern the main web app uses.

(function () {
  "use strict";

  // ── Tauri window controls ──────────────────────────────────────────────────

  var TAURI = window.__TAURI__;
  var hasTauri = !!(TAURI && TAURI.window && typeof TAURI.window.getCurrentWindow === "function");
  var appWindow = hasTauri ? TAURI.window.getCurrentWindow() : null;
  var pinned = false;

  function $id(id) { return document.getElementById(id); }

  function on(id, fn) {
    var el = $id(id);
    if (el) el.addEventListener("click", fn);
  }

  // ── Auth diagnostics ─────────────────────────────────────────────────────────
  // The widget can't easily open devtools, and the auth flow involves a
  // cross-origin redirect round-trip, so we keep a persistent on-screen log.
  // It's stored in localStorage (survives the redirect) and rendered into the
  // #dbg-log panel so a screenshot is enough to diagnose a stuck login.
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

  // Render whatever was logged before this load (e.g. before the redirect).
  dbgRender();
  dbg("page load · origin=" + location.origin);

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
      .catch(function (e) {
        console.error("[widget] setAlwaysOnTop:", e);
        pinned = !pinned;
      });
  });

  on("min-btn", function () {
    if (appWindow) appWindow.minimize().catch(console.error);
  });

  on("close-btn", function () {
    if (appWindow) appWindow.close().catch(console.error);
  });

  // ── Views ──────────────────────────────────────────────────────────────────

  var ALL_VIEWS = ["loading", "auth", "habits", "error"];

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
  // Same project and config as the main web app (DEFAULT_FB_CONFIG).

  var FB_CONFIG = {
    apiKey:      "AIzaSyA5zb3HtI4yZj0hJ9I66OMqpc7CPRuEVRY",
    authDomain:  "my-return-system.firebaseapp.com",
    projectId:   "my-return-system"
  };

  var fbAuth, fbDb;
  try {
    firebase.app();
  } catch (_) {
    firebase.initializeApp(FB_CONFIG);
  }
  fbAuth = firebase.auth();
  fbDb   = firebase.firestore();

  // Persist auth across restarts (IndexedDB-backed by Firebase SDK). Once the
  // user signs in once, signInWithCredential's session is restored on launch and
  // onAuthStateChanged fires with the user — no re-login needed.
  fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});

  // ── OAuth (system browser + loopback) ────────────────────────────────────────
  // Firebase sign-in cannot complete inside Tauri's WebView2: both popup and
  // redirect rely on cross-origin postMessage with firebaseapp.com, which
  // WebView2 blocks (confirmed via the diagnostics log). Instead we run the
  // standard desktop OAuth flow (RFC 8252): open Google sign-in in the real
  // system browser, catch the loopback redirect on the local server, exchange
  // the auth code (PKCE) for an id_token, and hand that straight to Firebase via
  // signInWithCredential — no iframe/postMessage involved.

  var OAUTH_REDIRECT = "http://127.0.0.1:14317/oauth2callback"; // server route
  var OAUTH_POLL = "/oauth2result"; // same-origin (localhost) poll endpoint
  var CFG_KEY = "widget_oauth_cfg";

  function readCfg() { return safeJson(localStorage.getItem(CFG_KEY), {}); }
  function saveCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (_) {} }

  function b64url(bytes) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  function pkceVerifier() {
    var a = new Uint8Array(32);
    crypto.getRandomValues(a);
    return b64url(a);
  }
  function pkceChallenge(verifier) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(b64url);
  }

  // Open a URL in the real system browser via the opener plugin (raw invoke, so
  // it works with withGlobalTauri and no JS bundler). Falls back to window.open
  // when running in a plain browser (for testing index.html directly).
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

  var unsubSnap = null; // Firestore onSnapshot unsubscribe handle

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

  // Poll the local server for the auth code captured from the loopback redirect.
  function pollForCode(state, verifier, clientId, clientSecret) {
    var tries = 0;
    var MAX = 200; // ~5 min at 1.5s intervals
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
        .catch(function () { /* server not ready / transient — keep polling */ });
    }, 1500);
  }

  // Exchange the auth code for an id_token (PKCE) and sign in to Firebase.
  function exchangeAndSignIn(code, verifier, clientId, clientSecret) {
    var body = {
      code: code,
      client_id: clientId,
      redirect_uri: OAUTH_REDIRECT,
      code_verifier: verifier,
      grant_type: "authorization_code"
    };
    if (clientSecret) body.client_secret = clientSecret;

    fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString()
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.text().then(function (t) {
          throw new Error("토큰 교환 " + resp.status + ": " + t);
        });
      }
      return resp.json();
    }).then(function (data) {
      if (!data.id_token) throw new Error("id_token 없음 (scope에 openid 필요)");
      dbg("token exchange OK · signInWithCredential");
      var cred = firebase.auth.GoogleAuthProvider.credential(data.id_token);
      return fbAuth.signInWithCredential(cred);
    }).then(function () {
      dbg("signInWithCredential OK");
      // onAuthStateChanged takes over from here (loads habits).
    }).catch(function (e) {
      dbg("exchange/signIn ERR · " + (e && e.message ? e.message : String(e)));
      failAuth("로그인 오류: " + (e.message || e));
    });
  }

  on("sign-out-btn", function () {
    teardownListener();
    fbAuth.signOut();
  });

  on("dbg-toggle", function () {
    var el = $id("dbg-log");
    if (!el) return;
    var show = el.style.display === "none";
    el.style.display = show ? "" : "none";
    if (show) dbgRender();
  });

  function copyText(text) {
    // navigator.clipboard is often unavailable/blocked in WebView2, so fall back
    // to a temporary textarea + execCommand("copy"), which works there.
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
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
    if (user) {
      startListener(user);
    } else {
      showView("auth");
    }
  });

  fbAuth.onAuthStateChanged(function (user) {
    teardownListener();
    if (!user) {
      dbg("onAuthStateChanged · null (signed out)");
      showView("auth");
      return;
    }
    dbg("onAuthStateChanged · user=" + (user.email || user.uid));
    showView("loading");
    startListener(user);
  });

  // Prefill the OAuth config inputs from the last saved values, and auto-expand
  // the config section on first run (when no client ID has been entered yet).
  (function prefillCfg() {
    var c = readCfg();
    var idEl = $id("oauth-client-id");
    var secEl = $id("oauth-client-secret");
    if (idEl) idEl.value = c.clientId || "";
    if (secEl) secEl.value = c.clientSecret || "";
    if (!c.clientId) { var d = $id("oauth-cfg"); if (d) d.open = true; }
  })();

  // ── Firestore reader ───────────────────────────────────────────────────────
  // Mirrors fbReadSplitData() from the main app: reads the main users/{uid}
  // document (legacy blob path) and the users/{uid}/data subcollection (split
  // path for large keys), then reassembles chunked values.

  function teardownListener() {
    if (unsubSnap) { unsubSnap(); unsubSnap = null; }
  }

  function startListener(user) {
    var ref = fbDb.collection("users").doc(user.uid);
    setSyncing(true);

    // Initial load
    readAllKeys(ref)
      .then(function (keys) {
        applyData(keys);
        setSyncing(false);
        updateSyncTime();
        showView("habits");
      })
      .catch(function (e) {
        console.error("[widget] initial load:", e);
        showError("데이터를 불러오지 못했어요.\n" + (e.message || String(e)));
        setSyncing(false);
      });

    // Live updates — re-read split subcollection on every main-doc change,
    // same strategy the main app uses (onSnapshot → readAllKeys).
    unsubSnap = ref.onSnapshot(
      function () {
        setSyncing(true);
        readAllKeys(ref)
          .then(function (keys) {
            applyData(keys);
            setSyncing(false);
            updateSyncTime();
            // Stay on the habit view; don't call showView again to avoid flicker.
          })
          .catch(function (e) {
            console.warn("[widget] snapshot re-read:", e);
            setSyncing(false);
          });
      },
      function (err) {
        console.warn("[widget] onSnapshot error:", err);
      }
    );
  }

  async function readAllKeys(ref) {
    var keys = {};

    // 1. Main document (legacy blob — small keys stored inline)
    var snap = await ref.get();
    if (snap.exists && snap.data() && snap.data().keys) {
      Object.assign(keys, snap.data().keys);
    }

    // 2. Split subcollection (large keys split into chunks)
    try {
      var qs = await ref.collection("data").get();
      var chunks = {};
      qs.forEach(function (doc) {
        var d = doc.data() || {};
        var key = d.key;
        if (!key) return;
        if (d.value != null && d.part == null) {
          // Single-doc value — overrides the blob copy (fresher)
          keys[key] = d.value;
          return;
        }
        if (d.part != null) {
          if (!chunks[key]) chunks[key] = [];
          chunks[key][d.part] = d.value || "";
        }
      });
      // Reassemble chunked values
      Object.keys(chunks).forEach(function (k) {
        keys[k] = chunks[k].join("");
      });
    } catch (e) {
      // Permission error or network issue — proceed with whatever the main
      // doc gave us; degraded but still useful.
      console.warn("[widget] split read skipped:", e.message || e);
    }

    return keys;
  }

  // ── Data extraction & rendering ────────────────────────────────────────────

  function safeJson(s, fallback) {
    if (!s) return fallback;
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }

  // Last snapshot, kept so tab switches and the per-minute now-line refresh can
  // re-render without re-fetching from Firestore.
  var lastData = { habits: [], bundles: [], logs: {}, tasks: [] };

  function applyData(keys) {
    lastData = {
      habits:  safeJson(keys["routine_habits_v1"],  []),
      bundles: safeJson(keys["routine_bundles_v1"], []),
      logs:    safeJson(keys["routine_logs_v1"],    {}),
      tasks:   safeJson(keys["task_items_v1"],      [])
    };
    renderHabits(lastData.habits, lastData.bundles, lastData.logs);
    if (curTab === "timeline") renderTimeline();
  }

  // ── Tabs (해빗 / 타임블록) ───────────────────────────────────────────────────

  var curTab = "habits";

  function setTab(name) {
    curTab = name;
    var hl = $id("habit-list");
    var tl = $id("timeline-list");
    if (hl) hl.style.display = name === "habits" ? "" : "none";
    if (tl) tl.style.display = name === "timeline" ? "" : "none";
    var th = $id("tab-habits"); if (th) th.classList.toggle("active", name === "habits");
    var tt = $id("tab-timeline"); if (tt) tt.classList.toggle("active", name === "timeline");
    if (name === "timeline") renderTimeline();
  }

  on("tab-habits", function () { setTab("habits"); });
  on("tab-timeline", function () { setTab("timeline"); });

  // Keep the now-line current while the timeline is open.
  setInterval(function () { if (curTab === "timeline") renderTimeline(); }, 60000);

  // Returns "YYYY-MM-DD" in local time (same key the main app uses).
  function todayKey() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  var KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  var STATE_MARK  = { done: "✓", skip: "—", rest: "◑", "": "" };
  var STATE_CLASS = { done: "s-done", skip: "s-skip", rest: "s-rest", "": "s-none" };

  function renderHabits(habits, bundles, logs) {
    // Date label
    var dateEl = $id("today-label");
    if (dateEl) {
      var d = new Date();
      dateEl.textContent =
        (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + KO_DAYS[d.getDay()] + ")";
    }

    var list = $id("habit-list");
    if (!list) return;

    var todayLog = logs[todayKey()] || {};

    if (!habits.length) {
      list.innerHTML = '<div class="w-empty">등록된 습관이 없어요</div>';
      return;
    }

    // Index habits by id for bundle lookup
    var byId = {};
    habits.forEach(function (h) { if (h && h.id) byId[String(h.id)] = h; });

    var rendered = {};
    var html = "";

    // Bundles first (ordered)
    bundles.forEach(function (b) {
      if (!b || !Array.isArray(b.habitIds) || !b.habitIds.length) return;
      var bHabits = b.habitIds.map(function (id) { return byId[String(id)]; }).filter(Boolean);
      if (!bHabits.length) return;

      var done = bHabits.filter(function (h) {
        var st = (todayLog[h.id] || {}).state || "";
        return st === "done" || st === "skip";
      }).length;

      html += '<div class="bundle">';
      html += '<div class="bundle-hd">';
      html += '<span class="bundle-icon">' + esc(b.icon || "") + '</span>';
      html += '<span class="bundle-name">' + esc(b.title || "") + '</span>';
      html += '<span class="bundle-prog">' + done + '/' + bHabits.length + '</span>';
      html += '</div>';
      bHabits.forEach(function (h) {
        rendered[String(h.id)] = true;
        html += habitRow(h, (todayLog[h.id] || {}).state || "");
      });
      html += '</div>';
    });

    // Habits not assigned to any bundle
    var loose = habits.filter(function (h) { return h && h.id && !rendered[String(h.id)]; });
    if (loose.length) {
      html += '<div class="bundle">';
      loose.forEach(function (h) {
        html += habitRow(h, (todayLog[h.id] || {}).state || "");
      });
      html += '</div>';
    }

    list.innerHTML = html;
  }

  function habitRow(h, state) {
    var mark = STATE_MARK[state]  || "";
    var cls  = STATE_CLASS[state] || "s-none";
    return (
      '<div class="habit-row">' +
        '<span class="habit-mark ' + cls + '">' + esc(mark) + '</span>' +
        '<span class="habit-icon">' + esc(h.icon || h.emoji || "") + '</span>' +
        '<span class="habit-name">' + esc(h.title || h.name || "") + '</span>' +
      '</div>'
    );
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── Timeline (W3) ────────────────────────────────────────────────────────────
  // Read-only vertical timeline of today's timed tasks with a "now" line. Mirrors
  // the main app's notion of a timed item: a task on today's date with a timeStart
  // (HH:MM), or a deadline falling today (deadlineTime). Sorted by time, with the
  // now-line inserted between past and upcoming items.

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

  function todayTimed(tasks) {
    var TK = todayKey();
    var out = [];
    (tasks || []).forEach(function (t) {
      if (!t || t._travelOnly) return;
      var isDeadlineToday = t.deadlineDate === TK;
      var date = isDeadlineToday ? t.deadlineDate : t.date;
      if (date !== TK) return;
      var time = isDeadlineToday ? (t.deadlineTime || t.timeStart) : t.timeStart;
      var mins = parseHM(time);
      if (mins == null) return;
      out.push({
        mins: mins,
        text: t.text || t.title || "",
        done: !!t.done,
        deadline: isDeadlineToday && !t.timeStart
      });
    });
    out.sort(function (a, b) { return a.mins - b.mins; });
    return out;
  }

  function renderTimeline() {
    var list = $id("timeline-list");
    if (!list) return;
    var items = todayTimed(lastData.tasks);
    if (!items.length) {
      list.innerHTML = '<div class="w-empty">오늘 시간 일정이 없어요</div>';
      return;
    }
    var now = new Date();
    var nowMins = now.getHours() * 60 + now.getMinutes();
    var nowRow =
      '<div class="tl-now"><span class="tl-now-dot"></span>' +
      '<span class="tl-now-time">지금 ' + fmtMins(nowMins) + '</span></div>';

    var html = "";
    var placed = false;
    items.forEach(function (it) {
      if (!placed && it.mins >= nowMins) { html += nowRow; placed = true; }
      var cls = "tl-row";
      if (it.done) cls += " tl-done";
      else if (it.mins < nowMins) cls += " tl-past";
      html +=
        '<div class="' + cls + '">' +
          '<span class="tl-time">' + esc(fmtMins(it.mins)) + '</span>' +
          '<span class="tl-bar"></span>' +
          '<span class="tl-text">' + esc(it.text) +
            (it.deadline ? ' <span class="tl-tag">마감</span>' : '') +
          '</span>' +
        '</div>';
    });
    if (!placed) html += nowRow;
    list.innerHTML = html;
  }

  // ── Sync indicator ─────────────────────────────────────────────────────────

  function setSyncing(active) {
    var dot = $id("sync-dot");
    if (dot) dot.className = "w-sync-dot" + (active ? " syncing" : "");
  }

  function updateSyncTime() {
    var el = $id("sync-time");
    if (!el) return;
    var d = new Date();
    var h = String(d.getHours()).padStart(2, "0");
    var m = String(d.getMinutes()).padStart(2, "0");
    el.textContent = h + ":" + m + " 동기화됨";
  }

})();
