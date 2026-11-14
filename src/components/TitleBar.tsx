import { Minus, Square, X } from 'lucide-react';
import { electron } from '../lib/electron';

export default function TitleBar() {
  return (
    <div className="titlebar h-10 flex items-center justify-between bg-zinc-950 border-b border-zinc-800 select-none shrink-0 z-50">
      <div className="flex items-center gap-2 pl-3">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ConvertFlow" className="w-6 h-6 rounded" />
        <span className="text-sm font-semibold text-fg">ConvertFlow Desktop</span>
      </div>
      {electron != null && (
        <div className="flex">
          <button
            onClick={() => electron!.minimize()}
            className="w-12 h-10 flex items-center justify-center text-zinc-400 hover:text-fg hover:bg-zinc-800 transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => electron!.maximize()}
            className="w-12 h-10 flex items-center justify-center text-zinc-400 hover:text-fg hover:bg-zinc-800 transition-colors"
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => electron!.close()}
            className="w-12 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
