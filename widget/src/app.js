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

  // Persist auth across restarts (IndexedDB-backed by Firebase SDK).
  fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});

  // ── Auth ───────────────────────────────────────────────────────────────────

  var unsubSnap = null; // Firestore onSnapshot unsubscribe handle

  on("sign-in-btn", function () {
    var errEl = $id("auth-err");
    if (errEl) errEl.textContent = "";
    var provider = new firebase.auth.GoogleAuthProvider();
    fbAuth.signInWithPopup(provider).catch(function (e) {
      if (errEl) errEl.textContent = "로그인 실패: " + (e.message || String(e));
    });
  });

  on("sign-out-btn", function () {
    teardownListener();
    fbAuth.signOut();
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
      showView("auth");
      return;
    }
    showView("loading");
    startListener(user);
  });

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

  function applyData(keys) {
    var habits  = safeJson(keys["routine_habits_v1"],  []);
    var bundles = safeJson(keys["routine_bundles_v1"], []);
    var logs    = safeJson(keys["routine_logs_v1"],    {});
    renderHabits(habits, bundles, logs);
  }

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
