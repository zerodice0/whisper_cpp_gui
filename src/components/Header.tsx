import React from 'react';
import { LanguageSelector } from './LanguageSelector';

export const Header: React.FC = React.memo(() => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Whisper GUI
        </h1>
        <div className="flex items-center space-x-4">
          <LanguageSelector />
          <div className="text-sm text-gray-500">
            v0.1.0
          </div>
        </div>
      </div>
    </header>
  );
});