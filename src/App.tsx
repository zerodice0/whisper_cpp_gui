import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Setup } from './components/Setup';
import { Management } from './components/Management';
import { Transcription } from './components/Transcription';
import { Output } from './components/Output';
import { Export } from './components/Export';

function App() {
  const [activeItem, setActiveItem] = useState('dashboard');

  const renderContent = () => {
    switch (activeItem) {
      case 'dashboard':
        return <Dashboard />;
      case 'setup':
        return <Setup />;
      case 'management':
        return <Management />;
      case 'transcription':
        return <Transcription />;
      case 'output':
        return <Output />;
      case 'export':
        return <Export />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeItem={activeItem} onItemClick={setActiveItem}>
      {renderContent()}
    </Layout>
  );
}

export default App;