import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { whisperApi } from '../services/api';

export const Setup: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [systemRequirements, setSystemRequirements] = useState<string>('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const steps = [
    { title: t('setup.checkingInstallation'), description: t('setup.checkingDescription') },
    { title: t('setup.repositoryClone'), description: t('setup.cloneDescription') },
    { title: t('setup.buildExecution'), description: t('setup.buildDescription') },
    { title: t('setup.installationComplete'), description: t('setup.completeDescription') },
  ];

  const checkInstallation = async () => {
    try {
      const installed = await whisperApi.checkInstallation();
      setIsInstalled(installed);
      if (installed) {
        setCurrentStep(3);
      }
    } catch (error) {
      console.error('Failed to check installation:', error);
      setIsInstalled(false);
    }
  };

  const checkSystemRequirements = async () => {
    try {
      const requirements = await whisperApi.checkSystemRequirements();
      setSystemRequirements(requirements);
    } catch (error) {
      console.error('Failed to check system requirements:', error);
      setSystemRequirements('시스템 요구사항을 확인할 수 없습니다.');
    }
  };

  const startInstallation = async () => {
    setIsInstalling(true);
    setInstallLog([]);
    setCurrentStep(0);

    try {
      addLog('🔄 Whisper.cpp 설치를 시작합니다...');
      setCurrentStep(0);
      
      const result = await whisperApi.setupWhisper();
      
      addLog('✅ ' + result);
      setCurrentStep(3);
      setIsInstalled(true);
      
      // 설치 완료 후 재확인
      await checkInstallation();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog('❌ 설치 실패: ' + errorMessage);
      addLog('💡 문제 해결 방법:');
      addLog('   1. Git이 설치되어 있는지 확인하세요');
      addLog('   2. 인터넷 연결을 확인하세요');
      addLog('   3. 충분한 디스크 공간이 있는지 확인하세요');
      addLog('   4. make 명령어가 설치되어 있는지 확인하세요 (macOS: xcode-select --install)');
      setCurrentStep(0);
    } finally {
      setIsInstalling(false);
    }
  };

  const addLog = (message: string) => {
    setInstallLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // 로그가 업데이트될 때마다 스크롤을 최하단으로 이동
  useEffect(() => {
    if (logEndRef.current && installLog.length > 0) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [installLog]);

  // 로그 메시지에 따라 설치 단계 업데이트
  const updateStepFromLog = (message: string) => {
    // 클론 단계
    if (message.includes('Repository 클론 시작') || message.includes('Git:') || message.includes('클론')) {
      setCurrentStep(1);
    } 
    // 빌드 단계
    else if (message.includes('Make로 컴파일') || message.includes('컴파일:') || message.includes('빌드') || message.includes('정보:')) {
      setCurrentStep(2);
    } 
    // 완료 단계
    else if (message.includes('빌드 완료') || message.includes('successfully built') || message.includes('바이너리 위치')) {
      setCurrentStep(3);
    }
  };

  useEffect(() => {
    checkInstallation();
    checkSystemRequirements();
    
    // 실시간 설치 로그 리스너 설정
    const setupListeners = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      
      const unlisten = await listen<string>('setup-log', (event) => {
        const logMessage = event.payload;
        addLog(logMessage);
        updateStepFromLog(logMessage);
      });
      
      return unlisten;
    };
    
    setupListeners();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('setup.title')}</h2>
        <p className="text-gray-600 mt-1">{t('setup.subtitle')}</p>
      </div>

      {/* 설치 상태 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{t('setup.installationStatus')}</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isInstalled === null 
              ? 'bg-gray-100 text-gray-600' 
              : isInstalled 
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
          }`}>
            {isInstalled === null ? t('dashboard.checking') : isInstalled ? t('dashboard.installed') : t('dashboard.notInstalled')}
          </div>
        </div>

        {isInstalled === false && (
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('setup.notInstalled')}
            </p>
            
            {/* 시스템 요구사항 */}
            {systemRequirements && (
              <div className="bg-gray-50 p-3 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">{t('setup.systemRequirements')}</h4>
                <pre className="text-sm text-gray-600 whitespace-pre-line">{systemRequirements}</pre>
                
                {systemRequirements.includes('❌') && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h5 className="text-sm font-medium text-yellow-800 mb-2">{t('setup.installGuide')}</h5>
                    <div className="text-sm text-yellow-700 space-y-1">
                      <p><strong>{t('setup.macosInstall')}</strong></p>
                      <code className="bg-yellow-100 px-2 py-1 rounded">xcode-select --install</code>
                      <p className="mt-2 text-xs text-yellow-600">
                        {t('setup.installCommand')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={startInstallation}
              disabled={isInstalling}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                isInstalling 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isInstalling ? t('setup.installing') : t('setup.installButton')}
            </button>
          </div>
        )}

        {isInstalled === true && (
          <div className="space-y-4">
            <p className="text-green-600 font-medium">
              {t('setup.successfullyInstalled')}
            </p>
            <button
              onClick={startInstallation}
              disabled={isInstalling}
              className="px-4 py-2 rounded-md text-white font-medium bg-green-600 hover:bg-green-700"
            >
              {t('setup.updateCheck')}
            </button>
          </div>
        )}
      </div>

      {/* 설치 진행 단계 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('setup.installationSteps')}</h3>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                index < currentStep 
                  ? 'bg-green-500 text-white border-green-500' 
                  : index === currentStep && isInstalling
                    ? 'bg-blue-500 text-white border-blue-500 animate-pulse'
                    : index === currentStep
                      ? 'bg-blue-100 text-blue-600 border-blue-300'
                      : 'bg-gray-100 text-gray-400 border-gray-300'
              }`}>
                {index < currentStep ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : index === currentStep && isInstalling ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  index + 1
                )}
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium transition-colors duration-300 ${
                    index < currentStep 
                      ? 'text-green-700' 
                      : index === currentStep 
                        ? 'text-blue-700' 
                        : 'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                  {index === currentStep && isInstalling && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
                      {t('setup.inProgress')}
                    </span>
                  )}
                  {index < currentStep && (
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium">
                      {t('setup.completed')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                {index !== steps.length - 1 && (
                  <div className={`w-px h-4 ml-5 mt-2 transition-colors duration-300 ${
                    index < currentStep ? 'bg-green-300' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 설치 로그 */}
      {installLog.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">{t('setup.installationLog')}</h3>
            {isInstalling && (
              <div className="flex items-center text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                <span className="text-sm">{t('setup.inProgress')}...</span>
              </div>
            )}
          </div>
          <div 
            className="bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto border"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div className="font-mono text-sm space-y-1">
              {installLog.map((log, index) => (
                <div 
                  key={index} 
                  className={`text-gray-700 ${
                    log.includes('❌') ? 'text-red-600' : 
                    log.includes('✅') ? 'text-green-600' :
                    log.includes('⏳') ? 'text-blue-600' :
                    log.includes('🔄') ? 'text-blue-600' :
                    log.includes('📥') ? 'text-purple-600' :
                    log.includes('🔨') ? 'text-orange-600' :
                    ''
                  }`}
                >
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* 다음 단계 안내 */}
      {isInstalled && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h4 className="text-blue-900 font-medium mb-2">{t('setup.nextSteps')}</h4>
          <p className="text-blue-800 text-sm">
            {t('setup.nextStepsDescription')}
          </p>
        </div>
      )}
    </div>
  );
});