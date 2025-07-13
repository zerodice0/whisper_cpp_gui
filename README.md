# Whisper GUI

A modern desktop application for [whisper.cpp](https://github.com/ggerganov/whisper.cpp) with a user-friendly interface built using Tauri and React.

[한국어 README](README_ko.md)

## Features

- **Easy Installation**: Automatic whisper.cpp installation and setup
- **Model Management**: Download and manage official Whisper models
- **Single File Processing**: Convert audio files to text with real-time progress
- **Multiple Export Formats**: Export results as SRT subtitles, FCPXML, or plain text
- **Multilingual Support**: English and Korean interface
- **Cross-Platform**: Supports macOS, Windows, and Linux

## Screenshots

*Screenshots will be added soon*

## Installation

### Prerequisites

- **macOS**: Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```

- **Windows**: Microsoft C++ Build Tools or Visual Studio

- **Linux**: Build essentials
  ```bash
  sudo apt install build-essential git
  ```

### Download

1. Download the latest release from [Releases](https://github.com/your-username/whisper-gui/releases)
2. Install the application
3. Launch Whisper GUI
4. Follow the setup wizard to install whisper.cpp

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific dependencies (see Installation section)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/whisper-gui.git
   cd whisper-gui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run tauri dev
   ```

### Building

Build for production:
```bash
npm run tauri build
```

## Architecture

This application follows functional programming principles and is built with:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Tauri (Rust) + Tokio for async operations
- **State Management**: Zustand with Immer for functional state updates
- **Internationalization**: react-i18next for multi-language support

### Project Structure

```
whisper-gui/
├── src-tauri/src/
│   ├── commands/          # Tauri commands
│   ├── services/          # Core business logic
│   ├── models/            # Data structures
│   └── utils/             # Helper functions
└── src/
    ├── components/        # React components
    ├── hooks/             # Custom hooks
    ├── services/          # API wrappers
    ├── store/             # Zustand state management
    ├── i18n/              # Internationalization
    └── utils/             # Pure function utilities
```

## Core Features

### 🔧 Setup & Installation
- Automatic whisper.cpp repository cloning
- Intelligent build system detection (Make/CMake)
- Real-time installation progress with detailed logs
- System requirements validation

### 📦 Model Management
- Browse and download official Whisper models
- Model size information and download progress
- Local model storage and management

### 🎤 Audio Transcription  
- Drag & drop audio file support
- Real-time transcription progress
- Support for multiple audio formats (MP3, WAV, FLAC, M4A, OGG)
- Single file processing (no batch operations)

### 📄 Output & Export
- View and edit transcription results
- Export to SRT subtitles for video editing
- Export to FCPXML for Final Cut Pro
- Plain text export with copy to clipboard

## Functional Programming Principles

This project adheres to functional programming concepts:

### Pure Functions
```rust
// Rust example
pub fn parse_whisper_output_line(line: &str) -> Option<ProgressInfo> {
    parse_time_pattern(line)
        .or_else(|| parse_percent_pattern(line))
}
```

### Immutable State Updates
```javascript
// React example with Zustand + Immer
export const useTranscriptionStore = create(immer((set) => ({
  progress: 0,
  setProgress: (progress) => set((state) => {
    state.progress = Math.max(0, Math.min(1, progress));
  }),
})));
```

### Side Effect Isolation
- I/O operations are clearly separated from pure logic
- All side effects are handled in dedicated service layers
- State changes flow through well-defined update functions

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines

1. Follow functional programming principles
2. Write pure functions whenever possible
3. Separate side effects from business logic
4. Add tests for new features
5. Update documentation for API changes
6. Use TypeScript for type safety

### Code Style

- **Rust**: Follow standard Rust conventions with `cargo fmt`
- **TypeScript/React**: Prettier with provided configuration
- **Commits**: Use conventional commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - The core audio transcription engine
- [Tauri](https://tauri.app/) - The application framework
- [OpenAI Whisper](https://openai.com/research/whisper) - The original Whisper model

## Support

If you encounter any issues or have questions:

1. Check the [FAQ](docs/FAQ.md)
2. Search [existing issues](https://github.com/your-username/whisper-gui/issues)
3. Create a [new issue](https://github.com/your-username/whisper-gui/issues/new) with detailed information

## Roadmap

- [ ] Batch processing support
- [ ] Custom model support
- [ ] Advanced audio preprocessing options
- [ ] Plugin system for custom export formats
- [ ] Cloud model support
- [ ] Real-time audio transcription