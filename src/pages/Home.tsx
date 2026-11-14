import { ArrowRightLeft, Layers, Sparkles, Gauge, Music, Settings, Cpu, Shield, Zap } from 'lucide-react';
import type { Page } from '../types';

interface HomeProps {
  onNavigate: (page: Page) => void;
}

const tools = [
  {
    id: 'converter' as Page,
    title: 'Advanced Converter',
    description: 'Convert video, audio & images with full control over codecs, resolution, bitrate, and more.',
    icon: ArrowRightLeft,
    color: 'from-yellow-500/20 to-yellow-600/10',
    iconColor: 'text-yellow-400',
    badge: 'Core Tool',
  },
  {
    id: 'enhancer' as Page,
    title: 'AI Enhancer',
    description: 'AI-assisted local enhancement with noise reduction, sharpening, color improvement, and upscaling.',
    icon: Sparkles,
    color: 'from-blue-500/20 to-blue-600/10',
    iconColor: 'text-blue-400',
    badge: 'AI-Powered',
  },
  {
    id: 'batch' as Page,
    title: 'Batch Converter',
    description: 'Queue and convert multiple files at once with a single output format. Full progress tracking.',
    icon: Layers,
    color: 'from-emerald-500/20 to-emerald-600/10',
    iconColor: 'text-emerald-400',
    badge: 'Bulk',
  },
  {
    id: 'compression' as Page,
    title: 'Compression Tool',
    description: 'Reduce file sizes intelligently while preserving quality. Great for sharing and storage.',
    icon: Gauge,
    color: 'from-orange-500/20 to-orange-600/10',
    iconColor: 'text-orange-400',
    badge: 'Optimizer',
  },
  {
    id: 'audio' as Page,
    title: 'Audio Extractor',
    description: 'Pull audio tracks from any video. Export to MP3, WAV, or FLAC with custom bitrate.',
    icon: Music,
    color: 'from-pink-500/20 to-pink-600/10',
    iconColor: 'text-pink-400',
    badge: 'Extract',
  },
  {
    id: 'settings' as Page,
    title: 'Settings',
    description: 'Configure output folder, quality defaults, hardware acceleration, and more.',
    icon: Settings,
    color: 'from-zinc-500/20 to-zinc-600/10',
    iconColor: 'text-zinc-400',
    badge: 'Config',
  },
];

const highlights = [
  { icon: Cpu, label: '100% Local Processing', desc: 'Your files never leave your computer.' },
  { icon: Shield, label: 'No Upload Limits', desc: 'Convert files of any size, no restrictions.' },
  { icon: Zap, label: 'Hardware Accelerated', desc: 'GPU-accelerated conversion when available.' },
];

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="flex items-center gap-5 mb-10">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ConvertFlow" className="w-16 h-16 rounded-2xl" />
        <div>
          <h1 className="text-3xl font-bold text-fg">ConvertFlow Desktop</h1>
          <p className="text-zinc-400 mt-1">Advanced media conversion suite — all processing happens locally on your computer.</p>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {highlights.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-fg text-sm font-semibold">{label}</p>
              <p className="text-zinc-500 text-xs">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tools Grid */}
      <h2 className="text-lg font-semibold text-fg mb-4">Quick Access</h2>
      <div className="grid grid-cols-3 gap-4">
        {tools.map(({ id, title, description, icon: Icon, color, iconColor, badge }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`
              relative text-left p-5 rounded-2xl border border-zinc-800 bg-gradient-to-br ${color}
              hover:border-zinc-700 hover:scale-[1.02] active:scale-[0.99]
              transition-all duration-200 group
            `}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-zinc-900/80 flex items-center justify-center`}>
                <Icon size={18} className={iconColor} />
              </div>
              <span className="text-xs font-medium bg-zinc-900/80 text-zinc-400 px-2 py-1 rounded-full">
                {badge}
              </span>
            </div>
            <h3 className="text-fg font-semibold text-sm mb-1.5">{title}</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">{description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
