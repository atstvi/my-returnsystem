// Return Widget — Tauri v2 shell.
//
// W0 scope: a frameless, transparent, draggable window that can pin itself
// always-on-top. The pin toggle and drag are driven from the frontend via the
// global Tauri JS API (`withGlobalTauri: true`) using the window ACL
// permissions granted in `capabilities/default.json` — so no custom commands
// are needed yet. Data wiring (Firebase) lands in W1.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Return widget");
}
