# Whisper GUI

Tauri와 React로 구축된 사용자 친화적인 인터페이스를 가진 [whisper.cpp](https://github.com/ggerganov/whisper.cpp)용 현대적인 데스크톱 애플리케이션입니다.

[English README](README.md)

## 주요 기능

- **간편한 설치**: whisper.cpp 자동 설치 및 설정
- **모델 관리**: 공식 Whisper 모델 다운로드 및 관리
- **단일 파일 처리**: 실시간 진행률과 함께 오디오 파일을 텍스트로 변환
- **다양한 내보내기 형식**: SRT 자막, FCPXML, 일반 텍스트로 결과 내보내기
- **다국어 지원**: 영어 및 한국어 인터페이스
- **크로스 플랫폼**: macOS, Windows, Linux 지원

## 스크린샷

*스크린샷은 곧 추가될 예정입니다*

## 설치

### 사전 요구사항

- **macOS**: Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```

- **Windows**: Microsoft C++ Build Tools 또는 Visual Studio

- **Linux**: Build essentials
  ```bash
  sudo apt install build-essential git
  ```

### 다운로드

1. [Releases](https://github.com/your-username/whisper-gui/releases)에서 최신 버전 다운로드
2. 애플리케이션 설치
3. Whisper GUI 실행
4. 설정 마법사를 따라 whisper.cpp 설치

## 개발

### 사전 요구사항

- [Node.js](https://nodejs.org/) (v18 이상)
- [Rust](https://rustup.rs/) (최신 안정 버전)
- 플랫폼별 의존성 (설치 섹션 참조)

### 설정

1. 저장소 클론:
   ```bash
   git clone https://github.com/your-username/whisper-gui.git
   cd whisper-gui
   ```

2. 의존성 설치:
   ```bash
   npm install
   ```

3. 개발 서버 시작:
   ```bash
   npm run tauri dev
   ```

### 빌드

프로덕션 빌드:
```bash
npm run tauri build
```

## 아키텍처

이 애플리케이션은 함수형 프로그래밍 원칙을 따르며 다음으로 구축되었습니다:

- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS
- **백엔드**: Tauri (Rust) + 비동기 작업을 위한 Tokio
- **상태 관리**: 함수형 상태 업데이트를 위한 Zustand + Immer
- **국제화**: 다국어 지원을 위한 react-i18next

### 프로젝트 구조

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
    ├── i18n/              # 국제화
    └── utils/             # 순수함수 유틸리티
```

## 핵심 기능

### 🔧 설정 및 설치
- whisper.cpp 저장소 자동 클론
- 지능적인 빌드 시스템 감지 (Make/CMake)
- 상세한 로그와 함께 실시간 설치 진행률
- 시스템 요구사항 검증

### 📦 모델 관리
- 공식 Whisper 모델 탐색 및 다운로드
- 모델 크기 정보 및 다운로드 진행률
- 로컬 모델 저장 및 관리

### 🎤 오디오 음성 인식  
- 드래그 앤 드롭 오디오 파일 지원
- 실시간 음성 인식 진행률
- 다양한 오디오 형식 지원 (MP3, WAV, FLAC, M4A, OGG)
- 단일 파일 처리 (배치 작업 없음)

### 📄 출력 및 내보내기
- 음성 인식 결과 보기 및 편집
- 비디오 편집용 SRT 자막으로 내보내기
- Final Cut Pro용 FCPXML로 내보내기
- 클립보드 복사 기능이 있는 일반 텍스트 내보내기

## 함수형 프로그래밍 원칙

이 프로젝트는 함수형 프로그래밍 개념을 준수합니다:

### 순수 함수
```rust
// Rust 예시
pub fn parse_whisper_output_line(line: &str) -> Option<ProgressInfo> {
    parse_time_pattern(line)
        .or_else(|| parse_percent_pattern(line))
}
```

### 불변 상태 업데이트
```javascript
// Zustand + Immer를 사용한 React 예시
export const useTranscriptionStore = create(immer((set) => ({
  progress: 0,
  setProgress: (progress) => set((state) => {
    state.progress = Math.max(0, Math.min(1, progress));
  }),
})));
```

### 사이드 이펙트 분리
- I/O 작업은 순수 로직과 명확히 분리됨
- 모든 사이드 이펙트는 전용 서비스 레이어에서 처리
- 상태 변경은 잘 정의된 업데이트 함수를 통해 흐름

## 기여하기

기여를 환영합니다! 자세한 내용은 [기여 가이드](CONTRIBUTING.md)를 읽어주세요.

### 개발 가이드라인

1. 함수형 프로그래밍 원칙 따르기
2. 가능한 한 순수 함수 작성
3. 비즈니스 로직에서 사이드 이펙트 분리
4. 새로운 기능에 대한 테스트 추가
5. API 변경 사항에 대한 문서 업데이트
6. 타입 안전성을 위해 TypeScript 사용

### 코드 스타일

- **Rust**: `cargo fmt`로 표준 Rust 관례 따르기
- **TypeScript/React**: 제공된 구성으로 Prettier 사용
- **커밋**: 관례적인 커밋 메시지 사용

## 라이선스

이 프로젝트는 MIT 라이선스 하에 라이선스가 부여됩니다 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 감사의 말

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - 핵심 오디오 음성 인식 엔진
- [Tauri](https://tauri.app/) - 애플리케이션 프레임워크
- [OpenAI Whisper](https://openai.com/research/whisper) - 원래 Whisper 모델

## 지원

문제가 발생하거나 질문이 있으면:

1. [FAQ](docs/FAQ.md) 확인
2. [기존 이슈](https://github.com/your-username/whisper-gui/issues) 검색
3. 상세한 정보와 함께 [새로운 이슈](https://github.com/your-username/whisper-gui/issues/new) 생성

## 로드맵

- [ ] 배치 처리 지원
- [ ] 커스텀 모델 지원
- [ ] 고급 오디오 전처리 옵션
- [ ] 커스텀 내보내기 형식을 위한 플러그인 시스템
- [ ] 클라우드 모델 지원
- [ ] 실시간 오디오 음성 인식