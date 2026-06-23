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

use std::io::{Read, Write};
use std::net::TcpListener;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_window_state::StateFlags;

// Frontend assets are embedded into the binary and served over http://localhost
// (see WIDGET_LOCAL_PORT). This is required for Firebase auth: signInWithRedirect
// returns to the app's origin via the firebaseapp.com auth handler, and that
// handler can only redirect back to an http(s) origin — never a custom scheme
// like tauri://localhost. "localhost" is also already an authorized domain in
// Firebase Auth, so the redirect round-trip completes. Serving from the tauri://
// scheme made auth silently fail (login never returned to the widget).
const INDEX_HTML: &str = include_str!("../../src/index.html");
const APP_JS: &str = include_str!("../../src/app.js");
const STYLES_CSS: &str = include_str!("../../src/styles.css");

// Fixed port kept in sync with tauri.conf.json's window url. Windows allows
// rebinding a listener port after process exit, so a fixed port is fine here.
const WIDGET_LOCAL_PORT: u16 = 14317;

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
            // "GET /path HTTP/1.1" → take the path token.
            let path = req.split_whitespace().nth(1).unwrap_or("/");
            let (content_type, body) = match path {
                "/app.js" => ("application/javascript; charset=utf-8", APP_JS),
                "/styles.css" => ("text/css; charset=utf-8", STYLES_CSS),
                _ => ("text/html; charset=utf-8", INDEX_HTML),
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
