# Whisper GUI 프로젝트 명세서

## 프로젝트 개요
Tauri + React 기반 whisper.cpp GUI 애플리케이션 (단일 파일 처리, 함수형 프로그래밍)

## 기능 요구사항
- [ ] whisper.cpp 자동 설치/빌드/업데이트
- [ ] 단일 파일 음성 인식 (배치 처리 없음)
- [ ] 실시간 터미널 출력 파싱 및 진행률 표시
- [ ] 동적 옵션 파싱 (--help 기반)
- [ ] SRT/FCPXML 내보내기
- [ ] 모델 관리 (공식/커스텀)

## 화면 구성
```
Header + Sidebar + Main Content
├── Dashboard: 상태 개요, 최근 파일
├── Setup: 초기 설정 마법사
├── Management: whisper.cpp/모델 관리  
├── Transcription: 단일 파일 처리
├── Output: 결과 표시/편집
└── Export: 내보내기 옵션
```

## 프로젝트 구조
```
whisper-gui/
├── src-tauri/src/
│   ├── commands/          # Tauri 명령들
│   ├── services/          # 핵심 비즈니스 로직
│   ├── models/            # 데이터 구조체
│   └── utils/             # 헬퍼 함수들
└── src/
    ├── components/        # React 컴포넌트
    ├── hooks/             # 커스텀 훅
    ├── services/          # API 래퍼
    ├── store/             # Zustand 상태 관리
    └── utils/             # 순수함수 유틸리티
```

## 기술 스택
**프론트엔드**: React 18 + Vite + Zustand + Tailwind CSS + HeadlessUI
**백엔드**: Tauri 1.4 + Tokio + Serde + Git2
**선택적**: reqwest, zip (커스텀 모델용)

## 핵심 데이터 모델
```rust
// 단일 파일 처리 상태
pub struct TranscriptionState {
    pub file_path: Option<PathBuf>,
    pub status: TranscriptionStatus,  // Idle, Running, Completed, Failed
    pub progress: f32,                // 0.0 ~ 1.0
    pub logs: Vec<String>,            // 실시간 whisper.cpp 출력
    pub result: Option<String>,       // 최종 결과
}

// 진행률 정보
pub struct ProgressInfo {
    pub progress: f32,
    pub current_time: Option<f32>,
    pub message: String,
}
```

## 주요 이벤트
- `transcription-progress`: 진행률 업데이트 (0.0-1.0)
- `transcription-log`: whisper.cpp 실시간 출력
- `transcription-complete`: 완료 시 결과 전송
- `error`: 에러 발생

## 함수형 프로그래밍 원칙
1. **순수함수 우선**: 사이드 이펙트 최소화
2. **불변성**: 상태 변경 시 새 객체 반환
3. **함수 분해**: 작은 단위로 기능 분리
4. **사이드 이펙트 분리**: I/O와 순수 로직 구분

### Rust 예시
```rust
// 순수함수
pub fn parse_whisper_output_line(line: &str) -> Option<ProgressInfo> {
    parse_time_pattern(line)
        .or_else(|| parse_percent_pattern(line))
}

// 불변 상태 변경
impl TranscriptionState {
    pub fn with_progress(self, progress: f32) -> Self {
        Self { progress, ..self }
    }
}
```

### React 예시
```javascript
// 순수 컴포넌트
export const ProgressTracker = React.memo(({ progress, status, onCancel }) => (
  <div>
    <ProgressBar progress={progress} />
    <StatusDisplay status={status} />
    {status === 'running' && <button onClick={onCancel}>취소</button>}
  </div>
));

// 불변 상태 관리 (Zustand + Immer)
export const useTranscriptionStore = create(immer((set) => ({
  currentFile: null,
  status: 'idle',
  progress: 0,
  logs: [],
  
  setProgress: (progress) => set((state) => {
    state.progress = Math.max(0, Math.min(1, progress));
  }),
})));
```

## 핵심 기능 구현

### 실시간 터미널 출력 파싱
```rust
// stdout/stderr 스트리밍
pub async fn start_transcription_with_streaming(&self, file_path: &str) -> Result<()> {
    let mut cmd = Command::new(&self.whisper_binary_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = cmd.stdout.take().unwrap();
    let app_handle = self.app_handle.clone();
    
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            app_handle.emit_all("transcription-log", &line).ok();
            if let Some(progress) = parse_whisper_output_line(&line) {
                app_handle.emit_all("transcription-progress", &progress).ok();
            }
        }
    });
}
```

### 모델 관리 (내장 스크립트 활용)
```rust
pub async fn download_official_model(&self, model_name: &str) -> Result<()> {
    let script_path = self.get_download_script_path()?;
    
    let output = Command::new("bash")
        .args([&script_path.to_string_lossy(), model_name])
        .current_dir(&self.models_path)
        .output().await?;
        
    if !output.status.success() {
        return Err(anyhow::anyhow!("모델 다운로드 실패"));
    }
    Ok(())
}
```

## 개발 순서
1. **기본 Tauri 앱 + React UI 구성**
2. **설정 관리 + whisper.cpp 설치**
3. **모델 관리 (공식 모델 다운로드)**
4. **단일 파일 음성 인식 + 실시간 로그**
5. **결과 처리 + SRT/FCPXML 내보내기**
6. **UI/UX 개선 + 에러 처리 강화**

## 주요 체크리스트
- [ ] 단일 파일만 처리 (큐/배치 없음)
- [ ] whisper.cpp stdout/stderr 실시간 스트리밍
- [ ] 터미널 출력에서 진행률 파싱
- [ ] 순수함수 기반 상태 관리
- [ ] 모든 사이드 이펙트 명시적 분리
- [ ] 불변성 기반 데이터 구조