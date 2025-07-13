import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { whisperApi } from '../services/api';

export const Management: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const [downloadLogs, setDownloadLogs] = useState<Record<string, string[]>>({});

  const modelSizes = {
    'tiny': '39 MB',
    'tiny.en': '39 MB',
    'base': '142 MB',
    'base.en': '142 MB',
    'small': '466 MB',
    'small.en': '466 MB',
    'medium': '1.5 GB',
    'medium.en': '1.5 GB',
    'large-v1': '2.9 GB',
    'large-v2': '2.9 GB',
    'large-v3': '2.9 GB',
  };

  const modelDescriptions = {
    'tiny': '가장 빠르지만 정확도가 낮음',
    'tiny.en': 'Tiny 모델 (영어 전용)',
    'base': '속도와 정확도의 균형',
    'base.en': 'Base 모델 (영어 전용)',
    'small': '좋은 정확도, 적당한 속도',
    'small.en': 'Small 모델 (영어 전용)',
    'medium': '높은 정확도, 느린 속도',
    'medium.en': 'Medium 모델 (영어 전용)',
    'large-v1': '최고 정확도 (구 버전)',
    'large-v2': '최고 정확도 (개선 버전)',
    'large-v3': '최신 최고 정확도 모델',
  };

  const loadModels = async () => {
    try {
      const [available, downloaded] = await Promise.all([
        whisperApi.listAvailableModels(),
        whisperApi.listDownloadedModels()
      ]);
      setAvailableModels(available);
      setDownloadedModels(downloaded);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const downloadModel = async (modelName: string) => {
    setDownloadingModels(prev => new Set([...prev, modelName]));
    setDownloadLogs(prev => ({ ...prev, [modelName]: [`모델 ${modelName} 다운로드를 시작합니다...`] }));

    try {
      const result = await whisperApi.downloadModel(modelName);
      setDownloadLogs(prev => ({ 
        ...prev, 
        [modelName]: [...(prev[modelName] || []), `✅ ${result}`] 
      }));
      
      // 다운로드된 모델 목록 새로고침
      await loadModels();
    } catch (error) {
      setDownloadLogs(prev => ({ 
        ...prev, 
        [modelName]: [...(prev[modelName] || []), `❌ 다운로드 실패: ${(error as Error).message}`] 
      }));
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('management.title')}</h2>
        <p className="text-gray-600 mt-1">{t('management.subtitle')}</p>
      </div>

      {/* 다운로드된 모델 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('management.downloadedModels')} ({downloadedModels.length})
        </h3>
        
        {downloadedModels.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {t('management.noModelsDownloaded')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {downloadedModels.map((model) => (
              <div key={model} className="border border-green-200 bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-green-900">{model}</h4>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                    {t('dashboard.installed')}
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  {modelDescriptions[model as keyof typeof modelDescriptions] || '설명 없음'}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  크기: {modelSizes[model as keyof typeof modelSizes] || '알 수 없음'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 사용 가능한 모델 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">사용 가능한 모델</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableModels.map((model) => {
            const isDownloaded = downloadedModels.includes(model);
            const isDownloading = downloadingModels.has(model);
            
            return (
              <div key={model} className={`border p-4 rounded-lg ${
                isDownloaded ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-medium ${isDownloaded ? 'text-green-900' : 'text-gray-900'}`}>
                    {model}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded ${
                    isDownloaded 
                      ? 'text-green-600 bg-green-100'
                      : 'text-blue-600 bg-blue-100'
                  }`}>
                    {modelSizes[model as keyof typeof modelSizes] || '알 수 없음'}
                  </span>
                </div>
                
                <p className={`text-sm mb-3 ${isDownloaded ? 'text-green-700' : 'text-gray-600'}`}>
                  {modelDescriptions[model as keyof typeof modelDescriptions] || '설명 없음'}
                </p>
                
                <button
                  onClick={() => downloadModel(model)}
                  disabled={isDownloaded || isDownloading}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium ${
                    isDownloaded
                      ? 'bg-green-100 text-green-600 cursor-not-allowed'
                      : isDownloading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isDownloaded ? '설치됨' : isDownloading ? '다운로드 중...' : '다운로드'}
                </button>
                
                {downloadLogs[model] && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                    {downloadLogs[model].map((log, index) => (
                      <div key={index} className="text-gray-600">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 모델 정보 */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="text-blue-900 font-medium mb-2">모델 선택 가이드</h4>
        <div className="text-blue-800 text-sm space-y-2">
          <p><strong>처음 사용자:</strong> base 모델 권장 (속도와 정확도의 균형)</p>
          <p><strong>빠른 처리:</strong> tiny 또는 small 모델</p>
          <p><strong>최고 품질:</strong> large-v3 모델 (느리지만 가장 정확)</p>
          <p><strong>영어만:</strong> .en 버전이 해당 언어에서 더 나은 성능</p>
        </div>
      </div>
    </div>
  );
});