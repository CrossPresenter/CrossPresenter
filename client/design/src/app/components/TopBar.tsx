import { Monitor, EyeOff, Palette, Settings, Wifi, WifiOff } from "lucide-react";

interface TopBarProps {
  isLive: boolean;
  setIsLive: (v: boolean) => void;
  isBlank: boolean;
  setIsBlank: (v: boolean) => void;
  isTheme: boolean;
  setIsTheme: (v: boolean) => void;
}

export function TopBar({ isLive, setIsLive, isBlank, setIsBlank, isTheme, setIsTheme }: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-[#0d0d1a] select-none" style={{ minHeight: 44 }}>
      <div className="flex items-center gap-4">
        <span className="text-[#7c6af7] font-bold tracking-wide text-sm">CrossPresenter</span>
        {["File", "View", "Service", "Themes", "Settings", "Tools", "Help"].map(label => (
          <button key={label} className="text-xs text-white/45 hover:text-white/85 transition-colors px-1">{label}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsBlank(!isBlank)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all border ${isBlank ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-300" : "bg-white/5 border-white/10 text-white/55 hover:text-white/80 hover:border-white/20"
            }`}
        >
          <EyeOff size={12} /> Blank
        </button>
        <button
          onClick={() => setIsTheme(!isTheme)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all border ${isTheme ? "bg-purple-500/20 border-purple-400/50 text-purple-300" : "bg-white/5 border-white/10 text-white/55 hover:text-white/80 hover:border-white/20"
            }`}
        >
          <Palette size={12} /> Theme
        </button>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-1.5 px-4 py-1 rounded text-xs font-semibold transition-all border ${isLive ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30" : "bg-white/5 border-white/10 text-white/55 hover:text-white/80 hover:border-white/20"
            }`}
        >
          {isLive ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isLive ? "LIVE" : "Go Live"}
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button className="p-1.5 text-white/35 hover:text-white/75 transition-colors"><Monitor size={15} /></button>
        <button className="p-1.5 text-white/35 hover:text-white/75 transition-colors"><Settings size={15} /></button>
      </div>
    </div>
  );
}
