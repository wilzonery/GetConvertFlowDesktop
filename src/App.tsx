import { useState } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ActivationGate from './components/ActivationGate';
import Home from './pages/Home';
import Converter from './pages/Converter';
import BatchConverter from './pages/BatchConverter';
import AIEnhancer from './pages/AIEnhancer';
import CompressionTool from './pages/CompressionTool';
import AudioExtractor from './pages/AudioExtractor';
import Settings from './pages/Settings';
import type { Page } from './types';
import { getSavedLicense } from './lib/license';
import { isElectron } from './lib/electron';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  // Keep production locked behind an entitlement, but do not block local QA builds.
  const [licensed, setLicensed] = useState(() => getSavedLicense() !== null);

  const renderPage = () => {
    switch (page) {
      case 'home': return <Home onNavigate={setPage} />;
      case 'converter': return <Converter />;
      case 'batch': return <BatchConverter />;
      case 'enhancer': return <AIEnhancer />;
      case 'compression': return <CompressionTool />;
      case 'audio': return <AudioExtractor />;
      case 'settings': return <Settings />;
      default: return <Home onNavigate={setPage} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-fg overflow-hidden selection:bg-yellow-500/30">
      <TitleBar />
      {licensed ? (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar current={page} onChange={setPage} />
          <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
            {!isElectron && (
              <div className="shrink-0 flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs text-amber-200">
                <span>Preview mode: file conversions require the Electron desktop app.</span>
                <code className="rounded bg-black/20 px-2 py-1 text-amber-100">npm run dev:electron</code>
              </div>
            )}
            {renderPage()}
          </main>
        </div>
      ) : <ActivationGate onActivated={() => setLicensed(true)} />}
    </div>
  );
}
