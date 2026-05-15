use rand::Rng;
use tauri::AppHandle;
use tauri::webview::WebviewWindow;
use tauri::LogicalPosition;

pub fn random_position(app: &AppHandle) -> (i32, i32) {
    let monitor = app.primary_monitor().ok().flatten();
    if let Some(m) = monitor {
        let size = m.size();
        let width = size.width as i32;
        let height = size.height as i32;
        let pet_width = 200;
        let pet_height = 260;
        let margin = 100;
        let mut rng = rand::thread_rng();
        let x = margin + rng.gen_range(0..(width - pet_width - margin * 2).max(1));
        let y = margin + rng.gen_range(0..(height - pet_height - margin * 2).max(1));
        return (x, y);
    }
    (100, 100)
}

pub fn center_window(window: &WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let window_size = window.outer_size().unwrap_or_default();
        let x = (size.width as i32 - window_size.width as i32) / 2;
        let y = (size.height as i32 - window_size.height as i32) / 2;
        let _ = window.set_position(LogicalPosition::new(x, y));
    }
}
