import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, Monitor, EyeOff, Palette, Settings, Wifi, WifiOff, Timer, ChevronRight, ChevronLeft, XCircle, Image as ImageIcon, BookOpen, Music } from "lucide-react";
import { TopBar } from "./components/TopBar";
import type { CommandDef } from "./components/CommandBar";
import { parseBibleRef } from "./components/bibleRef";
import { getVerseText, setActiveTranslation } from "./components/BibleData";
import { smartFuzzyMatch } from "./utils/search";
import { LyricsPanel, DEFAULT_SLIDE } from "./components/LyricsPanel";
import { ServicePanel } from "./components/ServicePanel";
import { MediaPanel } from "./components/MediaPanel";
import { SongBank } from "./components/SongBank";
import { ResizeHandle } from "./components/ResizeHandle";
import { SettingsModal } from "./components/SettingsModal";
import { useSettings } from "./contexts/SettingsContext";

export interface VideoState {
  type: "local";
  url: string;
  playing: boolean;
  volume: number;
  playbackRate: number;
  seekToTimestamp?: number;
  isBackground: boolean;
  audioOutput: string;
}

export interface LiveContent {
  type: "song" | "bible" | "image";
  text: string;
  reference?: string; // e.g. "John 3:16"
  url?: string;
}

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ServiceItem {
  id: string; // Unique string ID
  type: "song" | "reading" | "image" | "video" | "custom";
  title: string;
  detail: string;
  slides: string[];
  lastModified?: number;
  size?: number;
}

export interface ClockSettings {
  show: boolean;
  format: "12h" | "24h";
}

export interface TimerState {
  endTime: number | null;
  totalDuration: number;
  background: string;
  circleColor: string;
  alarmSound: string | null;
  playAlarm: boolean;
  isFinished: boolean;
}


export default function App() {
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>(() => {
    if (!window.electron) return [];
    const saved = window.electron.storeGet("oflow_serviceItems");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeServiceItem, setActiveServiceItem] = useState(0);
  const [activeLyricSlide, setActiveLyricSlide] = useState(0);
  
  const { settings } = useSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [isLive, setIsLive] = useState(false);
  const [isBlank, setIsBlank] = useState(false);
  const [isTheme, setIsTheme] = useState(false);
  const [liveOverride, setLiveOverride] = useState<LiveContent | null>(null);
  const [scriptureBadge, setScriptureBadge] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  
  const [timerState, setTimerState] = useState<TimerState>({
    endTime: null,
    totalDuration: 0,
    background: "black",
    circleColor: "#7c6af7",
    alarmSound: null,
    playAlarm: false,
    isFinished: false
  });
  
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplays, setSelectedDisplays] = useState<number[]>([]);

  // Shutdown state
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [shutdownProgress, setShutdownProgress] = useState(0);

  // New Background States
  const [activeCameraId, setActiveCameraId] = useState<string | null>(() => window.electron ? window.electron.storeGet("oflow_activeCameraId") : null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => window.electron ? window.electron.storeGet("oflow_backgroundImage") : null);
  const [textScale, setTextScale] = useState(1);
  const [savedImages, setSavedImages] = useState<string[]>(() => {
    if (!window.electron) return [];
    try {
      const saved = window.electron.storeGet("oflow_savedImages");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [savedBackgrounds, setSavedBackgrounds] = useState<string[]>(() => {
    if (!window.electron) return [];
    try {
      const saved = window.electron.storeGet("oflow_savedBackgrounds");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [savedVideos, setSavedVideos] = useState<string[]>(() => {
    if (!window.electron) return [];
    try {
      const saved = window.electron.storeGet("oflow_savedVideos");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // New Overlay and Presentation States
  const [clockSettings, setClockSettings] = useState<ClockSettings>(() => {
    if (!window.electron) return { show: false, format: "12h" };
    const saved = window.electron.storeGet("oflow_clockSettings");
    return saved ? JSON.parse(saved) : { show: false, format: "12h" };
  });

  const [videoState, setVideoState] = useState<VideoState | null>(() => {
    if (!window.electron) return null;
    const saved = window.electron.storeGet("oflow_videoState");
    return saved ? JSON.parse(saved) : null;
  });

  const [audioOutputs, setAudioOutputs] = useState<{ id: string; label: string }[]>([]);

  // Enumerate available audio output devices.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        // Chromium hides output device labels until media permission is granted.
        let allLabeled = devices.every(d => d.kind !== "audiooutput" || d.label);
        if (!allLabeled && navigator.mediaDevices.getUserMedia) {
          let stream: MediaStream | null = null;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch { /* permission denied — fall back to unnamed outputs */ }
          if (stream) stream.getTracks().forEach(t => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
        }
        if (cancelled) return;
        const outputs = devices
          .filter(d => d.kind === "audiooutput")
          .map((d, i) => ({ id: d.deviceId, label: d.label || `Output ${i + 1}` }));
        setAudioOutputs(outputs);
      } catch { /* ignore */ }
    };
    refresh();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refresh);
    }
    return () => { cancelled = true; };
  }, []);

  const [songBankWidth, setSongBankWidth] = useState(260);
  const [servicePanelWidth, setServicePanelWidth] = useState(300);
  const [mediaPanelHeight, setMediaPanelHeight] = useState(240);

  // Persist State
  useEffect(() => {
    if (!window.electron) return;
    
    window.electron.storeSet("oflow_serviceItems", JSON.stringify(serviceItems));
    if (activeCameraId) window.electron.storeSet("oflow_activeCameraId", activeCameraId);
    else window.electron.storeSet("oflow_activeCameraId", "");
    
    if (backgroundImage) window.electron.storeSet("oflow_backgroundImage", backgroundImage);
    else window.electron.storeSet("oflow_backgroundImage", "");
    
    window.electron.storeSet("oflow_clockSettings", JSON.stringify(clockSettings));
    window.electron.storeSet("oflow_savedImages", JSON.stringify(savedImages));
    window.electron.storeSet("oflow_savedBackgrounds", JSON.stringify(savedBackgrounds));
    window.electron.storeSet("oflow_savedVideos", JSON.stringify(savedVideos));
  }, [serviceItems, activeCameraId, backgroundImage, clockSettings, savedImages, savedBackgrounds, savedVideos, videoState]);

  // Persist videoState separately (avoids thundering-store writes on player ticks)
  useEffect(() => {
    if (!window.electron) return;
    window.electron.storeSet("oflow_videoState", videoState ? JSON.stringify(videoState) : "");
  }, [videoState]);

  // Handle Shutdown
  useEffect(() => {
    if (window.electron && window.electron.onAppClosing) {
      window.electron.onAppClosing(() => {
        setIsShuttingDown(true);
        let current = 0;
        const interval = setInterval(() => {
          current += 4; // ~750ms total
          if (current >= 100) {
            clearInterval(interval);
            setShutdownProgress(100);
            setTimeout(() => {
              window.electron.confirmQuit();
            }, 300);
          } else {
            setShutdownProgress(current);
          }
        }, 30);
      });
    }
  }, []);

  // Initialize and listen to displays
  useEffect(() => {
    if (window.electron && window.electron.getDisplays) {
      window.electron.getDisplays().then((initialDisplays: DisplayInfo[]) => {
        setDisplays(initialDisplays);
        if (initialDisplays.length > 0) {
          setSelectedDisplays([initialDisplays[0].id]);
        }
      });
      
      window.electron.onDisplaysChanged((updatedDisplays: DisplayInfo[]) => {
        setDisplays(updatedDisplays);
        setSelectedDisplays(prev => prev.filter(id => updatedDisplays.some(d => d.id === id)));
      });
    }
  }, []);

  // Whenever selected displays change, tell Electron to spawn/destroy windows
  useEffect(() => {
    if (window.electron && window.electron.setPresenterDisplays) {
      window.electron.setPresenterDisplays(selectedDisplays);
    }
  }, [selectedDisplays]);

  // Notify the main process when NDI output is toggled on/off
  useEffect(() => {
    if (window.electron && window.electron.setNDIEnabled) {
      window.electron.setNDIEnabled(settings.app.enableNDI);
    }
  }, [settings.app.enableNDI]);

  // Broadcast state to Electron for the secondary presenter display
  // Added selectedDisplays to dependency array so when a window is created, it gets the state immediately
  useEffect(() => {
    if (window.electron && window.electron.sendStateUpdate) {
      const activeItem = serviceItems[activeServiceItem];
      const slides = activeItem ? activeItem.slides : DEFAULT_SLIDE.slides;
      const text = liveOverride ? liveOverride.text : (slides[activeLyricSlide] ?? "");
      const reference = liveOverride?.type === "bible" ? liveOverride.reference : undefined;
      const liveImage = liveOverride?.type === "image" ? liveOverride.url : null;
      const stageNext = !liveOverride && activeLyricSlide < slides.length - 1 ? slides[activeLyricSlide + 1] : null;
      
      window.electron.sendStateUpdate({
        text,
        reference,
        liveImage,
        imageZoom,
        imagePan,
        isBlank,
        isTheme,
        isLive,
        scriptureBadge,
        activeCameraId,
        backgroundImage,
        textScale,
        appSettings: settings,
        clockSettings,
        videoState,
        timerState,
        activeServiceIndex: activeServiceItem,
        activeLyricSlide,
        totalSlides: Math.max(slides.length, 1),
        serviceOrder: serviceItems.map(it => ({ id: it.id, title: it.title, detail: it.detail }))
      });
    }
  }, [serviceItems, activeServiceItem, activeLyricSlide, isBlank, isTheme, isLive, liveOverride, activeCameraId, backgroundImage, textScale, selectedDisplays, settings, clockSettings, videoState, timerState, scriptureBadge, imageZoom, imagePan]);

  // Shared action callbacks (keyboard shortcuts + phone/tablet remote)
  const goPrevSlide = useCallback(() => {
    setActiveLyricSlide(prev => Math.max(0, prev - 1));
  }, []);

  const goNextSlide = useCallback(() => {
    setActiveLyricSlide(prev => {
      const activeItem = serviceItems[activeServiceItem];
      const maxSlide = activeItem ? activeItem.slides.length - 1 : 0;
      return Math.min(maxSlide, prev + 1);
    });
  }, [serviceItems, activeServiceItem]);

  const goPrevItem = useCallback(() => {
    setActiveServiceItem(prev => Math.max(0, prev - 1));
    setActiveLyricSlide(0);
    setLiveOverride(null);
  }, []);

  const goNextItem = useCallback(() => {
    setActiveServiceItem(prev => Math.min(serviceItems.length - 1, prev + 1));
    setActiveLyricSlide(0);
    setLiveOverride(null);
  }, [serviceItems.length]);

  const toggleTimer = useCallback(() => {
    setTimerState(prev => prev.endTime !== null
      ? { ...prev, endTime: null, isFinished: false }
      : { ...prev, totalDuration: prev.totalDuration || 5 * 60000, endTime: Date.now() + (prev.totalDuration || 5 * 60000), isFinished: false });
  }, []);

  const panic = useCallback(() => {
    setIsBlank(true);
    setLiveOverride(null);
    setVideoState(null);
    setIsLive(false);
  }, []);

  const disconnectOutputs = useCallback(() => {
    setSelectedDisplays([]);
    setIsLive(false);
  }, []);

  // Phone/tablet remote commands
  useEffect(() => {
    if (window.electron && window.electron.onRemoteCommand) {
      window.electron.onRemoteCommand((cmd: any) => {
        if (!cmd || typeof cmd.type !== "string") return;
        switch (cmd.type) {
          case "next": goNextSlide(); break;
          case "prev": goPrevSlide(); break;
          case "blank": setIsBlank(v => !v); break;
          case "live": setIsLive(v => !v); break;
          case "timer": toggleTimer(); break;
          case "panic": panic(); break;
          case "item":
            if (typeof cmd.index === "number" && cmd.index >= 0 && cmd.index < serviceItems.length) {
              setActiveServiceItem(cmd.index);
              setActiveLyricSlide(0);
              setLiveOverride(null);
            }
            break;
        }
      });
    }
  }, [goNextSlide, goPrevSlide, toggleTimer, panic, serviceItems.length]);

  // Blur buttons after mouse clicks so Space/Enter afterwards advance slides
  // instead of re-triggering the focused button.
  useEffect(() => {
    const onPointerUp = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      const control = t && t.closest('button, a, [role="button"], select');
      if (control) (control as HTMLElement).blur();
    };
    document.addEventListener("pointerup", onPointerUp);
    return () => document.removeEventListener("pointerup", onPointerUp);
  }, []);

  // Keyboard shortcuts removed — all actions are triggered via the TopBar
  // command/search bar instead.

  const handleAddSongToService = useCallback((song: ServiceItem) => {
    // Make a unique copy of the song to append to the service order
    setServiceItems(prev => [...prev, { ...song, id: crypto.randomUUID() }]);
  }, []);

  const handleLyricSlideChange = useCallback((slideIndex: number) => {
    setActiveLyricSlide(slideIndex);
    // Clearing the bible or image override automatically when a lyric is clicked
    setLiveOverride(prev => prev ? null : prev);
  }, []);

  const handleSetActiveServiceItem = useCallback((i: number) => { 
    setActiveServiceItem(i); 
    setActiveLyricSlide(0); 
    setLiveOverride(null); 
  }, []);

  const handleQuickAdd = useCallback(() => {
    handleAddSongToService({
      id: crypto.randomUUID(),
      type: "custom",
      title: "Blank Slide",
      detail: "Placeholder",
      slides: [""]
    });
  }, [handleAddSongToService]);

  const handleImageOverride = useCallback((url: string) => {
    setLiveOverride(url ? { type: "image", text: "", url } : null);
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
  }, []);

  const handleSetActiveCameraId = useCallback((id: string | null) => {
    setActiveCameraId(id);
    if (id) setBackgroundImage(null);
  }, []);

  const themeBg = settings.app.theme === 'oled' ? '#000000' : settings.app.theme === 'light' ? '#f3f4f6' : '#1e1e2e';
  const themeColor = settings.app.theme === 'light' ? '#111827' : '#e2e2f0';

  // Command palette registry — all app actions are reachable via the TopBar
  // search bar so no keyboard shortcuts are needed.
  const commands: CommandDef[] = useMemo(() => {
    const externalDisplays = displays.filter(d =>
      !(d.bounds.x === 0 && d.bounds.y === 0) || displays.length === 1
    );
    const presentCommands: CommandDef[] = displays.map((d, i) => {
      const isSelected = selectedDisplays.includes(d.id);
      const isPrimary = d.bounds.x === 0 && d.bounds.y === 0;
      const label = isPrimary ? `Present on main screen` : `Present on ${d.label || `screen ${i + 1}`}`;
      return {
        id: `present-${d.id}`,
        label,
        keywords: ["tv", "projector", "display", "screen", "go live", "present", `screen ${i + 1}`, isPrimary ? "main" : d.label.toLowerCase()],
        icon: Monitor,
        confirm: () => isSelected ? "This display is already selected. Turn on Live?" : `Turn on Live and present on ${d.label || `screen ${i + 1}`}?`,
        run: () => {
          setSelectedDisplays([d.id]);
          setIsLive(true);
        },
      };
    });

    return [
      ...presentCommands,
      { id: "live-on", label: "Turn Live ON", keywords: ["live", "start", "broadcast", "go live"], icon: Wifi, run: () => setIsLive(true) },
      { id: "live-off", label: "Turn Live OFF", keywords: ["live", "stop", "end broadcast"], icon: WifiOff, run: () => setIsLive(false) },
      { id: "blank-on", label: "Blank screen ON", keywords: ["blank", "black", "hide"], icon: EyeOff, run: () => setIsBlank(true) },
      { id: "blank-off", label: "Blank screen OFF", keywords: ["blank", "show", "unhide"], icon: EyeOff, run: () => setIsBlank(false) },
      { id: "theme", label: "Toggle color theme", keywords: ["theme", "color", "palette", "background"], icon: Palette, run: () => setIsTheme(v => !v) },
      { id: "next-slide", label: "Next slide", keywords: ["next", "slide", "advance", "down", "forward"], icon: ChevronRight, run: goNextSlide },
      { id: "prev-slide", label: "Previous slide", keywords: ["prev", "previous", "slide", "back", "up"], icon: ChevronLeft, run: goPrevSlide },
      { id: "next-item", label: "Next service item", keywords: ["next", "item", "song", "service"], icon: ChevronRight, run: goNextItem },
      { id: "prev-item", label: "Previous service item", keywords: ["prev", "previous", "item", "song", "service"], icon: ChevronLeft, run: goPrevItem },
      { id: "timer", label: "Start / stop timer", keywords: ["timer", "time", "clock", "countdown"], icon: Timer, run: toggleTimer },
      { id: "disconnect", label: "Disconnect all outputs", keywords: ["disconnect", "outputs", "off", "stop", "exit live"], icon: XCircle, run: disconnectOutputs },
      { id: "settings", label: "Open settings", keywords: ["settings", "preferences", "options", "config"], icon: Settings, run: () => setIsSettingsOpen(true) },
    ];
  }, [displays, selectedDisplays, goNextSlide, goPrevSlide, goNextItem, goPrevItem, toggleTimer, disconnectOutputs]);

  // Dynamic text matching for the search bar: resolves Bible references (e.g.
  // "Pro 29:4") into a scripture-badge action, and service titles into a
  // "go to item" action.
  const matchText = useCallback((query: string): CommandDef[] => {
    const out: CommandDef[] = [];

    const ref = parseBibleRef(query);
    if (ref) {
      out.push({
        id: `badge-${ref.label}`,
        label: `Show scripture badge: ${ref.label}`,
        keywords: [ref.book.toLowerCase(), "badge", "scripture", "bible", "verse"],
        icon: BookOpen,
        run: () => {
          setActiveTranslation("nasb2020");
          const text = getVerseText(ref.book, ref.chapter, ref.verse);
          setLiveOverride({ type: "bible", text, reference: ref.label });
          setScriptureBadge(true);
        },
      });
    }

    const lower = query.trim().toLowerCase();

    // "slide 5" -> jump to slide 5 of the active item.
    const slideMatch = lower.match(/^(?:slide|go to slide|line)?\s*#?\s*(\d+)\s*$/);
    const activeItem = serviceItems[activeServiceItem];
    if (activeItem && slideMatch) {
      const slideNum = parseInt(slideMatch[1], 10);
      if (slideNum >= 1 && slideNum <= activeItem.slides.length) {
        out.push({
          id: `slide-${slideNum}`,
          label: `Go to slide ${slideNum}${activeItem.title ? ` — ${activeItem.title}` : ""}`,
          keywords: ["slide", "line", "go to", "jump"],
          icon: ChevronRight,
          run: () => {
            setActiveLyricSlide(slideNum - 1);
            setLiveOverride(null);
          },
        });
      }
    }

    const itemIdx = serviceItems.findIndex(it => it.title.toLowerCase().includes(lower));
    if (itemIdx >= 0 && lower.length > 0) {
      out.push({
        id: `goto-${itemIdx}`,
        label: `Go to item: ${serviceItems[itemIdx].title}`,
        keywords: [serviceItems[itemIdx].title.toLowerCase(), "go to", "item", "song"],
        icon: ChevronRight,
        run: () => {
          handleSetActiveServiceItem(itemIdx);
        },
      });
    }

    // Search the Song Bank (reads the same oflow_songs store SongBank uses).
    if (window.electron && window.electron.storeGet && lower.length > 0) {
      let songs: ServiceItem[] = [];
      try {
        const raw = window.electron.storeGet("oflow_songs");
        songs = raw ? JSON.parse(raw) : [];
      } catch { /* ignore parse error */ }
      const songMatches = songs
        .filter(s => smartFuzzyMatch(lower, s.title) || smartFuzzyMatch(lower, s.detail))
        .slice(0, 5);
      for (const song of songMatches) {
        out.push({
          id: `song-${song.id}`,
          label: `Play song: ${song.title}`,
          keywords: [song.title.toLowerCase(), song.detail.toLowerCase(), "song", "play", "add", "bank"],
          icon: Music,
          run: () => {
            handleAddSongToService(song);
          },
        });
      }
    }

    return out;
  }, [serviceItems, activeServiceItem, handleSetActiveServiceItem, handleAddSongToService]);

  return (
    <div
      className="size-full flex flex-col overflow-hidden transition-colors"
      style={{ background: themeBg, color: themeColor, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <TopBar
        isLive={isLive} setIsLive={setIsLive}
        isBlank={isBlank} setIsBlank={setIsBlank}
        isTheme={isTheme} setIsTheme={setIsTheme}
        setSelectedDisplays={setSelectedDisplays}
        onOpenSettings={() => setIsSettingsOpen(true)}
        commands={commands}
        matchText={matchText}
        />

      <>
      <div className="flex overflow-hidden" style={{ flex: 1 }}>
        <SongBank onAddSongToService={handleAddSongToService} width={songBankWidth} />
        <ResizeHandle
          direction="vertical"
          ariaLabel="Resize song bank"
          onResize={(d) => setSongBankWidth(w => Math.min(420, Math.max(200, w + d)))}
        />
        
        <LyricsPanel
          activeItem={serviceItems[activeServiceItem]}
          activeLyricSlide={activeLyricSlide}
          setActiveLyricSlide={handleLyricSlideChange}
          isBlank={isBlank}
          liveOverride={liveOverride}
          clearOverride={() => setLiveOverride(null)}
          activeCameraId={activeCameraId}
          backgroundImage={backgroundImage}
          setBackgroundImage={setBackgroundImage}
          setActiveCameraId={setActiveCameraId}
          clockSettings={clockSettings}
          displays={displays}
          selectedDisplays={selectedDisplays}
          isLive={isLive}
          isTheme={isTheme}
          savedBackgrounds={savedBackgrounds}
          setSavedBackgrounds={setSavedBackgrounds}
          textScale={textScale}
          setTextScale={setTextScale}
          videoState={videoState}
          setVideoState={setVideoState}
          audioOutputs={audioOutputs}
          timerState={timerState}
          scriptureBadge={scriptureBadge}
          imageZoom={imageZoom}
          setImageZoom={setImageZoom}
          imagePan={imagePan}
          setImagePan={setImagePan}
          onUpdateActiveItem={(patch) => setServiceItems(prev => prev.map((it, i) => i === activeServiceItem ? { ...it, ...patch } : it))}
        />
        
        <ServicePanel
          items={serviceItems}
          setItems={setServiceItems}
          activeServiceItem={activeServiceItem}
          setActiveServiceItem={handleSetActiveServiceItem}
          onQuickAdd={handleQuickAdd}
          width={servicePanelWidth}
        />
        <ResizeHandle
          direction="vertical"
          ariaLabel="Resize service panel"
          onResize={(d) => setServicePanelWidth(w => Math.min(480, Math.max(220, w - d)))}
        />

      </div>

      <ResizeHandle
        direction="horizontal"
        ariaLabel="Resize media panel"
        onResize={(d) => setMediaPanelHeight(h => Math.min(560, Math.max(160, h - d)))}
      />
      <MediaPanel 
        onImageOverride={handleImageOverride}
        onBibleVerse={setLiveOverride}
        height={mediaPanelHeight}
        displays={displays}
        selectedDisplays={selectedDisplays}
        setSelectedDisplays={setSelectedDisplays}
        activeCameraId={activeCameraId}
        setActiveCameraId={handleSetActiveCameraId}
        savedImages={savedImages}
        setSavedImages={setSavedImages}
        savedVideos={savedVideos}
        setSavedVideos={setSavedVideos}
        backgroundImage={backgroundImage}
        setBackgroundImage={setBackgroundImage}
        savedBackgrounds={savedBackgrounds}
        setSavedBackgrounds={setSavedBackgrounds}
        clockSettings={clockSettings}
        setClockSettings={setClockSettings}
        videoState={videoState}
        setVideoState={setVideoState}
        timerState={timerState}
        setTimerState={setTimerState}
        onScriptureBadge={setScriptureBadge}
      />
      </>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Shutdown Modal */}
      {isShuttingDown && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#1a1a24]/90 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-200" style={{ width: 300, height: 200 }}>
            <div className="relative w-16 h-16 mb-6">
              <svg className="w-full h-full text-white/10" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" stroke="currentColor" />
              </svg>
              <svg className="absolute inset-0 w-full h-full text-[#7c6af7] -rotate-90 transition-all duration-100 ease-out" viewBox="0 0 100 100">
                <circle 
                  cx="50" cy="50" r="45" fill="none" strokeWidth="6" stroke="currentColor" 
                  strokeDasharray={283} 
                  strokeDashoffset={283 - (283 * shutdownProgress) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {shutdownProgress >= 100 ? (
                  <Check className="text-[#7c6af7] animate-in zoom-in" size={24} />
                ) : (
                  <span className="text-xs font-semibold text-white/80">{Math.round(shutdownProgress)}%</span>
                )}
              </div>
            </div>
            <p className="text-sm font-medium text-white/80 tracking-wide text-center">
              {shutdownProgress < 40 ? "Saving configurations..." : shutdownProgress < 80 ? "Shutting down processes..." : "Done"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
