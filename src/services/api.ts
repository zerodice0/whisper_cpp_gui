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
};