#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod models;
mod services;
mod utils;

use commands::*;
use services::WhisperService;
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    let whisper_service = Arc::new(Mutex::new(WhisperService::new()));

    tauri::Builder::default()
        .manage(whisper_service)
        .invoke_handler(tauri::generate_handler![
            greet,
            check_whisper_installation,
            setup_whisper,
            check_system_requirements,
            list_available_models,
            list_downloaded_models,
            download_model,
            start_transcription,
            read_transcription_result,
            export_to_srt,
            export_to_fcpxml
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}