mod config;
mod window_manager;

use config::{load_config, save_config, Config};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri::webview::WebviewWindow;

pub struct AppState {
    pub config: Mutex<Config>,
    pub data_dir: PathBuf,
}

#[tauri::command]
fn get_config(state: tauri::State<'_, AppState>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn set_config(state: tauri::State<'_, AppState>, config: Config) {
    let mut guard = state.config.lock().unwrap();
    *guard = config.clone();
    save_config(&state.data_dir, &config);
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
            // Set activation policy to Accessory on macOS (no dock icon)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Get app data dir and load config
            let data_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            let config = load_config(&data_dir);

            app.manage(AppState {
                config: Mutex::new(config),
                data_dir,
            });

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
