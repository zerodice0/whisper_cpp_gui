import React from 'react';
import { useTranslation } from 'react-i18next';

const menuItems = [
  { id: 'dashboard', translationKey: 'nav.dashboard', icon: '📊' },
  { id: 'setup', translationKey: 'nav.setup', icon: '⚙️' },
  { id: 'management', translationKey: 'nav.management', icon: '🔧' },
  { id: 'transcription', translationKey: 'nav.transcription', icon: '🎤' },
  { id: 'output', translationKey: 'nav.output', icon: '📄' },
  { id: 'export', translationKey: 'nav.export', icon: '📤' },
];

interface SidebarProps {
  activeItem: string;
  onItemClick: (itemId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({ activeItem, onItemClick }) => {
  const { t } = useTranslation();
  
  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <nav className="p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onItemClick(item.id)}
                className={`w-full flex items-center px-3 py-2 text-left rounded-md transition-colors ${
                  activeItem === item.id
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {t(item.translationKey)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
});