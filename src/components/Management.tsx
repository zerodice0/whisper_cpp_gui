import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { whisperApi, DownloadProgress } from '../services/api';
import { DeleteModelModal } from './DeleteModelModal';

export const Management: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  const getModelSize = (model: string) => {
    return t(`management.modelSizes.${model}`, { defaultValue: t('common.unknownSize') });
  };

  const getModelDescription = (model: string) => {
    return t(`management.modelDescriptions.${model}`, { defaultValue: t('common.noDescription') });
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

    try {
      await whisperApi.downloadModelWithProgress(modelName);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadProgress(prev => ({
        ...prev,
        [modelName]: {
          model_name: modelName,
          progress: 0,
          downloaded_bytes: 0,
          status: 'Failed'
        }
      }));
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
    }
  };

  const handleDeleteModel = (modelName: string) => {
    setModelToDelete(modelName);
    setDeleteModalOpen(true);
  };

  const confirmDeleteModel = async () => {
    setIsDeleting(true);
    try {
      await whisperApi.deleteModel(modelToDelete);
      setDeleteModalOpen(false);
      setModelToDelete('');
      // 모델 목록 새로고침
      loadModels();
      console.log(t('management.deleteSuccess'));
    } catch (error) {
      console.error('Delete failed:', error);
      console.log(t('management.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteModel = () => {
    setDeleteModalOpen(false);
    setModelToDelete('');
  };

  useEffect(() => {
    loadModels();
    
    // 다운로드 진행률 이벤트 리스너 설정
    const setupListeners = async () => {
      const progressUnlisten = await listen<DownloadProgress>('download-progress', (event) => {
        const progress = event.payload;
        setDownloadProgress(prev => ({
          ...prev,
          [progress.model_name]: progress
        }));

        // 다운로드 완료 시 처리
        if (progress.status === 'Completed') {
          setDownloadingModels(prev => {
            const newSet = new Set(prev);
            newSet.delete(progress.model_name);
            return newSet;
          });
          // 모델 목록 새로고침
          loadModels();
        } else if (progress.status === 'Failed') {
          setDownloadingModels(prev => {
            const newSet = new Set(prev);
            newSet.delete(progress.model_name);
            return newSet;
          });
        }
      });

      return () => {
        progressUnlisten();
      };
    };

    setupListeners();
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
                <p className="text-sm text-green-700 mb-3">
                  {getModelDescription(model)}
                </p>
                <p className="text-xs text-green-600 mb-3">
                  {t('common.size')}: {getModelSize(model)}
                </p>
                <button
                  onClick={() => handleDeleteModel(model)}
                  className="w-full px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {t('management.deleteModel')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 사용 가능한 모델 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('management.availableModels')}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableModels.map((model) => {
            const isDownloaded = downloadedModels.includes(model);
            const isDownloading = downloadingModels.has(model);
            const progress = downloadProgress[model];
            
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
                    {getModelSize(model)}
                  </span>
                </div>
                
                <p className={`text-sm mb-3 ${isDownloaded ? 'text-green-700' : 'text-gray-600'}`}>
                  {getModelDescription(model)}
                </p>
                
                {/* 다운로드 진행률 표시 */}
                {isDownloading && progress && (
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {progress.status === 'Starting' && t('download.starting')}
                        {progress.status === 'Downloading' && t('download.downloading')}
                        {progress.status === 'Completed' && t('common.completed')}
                        {progress.status === 'Failed' && t('common.failed')}
                      </span>
                      <span className="font-medium text-blue-600">
                        {Math.round(progress.progress * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress.progress * 100}%` }}
                      />
                    </div>
                    {progress.download_speed && (
                      <div className="text-xs text-gray-500">
                        {t('download.speed', { speed: progress.download_speed })}
                        {progress.eta && ` • ${t('download.eta', { eta: progress.eta })}`}
                      </div>
                    )}
                  </div>
                )}
                
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
                  {isDownloaded ? t('common.installed') : isDownloading ? t('download.downloading') : t('common.download')}
                </button>
                
                {/* 다운로드 상태 메시지 */}
                {progress && progress.status === 'Failed' && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    ❌ {t('download.failedRetry')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 모델 정보 */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="text-blue-900 font-medium mb-2">{t('management.modelSelectionGuide')}</h4>
        <div className="text-blue-800 text-sm space-y-2">
          <p>{t('management.guideFirstTime')}</p>
          <p>{t('management.guideFastProcessing')}</p>
          <p>{t('management.guideBestQuality')}</p>
          <p>{t('management.guideEnglishOnly')}</p>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <DeleteModelModal
        isOpen={deleteModalOpen}
        modelName={modelToDelete}
        onConfirm={confirmDeleteModel}
        onCancel={cancelDeleteModel}
        isDeleting={isDeleting}
      />
    </div>
  );
});