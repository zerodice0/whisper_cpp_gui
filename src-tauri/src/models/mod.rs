use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TranscriptionStatus {
    Idle,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionState {
    pub file_path: Option<PathBuf>,
    pub status: TranscriptionStatus,
    pub progress: f32,
    pub logs: Vec<String>,
    pub result: Option<String>,
}

impl TranscriptionState {
    pub fn new() -> Self {
        Self {
            file_path: None,
            status: TranscriptionStatus::Idle,
            progress: 0.0,
            logs: Vec::new(),
            result: None,
        }
    }

    pub fn with_progress(mut self, progress: f32) -> Self {
        self.progress = progress.max(0.0).min(1.0);
        self
    }

    pub fn with_status(mut self, status: TranscriptionStatus) -> Self {
        self.status = status;
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressInfo {
    pub progress: f32,
    pub current_time: Option<f32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WhisperOptionType {
    Flag,           // --flag
    String,         // --option value
    Integer,        // --threads 4
    Float,          // --duration 10.5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperOption {
    pub name: String,
    pub short_name: Option<String>,
    pub description: String,
    pub option_type: WhisperOptionType,
    pub default_value: Option<String>,
    pub possible_values: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperOptions {
    pub options: Vec<WhisperOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperConfig {
    pub model: String,
    pub input_file: String,
    pub options: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub model_name: String,
    pub progress: f32,          // 0.0 ~ 1.0
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub download_speed: Option<String>,
    pub eta: Option<String>,
    pub status: DownloadStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DownloadStatus {
    Starting,
    Downloading,
    Completed,
    Failed,
    Cancelled,
}