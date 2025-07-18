use tauri::{State, AppHandle};
use crate::models::*;
use crate::services::*;
use std::sync::Arc;
use tokio::sync::Mutex;

type WhisperServiceState = Arc<Mutex<WhisperService>>;
type HistoryServiceState = Arc<Mutex<HistoryService>>;

#[tauri::command]
pub async fn greet(name: &str) -> Result<String, String> {
    Ok(format!("Hello, {}! You've been greeted from Rust!", name))
}

#[tauri::command]
pub async fn check_whisper_installation(
    service: State<'_, WhisperServiceState>
) -> Result<bool, String> {
    let service = service.lock().await;
    service.check_whisper_installation().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn setup_whisper(
    app_handle: AppHandle,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.setup_whisper(Some(app_handle)).await
        .map_err(|e| {
            eprintln!("Setup whisper error: {:?}", e);
            format!("설치 오류: {}", e)
        })
}

#[tauri::command]
pub async fn check_system_requirements() -> Result<String, String> {
    let mut requirements = Vec::new();
    
    // Git 확인
    match tokio::process::Command::new("git").arg("--version").output().await {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout);
            requirements.push(format!("✅ Git 설치됨: {}", version.lines().next().unwrap_or("").trim()));
        }
        _ => {
            requirements.push("❌ Git이 설치되지 않음".to_string());
        }
    }
    
    // Make 확인
    match tokio::process::Command::new("make").arg("--version").output().await {
        Ok(output) if output.status.success() => {
            requirements.push("✅ Make 설치됨".to_string());
        }
        _ => {
            requirements.push("❌ Make가 설치되지 않음".to_string());
        }
    }
    
    // C++ 컴파일러 확인
    let mut compiler_found = false;
    for compiler in &["clang++", "g++", "cc"] {
        if let Ok(output) = tokio::process::Command::new(compiler).arg("--version").output().await {
            if output.status.success() {
                requirements.push(format!("✅ C++ 컴파일러 발견: {}", compiler));
                compiler_found = true;
                break;
            }
        }
    }
    
    if !compiler_found {
        requirements.push("❌ C++ 컴파일러가 설치되지 않음".to_string());
    }
    
    Ok(requirements.join("\n"))
}

#[tauri::command]
pub async fn list_available_models(
    service: State<'_, WhisperServiceState>
) -> Result<Vec<String>, String> {
    let service = service.lock().await;
    service.list_available_models().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_downloaded_models(
    service: State<'_, WhisperServiceState>
) -> Result<Vec<String>, String> {
    let service = service.lock().await;
    service.list_downloaded_models().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_model(
    model_name: String,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.download_official_model(&model_name).await
        .map_err(|e| e.to_string())?;
    Ok(format!("Model {} downloaded successfully", model_name))
}

#[tauri::command]
pub async fn start_transcription(
    file_path: String,
    model_name: String,
    app_handle: AppHandle,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.start_transcription_with_streaming(&file_path, &model_name, app_handle).await
        .map_err(|e| e.to_string())?;
    Ok("Transcription started".to_string())
}

#[tauri::command]
pub async fn read_transcription_result(
    file_path: String,
    service: State<'_, WhisperServiceState>
) -> Result<Option<String>, String> {
    let service = service.lock().await;
    service.read_transcription_result(&file_path).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_to_srt(
    transcription: String,
    output_path: String,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.export_to_srt(&transcription, &output_path).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_to_fcpxml(
    transcription: String,
    output_path: String,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.export_to_fcpxml(&transcription, &output_path).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_whisper_options(
    service: State<'_, WhisperServiceState>
) -> Result<WhisperOptions, String> {
    let service = service.lock().await;
    service.get_whisper_options().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_transcription_with_options(
    config: WhisperConfig,
    app_handle: AppHandle,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    let history_id = service.start_transcription_with_options(&config, app_handle).await
        .map_err(|e| e.to_string())?;
    Ok(history_id)
}

#[tauri::command]
pub async fn download_model_with_progress(
    model_name: String,
    app_handle: AppHandle,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.download_model_with_progress(&model_name, app_handle).await
        .map_err(|e| e.to_string())?;
    Ok(format!("Model {} download started", model_name))
}

#[tauri::command]
pub async fn delete_model(
    model_name: String,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.delete_model(&model_name).await
        .map_err(|e| e.to_string())?;
    Ok(format!("Model {} deleted successfully", model_name))
}

#[tauri::command]
pub async fn validate_model(
    model_name: String,
    service: State<'_, WhisperServiceState>
) -> Result<bool, String> {
    let service = service.lock().await;
    service.validate_model(&model_name).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn repair_model(
    model_name: String,
    service: State<'_, WhisperServiceState>
) -> Result<String, String> {
    let service = service.lock().await;
    service.repair_model(&model_name).await
        .map_err(|e| e.to_string())?;
    Ok(format!("Model {} repaired successfully", model_name))
}

// ===== 히스토리 관련 명령들 =====

#[tauri::command]
pub async fn list_transcription_history(
    query: HistoryQuery,
    history_service: State<'_, HistoryServiceState>
) -> Result<HistoryListResponse, String> {
    let service = history_service.lock().await;
    service.list_history(query).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_transcription_history(
    history_id: String,
    history_service: State<'_, HistoryServiceState>
) -> Result<TranscriptionHistory, String> {
    let service = history_service.lock().await;
    service.get_history(&history_id).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_transcription_history(
    history_id: String,
    history_service: State<'_, HistoryServiceState>
) -> Result<String, String> {
    let service = history_service.lock().await;
    service.delete_history(&history_id).await
        .map_err(|e| e.to_string())?;
    Ok(format!("History {} deleted successfully", history_id))
}

#[tauri::command]
pub async fn update_history_tags(
    history_id: String,
    tags: Vec<String>,
    history_service: State<'_, HistoryServiceState>
) -> Result<TranscriptionHistory, String> {
    let service = history_service.lock().await;
    service.update_history_tags(&history_id, tags).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_history_notes(
    history_id: String,
    notes: Option<String>,
    history_service: State<'_, HistoryServiceState>
) -> Result<TranscriptionHistory, String> {
    let service = history_service.lock().await;
    service.update_history_notes(&history_id, notes).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_result_file(
    history_id: String,
    format: String,
    save_path: String,
    history_service: State<'_, HistoryServiceState>
) -> Result<String, String> {
    let service = history_service.lock().await;
    let source_path = service.get_result_file_path(&history_id, &format);
    
    if !source_path.exists() {
        return Err(format!("Result file not found: {}", format));
    }
    
    tokio::fs::copy(&source_path, &save_path).await
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    
    Ok(format!("File downloaded to: {}", save_path))
}

#[tauri::command]
pub async fn get_result_file_info(
    history_id: String,
    history_service: State<'_, HistoryServiceState>
) -> Result<Vec<TranscriptionResult>, String> {
    let service = history_service.lock().await;
    let history = service.get_history(&history_id).await
        .map_err(|e| e.to_string())?;
    
    Ok(history.results)
}