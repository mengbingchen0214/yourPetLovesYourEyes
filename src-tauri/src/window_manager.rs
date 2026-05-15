use tauri::webview::WebviewWindow;
use tauri::LogicalPosition;

pub fn center_window(window: &WebviewWindow) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let msize = monitor.size();
        if let Ok(wsize) = window.outer_size() {
            let x = (msize.width as i32 - wsize.width as i32) / 2;
            let y = (msize.height as i32 - wsize.height as i32) / 2;
            let _ = window.set_position(LogicalPosition::new(x, y));
        }
    }
}
