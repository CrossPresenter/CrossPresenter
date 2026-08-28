import { Monitor, Eye, BookOpen, X, Plus, Type, GripVertical, Github, Film } from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import type { LiveContent, ServiceItem, ClockSettings, DisplayInfo, VideoState } from "../App";
import { PresenterView, type PresenterState } from "./PresenterView";

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_SLIDE: ServiceItem = { 
  id: "default",
  type: "custom",
  title: "—", 
  detail: "—", 
  slides: [] 
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
  audioOutputs?: { id: string; label: string }[];
  timerState?: any;
  clockSettings?: ClockSettings;
  displays?: DisplayInfo[];
  selectedDisplays?: number[];
  isLive?: boolean;
  isTheme?: boolean;
  hideLyrics?: boolean;
  textScale?: number;
  setTextScale?: (scale: number) => void;
  scriptureBadge?: boolean;
  imageZoom?: number;
  setImageZoom?: (v: number) => void;
  imagePan?: { x: number; y: number };
  setImagePan?: (v: { x: number; y: number }) => void;
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
  audioOutputs = [],
  timerState,
  textScale = 1,
  setTextScale,
  scriptureBadge = false,
  imageZoom = 1,
  setImageZoom,
  imagePan = { x: 0, y: 0 },
  setImagePan,
  onUpdateActiveItem
}: LyricsPanelProps) {
  const { settings } = useSettings();
  const song = activeItem ?? DEFAULT_SLIDE;
  const slides = song.slides;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slide drag-to-reorder
  const [slideDragIndex, setSlideDragIndex] = useState<number | null>(null);
  const [slideOverIndex, setSlideOverIndex] = useState<number | null>(null);

  const reorderSlides = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= slides.length || to >= slides.length) return;
    const newSlides = [...slides];
    const [moved] = newSlides.splice(from, 1);
    newSlides.splice(to, 0, moved);
    if (onUpdateActiveItem) onUpdateActiveItem({ slides: newSlides });
    setActiveLyricSlide(to);
  };

  // Video Time State
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    if (window.electron && window.electron.onSyncTimeUpdated) {
      window.electron.onSyncTimeUpdated((time: number) => setVideoCurrentTime(time));
    }
    if (window.electron && window.electron.onSyncDurationUpdated) {
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
  const previewStyle = useMemo(() => ({ aspectRatio: previewRatio }), [previewRatio]);

  // Pixel-locked canvas: computed from the actual preview area size so slide/state
  // changes can never resize it. Only real pane resizes (window/panel drags) recompute it.
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(0, rect.width - 48);
      const availH = Math.max(0, rect.height - 48);
      if (availW <= 0 || availH <= 0) return;
      const [rw, rh] = previewRatio.split("/").map(Number);
      const ratio = rw > 0 && rh > 0 ? rw / rh : 16 / 9;
      let w = Math.min(availW, 672); // former max-w-2xl cap
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      const nw = Math.floor(w);
      const nh = Math.floor(h);
      setCanvasSize(prev => (prev && prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewRatio]);

  const presenterState: PresenterState = useMemo(() => ({
    text: hideLyrics ? "" : current,
    reference: liveOverride?.type === "bible" ? liveOverride.reference : undefined,
    liveImage: liveOverride?.type === "image" ? liveOverride.url : null,
    imageZoom,
    imagePan,
    isBlank,
    isTheme,
    isLive, // For preview, we force it to show even if not live by passing isPreview=true
    scriptureBadge,
    activeCameraId,
    backgroundImage,
    textScale,
    appSettings: settings,
    clockSettings,
    videoState,
    timerState
  }), [current, liveOverride, isBlank, isTheme, isLive, scriptureBadge,
        activeCameraId, backgroundImage, textScale, settings, clockSettings,
        videoState, timerState, hideLyrics, imageZoom, imagePan]);

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
        accept="image/*,video/*" 
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
                </button>
              </div>
            ))}
          </div>

        </div>

        {/* Live preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d1a] relative">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-[#13131f] min-h-[36px] shrink-0">
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
          <div ref={previewAreaRef} className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
            
            {/* Custom Image + Button */}
            <div className="absolute bottom-4 left-4 flex gap-2 items-center z-20">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-full bg-[#7c6af7] hover:bg-[#6a58e0] shadow-lg flex items-center justify-center transition-all group"
                title="Add Custom Background (Image or Video)"
              >
                <Plus size={20} className="text-white" />
              </button>
              
              {/* Background Gallery (images & videos, up to 6) */}
              {savedBackgrounds.length > 0 && (
                <div className="flex gap-2 bg-transparent p-1 rounded-full">
                  {savedBackgrounds.slice(0, 6).map((url, idx) => {
                    const isVideo = /^data:video\//i.test(url) || /\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(url);
                    return isVideo ? (
                      <div
                        key={idx}
                        className={`relative w-7 h-7 rounded-full overflow-hidden border-2 transition-all hover:scale-110 active:scale-95 cursor-pointer ${backgroundImage === url ? 'border-[#7c6af7]' : 'border-transparent hover:border-white/40'}`}
                        onClick={() => handleImageClick(url)}
                        title={backgroundImage === url ? "Click to clear wallpaper" : "Set as video wallpaper"}
                      >
                        <video src={url} muted playsInline loop className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                          <Film size={9} className="text-white/80" />
                        </div>
                      </div>
                    ) : (
                      <button 
                        key={idx} 
                        onClick={() => handleImageClick(url)}
                        className={`w-7 h-7 rounded-full bg-cover bg-center border-2 transition-all hover:scale-110 active:scale-95 ${backgroundImage === url ? 'border-[#7c6af7]' : 'border-transparent hover:border-white/40'}`}
                        style={{ backgroundImage: `url(${url})` }}
                        title={backgroundImage === url ? "Click to clear wallpaper" : "Set as wallpaper"}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Font Editor removed, moved to Settings Modal */}

            <div
              className="bg-black border border-white/10 relative overflow-hidden shadow-2xl shrink-0"
              style={canvasSize ? { width: canvasSize.w, height: canvasSize.h, contain: "layout" } : { ...previewStyle, contain: "layout" }}
            >
              <PresenterView 
                state={presenterState} 
                isPreview={true}
                canvasSize={canvasSize}
                onImageZoomChange={setImageZoom}
                onImagePanChange={setImagePan}
                onTogglePlay={() => {
                  if (setVideoState && videoState) {
                    setVideoState({ ...videoState, playing: !videoState.playing });
                  }
                  }}
              onVideoEnd={() => { if (setVideoState) setVideoState(null); }}
              />
              
              {/* Screen corners (UI decoration for the preview box) */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/20 rounded-tl z-50 pointer-events-none" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/20 rounded-tr z-50 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/20 rounded-bl z-50 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/20 rounded-br z-50 pointer-events-none" />


            </div>

            {/* Text size slider */}
            {setTextScale && (
              <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 bg-transparent px-3 py-1.5">
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

          {/* Video Controls — placeholder */}
          {videoState && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex items-center justify-center gap-2 rounded-lg bg-black/30 border border-white/10 px-3 py-2" title="Video controls are in development">
                <Github size={14} className="text-white/30 animate-pulse" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">Will be developed soon</span>
              </div>
            </div>
          )}

          {/* Prev / next text hints (fixed height so slide changes never shift the preview) */}
          <div className="grid grid-cols-2 gap-3 px-4 pb-3 shrink-0">
            <button
              onClick={() => { if (activeLyricSlide > 0 && !liveOverride) setActiveLyricSlide(activeLyricSlide - 1); }}
              disabled={activeLyricSlide <= 0 || !!liveOverride}
              className="rounded bg-white/3 border border-white/8 p-2 h-[64px] overflow-hidden text-left transition-colors hover:bg-white/6 hover:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Previous</p>
              <p className="text-[10px] text-white/35 whitespace-pre-line leading-tight line-clamp-3">{prev ?? "—"}</p>
            </button>
            <button
              onClick={() => { if (next !== null && !liveOverride) setActiveLyricSlide(activeLyricSlide + 1); }}
              disabled={next === null || !!liveOverride}
              className="rounded bg-white/3 border border-white/8 p-2 h-[64px] overflow-hidden text-left transition-colors hover:bg-white/6 hover:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Next</p>
              <p className="text-[10px] text-white/35 whitespace-pre-line leading-tight line-clamp-3">{next ?? "—"}</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
