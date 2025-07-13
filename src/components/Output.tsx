import React, { useState, useEffect } from 'react';
import { whisperApi } from '../services/api';
import { useAppStore } from '../store';

export const Output: React.FC = React.memo(() => {
  const { currentFile, status } = useAppStore();
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadTranscriptionResult = async () => {
    if (!currentFile || status !== 'completed') return;
    
    setIsLoading(true);
    try {
      const result = await whisperApi.readTranscriptionResult(currentFile);
      if (result) {
        setTranscriptionText(result);
      }
    } catch (error) {
      console.error('Failed to load transcription result:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscriptionText(e.target.value);
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const getWordCount = () => {
    return transcriptionText.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getCharacterCount = () => {
    return transcriptionText.length;
  };

  const getLineCount = () => {
    return transcriptionText.split('\n').length;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcriptionText);
      // TODO: 토스트 알림 추가
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const clearText = () => {
    if (window.confirm('텍스트를 모두 지우시겠습니까?')) {
      setTranscriptionText('');
    }
  };

  useEffect(() => {
    loadTranscriptionResult();
  }, [currentFile, status]);

  if (!currentFile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">변환 결과</h2>
          <p className="text-gray-600 mt-1">음성 변환 결과를 확인하고 편집합니다</p>
        </div>

        <div className="bg-white p-12 rounded-lg shadow text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">변환된 파일이 없습니다</h3>
          <p className="text-gray-500">
            Transcription 탭에서 음성 파일을 변환한 후 결과를 확인할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">변환 결과</h2>
        <p className="text-gray-600 mt-1">음성 변환 결과를 확인하고 편집합니다</p>
      </div>

      {/* 파일 정보 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-3">파일 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">파일명</label>
            <p className="text-gray-900">{currentFile.split('/').pop()}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">상태</label>
            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
              status === 'completed' 
                ? 'bg-green-100 text-green-800'
                : status === 'running'
                  ? 'bg-blue-100 text-blue-800'
                  : status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
            }`}>
              {status === 'completed' && '완료'}
              {status === 'running' && '진행 중'}
              {status === 'failed' && '실패'}
              {status === 'idle' && '대기'}
            </span>
          </div>
        </div>
      </div>

      {/* 텍스트 통계 */}
      {transcriptionText && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-3">텍스트 통계</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{getWordCount()}</div>
              <div className="text-sm text-gray-500">단어</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{getCharacterCount()}</div>
              <div className="text-sm text-gray-500">문자</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{getLineCount()}</div>
              <div className="text-sm text-gray-500">줄</div>
            </div>
          </div>
        </div>
      )}

      {/* 텍스트 편집기 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">변환된 텍스트</h3>
          <div className="flex space-x-2">
            <button
              onClick={toggleEdit}
              className={`px-3 py-1 text-sm rounded-md ${
                isEditing 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isEditing ? '읽기 모드' : '편집 모드'}
            </button>
            {transcriptionText && (
              <>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                >
                  복사
                </button>
                <button
                  onClick={clearText}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                >
                  지우기
                </button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">결과를 불러오는 중...</span>
          </div>
        ) : !transcriptionText && status === 'completed' ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">변환 결과를 찾을 수 없습니다.</p>
            <button
              onClick={loadTranscriptionResult}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        ) : status !== 'completed' ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">
              {status === 'running' ? '변환이 진행 중입니다...' : '변환을 완료한 후 결과를 확인할 수 있습니다.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {isEditing ? (
              <textarea
                value={transcriptionText}
                onChange={handleTextChange}
                className="w-full h-96 p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                placeholder="변환된 텍스트가 여기에 표시됩니다..."
              />
            ) : (
              <div className="w-full h-96 p-4 bg-gray-50 border border-gray-200 rounded-md overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
                  {transcriptionText || '변환된 텍스트가 없습니다.'}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 도움말 */}
      {transcriptionText && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h4 className="text-blue-900 font-medium mb-2">편집 팁</h4>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• 편집 모드에서 텍스트를 직접 수정할 수 있습니다</li>
            <li>• 수정된 텍스트는 Export 탭에서 다양한 형식으로 내보낼 수 있습니다</li>
            <li>• 복사 버튼으로 클립보드에 텍스트를 복사할 수 있습니다</li>
          </ul>
        </div>
      )}
    </div>
  );
});