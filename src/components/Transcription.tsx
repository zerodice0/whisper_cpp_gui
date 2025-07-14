import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import { whisperApi, ProgressInfo, WhisperOptions, WhisperConfig } from '../services/api';
import { OptionsForm } from './OptionsForm';

interface TranscriptionState {
  currentFile: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  result: string | null;
}

export const Transcription: React.FC = React.memo(() => {
  const [state, setState] = useState<TranscriptionState>({
    currentFile: null,
    status: 'idle',
    progress: 0,
    logs: [],
    result: null,
  });
  
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [whisperOptions, setWhisperOptions] = useState<WhisperOptions | null>(null);
  const [config, setConfig] = useState<Partial<WhisperConfig>>({});

  const loadModels = async () => {
    try {
      const models = await whisperApi.listDownloadedModels();
      setDownloadedModels(models);
      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0]);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const loadWhisperOptions = async () => {
    try {
      const options = await whisperApi.getWhisperOptions();
      setWhisperOptions(options);
    } catch (error) {
      console.error('Failed to load whisper options:', error);
    }
  };

  const selectFile = async () => {
    try {
      const selected = await open({
        filters: [
          {
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg', 'mp4', 'avi', 'mov', 'mkv']
          }
        ]
      });

      if (selected && typeof selected === 'string') {
        setState(prev => ({ ...prev, currentFile: selected, status: 'idle', logs: [], result: null }));
      }
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };

  const startTranscription = async () => {
    if (!state.currentFile || !selectedModel) {
      return;
    }

    setState(prev => ({ 
      ...prev, 
      status: 'running', 
      progress: 0, 
      logs: [],
      result: null 
    }));

    try {
      const whisperConfig: WhisperConfig = {
        model: selectedModel,
        input_file: state.currentFile,
        options: config.options || {}
      };
      
      await whisperApi.startTranscriptionWithOptions(whisperConfig);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'failed',
        logs: [...prev.logs, `❌ 변환 실패: ${(error as Error).message}`]
      }));
    }
  };

  const cancelTranscription = () => {
    setState(prev => ({ ...prev, status: 'idle', progress: 0 }));
  };

  const resetTranscription = () => {
    setState({
      currentFile: null,
      status: 'idle',
      progress: 0,
      logs: [],
      result: null,
    });
  };

  // 이벤트 리스너 설정
  useEffect(() => {
    const setupListeners = async () => {
      // 진행률 업데이트
      const progressUnlisten = await listen<ProgressInfo>('transcription-progress', (event) => {
        setState(prev => ({ 
          ...prev, 
          progress: event.payload.progress,
          logs: [...prev.logs, `📊 ${event.payload.message}`]
        }));
      });

      // 로그 업데이트
      const logUnlisten = await listen<string>('transcription-log', (event) => {
        setState(prev => ({ 
          ...prev, 
          logs: [...prev.logs, event.payload]
        }));
      });

      // 완료 처리
      const completeUnlisten = await listen<string>('transcription-complete', (event) => {
        setState(prev => ({ 
          ...prev, 
          status: 'completed',
          progress: 1,
          logs: [...prev.logs, `✅ 변환 완료: ${event.payload}`]
        }));
      });

      // 에러 처리
      const errorUnlisten = await listen<string>('transcription-error', (event) => {
        setState(prev => ({ 
          ...prev, 
          status: 'failed',
          logs: [...prev.logs, `❌ 에러: ${event.payload}`]
        }));
      });

      return () => {
        progressUnlisten();
        logUnlisten();
        completeUnlisten();
        errorUnlisten();
      };
    };

    setupListeners();
    loadModels();
    loadWhisperOptions();
  }, []);

  const getFileSize = (filePath: string) => {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">음성 변환</h2>
        <p className="text-gray-600 mt-1">단일 음성 파일을 텍스트로 변환합니다</p>
      </div>

      {/* 파일 선택 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">1. 파일 선택</h3>
        
        {!state.currentFile ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">
              음성 파일을 선택하세요 (MP3, WAV, M4A, FLAC, AAC, OGG)
            </p>
            <button
              onClick={selectFile}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              파일 선택
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{getFileSize(state.currentFile)}</p>
                <p className="text-sm text-gray-500">{state.currentFile}</p>
              </div>
              <button
                onClick={selectFile}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                다른 파일 선택
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 모델 선택 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">2. 모델 선택</h3>
        
        {downloadedModels.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 mb-2">다운로드된 모델이 없습니다</p>
            <p className="text-sm text-gray-400">Management 탭에서 모델을 다운로드하세요</p>
          </div>
        ) : (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {downloadedModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        )}
      </div>

      {/* whisper.cpp 옵션 */}
      <OptionsForm
        options={whisperOptions}
        onConfigChange={setConfig}
        disabled={state.status === 'running'}
      />

      {/* 변환 실행 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">3. 변환 실행</h3>
        
        <div className="space-y-4">
          {state.status === 'running' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">진행률</span>
                <span className="text-sm font-medium">{Math.round(state.progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${state.progress * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={startTranscription}
              disabled={!state.currentFile || !selectedModel || state.status === 'running' || downloadedModels.length === 0}
              className={`px-4 py-2 rounded-md font-medium ${
                !state.currentFile || !selectedModel || state.status === 'running' || downloadedModels.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {state.status === 'running' ? '변환 중...' : '변환 시작'}
            </button>

            {state.status === 'running' && (
              <button
                onClick={cancelTranscription}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                취소
              </button>
            )}

            {(state.status === 'completed' || state.status === 'failed') && (
              <button
                onClick={resetTranscription}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                초기화
              </button>
            )}
          </div>

          {/* 상태 표시 */}
          {state.status !== 'idle' && (
            <div className={`p-3 rounded-md text-sm ${
              state.status === 'running' 
                ? 'bg-blue-50 text-blue-800'
                : state.status === 'completed'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
            }`}>
              {state.status === 'running' && '🔄 음성을 텍스트로 변환하는 중...'}
              {state.status === 'completed' && '✅ 변환이 완료되었습니다!'}
              {state.status === 'failed' && '❌ 변환에 실패했습니다.'}
            </div>
          )}
        </div>
      </div>

      {/* 실시간 로그 */}
      {state.logs.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">변환 로그</h3>
          <div className="bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto">
            <div className="font-mono text-sm space-y-1">
              {state.logs.map((log, index) => (
                <div key={index} className="text-gray-700">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});