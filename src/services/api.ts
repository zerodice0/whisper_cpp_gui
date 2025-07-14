import { invoke } from '@tauri-apps/api/tauri';

export interface ProgressInfo {
  progress: number;
  current_time?: number;
  message: string;
}

export interface WhisperOption {
  name: string;
  short_name?: string;
  description: string;
  option_type: 'Flag' | 'String' | 'Integer' | 'Float';
  default_value?: string;
  possible_values?: string[];
}

export interface WhisperOptions {
  options: WhisperOption[];
}

export interface WhisperConfig {
  model: string;
  input_file: string;
  options: Record<string, string>;
}

export interface DownloadProgress {
  model_name: string;
  progress: number;          // 0.0 ~ 1.0
  downloaded_bytes: number;
  total_bytes?: number;
  download_speed?: string;
  eta?: string;
  status: 'Starting' | 'Downloading' | 'Completed' | 'Failed' | 'Cancelled';
}

export interface TranscriptionResult {
  file_path: string;
  format: string;         // "txt", "srt", "vtt", "csv", "json", "lrc"
  file_size: number;      // 파일 크기 (bytes)
  created_at: string;     // ISO 8601 timestamp
}

export interface TranscriptionHistory {
  id: string;                         // 고유 ID (UUID)
  original_file_name: string;         // 원본 파일명
  original_file_path: string;         // 원본 파일 경로
  model_used: string;                 // 사용된 모델
  options_used: Record<string, string>; // 사용된 옵션들
  results: TranscriptionResult[];     // 생성된 결과 파일들
  status: 'Idle' | 'Running' | 'Completed' | 'Failed'; // 변환 상태
  created_at: string;                 // 변환 시작 시간 (ISO 8601)
  completed_at?: string;              // 변환 완료 시간 (ISO 8601)
  duration_seconds?: number;          // 변환 소요 시간 (초)
  tags: string[];                     // 사용자 태그들
  notes?: string;                     // 사용자 메모
  error_message?: string;             // 실패 시 에러 메시지
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  search?: string;          // 파일명 검색
  model_filter?: string;    // 모델별 필터
  format_filter?: string;   // 형식별 필터
  tag_filter?: string;      // 태그별 필터
  status_filter?: 'Idle' | 'Running' | 'Completed' | 'Failed'; // 상태별 필터
  date_from?: string;       // 시작 날짜 (ISO 8601)
  date_to?: string;         // 종료 날짜 (ISO 8601)
}

export interface HistoryListResponse {
  items: TranscriptionHistory[];
  total_count: number;
  has_more: boolean;
}

export const whisperApi = {
  async checkInstallation(): Promise<boolean> {
    return invoke('check_whisper_installation');
  },

  async setupWhisper(): Promise<string> {
    return invoke('setup_whisper');
  },

  async listAvailableModels(): Promise<string[]> {
    return invoke('list_available_models');
  },

  async listDownloadedModels(): Promise<string[]> {
    return invoke('list_downloaded_models');
  },

  async downloadModel(modelName: string): Promise<string> {
    return invoke('download_model', { modelName });
  },

  async startTranscription(filePath: string, modelName: string): Promise<string> {
    return invoke('start_transcription', { filePath, modelName });
  },

  async greet(name: string): Promise<string> {
    return invoke('greet', { name });
  },

  async readTranscriptionResult(filePath: string): Promise<string | null> {
    return invoke('read_transcription_result', { filePath });
  },

  async exportToSrt(transcription: string, outputPath: string): Promise<string> {
    return invoke('export_to_srt', { transcription, outputPath });
  },

  async exportToFcpxml(transcription: string, outputPath: string): Promise<string> {
    return invoke('export_to_fcpxml', { transcription, outputPath });
  },

  async checkSystemRequirements(): Promise<string> {
    return invoke('check_system_requirements');
  },

  async getWhisperOptions(): Promise<WhisperOptions> {
    return invoke('get_whisper_options');
  },

  async startTranscriptionWithOptions(config: WhisperConfig): Promise<string> {
    return invoke('start_transcription_with_options', { config });
  },

  async downloadModelWithProgress(modelName: string): Promise<string> {
    return invoke('download_model_with_progress', { modelName });
  },

  async deleteModel(modelName: string): Promise<string> {
    return invoke('delete_model', { modelName });
  },

  async validateModel(modelName: string): Promise<boolean> {
    return invoke('validate_model', { modelName });
  },

  async repairModel(modelName: string): Promise<string> {
    return invoke('repair_model', { modelName });
  },

  // ===== 히스토리 관련 API =====
  
  async listTranscriptionHistory(query: HistoryQuery = {}): Promise<HistoryListResponse> {
    return invoke('list_transcription_history', { query });
  },

  async getTranscriptionHistory(historyId: string): Promise<TranscriptionHistory> {
    return invoke('get_transcription_history', { historyId });
  },

  async deleteTranscriptionHistory(historyId: string): Promise<string> {
    return invoke('delete_transcription_history', { historyId });
  },

  async updateHistoryTags(historyId: string, tags: string[]): Promise<TranscriptionHistory> {
    return invoke('update_history_tags', { historyId, tags });
  },

  async updateHistoryNotes(historyId: string, notes?: string): Promise<TranscriptionHistory> {
    return invoke('update_history_notes', { historyId, notes });
  },

  async downloadResultFile(historyId: string, format: string, savePath: string): Promise<string> {
    return invoke('download_result_file', { historyId, format, savePath });
  },

  async getResultFileInfo(historyId: string): Promise<TranscriptionResult[]> {
    return invoke('get_result_file_info', { historyId });
  },
};