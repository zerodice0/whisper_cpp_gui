use std::path::Path;

pub fn ensure_directory_exists(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}

pub fn is_audio_file(file_path: &str) -> bool {
    let audio_extensions = ["mp3", "wav", "m4a", "flac", "aac", "ogg"];
    
    Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| audio_extensions.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}