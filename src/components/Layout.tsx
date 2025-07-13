import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  activeItem: string;
  onItemClick: (itemId: string) => void;
}

export const Layout: React.FC<LayoutProps> = React.memo(({ children, activeItem, onItemClick }) => {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeItem={activeItem} onItemClick={onItemClick} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
});