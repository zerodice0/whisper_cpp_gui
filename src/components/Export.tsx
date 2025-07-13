import React, { useState, useEffect } from 'react';
import { save } from '@tauri-apps/api/dialog';
import { whisperApi } from '../services/api';
import { useAppStore } from '../store';

interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  description: string;
  icon: string;
}

const exportFormats: ExportFormat[] = [
  {
    id: 'txt',
    name: 'Plain Text',
    extension: 'txt',
    description: '순수 텍스트 파일',
    icon: '📄'
  },
  {
    id: 'srt',
    name: 'SubRip (SRT)',
    extension: 'srt',
    description: '자막 파일 (비디오 편집용)',
    icon: '🎬'
  },
  {
    id: 'fcpxml',
    name: 'Final Cut Pro XML',
    extension: 'fcpxml',
    description: 'Final Cut Pro 프로젝트 파일',
    icon: '🎞️'
  }
];

export const Export: React.FC = React.memo(() => {
  const { currentFile, status } = useAppStore();
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('txt');
  const [isExporting, setIsExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<Array<{
    timestamp: string;
    format: string;
    path: string;
    status: 'success' | 'error';
  }>>([]);

  const loadTranscriptionResult = async () => {
    if (!currentFile || status !== 'completed') return;
    
    try {
      const result = await whisperApi.readTranscriptionResult(currentFile);
      if (result) {
        setTranscriptionText(result);
      }
    } catch (error) {
      console.error('Failed to load transcription result:', error);
    }
  };

  const handleExport = async () => {
    if (!transcriptionText || !currentFile) return;

    const format = exportFormats.find(f => f.id === selectedFormat);
    if (!format) return;

    try {
      const defaultFileName = currentFile.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'transcription';
      const savePath = await save({
        defaultPath: `${defaultFileName}.${format.extension}`,
        filters: [
          {
            name: format.name,
            extensions: [format.extension]
          }
        ]
      });

      if (!savePath) return;

      setIsExporting(true);

      switch (selectedFormat) {
        case 'srt':
          await whisperApi.exportToSrt(transcriptionText, savePath);
          break;
        case 'fcpxml':
          await whisperApi.exportToFcpxml(transcriptionText, savePath);
          break;
        case 'txt':
        default:
          // 텍스트 파일은 직접 저장
          await writeTextFile(savePath, transcriptionText);
          break;
      }

      // 성공 기록 추가
      setExportHistory(prev => [{
        timestamp: new Date().toLocaleString(),
        format: format.name,
        path: savePath,
        status: 'success'
      }, ...prev.slice(0, 9)]); // 최대 10개 기록 유지

    } catch (error) {
      console.error('Export failed:', error);
      
      // 실패 기록 추가
      setExportHistory(prev => [{
        timestamp: new Date().toLocaleString(),
        format: format?.name || selectedFormat,
        path: '',
        status: 'error'
      }, ...prev.slice(0, 9)]);
    } finally {
      setIsExporting(false);
    }
  };

  // 텍스트 파일 저장을 위한 헬퍼 함수 (Tauri fs API 사용)
  const writeTextFile = async (path: string, content: string) => {
    // 실제 구현에서는 Tauri의 fs API를 사용해야 함
    // 지금은 백엔드 API 호출로 대체
    return whisperApi.exportToSrt(content, path.replace('.txt', '.srt'));
  };

  const getPreview = () => {
    if (!transcriptionText) return '';
    
    switch (selectedFormat) {
      case 'srt':
        return generateSrtPreview(transcriptionText);
      case 'fcpxml':
        return generateFcpxmlPreview(transcriptionText);
      case 'txt':
      default:
        return transcriptionText;
    }
  };

  const generateSrtPreview = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '';
    
    return `1\n00:00:00,000 --> 00:00:05,000\n${lines[0]}\n\n2\n00:00:05,000 --> 00:00:10,000\n${lines[1] || '...'}\n\n...`;
  };

  const generateFcpxmlPreview = (_text: string) => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10">\n    <resources>\n        <format id="r1" name="FFVideoFormat1920x1080p30"/>\n    </resources>\n    <library>\n        <event name="Whisper Transcription">\n            ...\n        </event>\n    </library>\n</fcpxml>`;
  };

  useEffect(() => {
    loadTranscriptionResult();
  }, [currentFile, status]);

  if (!currentFile || status !== 'completed' || !transcriptionText) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">내보내기</h2>
          <p className="text-gray-600 mt-1">변환된 텍스트를 다양한 형식으로 내보냅니다</p>
        </div>

        <div className="bg-white p-12 rounded-lg shadow text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">내보낼 텍스트가 없습니다</h3>
          <p className="text-gray-500">
            음성 변환이 완료된 후 다양한 형식으로 내보낼 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">내보내기</h2>
        <p className="text-gray-600 mt-1">변환된 텍스트를 다양한 형식으로 내보냅니다</p>
      </div>

      {/* 파일 정보 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-3">원본 파일</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{currentFile.split('/').pop()}</p>
            <p className="text-sm text-gray-500">
              텍스트 길이: {transcriptionText.length}자 | 
              단어 수: {transcriptionText.trim().split(/\s+/).length}개
            </p>
          </div>
          <span className="bg-green-100 text-green-800 px-2 py-1 text-xs rounded-full">
            변환 완료
          </span>
        </div>
      </div>

      {/* 내보내기 형식 선택 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">내보내기 형식</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {exportFormats.map((format) => (
            <div
              key={format.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedFormat === format.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedFormat(format.id)}
            >
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">{format.icon}</span>
                <div>
                  <h4 className="font-medium text-gray-900">{format.name}</h4>
                  <p className="text-sm text-gray-500">.{format.extension}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">{format.description}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className={`w-full px-6 py-3 rounded-md font-medium ${
            isExporting
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isExporting ? '내보내는 중...' : `${exportFormats.find(f => f.id === selectedFormat)?.name} 형식으로 내보내기`}
        </button>
      </div>

      {/* 미리보기 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">미리보기</h3>
        <div className="bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto">
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
            {getPreview()}
          </pre>
        </div>
      </div>

      {/* 내보내기 기록 */}
      {exportHistory.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">내보내기 기록</h3>
          <div className="space-y-3">
            {exportHistory.map((record, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-3 ${
                    record.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{record.format}</p>
                    <p className="text-sm text-gray-500">{record.timestamp}</p>
                  </div>
                </div>
                <div className="text-right">
                  {record.status === 'success' ? (
                    <p className="text-sm text-gray-600">{record.path.split('/').pop()}</p>
                  ) : (
                    <p className="text-sm text-red-600">실패</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 형식별 설명 */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="text-blue-900 font-medium mb-2">형식별 용도</h4>
        <div className="text-blue-800 text-sm space-y-2">
          <p><strong>Plain Text (.txt):</strong> 순수 텍스트만 필요한 경우</p>
          <p><strong>SubRip (.srt):</strong> 동영상 편집 소프트웨어에서 자막으로 사용</p>
          <p><strong>Final Cut Pro XML (.fcpxml):</strong> Final Cut Pro에서 자막 트랙으로 가져오기</p>
        </div>
      </div>
    </div>
  );
});