import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { TopBar } from "./components/TopBar";
import { LyricsPanel, DEFAULT_SLIDE } from "./components/LyricsPanel";
import { VideoPlayer } from "./components/VideoPlayer";
import { ServicePanel } from "./components/ServicePanel";
import { MediaPanel } from "./components/MediaPanel";
import { SongBank } from "./components/SongBank";
import { StageView } from "./components/StageView";
import { ResizeHandle } from "./components/ResizeHandle";
import { SettingsModal } from "./components/SettingsModal";
import { useSettings } from "./contexts/SettingsContext";

export interface VideoState {
  type: "youtube" | "local";
  url: string;
  playing: boolean;
  volume: number;
  playbackRate: number;
  seekToTimestamp?: number;
  isBackground: boolean;
  audioDestination: "laptop" | "tv";
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
  notes?: string[]; // Optional per-slide speaker notes
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
    // @ts-ignore
    if (!window.electron) return [];
    // @ts-ignore
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

  // Stage view: in-app "Stage" tab + optional fullscreen stage output display
  const [view, setView] = useState<'main' | 'stage'>('main');
  const [stageDisplayId, setStageDisplayId] = useState<number | null>(null);

  // Shutdown state
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [shutdownProgress, setShutdownProgress] = useState(0);

  // New Background States
  // @ts-ignore
  const [activeCameraId, setActiveCameraId] = useState<string | null>(() => window.electron ? window.electron.storeGet("oflow_activeCameraId") : null);
  // @ts-ignore
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => window.electron ? window.electron.storeGet("oflow_backgroundImage") : null);
  const [textScale, setTextScale] = useState(1);
  const [savedImages, setSavedImages] = useState<string[]>(() => {
    // @ts-ignore
    if (!window.electron) return [];
    try {
      // @ts-ignore
      const saved = window.electron.storeGet("oflow_savedImages");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [savedBackgrounds, setSavedBackgrounds] = useState<string[]>(() => {
    // @ts-ignore
    if (!window.electron) return [];
    try {
      // @ts-ignore
      const saved = window.electron.storeGet("oflow_savedBackgrounds");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // New Overlay and Presentation States
  const [clockSettings, setClockSettings] = useState<ClockSettings>(() => {
    // @ts-ignore
    if (!window.electron) return { show: false, format: "12h" };
    // @ts-ignore
    const saved = window.electron.storeGet("oflow_clockSettings");
    return saved ? JSON.parse(saved) : { show: false, format: "12h" };
  });

  const [videoState, setVideoState] = useState<VideoState | null>(null);

  const [songBankWidth, setSongBankWidth] = useState(260);
  const [servicePanelWidth, setServicePanelWidth] = useState(300);
  const [mediaPanelHeight, setMediaPanelHeight] = useState(200);

  // Persist State
  useEffect(() => {
    // @ts-ignore
    if (!window.electron) return;
    
    // @ts-ignore
    window.electron.storeSet("oflow_serviceItems", JSON.stringify(serviceItems));
    // @ts-ignore
    if (activeCameraId) window.electron.storeSet("oflow_activeCameraId", activeCameraId);
    // @ts-ignore
    else window.electron.storeSet("oflow_activeCameraId", "");
    
    // @ts-ignore
    if (backgroundImage) window.electron.storeSet("oflow_backgroundImage", backgroundImage);
    // @ts-ignore
    else window.electron.storeSet("oflow_backgroundImage", "");
    
    // @ts-ignore
    window.electron.storeSet("oflow_clockSettings", JSON.stringify(clockSettings));
    // @ts-ignore
    window.electron.storeSet("oflow_savedImages", JSON.stringify(savedImages));
    // @ts-ignore
    window.electron.storeSet("oflow_savedBackgrounds", JSON.stringify(savedBackgrounds));
  }, [serviceItems, activeCameraId, backgroundImage, clockSettings, savedImages, savedBackgrounds]);

  // Handle Shutdown
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.onAppClosing) {
      // @ts-ignore
      window.electron.onAppClosing(() => {
        setIsShuttingDown(true);
        let current = 0;
        const interval = setInterval(() => {
          current += 4; // ~750ms total
          if (current >= 100) {
            clearInterval(interval);
            setShutdownProgress(100);
            setTimeout(() => {
              // @ts-ignore
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
    // @ts-ignore
    if (window.electron && window.electron.getDisplays) {
      // @ts-ignore
      window.electron.getDisplays().then((initialDisplays: DisplayInfo[]) => {
        setDisplays(initialDisplays);
        if (initialDisplays.length > 0) {
          setSelectedDisplays([initialDisplays[0].id]);
        }
      });
      
      // @ts-ignore
      window.electron.onDisplaysChanged((updatedDisplays: DisplayInfo[]) => {
        setDisplays(updatedDisplays);
        setSelectedDisplays(prev => prev.filter(id => updatedDisplays.some(d => d.id === id)));
      });
    }
  }, []);

  // Whenever selected displays change, tell Electron to spawn/destroy windows
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.setPresenterDisplays) {
      // @ts-ignore
      window.electron.setPresenterDisplays(selectedDisplays);
    }
  }, [selectedDisplays]);

  // Whenever the stage output display changes, tell Electron to spawn/destroy the stage window
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.setStageDisplay) {
      // @ts-ignore
      window.electron.setStageDisplay(stageDisplayId);
    }
  }, [stageDisplayId]);

  // Notify the main process when NDI output is toggled on/off
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.setNDIEnabled) {
      // @ts-ignore
      window.electron.setNDIEnabled(settings.app.enableNDI);
    }
  }, [settings.app.enableNDI]);

  // Broadcast state to Electron for the secondary presenter display
  // Added selectedDisplays to dependency array so when a window is created, it gets the state immediately
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.sendStateUpdate) {
      const activeItem = serviceItems[activeServiceItem];
      const slides = activeItem ? activeItem.slides : DEFAULT_SLIDE.slides;
      const text = liveOverride ? liveOverride.text : (slides[activeLyricSlide] ?? "");
      const reference = liveOverride?.type === "bible" ? liveOverride.reference : undefined;
      const liveImage = liveOverride?.type === "image" ? liveOverride.url : null;
      const stageNext = !liveOverride && activeLyricSlide < slides.length - 1 ? slides[activeLyricSlide + 1] : null;
      const stageNotes = (activeItem?.notes && activeItem.notes[activeLyricSlide]) || null;
      
      // @ts-ignore
      window.electron.sendStateUpdate({
        text,
        reference,
        liveImage,
        isBlank,
        isTheme,
        isLive,
        activeCameraId,
        backgroundImage,
        textScale,
        appSettings: settings,
        clockSettings,
        videoState,
        timerState,
        stageMode: stageDisplayId !== null,
        stageNext,
        stageNotes,
        stageTitle: activeItem?.title ?? "",
        stageDetail: activeItem?.detail ?? "",
        activeStageIndex: activeServiceItem,
        activeLyricSlide,
        totalSlides: Math.max(slides.length, 1),
        serviceOrder: serviceItems.map(it => ({ id: it.id, title: it.title, detail: it.detail }))
      });
    }
  }, [serviceItems, activeServiceItem, activeLyricSlide, isBlank, isTheme, isLive, liveOverride, activeCameraId, backgroundImage, textScale, selectedDisplays, settings, clockSettings, videoState, timerState, stageDisplayId]);

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

  // Phone/tablet remote commands
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.onRemoteCommand) {
      // @ts-ignore
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key;

      if (key === "ArrowUp" || key === "ArrowLeft" || key === "PageUp") {
        e.preventDefault();
        goPrevSlide();
      } else if (key === "ArrowDown" || key === "ArrowRight" || key === " " || key === "Spacebar" || key === "PageDown") {
        e.preventDefault();
        goNextSlide();
      } else if (key === "b" || key === "B") {
        e.preventDefault();
        setIsBlank(v => !v);
      } else if (key === "g" || key === "G") {
        e.preventDefault();
        setIsLive(v => !v);
      } else if (key === "t" || key === "T") {
        e.preventDefault();
        toggleTimer();
      } else if (key === "n" || key === "N") {
        e.preventDefault();
        goNextItem();
      } else if (key === "p" || key === "P") {
        e.preventDefault();
        goPrevItem();
      } else if (key === "Escape") {
        // Panic: blank output, clear override, stop video, exit live
        e.preventDefault();
        panic();
      } else if (key === "Delete" || key === "Backspace") {
        if (serviceItems.length > 0) {
          e.preventDefault();
          setServiceItems(prev => {
            const newItems = [...prev];
            newItems.splice(activeServiceItem, 1);
            return newItems;
          });
          setActiveServiceItem(prev => Math.max(0, prev >= serviceItems.length - 1 ? prev - 1 : prev));
          setActiveLyricSlide(0);
          setLiveOverride(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [serviceItems, activeServiceItem, goPrevSlide, goNextSlide, goNextItem, goPrevItem, toggleTimer, panic]);

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
  }, []);

  const handleSetActiveCameraId = useCallback((id: string | null) => {
    setActiveCameraId(id);
    if (id) setBackgroundImage(null);
  }, []);

  const handleVideoEnd = useCallback(() => {
    setVideoState(null);
  }, []);

  const themeBg = settings.app.theme === 'oled' ? '#000000' : settings.app.theme === 'light' ? '#f3f4f6' : '#1e1e2e';
  const themeColor = settings.app.theme === 'light' ? '#111827' : '#e2e2f0';

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
        view={view}
        setView={setView}
        onPanic={panic}
      />

      {view === 'stage' ? (
        <StageView
          serviceItems={serviceItems}
          activeServiceItem={activeServiceItem}
          setActiveServiceItem={handleSetActiveServiceItem}
          activeLyricSlide={activeLyricSlide}
          setActiveLyricSlide={setActiveLyricSlide}
          liveOverride={liveOverride}
          clockSettings={clockSettings}
          timerState={timerState}
          displays={displays}
          stageDisplayId={stageDisplayId}
          setStageDisplayId={setStageDisplayId}
        />
      ) : (
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
          timerState={timerState}
          onUpdateActiveItem={(patch) => setServiceItems(prev => prev.map((it, i) => i === activeServiceItem ? { ...it, ...patch } : it))}
        />
        
        {videoState && videoState.audioDestination === "laptop" && (
          <div className="absolute top-0 right-0 w-80 h-48 opacity-0 pointer-events-none">
            <VideoPlayer 
              {...videoState}
              onEnd={handleVideoEnd} 
            />
          </div>
        )}
        
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
      />
      </>
      )}

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
