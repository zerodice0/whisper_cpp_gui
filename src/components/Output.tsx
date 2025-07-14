import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/api/dialog';
import { whisperApi, TranscriptionHistory, HistoryQuery, HistoryListResponse } from '../services/api';
import { 
  MagnifyingGlassIcon, 
  ArrowDownTrayIcon,
  TrashIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

interface HistoryFilters {
  search: string;
  modelFilter: string;
  formatFilter: string;
  statusFilter: string;
}

const ITEMS_PER_PAGE = 20;

export const Output: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const [historyData, setHistoryData] = useState<HistoryListResponse>({
    items: [],
    total_count: 0,
    has_more: false
  });
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [filters, setFilters] = useState<HistoryFilters>({
    search: '',
    modelFilter: '',
    formatFilter: '',
    statusFilter: ''
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // 히스토리 로드
  const loadHistory = useCallback(async (page = 0, reset = false) => {
    setLoading(true);
    try {
      const query: HistoryQuery = {
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
        search: filters.search || undefined,
        model_filter: filters.modelFilter || undefined,
        format_filter: filters.formatFilter || undefined,
        status_filter: filters.statusFilter ? filters.statusFilter as any : undefined,
      };

      const response = await whisperApi.listTranscriptionHistory(query);
      
      if (reset || page === 0) {
        setHistoryData(response);
      } else {
        setHistoryData(prev => ({
          ...response,
          items: [...prev.items, ...response.items]
        }));
      }
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 사용 가능한 모델 목록 로드
  const loadAvailableModels = useCallback(async () => {
    try {
      const models = await whisperApi.listDownloadedModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadHistory(0, true);
    loadAvailableModels();
  }, [loadHistory, loadAvailableModels]);

  // 필터 변경 시 재로드
  useEffect(() => {
    const timer = setTimeout(() => {
      loadHistory(0, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, loadHistory]);

  // 필터 업데이트
  const updateFilter = (key: keyof HistoryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  };

  // 항목 확장/축소
  const toggleExpanded = (historyId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(historyId)) {
        newSet.delete(historyId);
      } else {
        newSet.add(historyId);
      }
      return newSet;
    });
  };

  // 파일 다운로드
  const downloadFile = async (historyId: string, format: string) => {
    try {
      const savePath = await save({
        defaultPath: `result.${format}`,
        filters: [{
          name: `${format.toUpperCase()} Files`,
          extensions: [format]
        }]
      });

      if (savePath) {
        await whisperApi.downloadResultFile(historyId, format, savePath);
        // TODO: 성공 토스트 표시
      }
    } catch (error) {
      console.error('Failed to download file:', error);
      // TODO: 에러 토스트 표시
    }
  };

  // 히스토리 삭제
  const deleteHistory = async (historyId: string) => {
    if (!window.confirm(t('output.confirmDelete'))) {
      return;
    }

    try {
      await whisperApi.deleteTranscriptionHistory(historyId);
      loadHistory(0, true);
      // TODO: 성공 토스트 표시
    } catch (error) {
      console.error('Failed to delete history:', error);
      // TODO: 에러 토스트 표시
    }
  };

  // 메모 저장
  const saveNotes = async (historyId: string) => {
    try {
      await whisperApi.updateHistoryNotes(historyId, noteText.trim() || undefined);
      setEditingNotes(null);
      setNoteText('');
      loadHistory(currentPage, false);
      // TODO: 성공 토스트 표시
    } catch (error) {
      console.error('Failed to save notes:', error);
      // TODO: 에러 토스트 표시
    }
  };

  // 더 보기
  const loadMore = () => {
    if (historyData.has_more && !loading) {
      loadHistory(currentPage + 1, false);
    }
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} ${t('output.bytes')}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t('output.kb')}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${t('output.mb')}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ${t('output.gb')}`;
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  // 소요 시간 포맷팅
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)} ${t('output.seconds')}`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  // 상태 표시
  const getStatusBadge = (status: string) => {
    const statusMap = {
      'Completed': { color: 'bg-green-100 text-green-800', text: t('output.completed') },
      'Running': { color: 'bg-blue-100 text-blue-800', text: t('output.running') },
      'Failed': { color: 'bg-red-100 text-red-800', text: t('output.failed') },
      'Idle': { color: 'bg-gray-100 text-gray-800', text: t('output.idle') }
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.Idle;
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  if (historyData.items.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('output.title')}</h2>
          <p className="text-gray-600 mt-1">{t('output.subtitle')}</p>
        </div>

        <div className="bg-white p-12 rounded-lg shadow text-center">
          <div className="text-gray-400 mb-4">
            <DocumentTextIcon className="mx-auto h-16 w-16" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('output.noResult')}</h3>
          <p className="text-gray-500">
            {t('output.noResultDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('output.title')}</h2>
          <p className="text-gray-600 mt-1">{t('output.subtitle')}</p>
        </div>
        <button
          onClick={() => loadHistory(0, true)}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          {t('output.refresh')}
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 검색 */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('output.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 모델 필터 */}
          <select
            value={filters.modelFilter}
            onChange={(e) => updateFilter('modelFilter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('output.allModels')}</option>
            {availableModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>

          {/* 형식 필터 */}
          <select
            value={filters.formatFilter}
            onChange={(e) => updateFilter('formatFilter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('output.allFormats')}</option>
            <option value="txt">TXT</option>
            <option value="srt">SRT</option>
            <option value="vtt">VTT</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="lrc">LRC</option>
          </select>

          {/* 상태 필터 */}
          <select
            value={filters.statusFilter}
            onChange={(e) => updateFilter('statusFilter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('output.allStatuses')}</option>
            <option value="Completed">{t('output.completed')}</option>
            <option value="Running">{t('output.running')}</option>
            <option value="Failed">{t('output.failed')}</option>
          </select>
        </div>

        {/* 결과 개수 */}
        <div className="mt-4 text-sm text-gray-600">
          {t('output.totalItems', { count: historyData.total_count })}
        </div>
      </div>

      {/* 히스토리 리스트 */}
      <div className="space-y-4">
        {historyData.items.map((item) => (
          <HistoryItem
            key={item.id}
            item={item}
            expanded={expandedItems.has(item.id)}
            onToggleExpanded={() => toggleExpanded(item.id)}
            onDownloadFile={downloadFile}
            onDeleteHistory={deleteHistory}
            onSaveNotes={saveNotes}
            editingNotes={editingNotes}
            setEditingNotes={setEditingNotes}
            noteText={noteText}
            setNoteText={setNoteText}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
            formatDuration={formatDuration}
            getStatusBadge={getStatusBadge}
          />
        ))}
      </div>

      {/* 더 보기 버튼 */}
      {historyData.has_more && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('output.loadMore')}
          </button>
        </div>
      )}

      {/* 로딩 */}
      {loading && historyData.items.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">{t('common.loading')}</span>
        </div>
      )}
    </div>
  );
});

// 히스토리 아이템 컴포넌트
interface HistoryItemProps {
  item: TranscriptionHistory;
  expanded: boolean;
  onToggleExpanded: () => void;
  onDownloadFile: (historyId: string, format: string) => void;
  onDeleteHistory: (historyId: string) => void;
  onSaveNotes: (historyId: string) => void;
  editingNotes: string | null;
  setEditingNotes: (id: string | null) => void;
  noteText: string;
  setNoteText: (text: string) => void;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateString: string) => string;
  formatDuration: (seconds?: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

const HistoryItem: React.FC<HistoryItemProps> = React.memo(({
  item,
  expanded,
  onToggleExpanded,
  onDownloadFile,
  onDeleteHistory,
  onSaveNotes,
  editingNotes,
  setEditingNotes,
  noteText,
  setNoteText,
  formatFileSize,
  formatDate,
  formatDuration,
  getStatusBadge,
}) => {
  const { t } = useTranslation();

  const startEditingNotes = () => {
    setEditingNotes(item.id);
    setNoteText(item.notes || '');
  };

  const cancelEditingNotes = () => {
    setEditingNotes(null);
    setNoteText('');
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* 기본 정보 */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-medium text-gray-900">{item.original_file_name}</h3>
              {getStatusBadge(item.status)}
            </div>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {formatDate(item.created_at)}
              </div>
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                {formatDuration(item.duration_seconds)}
              </div>
              <div className="text-blue-600">{item.model_used}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleExpanded}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            >
              {expanded ? (
                <ChevronUpIcon className="h-5 w-5" />
              ) : (
                <ChevronDownIcon className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={() => onDeleteHistory(item.id)}
              className="p-2 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 결과 파일 미리보기 */}
        {item.results.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.results.map((result, index) => (
              <button
                key={index}
                onClick={() => onDownloadFile(item.id, result.format)}
                className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100"
              >
                <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
                {result.format.toUpperCase()} ({formatFileSize(result.file_size)})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 확장된 정보 */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 메타데이터 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">{t('output.resultFiles')}</h4>
              <div className="space-y-2">
                {item.results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                    <div>
                      <div className="font-medium">{result.format.toUpperCase()}</div>
                      <div className="text-sm text-gray-500">
                        {formatFileSize(result.file_size)} • {formatDate(result.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => onDownloadFile(item.id, result.format)}
                      className="p-2 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{t('output.notes')}</h4>
                {editingNotes !== item.id && (
                  <button
                    onClick={startEditingNotes}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {t('output.editNotes')}
                  </button>
                )}
              </div>
              
              {editingNotes === item.id ? (
                <div className="space-y-3">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder={t('output.notes')}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onSaveNotes(item.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      {t('output.saveNotes')}
                    </button>
                    <button
                      onClick={cancelEditingNotes}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white rounded border min-h-[100px]">
                  {item.notes ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{item.notes}</p>
                  ) : (
                    <p className="text-gray-400 italic">{t('common.noDescription')}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 에러 메시지 */}
          {item.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <div className="text-red-400 mr-2">⚠</div>
                <div className="text-red-700 text-sm">{item.error_message}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});