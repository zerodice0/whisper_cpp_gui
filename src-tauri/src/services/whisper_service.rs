use std::path::PathBuf;
use tauri::Manager;
use crate::models::*;
use crate::services::whisper_installer::WhisperInstaller;

pub struct WhisperService {
    pub whisper_repo_path: PathBuf,
    pub whisper_binary_path: PathBuf,
    pub models_path: PathBuf,
    installer: WhisperInstaller,
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
        Ok(vec![
            "tiny".to_string(),
            "tiny.en".to_string(),
            "base".to_string(),
            "base.en".to_string(),
            "small".to_string(),
            "small.en".to_string(),
            "medium".to_string(),
            "medium.en".to_string(),
            "large-v1".to_string(),
            "large-v2".to_string(),
            "large-v3".to_string(),
        ])
    }

    pub async fn list_downloaded_models(&self) -> anyhow::Result<Vec<String>> {
        let mut models = Vec::new();
        
        if self.models_path.exists() {
            let mut dir = tokio::fs::read_dir(&self.models_path).await?;
            while let Some(entry) = dir.next_entry().await? {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".bin") {
                        models.push(name.trim_end_matches(".bin").to_string());
                    }
                }
            }
        }
        
        Ok(models)
    }

    pub async fn download_official_model(&self, model_name: &str) -> anyhow::Result<()> {
        self.installer.download_model(model_name).await
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

        // 실제 바이너리 위치 찾기
        let main_binary = self.whisper_repo_path.join("build").join("bin").join("main");
        let fallback_binary = self.whisper_repo_path.join("build").join("main");
        
        let binary_path = if main_binary.exists() {
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

pub fn parse_whisper_output_line(line: &str) -> Option<ProgressInfo> {
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
    
    if line.contains("whisper_print_timings") {
        return Some(ProgressInfo {
            progress: 1.0,
            current_time: None,
            message: "Processing complete".to_string(),
        });
    }
    
    None
}