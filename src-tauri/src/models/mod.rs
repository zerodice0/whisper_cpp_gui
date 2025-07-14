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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub file_path: PathBuf,
    pub format: String,         // "txt", "srt", "vtt", "csv", "json", "lrc"
    pub file_size: u64,         // 파일 크기 (bytes)
    pub created_at: String,     // ISO 8601 timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionHistory {
    pub id: String,                         // 고유 ID (UUID)
    pub original_file_name: String,         // 원본 파일명
    pub original_file_path: PathBuf,        // 원본 파일 경로
    pub model_used: String,                 // 사용된 모델
    pub options_used: std::collections::HashMap<String, String>, // 사용된 옵션들
    pub results: Vec<TranscriptionResult>,  // 생성된 결과 파일들
    pub status: TranscriptionStatus,        // 변환 상태
    pub created_at: String,                 // 변환 시작 시간 (ISO 8601)
    pub completed_at: Option<String>,       // 변환 완료 시간 (ISO 8601)
    pub duration_seconds: Option<f64>,      // 변환 소요 시간 (초)
    pub tags: Vec<String>,                  // 사용자 태그들
    pub notes: Option<String>,              // 사용자 메모
    pub error_message: Option<String>,      // 실패 시 에러 메시지
}

impl TranscriptionHistory {
    pub fn new(
        original_file_name: String,
        original_file_path: PathBuf,
        model_used: String,
        options_used: std::collections::HashMap<String, String>,
    ) -> Self {
        use uuid::Uuid;
        use chrono::Utc;
        
        Self {
            id: Uuid::new_v4().to_string(),
            original_file_name,
            original_file_path,
            model_used,
            options_used,
            results: Vec::new(),
            status: TranscriptionStatus::Running,
            created_at: Utc::now().to_rfc3339(),
            completed_at: None,
            duration_seconds: None,
            tags: Vec::new(),
            notes: None,
            error_message: None,
        }
    }
    
    pub fn mark_completed(mut self) -> Self {
        use chrono::{DateTime, Utc};
        
        self.status = TranscriptionStatus::Completed;
        let now = Utc::now();
        self.completed_at = Some(now.to_rfc3339());
        
        // 소요 시간 계산
        if let Ok(created) = DateTime::parse_from_rfc3339(&self.created_at) {
            let duration = now.signed_duration_since(created.with_timezone(&Utc));
            self.duration_seconds = Some(duration.num_milliseconds() as f64 / 1000.0);
        }
        
        self
    }
    
    pub fn mark_failed(mut self, error_message: String) -> Self {
        use chrono::Utc;
        
        self.status = TranscriptionStatus::Failed;
        self.completed_at = Some(Utc::now().to_rfc3339());
        self.error_message = Some(error_message);
        self
    }
    
    pub fn add_result(mut self, result: TranscriptionResult) -> Self {
        self.results.push(result);
        self
    }
    
    pub fn total_file_size(&self) -> u64 {
        self.results.iter().map(|r| r.file_size).sum()
    }
    
    pub fn get_formats(&self) -> Vec<String> {
        self.results.iter().map(|r| r.format.clone()).collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub search: Option<String>,      // 파일명 검색
    pub model_filter: Option<String>, // 모델별 필터
    pub format_filter: Option<String>, // 형식별 필터
    pub tag_filter: Option<String>,   // 태그별 필터
    pub status_filter: Option<TranscriptionStatus>, // 상태별 필터
    pub date_from: Option<String>,    // 시작 날짜 (ISO 8601)
    pub date_to: Option<String>,      // 종료 날짜 (ISO 8601)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryListResponse {
    pub items: Vec<TranscriptionHistory>,
    pub total_count: usize,
    pub has_more: bool,
}