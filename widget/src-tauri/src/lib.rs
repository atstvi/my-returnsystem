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
// W3 (multi-window): two independent windows — "habits" and "timeline" — each
//     with its own tray toggle and block-style calendar view.

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
const INDEX_HTML: &str = include_str!("../../src/index.html");
const APP_JS: &str = include_str!("../../src/app.js");
const STYLES_CSS: &str = include_str!("../../src/styles.css");

const WIDGET_LOCAL_PORT: u16 = 14317;

const OAUTH_DONE_HTML: &str = "<!DOCTYPE html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>Return</title><style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e7e9ee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#9aa0aa;font-size:14px}</style></head><body><div><h1>↩ 로그인 완료</h1><p>이 창을 닫고 위젯으로 돌아가세요.</p></div></body></html>";

static OAUTH_CODES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn oauth_codes() -> &'static Mutex<HashMap<String, String>> {
    OAUTH_CODES.get_or_init(|| Mutex::new(HashMap::new()))
}

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
            let raw = req.split_whitespace().nth(1).unwrap_or("/");
            let (path, query) = parse_query(raw);

            let (content_type, body): (&str, String) = match path {
                "/app.js" => ("application/javascript; charset=utf-8", APP_JS.to_string()),
                "/styles.css" => ("text/css; charset=utf-8", STYLES_CSS.to_string()),
                "/oauth2callback" => {
                    if let (Some(state), Some(code)) = (query.get("state"), query.get("code")) {
                        if let Ok(mut map) = oauth_codes().lock() {
                            map.insert(state.clone(), code.clone());
                        }
                    }
                    ("text/html; charset=utf-8", OAUTH_DONE_HTML.to_string())
                }
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

fn toggle_window(app: &tauri::AppHandle, label: &str) {
    if let Some(win) = app.get_webview_window(label) {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn show_window(app: &tauri::AppHandle, label: &str) {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    start_local_server();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

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
            let habits_item =
                MenuItem::with_id(app, "habits-show", "↩ 해빗 위젯", true, None::<&str>)?;
            let timeline_item =
                MenuItem::with_id(app, "timeline-show", "⏱ 타임블록 위젯", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let auto_item = CheckMenuItem::with_id(
                app,
                "autostart",
                "Windows 시작 시 자동 실행",
                true,
                is_auto,
                None::<&str>,
            )?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&habits_item, &timeline_item, &sep1, &auto_item, &sep2, &quit_item],
            )?;

            let auto_item_handle = auto_item.clone();

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Return 위젯")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "habits-show"   => toggle_window(app, "habits"),
                    "timeline-show" => toggle_window(app, "timeline"),
                    "autostart" => {
                        let mgr = app.autolaunch();
                        let enabled = mgr.is_enabled().unwrap_or(false);
                        if enabled { let _ = mgr.disable(); } else { let _ = mgr.enable(); }
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
                        show_window(tray.app_handle(), "habits");
                        show_window(tray.app_handle(), "timeline");
                    }
                })
                .build(app)?;

            Ok(())
        })
        // CloseRequested hides any window to the tray. Applies to all windows.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the Return widget");
}
