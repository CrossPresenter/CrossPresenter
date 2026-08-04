import { ChevronLeft, ChevronRight, Monitor, Eye, BookOpen, X, Plus, PenTool, Type, Image as ImageIcon, Youtube, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Laptop, StickyNote, GripVertical } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import type { LiveContent, ServiceItem, ClockSettings, DisplayInfo, VideoState } from "../App";
import { PresenterView, type PresenterState } from "./PresenterView";

export const DEFAULT_SLIDE: ServiceItem = { 
  id: "default",
  type: "custom",
  title: "—", 
  detail: "—", 
  slides: ["(No lyrics for this item)"] 
};

interface LyricsPanelProps {
  activeItem: ServiceItem | null;
  activeLyricSlide: number;
  setActiveLyricSlide: (i: number) => void;
  isBlank: boolean;
  liveOverride: LiveContent | null;
  clearOverride: () => void;
  activeCameraId?: string | null;
  backgroundImage?: string | null;
  setBackgroundImage?: (dataUrl: string | null) => void;
  setActiveCameraId?: (id: string | null) => void;
  savedBackgrounds: string[];
  setSavedBackgrounds: React.Dispatch<React.SetStateAction<string[]>>;
  videoState?: VideoState | null;
  setVideoState?: (state: VideoState | null) => void;
  timerState?: any;
  clockSettings?: ClockSettings;
  displays?: DisplayInfo[];
  selectedDisplays?: number[];
  isLive?: boolean;
  isTheme?: boolean;
  hideLyrics?: boolean;
  textScale?: number;
  setTextScale?: (scale: number) => void;
  onUpdateActiveItem?: (patch: Partial<ServiceItem>) => void;
}

export const LyricsPanel = React.memo(function LyricsPanel({ 
  activeItem, 
  activeLyricSlide, 
  setActiveLyricSlide, 
  isBlank, 
  liveOverride, 
  clearOverride,
  activeCameraId,
  backgroundImage,
  setBackgroundImage,
  setActiveCameraId,
  clockSettings,
  displays,
  selectedDisplays,
  isLive,
  isTheme,
  hideLyrics = false,
  savedBackgrounds,
  setSavedBackgrounds,
  videoState,
  setVideoState,
  timerState,
  textScale = 1,
  setTextScale,
  onUpdateActiveItem
}: LyricsPanelProps) {
  const { settings } = useSettings();
  const song = activeItem ?? DEFAULT_SLIDE;
  const slides = song.slides;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Font Editor
  const [showFontEditor, setShowFontEditor] = useState(false);

  // Speaker Notes Editor
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const currentNote = (song.notes && song.notes[activeLyricSlide]) || "";

  const handleNoteChange = (value: string) => {
    if (!onUpdateActiveItem) return;
    const notes = [...(song.notes ?? [])];
    notes[activeLyricSlide] = value;
    onUpdateActiveItem({ notes });
  };

  // Slide drag-to-reorder
  const [slideDragIndex, setSlideDragIndex] = useState<number | null>(null);
  const [slideOverIndex, setSlideOverIndex] = useState<number | null>(null);

  const reorderSlides = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= slides.length || to >= slides.length) return;
    const newSlides = [...slides];
    const [moved] = newSlides.splice(from, 1);
    newSlides.splice(to, 0, moved);
    const notes = song.notes ? [...song.notes] : undefined;
    if (notes) {
      const [n] = notes.splice(from, 1);
      notes.splice(to, 0, n);
    }
    if (onUpdateActiveItem) onUpdateActiveItem({ slides: newSlides, notes });
    setActiveLyricSlide(to);
  };

  // Video Time State
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.onSyncTimeUpdated) {
      // @ts-ignore
      window.electron.onSyncTimeUpdated((time: number) => setVideoCurrentTime(time));
    }
    // @ts-ignore
    if (window.electron && window.electron.onSyncDurationUpdated) {
      // @ts-ignore
      window.electron.onSyncDurationUpdated((duration: number) => setVideoDuration(duration));
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const current = liveOverride ? liveOverride.text : (slides[activeLyricSlide] ?? "");
  const prev = !liveOverride && activeLyricSlide > 0 ? slides[activeLyricSlide - 1] : null;
  const next = !liveOverride && activeLyricSlide < slides.length - 1 ? slides[activeLyricSlide + 1] : null;

  // Aspect Ratio Calculation
  const activeDisplay = displays.find(d => selectedDisplays.includes(d.id));
  const previewRatio = activeDisplay ? `${activeDisplay.bounds.width}/${activeDisplay.bounds.height}` : "16/9";

  const presenterState: PresenterState = {
    text: hideLyrics ? "" : current,
    reference: liveOverride?.type === "bible" ? liveOverride.reference : undefined,
    liveImage: liveOverride?.type === "image" ? liveOverride.url : null,
    isBlank,
    isTheme,
    isLive, // For preview, we force it to show even if not live by passing isPreview=true
    activeCameraId,
    backgroundImage,
    textScale,
    appSettings: settings,
    clockSettings,
    videoState,
    timerState
  };

  // Video camera is now handled exclusively by PresenterView!

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && setBackgroundImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          const url = event.target.result;
          setBackgroundImage(url);
          setSavedBackgrounds(prev => [url, ...prev.filter(u => u !== url)]);
          if (setActiveCameraId) setActiveCameraId(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = (url: string) => {
    if (backgroundImage === url) {
      // Clear background if already selected
      if (setBackgroundImage) setBackgroundImage(null);
    } else {
      // Select new background
      if (setBackgroundImage) setBackgroundImage(url);
      if (setActiveCameraId) setActiveCameraId(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* Hidden file input */}
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleImageUpload}
      />

      {/* Top: slide list + live preview side by side */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide List (Text only, no thumbnails) */}
        <div className="flex flex-col border-r border-white/10 overflow-y-auto bg-[#16162a]" style={{ width: 220, minWidth: 180 }}>
          <div className="px-3 py-2 border-b border-white/10 bg-[#13131f]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Slides</p>
              {onUpdateActiveItem && (
                <button
                  onClick={() => setShowNotesEditor(v => !v)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-medium border transition-colors ${showNotesEditor ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-300" : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/25"}`}
                  title="Edit speaker notes for this slide"
                >
                  <StickyNote size={10} /> Notes
                </button>
              )}
            </div>
            <p className="text-xs text-white/80 font-medium truncate mt-0.5">{song.title}</p>
            <p className="text-[10px] text-white/35">{song.detail}</p>
          </div>
          <div className="flex-1 p-2 flex flex-col gap-1">
            {slides.map((slide, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => {
                  setSlideDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (slideOverIndex !== i) setSlideOverIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (slideDragIndex !== null) reorderSlides(slideDragIndex, i);
                  setSlideDragIndex(null);
                  setSlideOverIndex(null);
                }}
                onDragEnd={() => {
                  setSlideDragIndex(null);
                  setSlideOverIndex(null);
                }}
                className={`${slideDragIndex === i ? "opacity-40" : ""} ${slideOverIndex === i && slideDragIndex !== null && slideDragIndex !== i ? "border-t-2 border-t-[#7c6af7]" : ""}`}
                title="Drag to reorder slide"
              >
                <button
                  onClick={() => {
                    setActiveLyricSlide(i);
                    // Hide lyrics state is now handled in App.tsx handleLyricSlideChange
                  }}
                  className={`w-full text-left rounded px-2.5 py-2 border transition-all ${
                    i === activeLyricSlide && !hideLyrics && !liveOverride
                      ? "border-[#7c6af7]/60 bg-[#7c6af7]/20 text-white shadow-sm"
                      : "border-white/5 bg-white/5 text-white/60 hover:text-white/90 hover:border-white/15 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <GripVertical size={9} className="text-white/15 mt-1 flex-shrink-0" />
                    <span className={`text-[9px] font-mono mt-0.5 flex-shrink-0 ${i === activeLyricSlide && !hideLyrics && !liveOverride ? "text-[#a89cf7]" : "text-white/30"}`}>
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <p className="text-[11px] leading-snug whitespace-pre-line break-words flex-1 min-w-0">{slide}</p>
                  </div>
                  {song.notes && song.notes[i] ? (
                    <div className="flex items-center gap-1 mt-1 ml-6">
                      <StickyNote size={9} className="text-yellow-400/70 flex-shrink-0" />
                      <p className="text-[9px] text-yellow-300/70 line-clamp-1">{song.notes[i]}</p>
                    </div>
                  ) : null}
                </button>
              </div>
            ))}
          </div>

          {/* Speaker Notes Editor */}
          {showNotesEditor && (
            <div className="border-t border-white/10 bg-[#13131f] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-yellow-400/70 mb-1.5">Notes — Slide {activeLyricSlide + 1}</p>
              <textarea
                value={currentNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="Speaker notes for this slide (shown only in Stage view)…"
                className="w-full h-20 bg-black/40 border border-white/10 rounded p-2 text-[11px] text-white/80 placeholder-white/25 focus:outline-none focus:border-yellow-400/40 resize-none"
              />
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d1a] relative">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-[#13131f]">
            <div className="flex items-center gap-1.5">
              <Monitor size={12} className="text-[#7c6af7]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Live Output Preview</span>
            </div>
            <div className="flex items-center gap-1.5">
              {liveOverride?.type === "bible" && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                    <BookOpen size={9} /> {liveOverride.reference}
                  </span>
                  <button onClick={clearOverride} className="text-white/25 hover:text-white/60 transition-colors">
                    <X size={11} />
                  </button>
                </div>
              )}
              {hideLyrics && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">IMAGE ONLY</span>
              )}
              {isBlank && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">BLANK</span>
              )}
              <Eye size={12} className="text-white/30" />
            </div>
          </div>

          {/* Preview screen */}
          <div className="flex-1 flex items-center justify-center p-6 relative">
            
            {/* Custom Image + Button */}
            <div className="absolute bottom-4 left-4 flex gap-2 items-center z-20">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-full bg-[#7c6af7] hover:bg-[#6a58e0] shadow-lg flex items-center justify-center transition-all group"
                title="Add Custom Background Image"
              >
                <Plus size={20} className="text-white" />
              </button>
              
              {/* Background Gallery */}
              {savedBackgrounds.length > 0 && (
                <div className="flex gap-2 bg-black/40 p-1.5 rounded-full backdrop-blur-sm border border-white/10">
                  {savedBackgrounds.slice(0, 5).map((url, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleImageClick(url)}
                      className={`w-7 h-7 rounded-full bg-cover bg-center border-2 transition-all hover:scale-110 active:scale-95 ${backgroundImage === url ? 'border-[#7c6af7]' : 'border-transparent hover:border-white/40'}`}
                      style={{ backgroundImage: `url(${url})` }}
                      title={backgroundImage === url ? "Click to clear wallpaper" : "Set as wallpaper"}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Font Editor removed, moved to Settings Modal */}

            <div 
              className="w-full max-w-2xl bg-black border border-white/10 relative overflow-hidden shadow-2xl flex items-center justify-center transition-all"
              style={{ aspectRatio: previewRatio }}
            >
              <PresenterView 
                state={presenterState} 
                isPreview={true} 
                onTogglePlay={() => {
                  if (setVideoState && videoState) {
                    setVideoState({ ...videoState, playing: !videoState.playing });
                  }
                }}
              />
              
              {/* Screen corners (UI decoration for the preview box) */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/20 rounded-tl z-50 pointer-events-none" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/20 rounded-tr z-50 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/20 rounded-bl z-50 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/20 rounded-br z-50 pointer-events-none" />
            </div>

            {/* Text size slider */}
            {setTextScale && (
              <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 shadow-lg">
                <Type size={12} className="text-white/50" />
                <input
                  type="range"
                  min={50}
                  max={150}
                  step={5}
                  defaultValue={100}
                  onChange={(e) => setTextScale(Number(e.target.value) / 100)}
                  className="w-28 h-1.5 cursor-pointer accent-[#7c6af7]"
                  title="Text size"
                />
                <span className="text-[9px] text-white/60 tabular-nums w-8 text-right">{Math.round(textScale * 100)}%</span>
              </div>
            )}
          </div>

          {/* YouTube Control Deck inside Preview Panel */}
          {videoState && (
            <div className="px-4 pb-2">
              <div className="flex flex-col rounded-lg bg-black border border-white/10 p-2.5 gap-2 shadow-xl">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    {videoState.type === "youtube" ? (
                      <Youtube size={12} className="text-[#ff0000]" />
                    ) : (
                      <Play size={12} className="text-[#00ffcc]" />
                    )}
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                      {videoState.type === "youtube" ? "YouTube Stream Active" : "Local Video Active"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Laptop size={12} className="text-white/40" />
                    <select 
                      value={videoState.audioDestination}
                      onChange={e => {
                        if (setVideoState) setVideoState({ ...videoState, audioDestination: e.target.value as "laptop" | "tv" });
                      }}
                      className="bg-[#1a1a2e] border border-white/10 rounded text-[10px] text-white/80 px-2 py-0.5 outline-none cursor-pointer"
                    >
                      <option value="tv">Output Audio: TV (Presenter Display)</option>
                      <option value="laptop">Output Audio: Laptop (Local Preview)</option>
                    </select>
                    <button onClick={() => { if (setVideoState) setVideoState(null); }} className="text-white/25 hover:text-white/60 transition-colors ml-2">
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
                  {/* Timeline Slider */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[9px] text-white/40 font-mono w-8 text-right">{formatTime(videoCurrentTime)}</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={videoDuration || 100} 
                      value={videoCurrentTime}
                      onChange={e => {
                        const newTime = Number(e.target.value);
                        setVideoCurrentTime(newTime);
                        if (setVideoState) setVideoState({ ...videoState, seekToTimestamp: newTime });
                      }}
                      className="flex-1 h-1.5 accent-[#7c6af7] bg-white/10 rounded-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#7c6af7] [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-[9px] text-white/40 font-mono w-8">{formatTime(videoDuration)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setVideoState && setVideoState({ ...videoState, playbackRate: Math.max(0.25, videoState.playbackRate - 0.25) })} className="p-1.5 text-white/40 hover:text-white/80 transition-colors rounded hover:bg-white/5" title="Slow Down"><SkipBack size={14} /></button>
                      <button
                        onClick={() => setVideoState && setVideoState({ ...videoState, playing: !videoState.playing })}
                        className="w-8 h-8 rounded-full bg-[#7c6af7] flex items-center justify-center text-white hover:bg-[#6a58e0] shadow-lg transition-colors mx-1"
                      >
                        {videoState.playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                      </button>
                      <button onClick={() => setVideoState && setVideoState({ ...videoState, playbackRate: Math.min(2, videoState.playbackRate + 0.25) })} className="p-1.5 text-white/40 hover:text-white/80 transition-colors rounded hover:bg-white/5" title="Speed Up"><SkipForward size={14} /></button>
                      <span className="text-[9px] text-white/40 ml-1 font-mono w-6">{videoState.playbackRate}x</span>
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <button 
                        onClick={() => setVideoState && setVideoState({ ...videoState, isBackground: !videoState.isBackground })}
                        className={`px-4 py-1.5 rounded text-[10px] font-medium border transition-colors shadow-sm ${videoState.isBackground ? "bg-[#7c6af7]/20 border-[#7c6af7]/50 text-[#a89cf7]" : "bg-black/60 border-white/20 hover:border-white/40 text-white"}`}
                      >
                        {videoState.isBackground ? "✓ Background Mode (Behind Lyrics)" : "Foreground Mode (Hide Lyrics)"}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => setVideoState && setVideoState({ ...videoState, volume: videoState.volume === 0 ? 80 : 0 })} className="text-white/40 hover:text-white/80 transition-colors p-1 rounded hover:bg-white/5">
                        {videoState.volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                      <input
                        type="range" min={0} max={100} value={videoState.volume}
                        onChange={e => setVideoState && setVideoState({ ...videoState, volume: Number(e.target.value) })}
                        className="w-24 h-1 accent-[#7c6af7] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prev / next text hints */}
          <div className="grid grid-cols-2 gap-3 px-4 pb-3">
            <div className="rounded bg-white/3 border border-white/8 p-2 min-h-[52px]">
              <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Previous</p>
              <p className="text-[10px] text-white/35 whitespace-pre-line leading-tight line-clamp-3">{prev ?? "—"}</p>
            </div>
            <div className="rounded bg-white/3 border border-white/8 p-2 min-h-[52px]">
              <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Next</p>
              <p className="text-[10px] text-white/35 whitespace-pre-line leading-tight line-clamp-3">{next ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
