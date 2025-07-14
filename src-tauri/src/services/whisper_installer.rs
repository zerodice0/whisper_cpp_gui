use std::path::PathBuf;
use tokio::process::Command as TokioCommand;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;
use tauri::Manager;

pub struct WhisperInstaller {
    whisper_repo_path: PathBuf,
    models_path: PathBuf,
}

impl WhisperInstaller {
    pub fn new(whisper_repo_path: PathBuf, models_path: PathBuf) -> Self {
        Self {
            whisper_repo_path,
            models_path,
        }
    }

    pub async fn setup_whisper(&self, app_handle: Option<tauri::AppHandle>) -> anyhow::Result<String> {
        let parent_dir = self.whisper_repo_path.parent().unwrap();
        std::fs::create_dir_all(parent_dir)?;
        std::fs::create_dir_all(&self.models_path)?;

        if self.whisper_repo_path.exists() {
            self.emit_log(app_handle.as_ref(), "Existing installation found, updating...").await;
            self.update_whisper(app_handle).await
        } else {
            self.emit_log(app_handle.as_ref(), "Starting fresh installation...").await;
            self.clone_and_build_whisper(app_handle).await
        }
    }

    async fn clone_and_build_whisper(&self, app_handle: Option<tauri::AppHandle>) -> anyhow::Result<String> {
        let repo_url = "https://github.com/ggerganov/whisper.cpp.git";
        
        if self.whisper_repo_path.exists() {
            self.emit_log(app_handle.as_ref(), "기존 디렉토리 제거 중...").await;
            tokio::fs::remove_dir_all(&self.whisper_repo_path).await?;
        }
        
        self.emit_log(app_handle.as_ref(), &format!("Repository 클론 시작: {}", repo_url)).await;
        self.emit_log(app_handle.as_ref(), &format!("대상 경로: {}", self.whisper_repo_path.display())).await;
        
        let mut cmd = TokioCommand::new("git")
            .args(["clone", "--progress", repo_url, &self.whisper_repo_path.to_string_lossy()])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // Git clone 진행상황을 실시간으로 표시
        if let Some(stderr) = cmd.stderr.take() {
            let app_handle_clone = app_handle.clone();
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if let Some(ref handle) = app_handle_clone {
                        handle.emit_all("setup-log", &format!("Git: {}", line)).ok();
                    }
                }
            });
        }

        let output = cmd.wait_with_output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(anyhow::anyhow!("Git clone failed.\nStderr: {}\nStdout: {}", stderr, stdout));
        }

        self.emit_log(app_handle.as_ref(), "Repository 클론 완료!").await;
        self.build_with_make(app_handle).await
    }

    async fn update_whisper(&self, app_handle: Option<tauri::AppHandle>) -> anyhow::Result<String> {
        self.emit_log(app_handle.as_ref(), "Git pull로 업데이트 중...").await;
        
        let output = TokioCommand::new("git")
            .args(["pull"])
            .current_dir(&self.whisper_repo_path)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow::anyhow!("Git pull failed: {}", String::from_utf8_lossy(&output.stderr)));
        }

        self.emit_log(app_handle.as_ref(), "업데이트 완료, 다시 빌드 중...").await;
        self.build_with_make(app_handle).await
    }

    async fn build_with_make(&self, app_handle: Option<tauri::AppHandle>) -> anyhow::Result<String> {
        // Makefile 존재 확인
        let makefile_path = self.whisper_repo_path.join("Makefile");
        if !makefile_path.exists() {
            return Err(anyhow::anyhow!("Makefile not found in whisper.cpp directory"));
        }

        self.emit_log(app_handle.as_ref(), "Starting compilation with Make...").await;
        self.emit_log(app_handle.as_ref(), "📦 Using latest C++ standard for macOS compatibility").await;
        self.emit_log(app_handle.as_ref(), "⏳ This process may take several minutes...").await;
            
        let mut cmd = TokioCommand::new("make")
        .args(["build"])
        .current_dir(&self.whisper_repo_path)
        .env("MACOSX_DEPLOYMENT_TARGET", "10.15")
        .env("CMAKE_ARGS", "-DCMAKE_OSX_DEPLOYMENT_TARGET=10.15 -DCMAKE_CXX_STANDARD=17")
        .env("CXXFLAGS", "-std=c++17 -mmacosx-version-min=10.15")
        .env("CFLAGS", "-mmacosx-version-min=10.15")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

        // Make 진행상황을 실시간으로 표시
        if let Some(stdout) = cmd.stdout.take() {
            let app_handle_clone = app_handle.clone();
            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if line.contains("cc") || line.contains("g++") || line.contains("clang") || line.contains("%") {
                        if let Some(ref handle) = app_handle_clone {
                            handle.emit_all("setup-log", &format!("컴파일: {}", line)).ok();
                        }
                    }
                }
            });
        }

        if let Some(stderr) = cmd.stderr.take() {
            let app_handle_clone = app_handle.clone();
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if !line.trim().is_empty() {
                        if let Some(ref handle) = app_handle_clone {
                            handle.emit_all("setup-log", &format!("정보: {}", line)).ok();
                        }
                    }
                }
            });
        }

        let output = cmd.wait_with_output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(anyhow::anyhow!("Make failed.\nStderr: {}\nStdout: {}", stderr, stdout));
        }

        // 빌드된 바이너리 확인 (CMake 빌드는 build 디렉토리 사용)
        let main_binary = self.whisper_repo_path.join("build").join("bin").join("main");
        let fallback_binary = self.whisper_repo_path.join("build").join("main");
        
        let binary_path = if main_binary.exists() {
            main_binary
        } else if fallback_binary.exists() {
            fallback_binary
        } else {
            return Err(anyhow::anyhow!("Whisper binary not found after build. Checked: {} and {}", 
                main_binary.display(), fallback_binary.display()));
        };

        self.emit_log(app_handle.as_ref(), "✅ Make build completed!").await;
        self.emit_log(app_handle.as_ref(), &format!("Binary location: {}", binary_path.display())).await;
        
        Ok("Whisper.cpp successfully built with Make".to_string())
    }

    pub async fn download_model(&self, model_name: &str) -> anyhow::Result<()> {
        let script_path = self.whisper_repo_path.join("models").join("download-ggml-model.sh");
        
        if !script_path.exists() {
            return Err(anyhow::anyhow!("Download script not found"));
        }

        let output = TokioCommand::new("bash")
            .args([&script_path.to_string_lossy(), model_name])
            .current_dir(&self.models_path)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow::anyhow!("Model download failed: {}", String::from_utf8_lossy(&output.stderr)));
        }

        Ok(())
    }

    pub async fn download_model_with_progress(
        &self, 
        model_name: &str, 
        app_handle: tauri::AppHandle
    ) -> anyhow::Result<()> {
        use crate::models::{DownloadProgress, DownloadStatus};
        
        // 모델 URL 매핑
        let model_url = get_model_url(model_name)?;
        let output_file = self.models_path.join(format!("ggml-{}.bin", model_name));
        
        // 모델 디렉토리 생성
        std::fs::create_dir_all(&self.models_path)?;
        
        // 이미 다운로드된 모델이 있는지 확인
        if output_file.exists() {
            app_handle.emit_all("download-progress", &DownloadProgress {
                model_name: model_name.to_string(),
                progress: 1.0,
                downloaded_bytes: 0,
                total_bytes: None,
                download_speed: None,
                eta: None,
                status: DownloadStatus::Completed,
            }).ok();
            return Ok(());
        }

        // 다운로드 시작 알림
        app_handle.emit_all("download-progress", &DownloadProgress {
            model_name: model_name.to_string(),
            progress: 0.0,
            downloaded_bytes: 0,
            total_bytes: None,
            download_speed: None,
            eta: None,
            status: DownloadStatus::Starting,
        }).ok();

        // curl 명령어로 다운로드 (진행률 표시 포함)
        let mut cmd = TokioCommand::new("curl")
            .args([
                "-L",  // 리다이렉트 따라가기
                "-#",  // 진행률 바 표시
                "--progress-bar",
                "-o", &output_file.to_string_lossy(),
                &model_url
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let model_name_clone = model_name.to_string();
        let app_handle_stderr = app_handle.clone();
        
        // stderr에서 진행률 파싱
        if let Some(stderr) = cmd.stderr.take() {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if let Some(progress) = parse_curl_progress(&line, &model_name_clone) {
                        app_handle_stderr.emit_all("download-progress", &progress).ok();
                    }
                }
            });
        }

        let output = cmd.wait_with_output().await?;

        if output.status.success() {
            // 다운로드 완료
            app_handle.emit_all("download-progress", &DownloadProgress {
                model_name: model_name.to_string(),
                progress: 1.0,
                downloaded_bytes: 0,
                total_bytes: None,
                download_speed: None,
                eta: None,
                status: DownloadStatus::Completed,
            }).ok();
            Ok(())
        } else {
            // 다운로드 실패
            app_handle.emit_all("download-progress", &DownloadProgress {
                model_name: model_name.to_string(),
                progress: 0.0,
                downloaded_bytes: 0,
                total_bytes: None,
                download_speed: None,
                eta: None,
                status: DownloadStatus::Failed,
            }).ok();
            
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(anyhow::anyhow!("Download failed: {}", stderr))
        }
    }

    async fn emit_log(&self, app_handle: Option<&tauri::AppHandle>, message: &str) {
        if let Some(handle) = app_handle {
            handle.emit_all("setup-log", message).ok();
        }
    }
}

fn get_model_url(model_name: &str) -> anyhow::Result<String> {
    let base_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
    
    let url = match model_name {
        "tiny" => format!("{}/ggml-tiny.bin", base_url),
        "tiny.en" => format!("{}/ggml-tiny.en.bin", base_url),
        "base" => format!("{}/ggml-base.bin", base_url),
        "base.en" => format!("{}/ggml-base.en.bin", base_url),
        "small" => format!("{}/ggml-small.bin", base_url),
        "small.en" => format!("{}/ggml-small.en.bin", base_url),
        "medium" => format!("{}/ggml-medium.bin", base_url),
        "medium.en" => format!("{}/ggml-medium.en.bin", base_url),
        "large-v1" => format!("{}/ggml-large-v1.bin", base_url),
        "large-v2" => format!("{}/ggml-large-v2.bin", base_url),
        "large-v3" => format!("{}/ggml-large-v3.bin", base_url),
        _ => return Err(anyhow::anyhow!("Unknown model: {}", model_name)),
    };
    
    Ok(url)
}

fn parse_curl_progress(line: &str, model_name: &str) -> Option<crate::models::DownloadProgress> {
    use crate::models::{DownloadProgress, DownloadStatus};
    
    // curl의 progress bar 출력 파싱
    // 예시: "######################################################################## 100.0%"
    if line.contains('%') {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if let Some(percentage_str) = parts.iter().find(|s| s.contains('%')) {
            if let Ok(percentage) = percentage_str.trim_end_matches('%').parse::<f32>() {
                return Some(DownloadProgress {
                    model_name: model_name.to_string(),
                    progress: percentage / 100.0,
                    downloaded_bytes: 0,
                    total_bytes: None,
                    download_speed: None,
                    eta: None,
                    status: if percentage >= 100.0 { 
                        DownloadStatus::Completed 
                    } else { 
                        DownloadStatus::Downloading 
                    },
                });
            }
        }
    }
    
    // wget 스타일 출력도 파싱 (백업용)
    // 예시: "50% [======>     ] 1,234,567  123KB/s  eta 2m 30s"
    if line.contains('[') && line.contains(']') && line.contains('%') {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if let Some(percentage_str) = parts.first() {
            if let Ok(percentage) = percentage_str.trim_end_matches('%').parse::<f32>() {
                let download_speed = parts.iter()
                    .find(|s| s.contains("B/s"))
                    .map(|s| s.to_string());
                
                let eta = if let Some(eta_idx) = parts.iter().position(|&s| s == "eta") {
                    if eta_idx + 1 < parts.len() {
                        Some(parts[eta_idx + 1..].join(" "))
                    } else {
                        None
                    }
                } else {
                    None
                };
                
                return Some(DownloadProgress {
                    model_name: model_name.to_string(),
                    progress: percentage / 100.0,
                    downloaded_bytes: 0,
                    total_bytes: None,
                    download_speed,
                    eta,
                    status: if percentage >= 100.0 { 
                        DownloadStatus::Completed 
                    } else { 
                        DownloadStatus::Downloading 
                    },
                });
            }
        }
    }
    
    None
}