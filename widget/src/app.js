// Return Widget frontend — W0.
//
// Uses the global Tauri API (config: app.withGlobalTauri = true) so the widget
// frontend stays buildless, matching the web app's no-bundler ethos. When this
// file is opened in a plain browser (no Tauri), the window controls degrade to
// no-ops so the layout can still be previewed.

(function () {
  "use strict";

  var TAURI = window.__TAURI__;
  var hasTauri = !!(TAURI && TAURI.window && typeof TAURI.window.getCurrentWindow === "function");

  var pinBtn = document.getElementById("pin-btn");
  var minBtn = document.getElementById("min-btn");
  var closeBtn = document.getElementById("close-btn");
  var envNote = document.getElementById("env-note");

  if (!hasTauri) {
    // Browser preview mode — controls do nothing, but make it obvious.
    if (envNote) envNote.textContent = "브라우저 미리보기 (Tauri 밖)";
    return;
  }

  var appWindow = TAURI.window.getCurrentWindow();
  var pinned = false;

  pinBtn.addEventListener("click", function () {
    pinned = !pinned;
    appWindow
      .setAlwaysOnTop(pinned)
      .then(function () {
        pinBtn.classList.toggle("pinned", pinned);
        pinBtn.title = pinned ? "고정 해제" : "항상 위에 고정";
      })
      .catch(function (e) {
        console.error("[widget] setAlwaysOnTop failed:", e);
        pinned = !pinned; // revert optimistic toggle
      });
  });

  minBtn.addEventListener("click", function () {
    appWindow.minimize().catch(function (e) {
      console.error("[widget] minimize failed:", e);
    });
  });

  closeBtn.addEventListener("click", function () {
    appWindow.close().catch(function (e) {
      console.error("[widget] close failed:", e);
    });
  });
})();
