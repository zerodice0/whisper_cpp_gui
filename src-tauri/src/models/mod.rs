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