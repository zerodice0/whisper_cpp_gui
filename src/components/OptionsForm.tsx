import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WhisperOption, WhisperOptions, WhisperConfig } from '../services/api';

interface OptionsFormProps {
  options: WhisperOptions | null;
  onConfigChange: (config: Partial<WhisperConfig>) => void;
  disabled?: boolean;
}

export const OptionsForm: React.FC<OptionsFormProps> = React.memo(({
  options,
  onConfigChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Record<string, string>>({});

  const getOutputFormatDisplayName = (optionName: string) => {
    const formatNames: Record<string, string> = {
      'output-txt': t('transcription.outputTxt'),
      'output-srt': t('transcription.outputSrt'),
      'output-vtt': t('transcription.outputVtt'),
      'output-csv': t('transcription.outputCsv'),
      'output-json': t('transcription.outputJson'),
      'output-lrc': t('transcription.outputLrc'),
    };
    return formatNames[optionName] || optionName;
  };

  useEffect(() => {
    if (options) {
      const defaultConfig: Record<string, string> = {};
      options.options.forEach(option => {
        if (option.default_value && option.option_type !== 'Flag') {
          defaultConfig[option.name] = option.default_value;
        }
      });
      setConfig(defaultConfig);
      onConfigChange({ options: defaultConfig });
    }
  }, [options, onConfigChange]);

  const handleOptionChange = (optionName: string, value: string, isFlag: boolean = false) => {
    const newConfig = { ...config };
    
    if (isFlag) {
      if (value === 'true') {
        newConfig[optionName] = '';
      } else {
        delete newConfig[optionName];
      }
    } else {
      if (value.trim()) {
        newConfig[optionName] = value;
      } else {
        delete newConfig[optionName];
      }
    }
    
    setConfig(newConfig);
    onConfigChange({ options: newConfig });
  };

  const renderOptionInput = (option: WhisperOption) => {
    const value = config[option.name] || '';
    const isEnabled = option.name in config;

    switch (option.option_type) {
      case 'Flag':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={option.name}
              checked={isEnabled}
              onChange={(e) => handleOptionChange(option.name, e.target.checked.toString(), true)}
              disabled={disabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor={option.name} className="text-sm text-gray-700">
              {t('transcription.enable')}
            </label>
          </div>
        );

      case 'String':
        if (option.possible_values && option.possible_values.length > 0) {
          return (
            <select
              value={value}
              onChange={(e) => handleOptionChange(option.name, e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">{t('common.selectOption')}</option>
              {option.possible_values.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          );
        } else {
          return (
            <input
              type="text"
              value={value}
              onChange={(e) => handleOptionChange(option.name, e.target.value)}
              disabled={disabled}
              placeholder={option.default_value || t('transcription.enterValue')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          );
        }

      case 'Integer':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleOptionChange(option.name, e.target.value)}
            disabled={disabled}
            placeholder={option.default_value || t('transcription.enterNumber')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        );

      case 'Float':
        return (
          <input
            type="number"
            step="0.1"
            value={value}
            onChange={(e) => handleOptionChange(option.name, e.target.value)}
            disabled={disabled}
            placeholder={option.default_value || t('transcription.enterFloat')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        );

      default:
        return null;
    }
  };

  if (!options || options.options.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('transcription.whisperOptions')}</h3>
        <div className="text-center py-4">
          <p className="text-gray-500">{t('transcription.loadingOptions')}...</p>
        </div>
      </div>
    );
  }

  const outputOptions = options.options.filter(opt => 
    opt.name.startsWith('output-')
  );
  const basicOptions = options.options.filter(opt => 
    ['language', 'threads'].includes(opt.name)
  );
  const advancedOptions = options.options.filter(opt => 
    !['language', 'threads'].includes(opt.name) && !opt.name.startsWith('output-')
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{t('transcription.whisperOptions')}</h3>
      
      {/* 출력 형식 */}
      {outputOptions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-800 mb-3">{t('transcription.outputFormats')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {outputOptions.map((option) => (
              <div key={option.name} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {getOutputFormatDisplayName(option.name)}
                </label>
                {renderOptionInput(option)}
                {option.description && (
                  <p className="text-xs text-gray-500">{option.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 기본 옵션 */}
      {basicOptions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-800 mb-3">{t('transcription.basicOptions')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {basicOptions.map((option) => (
              <div key={option.name} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {option.name}
                  {option.short_name && ` (-${option.short_name})`}
                </label>
                {renderOptionInput(option)}
                {option.description && (
                  <p className="text-xs text-gray-500">{option.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 고급 옵션 */}
      {advancedOptions.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between py-2 text-md font-medium text-gray-800">
            <span>{t('transcription.advancedOptions')}</span>
            <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {advancedOptions.map((option) => (
              <div key={option.name} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {option.name}
                  {option.short_name && ` (-${option.short_name})`}
                </label>
                {renderOptionInput(option)}
                {option.description && (
                  <p className="text-xs text-gray-500">{option.description}</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 현재 설정된 옵션 표시 */}
      {Object.keys(config).length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h5 className="text-sm font-medium text-gray-700 mb-2">{t('transcription.appliedOptions')}:</h5>
          <div className="text-xs font-mono text-gray-600">
            {Object.entries(config).map(([key, value]) => (
              <span key={key} className="inline-block mr-2 mb-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                --{key}{value && ` ${value}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});