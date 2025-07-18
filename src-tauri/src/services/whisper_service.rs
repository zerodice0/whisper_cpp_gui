use std::path::PathBuf;
use tauri::Manager;
use crate::models::*;
use crate::services::whisper_installer::WhisperInstaller;
use crate::services::history_service::HistoryService;

pub struct WhisperService {
    pub whisper_repo_path: PathBuf,
    pub whisper_binary_path: PathBuf,
    pub models_path: PathBuf,
    installer: WhisperInstaller,
    history_service: HistoryService,
}

impl WhisperService {
    pub fn new() -> Self {
        let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let whisper_dir = home_dir.join(".whisper-gui");
        
        let whisper_repo_path = whisper_dir.join("whisper.cpp");
        let whisper_binary_path = whisper_repo_path.join("build").join("bin").join("main");
        let models_path = whisper_dir.join("models");
        
        Self {
            whisper_repo_path: whisper_repo_path.clone(),
            whisper_binary_path,
            models_path: models_path.clone(),
            installer: WhisperInstaller::new(whisper_repo_path, models_path),
            history_service: HistoryService::new(),
        }
    }

    pub async fn check_whisper_installation(&self) -> anyhow::Result<bool> {
        // 빌드된 바이너리 위치 확인 (여러 가능한 위치 체크)
        let main_binary = self.whisper_repo_path.join("build").join("bin").join("main");
        let fallback_binary = self.whisper_repo_path.join("build").join("main");
        
        Ok(main_binary.exists() || fallback_binary.exists())
    }

    pub async fn setup_whisper(&self, app_handle: Option<tauri::AppHandle>) -> anyhow::Result<String> {
        self.installer.setup_whisper(app_handle).await
    }

    pub async fn list_available_models(&self) -> anyhow::Result<Vec<String>> {
        // whisper.cpp의 download-ggml-model.sh 스크립트에서 모델 목록을 파싱
        let script_path = self.whisper_repo_path.join("models").join("download-ggml-model.sh");
        
        // 여러 번 시도해서 파싱 안정성 향상
        let mut last_error = None;
        for attempt in 1..=3 {
            if script_path.exists() {
                match self.parse_models_from_script(&script_path).await {
                    Ok(models) => {
                        if !models.is_empty() {
                            eprintln!("Successfully loaded {} models from download script (attempt {})", models.len(), attempt);
                            return Ok(models);
                        } else {
                            eprintln!("Empty model list from script (attempt {}), retrying...", attempt);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to parse models from script (attempt {}): {}", attempt, e);
                        last_error = Some(e);
                        
                        // 짧은 지연 후 재시도
                        if attempt < 3 {
                            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        }
                    }
                }
            } else {
                eprintln!("Download script not found at {:?} (attempt {})", script_path, attempt);
                break;
            }
        }
        
        // 스크립트 파싱이 실패했을 때 상세한 로그와 함께 폴백
        if let Some(error) = last_error {
            eprintln!("All script parsing attempts failed, last error: {}", error);
        }
        
        // 폴백: 하드코딩된 모델 목록
        let fallback_models = self.get_fallback_models();
        eprintln!("Using fallback model list with {} models", fallback_models.len());
        Ok(fallback_models)
    }

    async fn parse_models_from_script(&self, script_path: &std::path::Path) -> anyhow::Result<Vec<String>> {
        let content = tokio::fs::read_to_string(script_path).await?;
        let mut models = Vec::new();
        let mut in_models_section = false;
        
        for line in content.lines() {
            let trimmed = line.trim();
            
            // models 변수 시작 감지
            if trimmed.starts_with("models=\"") {
                in_models_section = true;
                // 첫 번째 줄에 모델이 있는 경우 처리
                let first_line = trimmed.trim_start_matches("models=\"");
                if !first_line.is_empty() && first_line != "tiny" {
                    // models=" 다음에 바로 모델명이 오는 경우는 거의 없지만 안전장치
                }
                continue;
            }
            
            // models 변수 끝 감지
            if in_models_section && trimmed.ends_with('"') {
                // 마지막 줄의 모델 추가 (따옴표 제거)
                let last_model = trimmed.trim_end_matches('"');
                if !last_model.is_empty() {
                    models.push(last_model.to_string());
                }
                break;
            }
            
            // models 섹션 내의 모델명 추가
            if in_models_section && !trimmed.is_empty() {
                models.push(trimmed.to_string());
            }
        }
        
        if models.is_empty() {
            return Err(anyhow::anyhow!("No models found in script"));
        }
        
        eprintln!("Parsed models from script: {:?}", models);
        Ok(models)
    }

    fn get_fallback_models(&self) -> Vec<String> {
        vec![
            "tiny".to_string(),
            "tiny.en".to_string(),
            "tiny-q5_1".to_string(),
            "tiny.en-q5_1".to_string(),
            "tiny-q8_0".to_string(),
            "base".to_string(),
            "base.en".to_string(),
            "base-q5_1".to_string(),
            "base.en-q5_1".to_string(),
            "base-q8_0".to_string(),
            "small".to_string(),
            "small.en".to_string(),
            "small.en-tdrz".to_string(),
            "small-q5_1".to_string(),
            "small.en-q5_1".to_string(),
            "small-q8_0".to_string(),
            "medium".to_string(),
            "medium.en".to_string(),
            "medium-q5_0".to_string(),
            "medium.en-q5_0".to_string(),
            "medium-q8_0".to_string(),
            "large-v1".to_string(),
            "large-v2".to_string(),
            "large-v2-q5_0".to_string(),
            "large-v2-q8_0".to_string(),
            "large-v3".to_string(),
            "large-v3-q5_0".to_string(),
            "large-v3-turbo".to_string(),
            "large-v3-turbo-q5_0".to_string(),
            "large-v3-turbo-q8_0".to_string(),
        ]
    }

    pub async fn list_downloaded_models(&self) -> anyhow::Result<Vec<String>> {
        let mut models = Vec::new();
        
        if self.models_path.exists() {
            let mut dir = tokio::fs::read_dir(&self.models_path).await?;
            while let Some(entry) = dir.next_entry().await? {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".bin") {
                        let file_name = name.trim_end_matches(".bin");
                        // ggml- 접두사를 제거하여 표준 모델명으로 변환
                        if let Some(model_name) = file_name.strip_prefix("ggml-") {
                            models.push(model_name.to_string());
                        } else {
                            // ggml- 접두사가 없는 경우 그대로 사용
                            models.push(file_name.to_string());
                        }
                    }
                }
            }
        }
        
        Ok(models)
    }

    pub async fn download_official_model(&self, model_name: &str) -> anyhow::Result<()> {
        self.installer.download_model(model_name).await
    }

    pub async fn validate_model(&self, model_name: &str) -> anyhow::Result<bool> {
        let model_path = self.models_path.join(format!("ggml-{}.bin", model_name));
        
        if !model_path.exists() {
            return Ok(false);
        }
        
        // 파일 크기 체크
        let metadata = tokio::fs::metadata(&model_path).await?;
        let file_size = metadata.len();
        
        // 예상 최소 파일 크기 (MB)
        let min_expected_size = match model_name {
            m if m.starts_with("tiny") => 39 * 1024 * 1024,      // ~39MB
            m if m.starts_with("base") => 142 * 1024 * 1024,     // ~142MB  
            m if m.starts_with("small") => 244 * 1024 * 1024,    // ~244MB
            m if m.starts_with("medium") => 769 * 1024 * 1024,   // ~769MB
            m if m.starts_with("large") => 1550 * 1024 * 1024,   // ~1550MB
            _ => 10 * 1024 * 1024, // 기본 최소값 10MB
        };
        
        if file_size < min_expected_size {
            eprintln!("Model {} appears to be incomplete: {} bytes (expected >= {} bytes)", 
                     model_name, file_size, min_expected_size);
            return Ok(false);
        }
        
        // whisper.cpp로 모델 검증 시도 (간단한 헤더 체크)
        if let Err(e) = self.test_model_loading(model_name).await {
            eprintln!("Model {} failed validation test: {}", model_name, e);
            return Ok(false);
        }
        
        Ok(true)
    }

    async fn test_model_loading(&self, model_name: &str) -> anyhow::Result<()> {
        use tokio::process::Command as TokioCommand;
        
        let model_path = self.models_path.join(format!("ggml-{}.bin", model_name));
        
        // whisper-cli 바이너리 찾기
        let whisper_cli_binary = self.whisper_repo_path.join("build").join("bin").join("whisper-cli");
        let fallback_cli_binary = self.whisper_repo_path.join("build").join("whisper-cli");
        let main_binary = self.whisper_repo_path.join("build").join("bin").join("main");
        let fallback_binary = self.whisper_repo_path.join("build").join("main");
        
        let binary_path = if whisper_cli_binary.exists() {
            &whisper_cli_binary
        } else if fallback_cli_binary.exists() {
            &fallback_cli_binary
        } else if main_binary.exists() {
            &main_binary
        } else if fallback_binary.exists() {
            &fallback_binary
        } else {
            return Err(anyhow::anyhow!("Whisper binary not found"));
        };

        // 모델 로딩 테스트 (매우 짧은 더미 파일로)
        let output = TokioCommand::new(binary_path)
            .args([
                "-m", &model_path.to_string_lossy(),
                "--help"  // 단순히 help만 표시하여 모델 로딩 확인
            ])
            .output()
            .await?;
            
        // stderr에서 모델 로딩 에러 체크
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("ERROR not all tensors loaded") || 
           stderr.contains("failed to load model") ||
           stderr.contains("failed to initialize whisper context") {
            return Err(anyhow::anyhow!("Model validation failed: {}", stderr));
        }
        
        Ok(())
    }

    pub async fn repair_model(&self, model_name: &str) -> anyhow::Result<()> {
        eprintln!("Attempting to repair model: {}", model_name);
        
        // 기존 손상된 파일 삭제
        let model_path = self.models_path.join(format!("ggml-{}.bin", model_name));
        if model_path.exists() {
            tokio::fs::remove_file(&model_path).await?;
            eprintln!("Removed corrupted model file: {:?}", model_path);
        }
        
        // 모델 재다운로드
        self.installer.download_model(model_name).await?;
        
        // 재다운로드 후 검증
        if !self.validate_model(model_name).await? {
            return Err(anyhow::anyhow!("Model repair failed - downloaded model is still invalid"));
        }
        
        eprintln!("Model {} successfully repaired", model_name);
        Ok(())
    }

    pub async fn download_model_with_progress(&self, model_name: &str, app_handle: tauri::AppHandle) -> anyhow::Result<()> {
        self.installer.download_model_with_progress(model_name, app_handle).await
    }

    pub async fn is_model_downloaded(&self, model_name: &str) -> bool {
        let model_path = self.models_path.join(format!("ggml-{}.bin", model_name));
        model_path.exists()
    }

    pub async fn delete_model(&self, model_name: &str) -> anyhow::Result<()> {
        let model_path = self.models_path.join(format!("ggml-{}.bin", model_name));
        
        if !model_path.exists() {
            return Err(anyhow::anyhow!("Model not found: {}", model_name));
        }

        tokio::fs::remove_file(&model_path).await?;
        Ok(())
    }

    pub async fn start_transcription_with_streaming(
        &self, 
        file_path: &str, 
        model_name: &str,
        app_handle: tauri::AppHandle
    ) -> anyhow::Result<()> {
        use tokio::process::Command as TokioCommand;
        use tokio::io::{AsyncBufReadExt, BufReader};
        use std::process::Stdio;
        
        let model_path = self.models_path.join(format!("ggml-{}.bin", model_name));
        
        if !model_path.exists() {
            return Err(anyhow::anyhow!("Model not found: {}", model_name));
        }

        // whisper-cli 바이너리 찾기 (최신 whisper.cpp에서 권장)
        let whisper_cli_binary = self.whisper_repo_path.join("build").join("bin").join("whisper-cli");
        let fallback_cli_binary = self.whisper_repo_path.join("build").join("whisper-cli");
        // 백워드 호환성을 위한 main 바이너리
        let main_binary = self.whisper_repo_path.join("build").join("bin").join("main");
        let fallback_binary = self.whisper_repo_path.join("build").join("main");
        
        let binary_path = if whisper_cli_binary.exists() {
            &whisper_cli_binary
        } else if fallback_cli_binary.exists() {
            &fallback_cli_binary
        } else if main_binary.exists() {
            &main_binary
        } else if fallback_binary.exists() {
            &fallback_binary
        } else {
            return Err(anyhow::anyhow!("Whisper binary not found"));
        };

        let mut cmd = TokioCommand::new(binary_path)
            .args([
                "-m", &model_path.to_string_lossy(),
                "-f", file_path,
                "--output-txt"
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let stdout = cmd.stdout.take().unwrap();
        let stderr = cmd.stderr.take().unwrap();

        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                app_handle_clone.emit_all("transcription-log", &line).ok();
                if let Some(progress) = parse_whisper_output_line(&line) {
                    app_handle_clone.emit_all("transcription-progress", &progress).ok();
                }
            }
        });

        let app_handle_stderr = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                app_handle_stderr.emit_all("transcription-log", &line).ok();
            }
        });

        let app_handle_final = app_handle;
        tokio::spawn(async move {
            match cmd.wait().await {
                Ok(status) => {
                    if status.success() {
                        app_handle_final.emit_all("transcription-complete", "Success").ok();
                    } else {
                        app_handle_final.emit_all("transcription-error", "Process failed").ok();
                    }
                }
                Err(e) => {
                    app_handle_final.emit_all("transcription-error", &e.to_string()).ok();
                }
            }
        });

        Ok(())
    }

    pub async fn read_transcription_result(&self, file_path: &str) -> anyhow::Result<Option<String>> {
        let input_path = PathBuf::from(file_path);
        let txt_path = input_path.with_extension("txt");
        
        if txt_path.exists() {
            let content = tokio::fs::read_to_string(&txt_path).await?;
            Ok(Some(content))
        } else {
            Ok(None)
        }
    }

    pub async fn export_to_srt(&self, transcription: &str, output_path: &str) -> anyhow::Result<String> {
        let srt_content = convert_to_srt(transcription);
        tokio::fs::write(output_path, srt_content).await?;
        Ok(format!("SRT exported to: {}", output_path))
    }

    pub async fn export_to_fcpxml(&self, transcription: &str, output_path: &str) -> anyhow::Result<String> {
        let fcpxml_content = convert_to_fcpxml(transcription);
        tokio::fs::write(output_path, fcpxml_content).await?;
        Ok(format!("FCPXML exported to: {}", output_path))
    }

    pub async fn get_whisper_options(&self) -> anyhow::Result<WhisperOptions> {
        use tokio::process::Command as TokioCommand;
        
        // whisper-cli 바이너리 찾기 (최신 whisper.cpp에서 권장)
        let whisper_cli_binary = self.whisper_repo_path.join("build").join("bin").join("whisper-cli");
        let fallback_cli_binary = self.whisper_repo_path.join("build").join("whisper-cli");
        // 백워드 호환성을 위한 main 바이너리
        let main_binary = self.whisper_repo_path.join("build").join("bin").join("main");
        let fallback_binary = self.whisper_repo_path.join("build").join("main");
        
        let binary_path = if whisper_cli_binary.exists() {
            Some(&whisper_cli_binary)
        } else if fallback_cli_binary.exists() {
            Some(&fallback_cli_binary)
        } else if main_binary.exists() {
            Some(&main_binary)
        } else if fallback_binary.exists() {
            Some(&fallback_binary)
        } else {
            eprintln!("Whisper binary not found, using default options");
            None
        };

        if let Some(binary) = binary_path {
            eprintln!("Attempting to get whisper options from: {}", binary.display());
            
            match TokioCommand::new(binary)
                .arg("--help")
                .output()
                .await 
            {
                Ok(output) => {
                    if output.status.success() {
                        let help_text = String::from_utf8_lossy(&output.stdout);
                        eprintln!("Successfully got help output, parsing...");
                        return Ok(parse_whisper_help(&help_text));
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        eprintln!("Whisper --help failed with stderr: {}", stderr);
                    }
                }
                Err(e) => {
                    eprintln!("Failed to execute whisper --help: {}", e);
                }
            }
        }
        
        // 바이너리가 없거나 실행에 실패한 경우 기본 옵션 제공
        eprintln!("Falling back to default options");
        let mut options = Vec::new();
        add_default_options(&mut options);
        Ok(WhisperOptions { options })
    }

    pub async fn start_transcription_with_options(
        &self,
        config: &WhisperConfig,
        app_handle: tauri::AppHandle
    ) -> anyhow::Result<String> {
        use tokio::process::Command as TokioCommand;
        use tokio::io::{AsyncBufReadExt, BufReader};
        use std::process::Stdio;
        
        let model_path = self.models_path.join(format!("ggml-{}.bin", config.model));
        
        if !model_path.exists() {
            return Err(anyhow::anyhow!("Model not found: {}", config.model));
        }

        // 히스토리 항목 생성
        let input_path = PathBuf::from(&config.input_file);
        let original_file_name = input_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();
        
        let history = self.history_service.create_history_entry(
            original_file_name.clone(),
            input_path.clone(),
            config.model.clone(),
            config.options.clone(),
        ).await?;
        
        let history_id = history.id.clone();

        // whisper-cli 바이너리 찾기 (최신 whisper.cpp에서 권장)
        let whisper_cli_binary = self.whisper_repo_path.join("build").join("bin").join("whisper-cli");
        let fallback_cli_binary = self.whisper_repo_path.join("build").join("whisper-cli");
        // 백워드 호환성을 위한 main 바이너리
        let main_binary = self.whisper_repo_path.join("build").join("bin").join("main");
        let fallback_binary = self.whisper_repo_path.join("build").join("main");
        
        let binary_path = if whisper_cli_binary.exists() {
            &whisper_cli_binary
        } else if fallback_cli_binary.exists() {
            &fallback_cli_binary
        } else if main_binary.exists() {
            &main_binary
        } else if fallback_binary.exists() {
            &fallback_binary
        } else {
            // 히스토리 실패로 마크
            self.history_service.mark_history_failed(
                &history_id, 
                "Whisper binary not found".to_string()
            ).await.ok();
            return Err(anyhow::anyhow!("Whisper binary not found"));
        };

        // 히스토리 결과 디렉토리 생성 (files 서브디렉토리 포함)
        let results_dir = self.history_service.get_history_directory(&history_id);
        let files_dir = results_dir.join("files");
        tokio::fs::create_dir_all(&files_dir).await?;
        
        let mut args = vec![
            "-m".to_string(), 
            model_path.to_string_lossy().to_string(),
            "-f".to_string(), 
            config.input_file.clone()
        ];

        // 출력 경로를 files 디렉토리로 설정하여 중복 저장 방지
        let output_file_base = files_dir.join("result");
        
        // --output-file 옵션으로 베이스 경로 지정 (확장자 제외)
        args.push("--output-file".to_string());
        args.push(output_file_base.to_string_lossy().to_string());
        
        // 출력 형식별 플래그 설정
        let mut has_output_format = false;
        for (key, value) in &config.options {
            if key.starts_with("output-") {
                // output-srt, output-txt 등은 플래그로만 사용
                args.push(format!("--{}", key));
                has_output_format = true;
            } else if value.is_empty() {
                args.push(format!("--{}", key));
            } else {
                args.push(format!("--{}", key));
                args.push(value.clone());
            }
        }
        
        // 기본 SRT 출력을 위한 설정 (사용자가 지정하지 않았을 경우)
        if !has_output_format {
            args.push("--output-srt".to_string());
        }

        // 실행될 명령어 로그 출력
        eprintln!("Executing whisper command:");
        eprintln!("Binary: {:?}", binary_path);
        eprintln!("Args: {:?}", args);

        let mut cmd = TokioCommand::new(binary_path)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                // 프로세스 시작 실패 시 히스토리 실패로 마크
                let history_service = self.history_service.clone();
                let history_id = history_id.clone();
                let error_message = e.to_string();
                tokio::spawn(async move {
                    history_service.mark_history_failed(&history_id, error_message).await.ok();
                });
                e
            })?;

        let stdout = cmd.stdout.take().unwrap();
        let stderr = cmd.stderr.take().unwrap();

        // stdout 처리
        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                app_handle_clone.emit_all("transcription-log", &line).ok();
                if let Some(progress) = parse_whisper_output_line(&line) {
                    app_handle_clone.emit_all("transcription-progress", &progress).ok();
                }
            }
        });

        // stderr 처리
        let app_handle_stderr = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                app_handle_stderr.emit_all("transcription-log", &line).ok();
            }
        });

        // 프로세스 완료 처리
        let app_handle_final = app_handle;
        let history_service = self.history_service.clone();
        let history_id_final = history_id.clone();
        let input_path_final = input_path.clone();
        let config_options = config.options.clone();
        
        tokio::spawn(async move {
            match cmd.wait().await {
                Ok(status) => {
                    if status.success() {
                        // 결과 파일들 수집 및 히스토리에 저장
                        match Self::collect_and_save_result_files(
                            &history_service,
                            &history_id_final,
                            &input_path_final,
                            &config_options,
                        ).await {
                            Ok(_) => {
                                app_handle_final.emit_all("transcription-complete", &history_id_final).ok();
                            }
                            Err(e) => {
                                history_service.mark_history_failed(
                                    &history_id_final, 
                                    format!("Failed to save results: {}", e)
                                ).await.ok();
                                app_handle_final.emit_all("transcription-error", &e.to_string()).ok();
                            }
                        }
                    } else {
                        history_service.mark_history_failed(
                            &history_id_final, 
                            "Transcription process failed".to_string()
                        ).await.ok();
                        app_handle_final.emit_all("transcription-error", "Process failed").ok();
                    }
                }
                Err(e) => {
                    history_service.mark_history_failed(
                        &history_id_final, 
                        e.to_string()
                    ).await.ok();
                    app_handle_final.emit_all("transcription-error", &e.to_string()).ok();
                }
            }
        });

        Ok(history_id)
    }
    
    async fn collect_and_save_result_files(
        history_service: &HistoryService,
        history_id: &str,
        _input_path: &PathBuf,
        options: &std::collections::HashMap<String, String>,
    ) -> anyhow::Result<()> {
        // files 디렉토리에서 결과 파일들 찾기 (whisper.cpp가 직접 저장한 위치)
        let results_dir = history_service.get_history_directory(history_id);
        let files_dir = results_dir.join("files");
        
        let mut result_files = Vec::new();
        
        // 생성될 수 있는 출력 형식들 체크
        let output_formats = vec![
            ("output-txt", "txt"),
            ("output-srt", "srt"),
            ("output-vtt", "vtt"),
            ("output-csv", "csv"),
            ("output-json", "json"),
            ("output-lrc", "lrc"),
        ];
        
        eprintln!("Looking for result files in files directory: {:?}", files_dir);
        
        for (option_key, format) in output_formats {
            // 해당 옵션이 활성화되어 있거나, 기본 srt 출력인 경우 
            if options.contains_key(option_key) || format == "srt" {
                let result_file_path = files_dir.join(format!("result.{}", format));
                
                eprintln!("Checking for result file: {:?}", result_file_path);
                
                if result_file_path.exists() {
                    eprintln!("Found result file: {:?}", result_file_path);
                    result_files.push((result_file_path, format.to_string()));
                } else {
                    eprintln!("Result file not found: {:?}", result_file_path);
                }
            }
        }
        
        if result_files.is_empty() {
            return Err(anyhow::anyhow!("No result files found in files directory"));
        }
        
        // 결과 파일들을 히스토리에 등록 (이미 올바른 위치에 있으므로 복사하지 않음)
        history_service.register_existing_results(history_id, result_files).await?;
        
        Ok(())
    }
}

fn convert_to_srt(transcription: &str) -> String {
    let lines: Vec<&str> = transcription.lines().collect();
    let mut srt_content = String::new();
    let mut subtitle_index = 1;
    
    for (i, line) in lines.iter().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        
        let start_time = i * 5;
        let end_time = start_time + 4;
        
        srt_content.push_str(&format!("{}\n", subtitle_index));
        srt_content.push_str(&format!(
            "{:02}:{:02}:{:02},000 --> {:02}:{:02}:{:02},000\n",
            start_time / 3600, (start_time % 3600) / 60, start_time % 60,
            end_time / 3600, (end_time % 3600) / 60, end_time % 60
        ));
        srt_content.push_str(&format!("{}\n\n", line.trim()));
        
        subtitle_index += 1;
    }
    
    srt_content
}

fn convert_to_fcpxml(transcription: &str) -> String {
    let lines: Vec<&str> = transcription.lines().collect();
    let mut fcpxml_content = String::new();
    
    fcpxml_content.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
    <resources>
        <format id="r1" name="FFVideoFormat1920x1080p30" frameDuration="1001/30000s" width="1920" height="1080"/>
    </resources>
    <library>
        <event name="Whisper Transcription">
            <project name="Transcription Project">
                <sequence format="r1" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
                    <spine>
"#);

    for (i, line) in lines.iter().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        
        let start_time = i * 5;
        fcpxml_content.push_str(&format!(
            r#"                        <title ref="r1" name="Subtitle {}" start="{}s" duration="4s">
                            <text>
                                <text-style ref="ts1">{}</text-style>
                            </text>
                        </title>
"#,
            i + 1,
            start_time,
            line.trim()
        ));
    }

    fcpxml_content.push_str(r#"                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>"#);
    
    fcpxml_content
}

pub fn parse_whisper_help(help_text: &str) -> WhisperOptions {
    let mut options = Vec::new();
    
    eprintln!("PARSING WHISPER HELP OUTPUT:");
    eprintln!("Length: {} chars", help_text.len());
    eprintln!("First 500 chars: {}", &help_text.chars().take(500).collect::<String>());
    
    let lines: Vec<&str> = help_text.lines().collect();
    eprintln!("Total lines: {}", lines.len());
    
    let mut in_options_section = false;
    
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        
        // 옵션 섹션 시작 감지
        if trimmed.contains("options:") || trimmed.contains("Options:") || trimmed.contains("arguments:") {
            in_options_section = true;
            eprintln!("Found options section at line {}: {}", i, trimmed);
            continue;
        }
        
        // 빈 줄이나 다른 섹션이 시작되면 옵션 섹션 종료
        if in_options_section && trimmed.is_empty() {
            continue;
        }
        
        if in_options_section && trimmed.starts_with("-") {
            eprintln!("Parsing option line {}: {}", i, trimmed);
            if let Some(option) = parse_option_line(trimmed) {
                eprintln!("Successfully parsed option: {:?}", option);
                options.push(option);
            } else {
                eprintln!("Failed to parse option line: {}", trimmed);
            }
        }
        
        // 새로운 섹션이 시작되면 (예: "examples:", "usage:") 옵션 섹션 종료
        if in_options_section && (trimmed.contains("usage:") || trimmed.contains("examples:") || trimmed.contains("example:")) {
            break;
        }
    }
    
    eprintln!("Parsed {} options from help text", options.len());
    
    // 기본 옵션이 파싱되지 않았다면 추가
    if options.is_empty() {
        eprintln!("No options parsed, adding default options");
        add_default_options(&mut options);
    } else {
        // 파싱된 옵션에 추가로 필요한 옵션들 보완
        add_missing_common_options(&mut options);
    }
    
    eprintln!("Final options count: {}", options.len());
    
    WhisperOptions { options }
}

fn parse_option_line(line: &str) -> Option<WhisperOption> {
    eprintln!("  Parsing line: '{}'", line);
    
    // 여러 가지 형식 지원:
    // "  -l, --language LANG        spoken language (auto for auto-detection) (default: auto)"
    // "  -t N, --threads N          number of threads to use during computation (default: 4)"
    // "  --output-txt               output result in a text file"
    // "  -f FILE, --file FILE       audio file to process"
    
    let trimmed = line.trim();
    if !trimmed.starts_with("-") {
        return None;
    }
    
    // 옵션 부분과 설명 부분 분리
    let (option_part, description) = if let Some(_pos) = trimmed.find("  ") {
        let parts = trimmed.split("  ").collect::<Vec<_>>();
        if parts.len() >= 2 {
            let option_part = parts[0].trim();
            let description = parts[1..].join(" ");
            (option_part, description)
        } else {
            (trimmed, String::new())
        }
    } else {
        // 단일 공백으로 구분된 경우
        let parts: Vec<&str> = trimmed.splitn(2, ' ').collect();
        if parts.len() >= 2 {
            (parts[0], parts[1].to_string())
        } else {
            (trimmed, String::new())
        }
    };
    
    eprintln!("    Option part: '{}', Description: '{}'", option_part, description);
    
    // 옵션 이름 파싱
    let (name, short_name) = parse_option_names(option_part)?;
    
    eprintln!("    Parsed name: '{}', short_name: {:?}", name, short_name);
    
    // 타입 결정
    let option_type = determine_option_type(option_part, &description);
    
    // 기본값 추출
    let default_value = extract_default_value(&description);
    
    // 가능한 값들 추출 (특정 옵션들에 대해)
    let possible_values = extract_possible_values(&name, &description);
    
    eprintln!("    Final option: name={}, type={:?}, default={:?}", name, option_type, default_value);
    
    Some(WhisperOption {
        name,
        short_name,
        description,
        option_type,
        default_value,
        possible_values,
    })
}

fn parse_option_names(option_part: &str) -> Option<(String, Option<String>)> {
    // "-l, --language" 또는 "--output-txt" 또는 "-f FILE" 등의 형식
    
    let cleaned = option_part.replace(",", "");
    let parts: Vec<&str> = cleaned.split_whitespace().collect();
    
    let mut long_name = None;
    let mut short_name = None;
    
    for part in parts {
        if part.starts_with("--") {
            long_name = Some(part.trim_start_matches("--").to_string());
        } else if part.starts_with("-") && part.len() == 2 {
            short_name = Some(part.trim_start_matches("-").to_string());
        }
    }
    
    // 긴 이름이 우선, 없으면 짧은 이름 사용
    if let Some(name) = long_name {
        Some((name, short_name))
    } else if let Some(name) = short_name.clone() {
        Some((name, None))
    } else {
        None
    }
}

fn determine_option_type(option_part: &str, description: &str) -> WhisperOptionType {
    let combined = format!("{} {}", option_part, description).to_lowercase();
    
    // 플래그 타입 (값이 없는 옵션)
    if combined.contains("flag") || 
       (!combined.contains("value") && !combined.contains("file") && 
        !combined.contains("number") && !combined.contains("lang") &&
        !combined.contains("n") && !combined.contains("string") &&
        !option_part.contains("FILE") && !option_part.contains("LANG") &&
        !option_part.contains("N") && !option_part.contains("VAL")) {
        return WhisperOptionType::Flag;
    }
    
    // 정수 타입
    if combined.contains("threads") || combined.contains("number") || 
       combined.contains("int") || option_part.contains(" N") ||
       combined.contains("processors") || combined.contains("duration") {
        return WhisperOptionType::Integer;
    }
    
    // 실수 타입
    if combined.contains("float") || combined.contains("temperature") ||
       combined.contains("probability") || combined.contains("threshold") {
        return WhisperOptionType::Float;
    }
    
    // 기본적으로 문자열 타입
    WhisperOptionType::String
}

fn extract_default_value(description: &str) -> Option<String> {
    // "(default: value)" 패턴 찾기
    if let Some(start) = description.find("(default: ") {
        if let Some(end) = description[start..].find(")") {
            let default_part = &description[start + 10..start + end];
            return Some(default_part.trim().to_string());
        }
    }
    
    None
}

fn extract_possible_values(name: &str, _description: &str) -> Option<Vec<String>> {
    match name {
        "language" => Some(vec![
            "auto".to_string(), "en".to_string(), "ko".to_string(), 
            "ja".to_string(), "zh".to_string(), "fr".to_string(),
            "de".to_string(), "es".to_string(), "ru".to_string(),
            "it".to_string(), "pt".to_string(), "ar".to_string()
        ]),
        _ => None
    }
}

fn add_missing_common_options(options: &mut Vec<WhisperOption>) {
    let essential_options = vec![
        ("output-txt", "Generate text output", WhisperOptionType::Flag, None),
        ("output-srt", "Generate SRT subtitle output", WhisperOptionType::Flag, None),
        ("language", "Spoken language (auto for auto-detection)", WhisperOptionType::String, Some("auto")),
        ("threads", "Number of threads to use during computation", WhisperOptionType::Integer, Some("4")),
    ];
    
    for (name, desc, opt_type, default) in essential_options {
        if !options.iter().any(|opt| opt.name == name) {
            options.push(WhisperOption {
                name: name.to_string(),
                short_name: match name {
                    "language" => Some("l".to_string()),
                    "threads" => Some("t".to_string()),
                    _ => None,
                },
                description: desc.to_string(),
                option_type: opt_type,
                default_value: default.map(|s| s.to_string()),
                possible_values: if name == "language" {
                    Some(vec![
                        "auto".to_string(), "en".to_string(), "ko".to_string(), 
                        "ja".to_string(), "zh".to_string(), "fr".to_string(),
                        "de".to_string(), "es".to_string(), "ru".to_string(),
                        "it".to_string(), "pt".to_string(), "ar".to_string()
                    ])
                } else {
                    None
                },
            });
        }
    }
}

fn add_default_options(options: &mut Vec<WhisperOption>) {
    let common_options = vec![
        WhisperOption {
            name: "output-txt".to_string(),
            short_name: None,
            description: "텍스트 파일 출력 생성".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "output-srt".to_string(),
            short_name: None,
            description: "SRT 자막 파일 출력 생성".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "output-vtt".to_string(),
            short_name: None,
            description: "WebVTT 자막 파일 출력 생성".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "output-csv".to_string(),
            short_name: None,
            description: "CSV 파일 출력 생성".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "output-json".to_string(),
            short_name: None,
            description: "JSON 파일 출력 생성".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "output-lrc".to_string(),
            short_name: None,
            description: "LRC 가사 파일 출력 생성".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "language".to_string(),
            short_name: Some("l".to_string()),
            description: "Spoken language (auto for auto-detection)".to_string(),
            option_type: WhisperOptionType::String,
            default_value: Some("auto".to_string()),
            possible_values: Some(vec![
                "auto".to_string(), "en".to_string(), "ko".to_string(), 
                "ja".to_string(), "zh".to_string(), "es".to_string(),
                "fr".to_string(), "de".to_string(), "it".to_string(),
                "pt".to_string(), "ru".to_string(), "ar".to_string(),
            ]),
        },
        WhisperOption {
            name: "threads".to_string(),
            short_name: Some("t".to_string()),
            description: "Number of threads to use during computation".to_string(),
            option_type: WhisperOptionType::Integer,
            default_value: Some("4".to_string()),
            possible_values: None,
        },
        WhisperOption {
            name: "verbose".to_string(),
            short_name: Some("v".to_string()),
            description: "Verbose output".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "translate".to_string(),
            short_name: None,
            description: "Translate from source language to English".to_string(),
            option_type: WhisperOptionType::Flag,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "duration".to_string(),
            short_name: Some("d".to_string()),
            description: "Duration of audio to process in milliseconds".to_string(),
            option_type: WhisperOptionType::Integer,
            default_value: None,
            possible_values: None,
        },
        WhisperOption {
            name: "offset".to_string(),
            short_name: Some("o".to_string()),
            description: "Offset of audio to start processing in milliseconds".to_string(),
            option_type: WhisperOptionType::Integer,
            default_value: None,
            possible_values: None,
        },
    ];
    
    for default_option in common_options {
        if !options.iter().any(|opt| opt.name == default_option.name) {
            options.push(default_option);
        }
    }
}

pub fn parse_whisper_output_line(line: &str) -> Option<ProgressInfo> {
    // whisper.cpp 타임스탬프 진행률 파싱 (예: [00:01:23.456 --> 00:01:25.789])
    if line.contains("[") && line.contains("-->") && line.contains("]") {
        if let Some(start) = line.find("[") {
            if let Some(arrow_pos) = line.find("-->") {
                if let Some(_end) = line.find("]") {
                    let timestamp_part = &line[start+1..arrow_pos].trim();
                    if let Some(time_seconds) = parse_timestamp_to_seconds(timestamp_part) {
                        // 임시로 시간을 기반으로 진행률 추정 (최대 300초 기준)
                        let estimated_progress = (time_seconds / 300.0).min(1.0);
                        return Some(ProgressInfo {
                            progress: estimated_progress,
                            current_time: Some(time_seconds),
                            message: line.to_string(),
                        });
                    }
                }
            }
        }
    }
    
    // 기존 백분율 기반 파싱
    if line.contains("[") && line.contains("]") && line.contains("%") {
        if let Some(start) = line.find("[") {
            if let Some(end) = line.find("]") {
                let progress_str = &line[start+1..end];
                if let Ok(progress) = progress_str.trim_end_matches('%').parse::<f32>() {
                    return Some(ProgressInfo {
                        progress: progress / 100.0,
                        current_time: None,
                        message: line.to_string(),
                    });
                }
            }
        }
    }
    
    // 완료 시그널 감지
    if line.contains("whisper_print_timings") || line.contains("total time") {
        return Some(ProgressInfo {
            progress: 1.0,
            current_time: None,
            message: "처리 완료".to_string(),
        });
    }
    
    // 시작 시그널 감지  
    if line.contains("whisper_init_from_file") || line.contains("loading model") {
        return Some(ProgressInfo {
            progress: 0.1,
            current_time: None,
            message: "모델 로딩 중...".to_string(),
        });
    }
    
    None
}

fn parse_timestamp_to_seconds(timestamp: &str) -> Option<f32> {
    // 타임스탬프 형식: "00:01:23.456" → 초 단위로 변환
    let parts: Vec<&str> = timestamp.split(':').collect();
    if parts.len() == 3 {
        if let (Ok(hours), Ok(minutes), Ok(seconds)) = 
            (parts[0].parse::<f32>(), parts[1].parse::<f32>(), parts[2].parse::<f32>()) {
            return Some(hours * 3600.0 + minutes * 60.0 + seconds);
        }
    }
    None
}