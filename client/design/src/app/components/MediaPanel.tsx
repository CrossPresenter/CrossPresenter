import { useState } from "react";
import { Play, Pause, Volume2, VolumeX, Layers, Film, Image, Maximize2, SkipBack, SkipForward, BookOpen } from "lucide-react";
import { BIBLE_BOOKS, CHAPTERS, getVerses, getVerseText } from "./BibleData";
import type { LiveContent } from "../App";

const VIDEOS = [
  { id: 1, title: "Offering Video", duration: "2:14", thumb: "bg-gradient-to-br from-purple-900 to-indigo-900" },
  { id: 2, title: "Welcome Loop", duration: "0:45", thumb: "bg-gradient-to-br from-blue-900 to-cyan-900" },
  { id: 3, title: "Countdown Timer", duration: "5:00", thumb: "bg-gradient-to-br from-red-900 to-orange-900" },
  { id: 4, title: "Baptism Testimony", duration: "4:32", thumb: "bg-gradient-to-br from-green-900 to-teal-900" },
];

const OVERLAYS = [
  { id: 1, label: "Lower Third — Speaker", color: "bg-[#7c6af7]/20 border-[#7c6af7]/40 text-[#a89cf7]" },
  { id: 2, label: "Scripture Reference Bar", color: "bg-blue-500/15 border-blue-400/30 text-blue-300" },
  { id: 3, label: "Offering Alert", color: "bg-yellow-500/15 border-yellow-400/30 text-yellow-300" },
  { id: 4, label: "Coming Up Next", color: "bg-green-500/15 border-green-400/30 text-green-300" },
  { id: 5, label: "Logo Bug (Bottom Right)", color: "bg-white/8 border-white/15 text-white/50" },
];

interface MediaPanelProps {
  onBibleVerse: (v: LiveContent) => void;
}

export function MediaPanel({ onBibleVerse }: MediaPanelProps) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState(35);
  const [activeVideo, setActiveVideo] = useState<number | null>(null);
  const [activeOverlays, setActiveOverlays] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<"videos" | "overlays" | "images" | "bible">("videos");
  const [bibleBook, setBibleBook] = useState("John");
  const [bibleChapter, setBibleChapter] = useState(3);
  const [bibleVerse, setBibleVerse] = useState<number | null>(null);

  const toggleOverlay = (id: number) =>
    setActiveOverlays(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="flex border-t border-white/10 bg-[#13131f]" style={{ height: activeVideo !== null ? 230 : 200, minHeight: 180, transition: "height 0.2s" }}>
      {/* Video player — only shown when a video is active */}
      {activeVideo !== null && (
        <div className="flex flex-col border-r border-white/10 p-3 gap-2" style={{ width: 280, minWidth: 220 }}>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2">
              <Film size={12} className="text-[#7c6af7]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Now Playing</span>
            </div>
            <button onClick={() => { setActiveVideo(null); setPlaying(false); }} className="text-white/25 hover:text-white/60 transition-colors text-xs">✕</button>
          </div>

          {/* Mini player */}
          <div className="flex-1 rounded bg-black border border-white/8 flex items-center justify-center relative overflow-hidden">
            <div className={`absolute inset-0 ${VIDEOS[activeVideo].thumb} opacity-60`} />
            <div className="relative z-10 text-center">
              <p className="text-xs text-white font-medium">{VIDEOS[activeVideo].title}</p>
              <p className="text-[10px] text-white/40">{VIDEOS[activeVideo].duration}</p>
            </div>
            <button className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                <Maximize2 size={12} className="text-white" />
              </div>
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30 w-6">
              {Math.floor(progress * 0.134)}:{String(Math.floor((progress * 8) % 60)).padStart(2,"0")}
            </span>
            <input
              type="range" min={0} max={100} value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              className="flex-1 h-1 accent-[#7c6af7] cursor-pointer"
            />
            <span className="text-[9px] text-white/30 w-7">{VIDEOS[activeVideo].duration}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button className="p-1 text-white/40 hover:text-white/80 transition-colors"><SkipBack size={13} /></button>
              <button
                onClick={() => setPlaying(!playing)}
                className="w-7 h-7 rounded-full bg-[#7c6af7] flex items-center justify-center text-white hover:bg-[#6a58e0] transition-colors"
              >
                {playing ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
              </button>
              <button className="p-1 text-white/40 hover:text-white/80 transition-colors"><SkipForward size={13} /></button>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setMuted(!muted)} className="text-white/40 hover:text-white/80 transition-colors">
                {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <input
                type="range" min={0} max={100} value={muted ? 0 : volume}
                onChange={e => { setVolume(Number(e.target.value)); setMuted(false); }}
                className="w-16 h-1 accent-[#7c6af7] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Media library tabs */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {([
            { key: "videos", label: "Videos", Icon: Film },
            { key: "overlays", label: "Overlays", Icon: Layers },
            { key: "images", label: "Images", Icon: Image },
          { key: "bible", label: "Bible", Icon: BookOpen },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "border-[#7c6af7] text-[#a89cf7]"
                  : "border-transparent text-white/35 hover:text-white/65"
              }`}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === "videos" && (
            <div className="grid grid-cols-4 gap-2">
              {VIDEOS.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => { setActiveVideo(i); setPlaying(true); setProgress(0); }}
                  className={`flex flex-col rounded border overflow-hidden transition-all text-left ${
                    activeVideo === i
                      ? "border-[#7c6af7]/60 ring-1 ring-[#7c6af7]/30"
                      : "border-white/8 hover:border-white/20"
                  }`}
                >
                  <div className={`aspect-video ${v.thumb} flex items-center justify-center`}>
                    <Film size={14} className="text-white/40" />
                  </div>
                  <div className="px-1.5 py-1 bg-black/40">
                    <p className="text-[9px] text-white/70 truncate">{v.title}</p>
                    <p className="text-[8px] text-white/30">{v.duration}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === "overlays" && (
            <div className="flex flex-col gap-1.5">
              {OVERLAYS.map(ov => {
                const isOn = activeOverlays.includes(ov.id);
                return (
                  <button
                    key={ov.id}
                    onClick={() => toggleOverlay(ov.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded border text-xs transition-all ${
                      isOn ? ov.color : "bg-white/3 border-white/8 text-white/40 hover:text-white/65 hover:border-white/15"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={11} />
                      {ov.label}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${isOn ? "bg-black/20" : "bg-white/5"}`}>
                      {isOn ? "ON" : "OFF"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "images" && (
            <div className="grid grid-cols-5 gap-1.5">
              {["Announcements","Offering","Welcome","Sermon Title","Verse Bg","Pastor Photo","Logo","Blank White","Dark Texture","Cross"].map((name, i) => (
                <button key={i} className="flex flex-col items-center gap-1 rounded border border-white/8 hover:border-white/20 p-1 transition-all">
                  <div className="w-full aspect-video rounded bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
                    <Image size={11} className="text-white/25" />
                  </div>
                  <p className="text-[8px] text-white/35 truncate w-full text-center">{name}</p>
                </button>
              ))}
            </div>
          )}

          {activeTab === "bible" && (
            <div className="flex flex-col gap-3 h-full">
              {/* Dropdowns row */}
              <div className="flex gap-2 flex-wrap">
                {/* Book */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-widest text-white/30">Book</label>
                  <select
                    value={bibleBook}
                    onChange={e => { setBibleBook(e.target.value); setBibleChapter(1); setBibleVerse(null); }}
                    className="bg-[#1e1e2e] border border-white/15 text-white/80 text-xs rounded px-2 py-1 outline-none focus:border-[#7c6af7]/60 cursor-pointer"
                    style={{ minWidth: 140 }}
                  >
                    {BIBLE_BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {/* Chapter */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-widest text-white/30">Chapter</label>
                  <select
                    value={bibleChapter}
                    onChange={e => { setBibleChapter(Number(e.target.value)); setBibleVerse(null); }}
                    className="bg-[#1e1e2e] border border-white/15 text-white/80 text-xs rounded px-2 py-1 outline-none focus:border-[#7c6af7]/60 cursor-pointer"
                    style={{ minWidth: 80 }}
                  >
                    {Array.from({ length: CHAPTERS[bibleBook] ?? 10 }, (_, i) => i + 1).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Verse list */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                {getVerses(bibleBook, bibleChapter).map(v => {
                  const text = getVerseText(bibleBook, bibleChapter, v);
                  const isActive = bibleVerse === v;
                  return (
                    <button
                      key={v}
                      onClick={() => {
                        setBibleVerse(v);
                        onBibleVerse({
                          type: "bible",
                          text,
                          reference: `${bibleBook} ${bibleChapter}:${v}`,
                        });
                      }}
                      className={`flex gap-2 text-left px-2.5 py-1.5 rounded border transition-all ${
                        isActive
                          ? "bg-blue-500/15 border-blue-400/40 text-white"
                          : "bg-white/3 border-white/8 text-white/55 hover:text-white/85 hover:border-white/18"
                      }`}
                    >
                      <span className={`text-[10px] font-mono flex-shrink-0 mt-0.5 ${isActive ? "text-blue-300" : "text-white/25"}`}>{v}</span>
                      <span className="text-[10px] leading-relaxed">{text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stream status panel */}
      <div className="flex flex-col border-l border-white/10 p-3 gap-2" style={{ width: 180, minWidth: 150 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wide">Stream Active</span>
        </div>
        {[
          { label: "Output 1", detail: "HDMI — 1920×1080", on: true },
          { label: "Output 2", detail: "VGA — 1280×720", on: true },
          { label: "Stream", detail: "YouTube Live", on: false },
          { label: "Recording", detail: "Local — MP4", on: false },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/60">{item.label}</p>
              <p className="text-[8px] text-white/25">{item.detail}</p>
            </div>
            <div className={`w-2 h-2 rounded-full ${item.on ? "bg-green-400" : "bg-white/15"}`} />
          </div>
        ))}
        <div className="mt-auto pt-2 border-t border-white/8">
          <p className="text-[9px] text-white/25">Elapsed</p>
          <p className="text-sm font-mono text-white/60">01:24:37</p>
        </div>
      </div>
    </div>
  );
}
