// Return Widget — Tauri v2 shell.
//
// W0: frameless, transparent, draggable, pinnable window (driven from the
//     frontend via the global Tauri JS API).
// W1: Firebase auth + Firestore habit reader (frontend only).
// W2: background residency — the whole point of a "PC standby widget":
//     - System tray icon: hide/show the widget, quit. Closing (×) hides to the
//       tray instead of quitting, so the widget keeps running in the background.
//     - Autostart: launch on Windows login (enabled once on first run; the user
//       can toggle it from the tray menu afterward).
//     - Window-state: remember the last position/size across restarts.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Mutex, OnceLock};

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_window_state::StateFlags;

// Frontend assets are embedded into the binary and served over http://localhost
// (see WIDGET_LOCAL_PORT) rather than the tauri:// custom scheme. Two reasons:
//   1. The OAuth loopback redirect (/oauth2callback) needs a real http origin the
//      system browser can navigate to; custom schemes can't be a redirect_uri.
//   2. "localhost" is an authorized Firebase domain, keeping signInWithCredential
//      and Firestore happy.
// (Firebase's in-WebView popup/redirect sign-in can't be used at all: it relies on
// cross-origin postMessage with firebaseapp.com, which WebView2 blocks. The widget
// instead runs OAuth in the system browser and exchanges the code for an id_token —
// see start_local_server's /oauth2* routes and src/app.js.)
const INDEX_HTML: &str = include_str!("../../src/index.html");
const APP_JS: &str = include_str!("../../src/app.js");
const STYLES_CSS: &str = include_str!("../../src/styles.css");

// Fixed port kept in sync with tauri.conf.json's window url. Windows allows
// rebinding a listener port after process exit, so a fixed port is fine here.
const WIDGET_LOCAL_PORT: u16 = 14317;

// Page shown in the system browser after the OAuth redirect lands on our local
// server. The widget itself polls /oauth2result for the code, so this page just
// reassures the user they can return to the widget.
const OAUTH_DONE_HTML: &str = "<!DOCTYPE html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>Return</title><style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e7e9ee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#9aa0aa;font-size:14px}</style></head><body><div><h1>↩ 로그인 완료</h1><p>이 창을 닫고 위젯으로 돌아가세요.</p></div></body></html>";

// Authorization codes captured from the loopback OAuth redirect, keyed by the
// `state` value the widget generated. The widget polls /oauth2result?state=…
// to pick its code up (and only its code), so concurrent/stale flows can't cross
// the streams.
static OAUTH_CODES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn oauth_codes() -> &'static Mutex<HashMap<String, String>> {
    OAUTH_CODES.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Percent-decode a query-string value (e.g. the auth code's "/" arrives as %2F).
/// Also turns '+' into a space, matching application/x-www-form-urlencoded.
fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(h), Some(l)) = (hi, lo) {
                    out.push((h * 16 + l) as u8);
                    i += 3;
                    continue;
                }
                out.push(b'%');
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Split "/path?a=1&b=2" into ("/path", {a:1, b:2}) with decoded values.
fn parse_query(raw: &str) -> (&str, HashMap<String, String>) {
    match raw.split_once('?') {
        Some((path, qs)) => {
            let mut map = HashMap::new();
            for pair in qs.split('&') {
                if let Some((k, v)) = pair.split_once('=') {
                    map.insert(k.to_string(), url_decode(v));
                }
            }
            (path, map)
        }
        None => (raw, HashMap::new()),
    }
}

/// JSON-encode a token string for the tiny /oauth2result response. Auth codes are
/// ASCII (letters, digits, -._/~), so only quotes/backslashes need escaping.
fn json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Minimal embedded static file server for the three frontend assets. Runs on a
/// background thread for the life of the process. Localhost-only, one tiny
/// personal client — a hand-rolled HTTP/1.1 responder is enough (no deps).
fn start_local_server() {
    let listener = match TcpListener::bind(("127.0.0.1", WIDGET_LOCAL_PORT)) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[widget] local server bind failed on {WIDGET_LOCAL_PORT}: {e}");
            return;
        }
    };
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let mut s = match stream {
                Ok(s) => s,
                Err(_) => continue,
            };
            let mut buf = [0u8; 2048];
            let n = s.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]);
            // "GET /path?query HTTP/1.1" → take the request-target token, split.
            let raw = req.split_whitespace().nth(1).unwrap_or("/");
            let (path, query) = parse_query(raw);

            // content_type is borrowed/static; body may be static or owned, so
            // hold it as a Cow-like String to unify both branches.
            let (content_type, body): (&str, String) = match path {
                "/app.js" => ("application/javascript; charset=utf-8", APP_JS.to_string()),
                "/styles.css" => ("text/css; charset=utf-8", STYLES_CSS.to_string()),
                // Loopback OAuth redirect target — the system browser lands here
                // after Google sign-in with ?code=…&state=…. Stash the code for
                // the widget to poll, then show a "done" page in the browser.
                "/oauth2callback" => {
                    if let (Some(state), Some(code)) = (query.get("state"), query.get("code")) {
                        if let Ok(mut map) = oauth_codes().lock() {
                            map.insert(state.clone(), code.clone());
                        }
                    }
                    ("text/html; charset=utf-8", OAUTH_DONE_HTML.to_string())
                }
                // The widget polls this (same-origin) until its code shows up.
                "/oauth2result" => {
                    let code = query
                        .get("state")
                        .and_then(|st| oauth_codes().lock().ok().and_then(|mut m| m.remove(st)));
                    let json = match code {
                        Some(c) => format!("{{\"code\":{}}}", json_string(&c)),
                        None => "{}".to_string(),
                    };
                    ("application/json; charset=utf-8", json)
                }
                _ => ("text/html; charset=utf-8", INDEX_HTML.to_string()),
            };
            let resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}",
                content_type,
                body.len(),
                body
            );
            let _ = s.write_all(resp.as_bytes());
            let _ = s.flush();
        }
    });
}

/// Toggle the main widget window between shown and hidden.
fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// Bring the main widget window to the foreground (used by tray "show").
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Start the localhost asset server BEFORE the window loads, so the window's
    // configured url (http://localhost:WIDGET_LOCAL_PORT) resolves immediately.
    start_local_server();

    tauri::Builder::default()
        // Remember only position + size. NOT visibility — otherwise quitting
        // while hidden-to-tray would relaunch hidden, leaving the user with a
        // blank desktop and no obvious window.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
                .build(),
        )
        // Autostart registers a Windows login launcher. No extra CLI args.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // opener: lets the frontend open the Google sign-in URL in the real
        // system browser (auth can't complete inside WebView2).
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            // Enable autostart once, on the very first run. After that, respect
            // whatever the user has chosen (toggleable from the tray menu), so
            // we never fight a deliberate "off". First run is detected by a
            // sentinel file in the app config dir.
            let autostart = handle.autolaunch();
            let first_run = match app.path().app_config_dir() {
                Ok(dir) => {
                    let sentinel = dir.join(".autostart_init");
                    if sentinel.exists() {
                        false
                    } else {
                        let _ = std::fs::create_dir_all(&dir);
                        let _ = std::fs::write(&sentinel, b"1");
                        true
                    }
                }
                Err(_) => false,
            };
            if first_run {
                let _ = autostart.enable();
            }

            // ── Tray menu ──────────────────────────────────────────────────
            let is_auto = autostart.is_enabled().unwrap_or(false);
            let show_item =
                MenuItem::with_id(app, "show", "위젯 보기 / 숨기기", true, None::<&str>)?;
            let auto_item = CheckMenuItem::with_id(
                app,
                "autostart",
                "Windows 시작 시 자동 실행",
                true,
                is_auto,
                None::<&str>,
            )?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &auto_item, &sep, &quit_item])?;

            // Clone the check item so the menu handler can update its tick.
            let auto_item_handle = auto_item.clone();

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Return 위젯")
                .menu(&menu)
                // Left-click on the icon toggles the window; the menu opens on
                // right-click so a single click feels like a real widget.
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => toggle_main_window(app),
                    "autostart" => {
                        let mgr = app.autolaunch();
                        let enabled = mgr.is_enabled().unwrap_or(false);
                        if enabled {
                            let _ = mgr.disable();
                        } else {
                            let _ = mgr.enable();
                        }
                        let _ = auto_item_handle.set_checked(!enabled);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        // Closing (×) hides to the tray instead of quitting, so the widget
        // stays resident. Real quit is via the tray menu's "종료".
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the Return widget");
}
