use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    pub sleep_image: Option<String>,
    pub rest_image: Option<String>,
    pub tray_icon: Option<String>,
    pub app_icon: Option<String>,
    pub greeting_text: Option<String>,
    pub saved_position: Option<Position>,
}

pub fn config_path(data_dir: &PathBuf) -> PathBuf {
    data_dir.join("config.json")
}

pub fn load_config(data_dir: &PathBuf) -> Config {
    let path = config_path(data_dir);
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

pub fn save_config(data_dir: &PathBuf, config: &Config) {
    let path = config_path(data_dir);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = fs::write(&path, json);
    }
}
