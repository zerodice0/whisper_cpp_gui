import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
  
  // 로그 컨테이너 참조
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logContentRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤 함수
  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  // 로그가 변경될 때마다 자동 스크롤
  useEffect(() => {
    if (state.logs.length > 0) {
      // 약간의 지연을 두어 DOM 업데이트 후 스크롤
      setTimeout(scrollToBottom, 50);
    }
  }, [state.logs]);

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
        logs: [...prev.logs, `❌ ${t('transcription.transcriptionFailed')}: ${(error as Error).message}`]
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
          logs: [...prev.logs, `✅ ${t('transcription.transcriptionCompleted')}: ${event.payload}`]
        }));
      });

      // 에러 처리
      const errorUnlisten = await listen<string>('transcription-error', (event) => {
        setState(prev => ({ 
          ...prev, 
          status: 'failed',
          logs: [...prev.logs, `❌ ${t('common.error')}: ${event.payload}`]
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
        <h2 className="text-2xl font-bold text-gray-900">{t('transcription.title')}</h2>
        <p className="text-gray-600 mt-1">{t('transcription.subtitle')}</p>
      </div>

      {/* 파일 선택 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">1. {t('transcription.selectFile')}</h3>
        
        {!state.currentFile ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">
              {t('transcription.dragDropText')}
            </p>
            <button
              onClick={selectFile}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('transcription.selectAudioFile')}
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
                {t('transcription.selectAnotherFile')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 모델 선택 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">2. {t('transcription.selectModel')}</h3>
        
        {downloadedModels.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 mb-2">{t('transcription.noModelsDownloaded')}</p>
            <p className="text-sm text-gray-400">{t('transcription.downloadModelsFirst')}</p>
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">3. {t('transcription.startTranscription')}</h3>
        
        <div className="space-y-4">
          {state.status === 'running' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('transcription.transcriptionProgress')}</span>
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
              {state.status === 'running' ? t('transcription.transcribing') : t('transcription.startTranscription')}
            </button>

            {state.status === 'running' && (
              <button
                onClick={cancelTranscription}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {t('common.cancel')}
              </button>
            )}

            {(state.status === 'completed' || state.status === 'failed') && (
              <button
                onClick={resetTranscription}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                {t('transcription.reset')}
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
              {state.status === 'running' && `🔄 ${t('transcription.processingAudio')}`}
              {state.status === 'completed' && `✅ ${t('transcription.transcriptionComplete')}`}
              {state.status === 'failed' && `❌ ${t('transcription.transcriptionFailed')}`}
            </div>
          )}
        </div>
      </div>

      {/* 실시간 로그 */}
      {state.logs.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">{t('transcription.transcriptionLog')}</h3>
            <div className="flex items-center space-x-2">
              <div className="flex items-center text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                {t('transcription.liveLog')}
              </div>
              <button
                onClick={scrollToBottom}
                className="px-2 py-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
              >
                {t('transcription.scrollToBottom')}
              </button>
            </div>
          </div>
          <div 
            ref={logContainerRef}
            className="bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div ref={logContentRef} className="font-mono text-sm space-y-1">
              {state.logs.map((log, index) => (
                <div key={index} className="text-gray-700 py-1 border-l-2 border-transparent hover:border-blue-300 hover:bg-blue-50 pl-2 -ml-2 transition-colors">
                  <span className="text-gray-400 mr-2">{String(index + 1).padStart(3, '0')}:</span>
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