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

        // wget 명령어로 다운로드 (실시간 진행률 파싱)
        let mut cmd = TokioCommand::new("wget")
            .args([
                "--progress=dot:giga",   // 더 자주 업데이트되는 dot 형식 사용
                "--show-progress",       // 진행률 표시
                "-O", &output_file.to_string_lossy(),
                &model_url
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let model_name_clone = model_name.to_string();
        let app_handle_stderr = app_handle.clone();
        
        // wget 진행률 파싱이 활성화되었는지 추적하기 위한 공유 상태
        let wget_active = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let wget_active_clone = wget_active.clone();

        // stderr에서 wget 진행률 파싱
        if let Some(stderr) = cmd.stderr.take() {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    // 모든 wget 출력 디버깅
                    eprintln!("WGET STDERR: '{}'", line);
                    
                    if let Some(progress) = parse_wget_progress(&line, &model_name_clone) {
                        eprintln!("PARSED PROGRESS: {:?}", progress);
                        
                        // wget 파싱이 활성화됨을 표시
                        wget_active_clone.store(true, std::sync::atomic::Ordering::Relaxed);
                        
                        app_handle_stderr.emit_all("download-progress", &progress).ok();
                    }
                }
            });
        }

        // wget 파싱이 잘 작동하므로 파일 크기 모니터링 임시 비활성화
        // (필요시 나중에 활성화 가능)
        let size_monitor = tokio::spawn(async move {
            // 빈 태스크 - wget 파싱만 사용
            eprintln!("FILE SIZE MONITORING DISABLED - USING WGET PARSING ONLY");
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        let output = cmd.wait_with_output().await?;
        
        // 파일 크기 모니터링 중단
        size_monitor.abort();

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

async fn get_remote_file_size(url: &str) -> anyhow::Result<u64> {
    // wget을 사용하여 파일 크기 확인
    let output = TokioCommand::new("wget")
        .args([
            "--spider",           // 파일을 다운로드하지 않고 헤더만 확인
            "--server-response",  // 서버 응답 헤더 표시
            url
        ])
        .output()
        .await?;

    // wget은 헤더 정보를 stderr에 출력
    let stderr_output = String::from_utf8_lossy(&output.stderr);
    
    let mut last_content_length = None;
    
    // Content-Length 헤더 찾기
    for line in stderr_output.lines() {
        if line.to_lowercase().contains("content-length:") {
            if let Some(size_str) = line.split(':').nth(1) {
                if let Ok(size) = size_str.trim().parse::<u64>() {
                    last_content_length = Some(size);
                }
            }
        }
    }
    
    if let Some(size) = last_content_length {
        return Ok(size);
    }
    
    Err(anyhow::anyhow!("Could not determine file size"))
}

fn get_expected_model_size(model_name: &str) -> u64 {
    // 예상 모델 크기 (바이트 단위)
    match model_name {
        "tiny" | "tiny.en" => 39 * 1024 * 1024,           // 39 MB
        "base" | "base.en" => 142 * 1024 * 1024,          // 142 MB
        "small" | "small.en" => 466 * 1024 * 1024,        // 466 MB
        "medium" | "medium.en" => 1500 * 1024 * 1024,     // 1.5 GB
        "large-v1" | "large-v2" | "large-v3" => 2900 * 1024 * 1024, // 2.9 GB
        _ => 1000 * 1024 * 1024, // 기본값 1GB
    }
}

fn parse_wget_progress(line: &str, model_name: &str) -> Option<crate::models::DownloadProgress> {
    use crate::models::{DownloadProgress, DownloadStatus};
    
    // wget 진행률 출력 파싱
    // 다양한 형식 지원:
    // 1. Bar 형식: "test_download        95%[==================> ]  46.72K   491 B/s    약 5s"
    // 2. Dot 형식: "     0K .......... .......... .......... .......... ..........  0%  491K 5s"
    // 3. Show-progress 형식: "46,720K  .......... .......... .......... .......... ..........  95%  491K 5s"
    
    // 모든 wget 출력을 더 자세히 디버깅
    eprintln!("WGET LINE ANALYSIS: '{}'", line);
    
    // 패턴 1: 퍼센티지 찾기 (95%, 100% 등)
    if let Some(percent_pos) = line.find('%') {
        // 퍼센티지 앞의 숫자 찾기
        let before_percent = &line[..percent_pos];
        
        // 여러 패턴으로 퍼센티지 추출 시도
        let percentage = if let Some(last_space) = before_percent.rfind(' ') {
            // 공백으로 구분된 경우
            before_percent[last_space + 1..].parse::<f32>().ok()
        } else if let Some(last_bracket) = before_percent.rfind(']') {
            // 대괄호 다음에 오는 경우
            before_percent[last_bracket + 1..].trim().parse::<f32>().ok()
        } else {
            // 직접 파싱 시도
            before_percent.trim().parse::<f32>().ok()
        };
        
        if let Some(percentage) = percentage {
            let progress = percentage / 100.0;
            
            eprintln!("FOUND PERCENTAGE: {}% -> progress: {}", percentage, progress);
            
            // 다운로드 속도 파싱 (K/s, M/s, B/s 등)
            let download_speed = extract_speed_from_line(line);
            
            // ETA 파싱 (초 단위)
            let eta = extract_eta_from_line(line);
            
            // 다운로드된 크기 파싱
            let downloaded_bytes = parse_size_from_line(line);
            
            return Some(DownloadProgress {
                model_name: model_name.to_string(),
                progress,
                downloaded_bytes,
                total_bytes: None,
                download_speed,
                eta,
                status: if progress >= 1.0 { 
                    DownloadStatus::Completed 
                } else { 
                    DownloadStatus::Downloading 
                },
            });
        }
    }
    
    // 패턴 2: "received/total" 형식 파싱 (일부 wget 버전에서 사용)
    if line.contains("received") || line.contains("saved") {
        eprintln!("FOUND RECEIVED/SAVED PATTERN: {}", line);
        // 이 경우에도 파싱 로직 추가 가능
    }
    
    None
}

fn extract_speed_from_line(line: &str) -> Option<String> {
    // 속도 패턴 찾기: "491K", "1.2M", "500B" 등 뒤에 "/s" 또는 단독으로
    let parts: Vec<&str> = line.split_whitespace().collect();
    
    for (i, part) in parts.iter().enumerate() {
        // "K/s", "M/s", "B/s" 형태
        if part.ends_with("K/s") || part.ends_with("M/s") || part.ends_with("B/s") {
            return Some(part.to_string());
        }
        // "K", "M" 뒤에 "/s"가 올 수 있음
        if (part.ends_with('K') || part.ends_with('M')) && i + 1 < parts.len() {
            if parts[i + 1] == "/s" || parts[i + 1].starts_with("/") {
                return Some(format!("{}/s", part));
            }
        }
        // 단독 "K", "M" 형태 (wget dot 형식에서 자주 보임)
        if part.ends_with('K') || part.ends_with('M') {
            // 숫자로 시작하는지 확인
            if part.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                return Some(format!("{}/s", part));
            }
        }
    }
    
    None
}

fn extract_eta_from_line(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    
    // 마지막 부분에서 시간 형식 찾기 ("5s", "1m", "10m", "1h2m" 등)
    for part in parts.iter().rev() {
        if part.ends_with('s') || part.ends_with('m') || part.ends_with('h') {
            if part.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                return Some(part.to_string());
            }
        }
    }
    
    None
}

fn parse_size_from_line(line: &str) -> u64 {
    // 크기 표시를 찾기 (예: "46.72K", "1.2M", "1234")
    let parts: Vec<&str> = line.split_whitespace().collect();
    
    for part in parts.iter() {
        if part.ends_with('K') || part.ends_with('M') || part.ends_with('G') {
            if let Ok(num) = part[..part.len()-1].parse::<f64>() {
                let multiplier = match part.chars().last() {
                    Some('K') => 1024,
                    Some('M') => 1024 * 1024,
                    Some('G') => 1024 * 1024 * 1024,
                    _ => 1,
                };
                return (num * multiplier as f64) as u64;
            }
        } else if let Ok(num) = part.parse::<u64>() {
            // 일반 숫자인 경우
            if num > 1000 { // 바이트 크기로 추정되는 큰 숫자
                return num;
            }
        }
    }
    
    0
}