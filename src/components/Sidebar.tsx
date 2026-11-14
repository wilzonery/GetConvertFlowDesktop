import {
  Home,
  ArrowRightLeft,
  Layers,
  Sparkles,
  Gauge,
  Music,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Page } from '../types';

const navItems: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'converter', label: 'Advanced Converter', icon: ArrowRightLeft },
  { id: 'batch', label: 'Batch Converter', icon: Layers },
  { id: 'enhancer', label: 'AI Enhancer', icon: Sparkles },
  { id: 'compression', label: 'Compression Tool', icon: Gauge },
  { id: 'audio', label: 'Audio Extractor', icon: Music },
];

const bottomItems: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  current: Page;
  onChange: (page: Page) => void;
}

export default function Sidebar({ current, onChange }: SidebarProps) {
  return (
    <aside className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0">
      <div className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = current === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-yellow-500 text-black'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-fg'
                }
              `}
            >
              <Icon size={16} className={isActive ? 'text-black' : ''} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="py-4 px-2 border-t border-zinc-800 space-y-0.5">
        {bottomItems.map(({ id, label, icon: Icon }) => {
          const isActive = current === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-yellow-500 text-black'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-fg'
                }
              `}
            >
              <Icon size={16} className={isActive ? 'text-black' : ''} />
              {label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
