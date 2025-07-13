import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { whisperApi } from '../services/api';

export const Dashboard: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const { 
    systemStatus, 
    currentFile, 
    status, 
    progress,
    setWhisperInstalled,
    setModelsCount 
  } = useAppStore();

  const loadSystemStatus = async () => {
    try {
      const [isInstalled, models] = await Promise.all([
        whisperApi.checkInstallation(),
        whisperApi.listDownloadedModels()
      ]);
      
      setWhisperInstalled(isInstalled);
      setModelsCount(models.length);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const formatLastTranscriptionTime = (timestamp: string | null) => {
    if (!timestamp) return t('dashboard.noRecentFiles');
    return new Date(timestamp).toLocaleString();
  };

  const getCurrentTaskInfo = () => {
    if (!currentFile) return null;
    
    const fileName = currentFile.split('/').pop() || '';
    return {
      fileName,
      status,
      progress
    };
  };

  useEffect(() => {
    loadSystemStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h2>
        <p className="text-gray-600 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.whisperInstalled')}</h3>
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
              systemStatus.whisperInstalled 
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {systemStatus.whisperInstalled ? t('dashboard.installed') : t('dashboard.notInstalled')}
            </span>
          </div>
          <div className="mt-4">
            <button 
              onClick={() => window.location.hash = '#setup'}
              className={`px-4 py-2 rounded-md text-sm text-white ${
                systemStatus.whisperInstalled 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {systemStatus.whisperInstalled ? t('setup.updateCheck') : t('dashboard.installWhisper')}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.modelsAvailable')}</h3>
          <p className="text-sm text-gray-600">{systemStatus.modelsCount} {t('dashboard.modelsAvailable').toLowerCase()}</p>
          <div className="mt-4">
            <button 
              onClick={() => window.location.hash = '#management'}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
            >
              {t('dashboard.downloadModel')}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.recentTranscriptions')}</h3>
          <p className="text-sm text-gray-600">
            {formatLastTranscriptionTime(systemStatus.lastTranscriptionTime)}
          </p>
          <div className="mt-4">
            <button 
              onClick={() => window.location.hash = '#transcription'}
              className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700"
            >
              {t('dashboard.startTranscription')}
            </button>
          </div>
        </div>
      </div>

      {/* 현재 작업 상태 */}
      {getCurrentTaskInfo() && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.currentTask')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{getCurrentTaskInfo()?.fileName}</p>
                <p className="text-sm text-gray-500">
                  Status: 
                  <span className={`ml-1 ${
                    status === 'completed' ? 'text-green-600' :
                    status === 'running' ? 'text-blue-600' :
                    status === 'failed' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {status === 'completed' && 'Completed'}
                    {status === 'running' && 'In Progress'}
                    {status === 'failed' && 'Failed'}
                    {status === 'idle' && 'Idle'}
                  </span>
                </p>
              </div>
              {status === 'running' && (
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-600">{Math.round(progress * 100)}%</p>
                </div>
              )}
            </div>
            
            {status === 'running' && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.gettingStarted')}</h3>
        <div className="space-y-3">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">1</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">{t('dashboard.step1Title')}</p>
              <p className="text-sm text-gray-600">{t('dashboard.step1Description')}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium">2</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">{t('dashboard.step2Title')}</p>
              <p className="text-sm text-gray-600">{t('dashboard.step2Description')}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium">3</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">{t('dashboard.step3Title')}</p>
              <p className="text-sm text-gray-600">{t('dashboard.step3Description')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});