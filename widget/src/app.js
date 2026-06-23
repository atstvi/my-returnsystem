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
  var ALL_VIEWS = ["loading", "auth", "habits", "timeline", "error"];

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
        showView(VIEW_MODE === "timeline" ? "timeline" : "habits");
      })
      .catch(function (e) {
        console.error("[widget] initial load:", e);
        showError("데이터를 불러오지 못했어요.\n" + (e.message || String(e)));
        setSyncing(false);
      });

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

  function applyData(keys) {
    lastData = {
      habits:  safeJson(keys["routine_habits_v1"],  []),
      bundles: safeJson(keys["routine_bundles_v1"], []),
      logs:    safeJson(keys["routine_logs_v1"],    {}),
      tasks:   safeJson(keys["task_items_v1"],      [])
    };
    if (VIEW_MODE === "timeline") {
      renderTimelineBlocks();
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

    bundles.forEach(function (b) {
      if (!b || !Array.isArray(b.habitIds) || !b.habitIds.length) return;
      var bHabits = b.habitIds.map(function (id) { return byId[String(id)]; }).filter(Boolean);
      if (!bHabits.length) return;
      var done = bHabits.filter(function (h) {
        var st = (todayLog[h.id] || {}).state || "";
        return st === "done" || st === "skip";
      }).length;
      html += '<div class="bundle"><div class="bundle-hd">';
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

    var loose = habits.filter(function (h) { return h && h.id && !rendered[String(h.id)]; });
    if (loose.length) {
      html += '<div class="bundle">';
      loose.forEach(function (h) { html += habitRow(h, (todayLog[h.id] || {}).state || ""); });
      html += '</div>';
    }
    list.innerHTML = html;
  }

  function habitRow(h, state) {
    var mark = STATE_MARK[state] || "";
    var cls  = STATE_CLASS[state] || "s-none";
    return '<div class="habit-row">' +
      '<span class="habit-mark ' + cls + '">' + esc(mark) + '</span>' +
      '<span class="habit-icon">' + esc(h.icon || h.emoji || "") + '</span>' +
      '<span class="habit-name">' + esc(h.title || h.name || "") + '</span>' +
      '</div>';
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      // Column positioning within the block zone (right of the label column)
      var colW   = (100 - 0) / numCols;  // each column is 1/numCols of the block zone
      var leftPct  = it.col * colW;
      var widthPct = colW;

      var cls = "tb-block";
      if (it.done)                                 cls += " tb-block-done";
      else if (it.endMins <= nm)                   cls += " tb-block-past";
      else if (it.startMins <= nm && nm < it.endMins) cls += " tb-block-now";

      // left/width expressed via CSS calc so they respond to window resize.
      // Block zone spans from TB_LABEL_W+2 px to right-4px.
      var zoneStart = (TB_LABEL_W + 2) + "px";
      var zoneEnd   = "4px";
      var left  = "calc(" + zoneStart + " + " + leftPct  + "% * (100% - " + zoneStart + " - " + zoneEnd + ") / 100)";
      var width = "calc(" + widthPct  + "% * (100% - " + zoneStart + " - " + zoneEnd + ") / 100 - 2px)";

      html += '<div class="' + cls + '" style="top:' + top + 'px;height:' + height + 'px;left:' + left + ';width:' + width + '">';
      html += '<div class="tb-block-title">' + esc(it.text);
      if (it.deadline) html += ' <span class="tb-tag">마감</span>';
      html += '</div>';
      if (height >= 34) {
        html += '<div class="tb-block-time">' + fmtMins(it.startMins) + '–' + fmtMins(it.endMins) + '</div>';
      }
      html += '</div>';
    });

    // Now-line
    if (nm >= TB_START_HOUR * 60 && nm <= TB_END_HOUR * 60) {
      var nowTop = (nm - TB_START_HOUR * 60) * pxPerMin;
      html += '<div class="tb-now-line" style="top:' + nowTop + 'px">'
        + '<div class="tb-now-dot"></div>'
        + '</div>';
    }

    grid.style.height = totalH + "px";
    grid.innerHTML = html;

    // Scroll so now-line is roughly 1/3 from the top
    if (nm >= TB_START_HOUR * 60 && nm <= TB_END_HOUR * 60) {
      var scroll = $id("tb-scroll");
      if (scroll) {
        var nowTop = (nm - TB_START_HOUR * 60) * pxPerMin;
        scroll.scrollTop = Math.max(0, nowTop - scroll.clientHeight / 3);
      }
    }
  }

  // Refresh now-line every minute while the timeline window is active.
  setInterval(function () {
    if (VIEW_MODE === "timeline") renderTimelineBlocks();
  }, 60000);

  // ── Sync indicator ─────────────────────────────────────────────────────────
  function setSyncing(active) {
    var id  = VIEW_MODE === "timeline" ? "tbl-sync-dot" : "sync-dot";
    var dot = $id(id);
    if (dot) dot.className = "w-sync-dot" + (active ? " syncing" : "");
  }

  function updateSyncTime() {
    var id = VIEW_MODE === "timeline" ? "tbl-sync-time" : "sync-time";
    var el = $id(id);
    if (!el) return;
    var d = new Date();
    el.textContent = String(d.getHours()).padStart(2, "0") + ":" +
                     String(d.getMinutes()).padStart(2, "0") + " 동기화됨";
  }

})();
