use std::path::PathBuf;
use anyhow::Result;
use serde_json;
use crate::models::*;

/// 변환 히스토리 관리 서비스
/// 
/// 디렉토리 구조:
/// ~/.whisper-gui/
/// ├── whisper.cpp/          # 기존 whisper.cpp 저장소
/// ├── models/               # 기존 모델 파일들
/// ├── results/              # 변환 결과 저장소
/// │   ├── <uuid-1>/
/// │   │   ├── files/
/// │   │   │   ├── result.txt
/// │   │   │   ├── result.srt
/// │   │   │   └── result.vtt
/// │   │   └── metadata.json # TranscriptionHistory 정보
/// │   ├── <uuid-2>/
/// │   └── <uuid-3>/
/// └── history.json          # 모든 히스토리 인덱스 (빠른 조회용)
#[derive(Clone)]
pub struct HistoryService {
    pub whisper_gui_dir: PathBuf,
    pub results_dir: PathBuf,
    pub history_index_file: PathBuf,
}

impl HistoryService {
    pub fn new() -> Self {
        let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let whisper_gui_dir = home_dir.join(".whisper-gui");
        let results_dir = whisper_gui_dir.join("results");
        let history_index_file = whisper_gui_dir.join("history.json");
        
        Self {
            whisper_gui_dir,
            results_dir,
            history_index_file,
        }
    }
    
    /// 필요한 디렉토리들을 생성합니다
    pub async fn ensure_directories(&self) -> Result<()> {
        tokio::fs::create_dir_all(&self.results_dir).await?;
        Ok(())
    }
    
    /// 새로운 변환 히스토리를 생성하고 디렉토리를 만듭니다
    pub async fn create_history_entry(
        &self,
        original_file_name: String,
        original_file_path: PathBuf,
        model_used: String,
        options_used: std::collections::HashMap<String, String>,
    ) -> Result<TranscriptionHistory> {
        self.ensure_directories().await?;
        
        let history = TranscriptionHistory::new(
            original_file_name,
            original_file_path,
            model_used,
            options_used,
        );
        
        // 히스토리별 디렉토리 생성
        let history_dir = self.get_history_directory(&history.id);
        let files_dir = history_dir.join("files");
        
        tokio::fs::create_dir_all(&files_dir).await?;
        
        // 메타데이터 저장
        self.save_history_metadata(&history).await?;
        
        // 히스토리 인덱스 업데이트
        self.update_history_index(&history).await?;
        
        Ok(history)
    }
    
    /// 변환 완료 시 결과 파일들을 히스토리에 추가합니다
    pub async fn add_transcription_results(
        &self,
        history_id: &str,
        result_files: Vec<(PathBuf, String)>, // (파일 경로, 형식)
    ) -> Result<TranscriptionHistory> {
        let mut history = self.load_history_metadata(history_id).await?;
        let files_dir = self.get_history_directory(history_id).join("files");
        
        for (source_path, format) in result_files {
            if source_path.exists() {
                // 파일을 히스토리 디렉토리로 복사
                let target_filename = format!("result.{}", format);
                let target_path = files_dir.join(&target_filename);
                
                tokio::fs::copy(&source_path, &target_path).await?;
                
                // 파일 크기 가져오기
                let metadata = tokio::fs::metadata(&target_path).await?;
                let file_size = metadata.len();
                
                // 결과 추가
                let result = TranscriptionResult {
                    file_path: target_path,
                    format: format.clone(),
                    file_size,
                    created_at: chrono::Utc::now().to_rfc3339(),
                };
                
                history = history.add_result(result);
                
                // 원본 파일 삭제 (선택적)
                // tokio::fs::remove_file(&source_path).await.ok();
            }
        }
        
        // 히스토리를 완료로 마크
        history = history.mark_completed();
        
        // 메타데이터 업데이트
        self.save_history_metadata(&history).await?;
        
        // 히스토리 인덱스 업데이트
        self.update_history_index(&history).await?;
        
        Ok(history)
    }
    
    /// 변환 실패 시 히스토리를 업데이트합니다
    pub async fn mark_history_failed(
        &self,
        history_id: &str,
        error_message: String,
    ) -> Result<TranscriptionHistory> {
        let history = self.load_history_metadata(history_id).await?;
        let failed_history = history.mark_failed(error_message);
        
        self.save_history_metadata(&failed_history).await?;
        self.update_history_index(&failed_history).await?;
        
        Ok(failed_history)
    }
    
    /// 히스토리 목록을 조회합니다
    pub async fn list_history(&self, query: HistoryQuery) -> Result<HistoryListResponse> {
        let index = self.load_history_index().await?;
        
        let mut filtered_items: Vec<TranscriptionHistory> = index.into_iter()
            .filter(|item| self.matches_query(item, &query))
            .collect();
        
        // 정렬 (최신순)
        filtered_items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        let total_count = filtered_items.len();
        
        // 페이징 적용
        let offset = query.offset.unwrap_or(0);
        let limit = query.limit.unwrap_or(50);
        let end_index = std::cmp::min(offset + limit, total_count);
        
        let items = if offset < total_count {
            filtered_items[offset..end_index].to_vec()
        } else {
            Vec::new()
        };
        
        let has_more = end_index < total_count;
        
        Ok(HistoryListResponse {
            items,
            total_count,
            has_more,
        })
    }
    
    /// 특정 히스토리 항목을 조회합니다
    pub async fn get_history(&self, history_id: &str) -> Result<TranscriptionHistory> {
        self.load_history_metadata(history_id).await
    }
    
    /// 히스토리 항목을 삭제합니다
    pub async fn delete_history(&self, history_id: &str) -> Result<()> {
        // 히스토리 디렉토리 삭제
        let history_dir = self.get_history_directory(history_id);
        if history_dir.exists() {
            tokio::fs::remove_dir_all(&history_dir).await?;
        }
        
        // 히스토리 인덱스에서 제거
        let mut index = self.load_history_index().await?;
        index.retain(|item| item.id != history_id);
        self.save_history_index(&index).await?;
        
        Ok(())
    }
    
    /// 히스토리 항목의 태그를 업데이트합니다
    pub async fn update_history_tags(
        &self,
        history_id: &str,
        tags: Vec<String>,
    ) -> Result<TranscriptionHistory> {
        let mut history = self.load_history_metadata(history_id).await?;
        history.tags = tags;
        
        self.save_history_metadata(&history).await?;
        self.update_history_index(&history).await?;
        
        Ok(history)
    }
    
    /// 히스토리 항목의 메모를 업데이트합니다
    pub async fn update_history_notes(
        &self,
        history_id: &str,
        notes: Option<String>,
    ) -> Result<TranscriptionHistory> {
        let mut history = self.load_history_metadata(history_id).await?;
        history.notes = notes;
        
        self.save_history_metadata(&history).await?;
        self.update_history_index(&history).await?;
        
        Ok(history)
    }
    
    /// 특정 결과 파일의 경로를 반환합니다
    pub fn get_result_file_path(&self, history_id: &str, format: &str) -> PathBuf {
        self.get_history_directory(history_id)
            .join("files")
            .join(format!("result.{}", format))
    }
    
    /// 히스토리 디렉토리 경로를 반환합니다 (public)
    pub fn get_history_directory(&self, history_id: &str) -> PathBuf {
        self.results_dir.join(history_id)
    }
    
    /// 히스토리 메타데이터 파일 경로를 반환합니다
    fn get_metadata_file_path(&self, history_id: &str) -> PathBuf {
        self.get_history_directory(history_id).join("metadata.json")
    }
    
    /// 히스토리 메타데이터를 저장합니다
    async fn save_history_metadata(&self, history: &TranscriptionHistory) -> Result<()> {
        let metadata_path = self.get_metadata_file_path(&history.id);
        let json_content = serde_json::to_string_pretty(history)?;
        tokio::fs::write(metadata_path, json_content).await?;
        Ok(())
    }
    
    /// 히스토리 메타데이터를 로드합니다
    async fn load_history_metadata(&self, history_id: &str) -> Result<TranscriptionHistory> {
        let metadata_path = self.get_metadata_file_path(history_id);
        let json_content = tokio::fs::read_to_string(metadata_path).await?;
        let history: TranscriptionHistory = serde_json::from_str(&json_content)?;
        Ok(history)
    }
    
    /// 히스토리 인덱스를 로드합니다
    async fn load_history_index(&self) -> Result<Vec<TranscriptionHistory>> {
        if !self.history_index_file.exists() {
            return Ok(Vec::new());
        }
        
        let json_content = tokio::fs::read_to_string(&self.history_index_file).await?;
        let index: Vec<TranscriptionHistory> = serde_json::from_str(&json_content)?;
        Ok(index)
    }
    
    /// 히스토리 인덱스를 저장합니다
    async fn save_history_index(&self, index: &[TranscriptionHistory]) -> Result<()> {
        let json_content = serde_json::to_string_pretty(index)?;
        tokio::fs::write(&self.history_index_file, json_content).await?;
        Ok(())
    }
    
    /// 히스토리 인덱스를 업데이트합니다
    async fn update_history_index(&self, history: &TranscriptionHistory) -> Result<()> {
        let mut index = self.load_history_index().await?;
        
        // 기존 항목 업데이트 또는 새 항목 추가
        if let Some(existing) = index.iter_mut().find(|item| item.id == history.id) {
            *existing = history.clone();
        } else {
            index.push(history.clone());
        }
        
        self.save_history_index(&index).await?;
        Ok(())
    }
    
    /// 쿼리 조건에 맞는지 확인합니다
    fn matches_query(&self, item: &TranscriptionHistory, query: &HistoryQuery) -> bool {
        // 검색어 필터
        if let Some(search) = &query.search {
            if !item.original_file_name.to_lowercase().contains(&search.to_lowercase()) {
                return false;
            }
        }
        
        // 모델 필터
        if let Some(model) = &query.model_filter {
            if item.model_used != *model {
                return false;
            }
        }
        
        // 형식 필터
        if let Some(format) = &query.format_filter {
            if !item.get_formats().contains(format) {
                return false;
            }
        }
        
        // 태그 필터
        if let Some(tag) = &query.tag_filter {
            if !item.tags.contains(tag) {
                return false;
            }
        }
        
        // 상태 필터
        if let Some(status) = &query.status_filter {
            if std::mem::discriminant(&item.status) != std::mem::discriminant(status) {
                return false;
            }
        }
        
        // 날짜 범위 필터
        if let Some(date_from) = &query.date_from {
            if item.created_at < *date_from {
                return false;
            }
        }
        
        if let Some(date_to) = &query.date_to {
            if item.created_at > *date_to {
                return false;
            }
        }
        
        true
    }
}