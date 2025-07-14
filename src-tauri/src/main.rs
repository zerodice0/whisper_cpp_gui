#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod models;
mod services;
mod utils;

use commands::*;
use services::{WhisperService, HistoryService};
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    let whisper_service = Arc::new(Mutex::new(WhisperService::new()));
    let history_service = Arc::new(Mutex::new(HistoryService::new()));

    tauri::Builder::default()
        .manage(whisper_service)
        .manage(history_service)
        .invoke_handler(tauri::generate_handler![
            greet,
            check_whisper_installation,
            setup_whisper,
            check_system_requirements,
            list_available_models,
            list_downloaded_models,
            download_model,
            delete_model,
            start_transcription,
            read_transcription_result,
            export_to_srt,
            export_to_fcpxml,
            get_whisper_options,
            start_transcription_with_options,
            download_model_with_progress,
            // 히스토리 관련 명령들
            list_transcription_history,
            get_transcription_history,
            delete_transcription_history,
            update_history_tags,
            update_history_notes,
            download_result_file,
            get_result_file_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}