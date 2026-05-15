mod config;
mod window_manager;

use config::{load_config, save_config, Config};
use tauri::Manager;
use tauri::webview::WebviewWindow;

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> Config {
    load_config(&app)
}

#[tauri::command]
fn set_config(app: tauri::AppHandle, config: Config) {
    save_config(&app, &config);
}

#[tauri::command]
fn center_pet(window: WebviewWindow) {
    window_manager::center_window(&window);
}

#[tauri::command]
fn show_pet(window: WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn hide_pet(window: WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
        .setup(|app| {
            let handle = app.handle();

            // Set activation policy to Accessory on macOS (no dock icon)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Show the main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            set_config,
            center_pet,
            show_pet,
            hide_pet,
            quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
