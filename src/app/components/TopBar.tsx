import React, { useEffect, useState } from "react";
import { Monitor, EyeOff, Palette, Settings, Wifi, WifiOff, Smartphone, Copy, Check, X, Camera } from "lucide-react";
import { qrToSvg } from "../lib/qr";
import { CommandBar } from "./CommandBar";
import type { CommandDef } from "./CommandBar";

interface RemoteInfo {
  url: string;
  token: string;
  port: number;
  addresses: string[];
  phonecamUrl: string;
}

interface TopBarProps {
  isLive: boolean;
  setIsLive: (v: boolean) => void;
  isBlank: boolean;
  setIsBlank: (v: boolean) => void;
  isTheme: boolean;
  setIsTheme: (v: boolean) => void;
  setSelectedDisplays?: (v: number[]) => void;
  onOpenSettings?: () => void;
  commands?: CommandDef[];
  matchText?: (query: string) => CommandDef[];
}

export const TopBar = React.memo(function TopBar({ isLive, setIsLive, isBlank, setIsBlank, isTheme, setIsTheme, setSelectedDisplays, onOpenSettings, commands = [], matchText }: TopBarProps) {
  const [searchValue, setSearchValue] = useState("");
  const [remoteInfo, setRemoteInfo] = useState<RemoteInfo | null>(null);
  const [showRemote, setShowRemote] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPhoneCam, setShowPhoneCam] = useState(false);
  const [phoneCamConnected, setPhoneCamConnected] = useState(false);
  const [copiedPhoneCam, setCopiedPhoneCam] = useState(false);

  useEffect(() => {
    if (window.electron && window.electron.getRemoteInfo) {
      window.electron.getRemoteInfo().then((info: RemoteInfo) => setRemoteInfo(info));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (window.electron && window.electron.getPhoneCamStatus) {
        window.electron.getPhoneCamStatus().then((s: any) => {
          if (!cancelled) setPhoneCamConnected(!!s?.connected);
        });
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Close the remote/phonecam popovers with Escape (instead of the app-wide panic).
  useEffect(() => {
    if (!showRemote && !showPhoneCam) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowRemote(false);
        setShowPhoneCam(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRemote, showPhoneCam]);

  const copyUrl = async () => {
    if (!remoteInfo) return;
    try {
      await navigator.clipboard.writeText(remoteInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const copyPhoneCamUrl = async () => {
    if (!remoteInfo) return;
    try {
      await navigator.clipboard.writeText(remoteInfo.phonecamUrl);
      setCopiedPhoneCam(true);
      setTimeout(() => setCopiedPhoneCam(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const qrSvg = remoteInfo ? qrToSvg(remoteInfo.url) : null;
  const qrDataUri = qrSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}` : null;
  const phoneCamQrSvg = remoteInfo ? qrToSvg(remoteInfo.phonecamUrl) : null;
  const phoneCamQrDataUri = phoneCamQrSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(phoneCamQrSvg)}` : null;

  return (
    <div className="relative flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-[#0d0d1a] select-none" style={{ minHeight: 44 }}>
      <div className="flex items-center gap-4">
        <span className="text-[#7c6af7] font-bold tracking-wide text-sm">CrossPresenter</span>
      </div>
      <CommandBar
        commands={commands}
        value={searchValue}
        onChange={setSearchValue}
        matchText={matchText}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsBlank(!isBlank)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all border ${isBlank ? "bg-yellow-500/30 border-yellow-400 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "bg-white/5 border-white/10 text-white/55 hover:text-white/80 hover:border-white/20"
            }`}
        >
          <EyeOff size={12} /> Blank
        </button>
        <button
          onClick={() => setIsTheme(!isTheme)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all border ${isTheme ? "bg-purple-500/30 border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]" : "bg-white/5 border-white/10 text-white/55 hover:text-white/80 hover:border-white/20"
            }`}
        >
          <Palette size={12} /> Theme
        </button>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-1.5 px-4 py-1 rounded text-xs font-semibold transition-colors border min-w-[100px] justify-center ${isLive ? "bg-red-500 border-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]" : "bg-white/5 border-white/10 text-white/55 hover:text-white/80 hover:border-white/20"
            }`}
        >
          {isLive ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isLive ? "Live" : "Live"}
        </button>
        <button
          onClick={() => {
            if (setSelectedDisplays) setSelectedDisplays([]);
            setIsLive(false);
          }}
          className="p-1.5 text-white/35 hover:text-red-400 transition-colors"
          title="Disconnect Outputs (Esc)"
        >
          <Monitor size={15} />
        </button>
        <button
          onClick={() => {
            setShowRemote(false);
            setShowPhoneCam(v => !v);
          }}
          className={`relative p-1.5 transition-colors ${showPhoneCam ? "text-[#7c6af7]" : "text-white/35 hover:text-white/75"}`}
          title="Phone camera — connect your phone"
        >
          <Camera size={15} />
          {phoneCamConnected && (
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.9)]" />
          )}
        </button>
        <button
          onClick={() => {
            setShowPhoneCam(false);
            setShowRemote(v => !v);
          }}
          className={`p-1.5 transition-colors ${showRemote ? "text-[#7c6af7]" : "text-white/35 hover:text-white/75"}`}
          title="Open phone/tablet remote"
        >
          <Smartphone size={15} />
        </button>
        <button onClick={onOpenSettings} className="p-1.5 text-white/35 hover:text-white/75 transition-colors"><Settings size={15} /></button>
      </div>

      {showPhoneCam && (
        <div data-modal="true" className="absolute top-[calc(100%+6px)] right-2 z-[150] w-72 rounded-xl border border-white/10 bg-[#16162a] shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-widest">Phone Camera</span>
            <button onClick={() => setShowPhoneCam(false)} className="p-1 text-white/40 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
          {remoteInfo ? (
            <>
              <div className="flex justify-center">
                {phoneCamQrDataUri ? (
                  <img src={phoneCamQrDataUri} alt="Phone Camera QR code" className="w-44 h-44 rounded-lg bg-white p-2" />
                ) : (
                  <div className="w-44 h-44 bg-white/5 rounded-lg flex items-center justify-center text-[10px] text-white/40">Generating…</div>
                )}
              </div>
              <div className="text-center">
                <p className="text-[10px] text-white/40 mb-1">Scan with your phone camera to stream it to this PC</p>
                <button
                  onClick={copyPhoneCamUrl}
                  className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-[#7c6af7]/20 border border-[#7c6af7]/40 text-[#a89cf7] text-xs font-medium hover:bg-[#7c6af7]/30 transition-colors max-w-full"
                  title="Copy phone camera link"
                >
                  {copiedPhoneCam ? <Check size={12} /> : <Copy size={12} />}
                  <span className="truncate">{copiedPhoneCam ? "Copied!" : "Copy phone link"}</span>
                </button>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-white/35 leading-snug">
                  On your phone, accept the security warning (tap <span className="text-white/55">Advanced → Proceed</span>), then tap <span className="text-white/55">Start Camera</span>.
                </p>
                <p className="text-[9px] text-white/25 mt-1.5">Phone and laptop must be on the same network.</p>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[9px]">
                <span className={`w-2 h-2 rounded-full ${phoneCamConnected ? "bg-green-400" : "bg-white/15"}`} />
                <span className={phoneCamConnected ? "text-green-400 font-medium" : "text-white/40"}>
                  {phoneCamConnected ? "Phone connected" : "Phone not connected"}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-white/40 text-center py-6">Server starting…</p>
          )}
        </div>
      )}

      {showRemote && (
        <div data-modal="true" className="absolute top-[calc(100%+6px)] right-2 z-[150] w-72 rounded-xl border border-white/10 bg-[#16162a] shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-widest">Phone Remote</span>
            <button onClick={() => setShowRemote(false)} className="p-1 text-white/40 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
          {remoteInfo ? (
            <>
              <div className="flex justify-center">
                {qrDataUri ? (
                  <img src={qrDataUri} alt="Remote QR code" className="w-44 h-44 rounded-lg bg-white p-2" />
                ) : (
                  <div className="w-44 h-44 bg-white/5 rounded-lg flex items-center justify-center text-[10px] text-white/40">Generating…</div>
                )}
              </div>
              <div className="text-center">
                <p className="text-[10px] text-white/40 mb-1">Scan with your phone camera, then tap the link</p>
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-[#7c6af7]/20 border border-[#7c6af7]/40 text-[#a89cf7] text-xs font-medium hover:bg-[#7c6af7]/30 transition-colors"
                  title="Copy URL"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : remoteInfo.url}
                </button>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-white/35">
                  Session token: <span className="font-mono text-white/60">{remoteInfo.token}</span>
                </p>
                <p className="text-[9px] text-white/25 mt-0.5">Phone and laptop must be on the same network.</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-white/40 text-center py-6">Remote server starting…</p>
          )}
        </div>
      )}
    </div>
  );
});
