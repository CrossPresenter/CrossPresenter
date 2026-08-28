import React, { useState, useEffect } from "react";
import { Layers, Film, Image as ImageIcon, BookOpen, Camera, Clock, Plus, Mic, ArrowLeft } from "lucide-react";
import { CHAPTERS, getVerses, getVerseText, setActiveTranslation, loadBuiltinBibles, TAMIL_BIBLE_BOOKS_MAP } from "./BibleData";
import { BibleBookGrid } from "./BibleBookGrid";
import type { LiveContent, DisplayInfo, ClockSettings, VideoState } from "../App";
import { useSettings } from "../contexts/SettingsContext";
import { MessageRecorder } from "./MessageRecorder";
import { VideoRecorder } from "./VideoRecorder";

const PHONE_CAMERA_ID = "phone-camera";

const OVERLAYS = [
  { id: 1, label: "Lower Third — Speaker", color: "bg-[#7c6af7]/20 border-[#7c6af7]/40 text-[#a89cf7]" },
  { id: 2, label: "Scripture Reference Bar", color: "bg-blue-500/15 border-blue-400/30 text-blue-300" },
  { id: 3, label: "Offering Alert", color: "bg-yellow-500/15 border-yellow-400/30 text-yellow-300" },
];

interface MediaPanelProps {
  onBibleVerse: (v: LiveContent | null) => void;
  onImageOverride: (url: string) => void;
  onScriptureBadge?: (v: boolean) => void;
  height?: number;
  displays?: DisplayInfo[];
  selectedDisplays?: number[];
  setSelectedDisplays?: (ids: number[]) => void;
  activeCameraId?: string | null;
  setActiveCameraId?: (id: string | null) => void;
  clockSettings: ClockSettings;
  setClockSettings: (s: ClockSettings) => void;
  savedImages: string[];
  setSavedImages: React.Dispatch<React.SetStateAction<string[]>>;
  savedVideos?: string[];
  setSavedVideos?: React.Dispatch<React.SetStateAction<string[]>>;
  backgroundImage?: string | null;
  setBackgroundImage?: (img: string | null) => void;
  videoState?: VideoState | null;
  setVideoState?: (state: VideoState | null) => void;
  timerState?: any;
  setTimerState?: any;
  savedBackgrounds?: string[];
  setSavedBackgrounds?: React.Dispatch<React.SetStateAction<string[]>>;
}

export const MediaPanel = React.memo(function MediaPanel({ 
  onBibleVerse, 
  onImageOverride,
  onScriptureBadge,
  height,
  displays = [], 
  selectedDisplays = [], 
  setSelectedDisplays,
  activeCameraId,
  setActiveCameraId,
  clockSettings,
  setClockSettings,
  savedImages,
  setSavedImages,
  savedVideos = [],
  setSavedVideos,
  videoState,
  setVideoState,
  timerState,
  setTimerState
}: MediaPanelProps) {
  const [bibleMode, setBibleMode] = useState<"verse" | "reference" | "badge" | null>(null);
  const [activeTab, setActiveTab] = useState<"videos" | "overlays" | "images" | "bible" | "record" | "timer">("videos");
  const [recordMode, setRecordMode] = useState<"video" | "audio">("video");
  const [customTimerMin, setCustomTimerMin] = useState<string>("");

  
  const { settings, updateSection } = useSettings();
  
  // Bible States
  const translations = ["nasb2020", "nasb", "tamil_bible"]; // Updated to match loaded keys
  const [biblesLoaded, setBiblesLoaded] = useState(false);
  const [selectedTranslations, setSelectedTranslations] = useState<string[]>([settings.bible.defaultTranslation]);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);
  const [bibleStep, setBibleStep] = useState<"book" | "chapter" | "verse">("book");
  const [bibleBook, setBibleBook] = useState<string | null>(null);
  const [bibleChapter, setBibleChapter] = useState<number | null>(null);
  const [bibleVerse, setBibleVerse] = useState<number | null>(null);
  
  // Camera States
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [previewCameraId, setPreviewCameraId] = useState<string | null>(null);

  // Phone Camera (virtual camera over WiFi) States
  const [phoneCamConnected, setPhoneCamConnected] = useState(false);

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

  useEffect(() => {
    async function loadCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoInputs);
      } catch (err) {
        console.error("Failed to enumerate cameras:", err);
      }
    }
    loadCameras();
    navigator.mediaDevices.addEventListener('devicechange', loadCameras);
    
    // Load Built-in Bibles
    loadBuiltinBibles().then(() => setBiblesLoaded(true));
    
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadCameras);
  }, []);

  // Effect to update local state if default translation setting changes
  useEffect(() => {
    setSelectedTranslations([settings.bible.defaultTranslation]);
  }, [settings.bible.defaultTranslation]);

  useEffect(() => {
    if (selectedTranslations.length > 0) setActiveTranslation(selectedTranslations[0]);
  }, [selectedTranslations]);

  // Reset the guided picker to the Book step whenever the Bible tab is opened.
  useEffect(() => {
    if (activeTab === "bible") {
      setBibleStep("book");
      setBibleBook(null);
      setBibleChapter(null);
      setBibleVerse(null);
    }
  }, [activeTab]);

  const pushBible = (mode: "verse" | "reference" | "badge", verse: number) => {
    const { text, refLabel } = buildLiveVerse(verse, selectedTranslations);
    if (mode === "verse") {
      onScriptureBadge?.(false);
      onBibleVerse({ type: "bible", text, reference: refLabel });
    } else if (mode === "reference") {
      onScriptureBadge?.(false);
      onBibleVerse({ type: "bible", text: "", reference: refLabel });
    } else {
      onScriptureBadge?.(true);
      onBibleVerse({ type: "bible", text: "", reference: refLabel });
    }
  };

  const applyBibleMode = (mode: "verse" | "reference" | "badge") => {
    if (bibleVerse === null) return;
    if (bibleMode === mode) {
      setBibleMode(null);
      onScriptureBadge?.(false);
      onBibleVerse(null);
      return;
    }
    setBibleMode(mode);
    pushBible(mode, bibleVerse);
  };

  const toggleDisplay = (id: number) => {
    if (!setSelectedDisplays) return;
    if (selectedDisplays.includes(id)) {
      setSelectedDisplays(selectedDisplays.filter(x => x !== id));
    } else {
      setSelectedDisplays([...selectedDisplays, id]);
    }
  };

  const selectAllDisplays = () => {
    if (!setSelectedDisplays) return;
    setSelectedDisplays(displays.map(d => d.id));
  };

  const toggleCamera = (id: string) => {
    if (previewCameraId === id) setPreviewCameraId(null);
    else setPreviewCameraId(id);
  }

  const applyCamera = () => {
    if (!setActiveCameraId || !previewCameraId) return;
    setActiveCameraId(previewCameraId);
  }

  const clearCamera = () => {
    if (!setActiveCameraId) return;
    setActiveCameraId(null);
    setPreviewCameraId(null);
  }

  const buildLiveVerse = (v: number, translationsToUse: string[]) => {
    if (!bibleBook || bibleChapter === null) return { text: "", refLabel: "" };
    let text = "";
    const tamilRefs: string[] = [];
    const englishRefs: string[] = [];
    translationsToUse.forEach((t, idx) => {
      setActiveTranslation(t);
      const tText = getVerseText(bibleBook, bibleChapter, v);
      text += idx === 0 ? tText : `\n\n${tText}`;
      if (t === 'tamil_bible') {
        tamilRefs.push(TAMIL_BIBLE_BOOKS_MAP[bibleBook] || bibleBook);
      } else {
        englishRefs.push(`${bibleBook} ${bibleChapter}:${v}`);
      }
    });
    if (translationsToUse.length > 0) setActiveTranslation(translationsToUse[0]);

    let refLabel = "";
    if (tamilRefs.length > 0 && englishRefs.length > 0) {
      refLabel = `${tamilRefs.join(' · ')} · ${englishRefs.join(' · ')}`;
    } else if (tamilRefs.length > 0) {
      refLabel = `${tamilRefs.join(' · ')} ${bibleChapter}:${v}`;
    } else {
      refLabel = englishRefs.join(' · ');
    }
    return { text, refLabel };
  };

  const selectBook = (b: string) => {
    setBibleBook(b);
    setBibleChapter(null);
    setBibleVerse(null);
    setBibleStep("chapter");
  };

  const selectChapter = (c: number) => {
    setBibleChapter(c);
    setBibleVerse(null);
    setBibleStep("verse");
  };

  const goBack = () => {
    setBibleStep("book");
    setBibleChapter(null);
    setBibleVerse(null);
  };

  const handleBibleSelection = (v: number) => {
    setBibleVerse(v);
    if (bibleMode) pushBible(bibleMode, v);
  }

  const toggleTranslation = (t: string) => {
    if (selectedTranslations.includes(t)) {
      if (selectedTranslations.length > 1) {
        setSelectedTranslations(selectedTranslations.filter(x => x !== t));
      }
      return;
    }
    if (selectedTranslations.length >= 2) {
      setVersionMsg("Not more than two versions");
      window.setTimeout(() => setVersionMsg(null), 2500);
      return;
    }
    setSelectedTranslations([...selectedTranslations, t]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (typeof ev.target?.result === 'string') {
            setSavedImages(prev => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // reset input
    e.target.value = '';
  };

  const deleteImage = (url: string) => {
    setSavedImages(prev => prev.filter(u => u !== url));
  };

  const handleImageClick = (url: string) => {
    onImageOverride(url);
    if (setActiveCameraId) setActiveCameraId(null);
    if (setVideoState) setVideoState(null); // Clear video if image goes full screen
  };

const presentVideo = (url: string) => {
    onImageOverride("");
    if (setActiveCameraId) setActiveCameraId(null);
    if (setVideoState) {
      setVideoState({
        type: "local",
        url,
        playing: true,
        volume: 80,
        playbackRate: 1,
        isBackground: false,
        audioOutput: ""
      });
    }
  };

  const handleLocalVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const filePath = window.electron ? window.electron.getPathForFile(file) : file.name;
      const url = `file:///${filePath.replace(/\\/g, '/')}`;
      if (!savedVideos.some(v => v === url)) setSavedVideos(prev => [...prev, url]);
      presentVideo(url);
    }
    // reset input
    e.target.value = '';
  };

  const deleteVideo = (url: string) => {
    setSavedVideos(prev => prev.filter(v => v !== url));
    if (setVideoState && videoState && videoState.url === url) setVideoState(null);
  };

  return (
    <div className="flex border-t border-white/10 bg-[#13131f]" style={{ height: height ?? 200, minHeight: 180, transition: "height 0.2s" }}>
      {/* Media library tabs */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {([
            { key: "videos", label: "Videos", Icon: Film },
            { key: "overlays", label: "Overlays", Icon: Layers },
            { key: "images", label: "Images", Icon: ImageIcon },
            { key: "bible", label: "Bible", Icon: BookOpen },
            { key: "record", label: "Record", Icon: Mic },
            { key: "timer", label: "Timer", Icon: Clock },
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
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mt-2 mb-2 px-4 shrink-0">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold"></p>
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-[#7c6af7] hover:bg-[#6a58e0] text-white text-[11px] font-medium rounded transition-colors shadow">
                  <Plus size={12} /> Add Movies
                  <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleLocalVideoUpload} />
                </label>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 pb-3 px-4 custom-scrollbar">
                {savedVideos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 gap-2 border-2 border-dashed border-white/10 rounded-lg">
                    <Film size={24} />
                    <p className="text-xs">No movies added yet.</p>
                    <p className="text-[10px] max-w-[200px] text-center opacity-70">Coming Soon and is under Development</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {savedVideos.map((url) => (
                      <div key={url} className="group relative aspect-video rounded overflow-hidden border border-white/10 hover:border-[#7c6af7] transition-all bg-black">
                        <video
                          src={url}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => presentVideo(url)}
                          title="Click to play full screen"
                        />
                        {/* Delete Button */}
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteVideo(url); }}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove Movie"
                        >
                          <span className="text-[10px]">✕</span>
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-[8px] text-white/70 text-center">Click to play</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "overlays" && (
            <div className="flex flex-col gap-1.5">
              {/* Special Clock Overlay */}
              <div className="flex items-center justify-between px-3 py-2 rounded border transition-all bg-white/3 border-white/8 text-white/40 hover:text-white/65 hover:border-white/15">
                <span className="flex items-center gap-2">
                  <Clock size={11} />
                  Clock Overlay
                </span>
                <div className="flex items-center gap-2">
                  <select 
                    value={clockSettings.format}
                    onChange={e => setClockSettings({ ...clockSettings, format: e.target.value as "12h" | "24h" })}
                    className="bg-black/50 border border-white/20 text-xs text-white px-1 py-0.5 rounded outline-none"
                  >
                    <option value="12h">12-Hour</option>
                    <option value="24h">24-Hour</option>
                  </select>
                  <button
                    onClick={() => setClockSettings({ ...clockSettings, show: !clockSettings.show })}
                    className={`text-[9px] px-2 py-0.5 rounded font-medium ${clockSettings.show ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-white/5 border border-transparent"}`}
                  >
                    {clockSettings.show ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              {OVERLAYS.map(ov => (
                <div
                  key={ov.id}
                  className={`flex items-center justify-between px-3 py-2 rounded border text-xs ${ov.color} opacity-70`}
                  title="Coming soon"
                >
                  <span className="flex items-center gap-2">
                    <Layers size={11} />
                    {ov.label}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20 uppercase tracking-wider">Soon</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "images" && (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Image Gallery</p>
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-[#7c6af7] hover:bg-[#6a58e0] text-white text-[11px] font-medium rounded transition-colors shadow">
                  <Plus size={12} /> Add Images
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {(!savedImages || savedImages.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 gap-2 border-2 border-dashed border-white/10 rounded-lg">
                    <ImageIcon size={24} />
                    <p className="text-xs">No images added yet.</p>
                    <p className="text-[10px] max-w-[200px] text-center opacity-70">Click 'Add Images' above to build your background library.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {(savedImages || []).map((url, i) => (
                      <div key={i} className="group relative aspect-video rounded overflow-hidden border border-white/10 hover:border-[#7c6af7] transition-all bg-black">
                        <img 
                          src={url} 
                          alt="media" 
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => handleImageClick(url)}
                          title="Click to present full screen"
                        />
                        {/* Delete Button */}
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteImage(url); }}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove Image"
                        >
                          <span className="text-[10px]">✕</span>
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-[8px] text-white/70 text-center">Click to present</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "bible" && (
            <div className="flex flex-col gap-1 h-full">
              {!biblesLoaded && (
                <div className="flex items-center justify-center h-full text-white/50 text-xs">
                  Loading Bibles...
                </div>
              )}
              {biblesLoaded && (
                <>
              {/* Translation chips + Reference Only */}
              <div className="flex items-center gap-1.5 pb-1 border-b border-white/10 shrink-0">
                {translations.map(t => {
                  const active = selectedTranslations.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTranslation(t)}
                      className={`px-2 py-0.5 rounded border text-[9px] transition-colors ${
                        active
                          ? "bg-[#7c6af7]/25 border-[#7c6af7]/60 text-white"
                          : "bg-white/3 border-white/10 text-white/45 hover:text-white/80 hover:border-white/20"
                      }`}
                    >
                      {t === 'nasb2020' ? 'NASB 2020' : t === 'tamil_bible' ? 'Tamil (O.V.)' : 'NASB'}
                    </button>
                  );
                })}
                <div className="flex-1" />
                {versionMsg && (
                  <span className="text-[9px] text-amber-300">{versionMsg}</span>
                )}
                <button
                  onClick={() => applyBibleMode("verse")}
                  disabled={bibleVerse === null}
                  title="Show the verse live"
                  className={`px-2 py-0.5 rounded border text-[9px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 ${
                    bibleMode === "verse"
                      ? "bg-[#7c6af7]/30 border-[#7c6af7]/70 text-white shadow-[0_0_8px_rgba(124,106,247,0.3)]"
                      : "bg-white/5 border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  }`}
                >
                  <BookOpen size={9} /> Verse
                </button>
                <button
                  onClick={() => applyBibleMode("reference")}
                  disabled={bibleVerse === null}
                  className={`px-2 py-0.5 rounded border text-[9px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    bibleMode === "reference"
                      ? "bg-[#7c6af7]/30 border-[#7c6af7]/70 text-white shadow-[0_0_8px_rgba(124,106,247,0.3)]"
                      : "bg-white/5 border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  }`}
                >
                  Reference Only
                </button>
                <button
                  onClick={() => applyBibleMode("badge")}
                  disabled={bibleVerse === null}
                  title="Scripture Lower Third Overlay Badge"
                  className={`px-2 py-0.5 rounded border text-[9px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 ${
                    bibleMode === "badge"
                      ? "bg-[#7c6af7]/30 border-[#7c6af7]/70 text-white shadow-[0_0_8px_rgba(124,106,247,0.3)]"
                      : "bg-white/5 border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  }`}
                >
                  <Layers size={9} /> Scripture Badge
                </button>
              </div>

              {/* Progress bar: Back + current reference */}
              <div className="flex items-center gap-1.5 shrink-0">
                {bibleStep !== "book" && (
                  <button
                    onClick={goBack}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-medium text-white/70 bg-white/5 border-white/15 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <ArrowLeft size={9} /> Back
                  </button>
                )}
                <span className="text-[11px] font-bold text-white/90 tracking-wide">
                  {bibleStep === "book" && "Select Book"}
                  {bibleStep === "chapter" && bibleBook}
                  {bibleStep === "verse" && bibleBook && bibleChapter !== null && `${bibleBook} ${bibleChapter}`}
                </span>
                {bibleStep === "verse" && bibleVerse !== null && (
                  <span className={`text-[8px] px-1 py-0.5 rounded font-mono ${bibleMode ? "bg-[#7c6af7]/20 border border-[#7c6af7]/30 text-[#9d8ff8]" : "bg-white/5 border border-white/10 text-white/35"}`}>
                    Verse {bibleVerse} {bibleMode ? "Live" : "Selected"}
                  </span>
                )}
              </div>

              {/* Step content — no scroll, fills available space */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {bibleStep === "book" && (
                  <BibleBookGrid active={bibleBook} onSelect={selectBook} />
                )}

                {bibleStep === "chapter" && (
                  <div className="grid grid-cols-6 gap-[3px] h-full content-start overflow-y-auto custom-scrollbar">
                    {Array.from({ length: CHAPTERS[bibleBook!] ?? 10 }, (_, i) => i + 1).map(c => (
                      <button
                        key={c}
                        onClick={() => selectChapter(c)}
                        className={`px-1 py-[3px] rounded text-[10px] leading-none text-center transition-colors ${
                          bibleChapter === c
                            ? "bg-[#7c6af7]/30 text-white border border-[#7c6af7]/60"
                            : "bg-white/5 text-white/55 border border-white/10 hover:bg-white/12"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                {bibleStep === "verse" && (
                  <div className="flex flex-col gap-[2px] h-full min-h-0 overflow-y-auto custom-scrollbar">
                    {getVerses(bibleBook!, bibleChapter!).map(v => {
                      setActiveTranslation(selectedTranslations[0]);
                      let text = getVerseText(bibleBook!, bibleChapter!, v);
                      for (let i = 1; i < selectedTranslations.length; i++) {
                        setActiveTranslation(selectedTranslations[i]);
                        text += `\n${getVerseText(bibleBook!, bibleChapter!, v)}`;
                      }
                      setActiveTranslation(selectedTranslations[0]);
                      const isActive = bibleVerse === v;
                      return (
                        <button
                          key={v}
                          onClick={() => handleBibleSelection(v)}
                          className={`flex gap-2 text-left px-2 py-1 rounded border transition-all ${
                            isActive
                              ? "bg-[#7c6af7]/20 border-[#7c6af7]/50 text-white shadow-[0_0_8px_rgba(124,106,247,0.15)]"
                              : "bg-white/3 border-white/8 text-white/55 hover:text-white/85 hover:border-white/18"
                          }`}
                        >
                          <span className={`text-[9px] font-mono flex-shrink-0 mt-0.5 ${isActive ? "text-[#9d8ff8]" : "text-white/25"}`}>{v}</span>
                          <span className="text-[9px] leading-relaxed whitespace-pre-line line-clamp-2">{text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          )}

          {activeTab === "record" && (
            <div className="flex flex-col h-full gap-3 p-3">
              <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 self-start">
                <button
                  onClick={() => setRecordMode("video")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold transition-colors ${
                    recordMode === "video" ? "bg-[#7c6af7]/25 text-white" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  <Camera size={11} /> Video
                </button>
                <button
                  onClick={() => setRecordMode("audio")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold transition-colors ${
                    recordMode === "audio" ? "bg-[#7c6af7]/25 text-white" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  <Mic size={11} /> Audio Message
                </button>
              </div>

              {recordMode === "video" ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <h3 className="text-xs text-white/80 font-medium">Record Live Video</h3>
                    <p className="text-[9px] text-white/40">Records exactly what is being presented (the live output).</p>
                  </div>
                  <VideoRecorder />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs text-white/70 font-medium">Record Message (MP3)</h3>
                  <MessageRecorder />
                </div>
              )}
            </div>
          )}

          {activeTab === "timer" && timerState && setTimerState && (
            <div className="flex flex-col h-full gap-3 p-4">
              <div className="flex gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm text-white/80 font-medium">Countdown Timer</h3>
                  <div className="flex gap-2 mb-2">
                    {[1, 2, 3, 5].map(min => (
                      <button 
                        key={min}
                        onClick={() => setTimerState({ ...timerState, totalDuration: min * 60000, endTime: Date.now() + min * 60000, isFinished: false })}
                        className="bg-[#7c6af7]/20 border border-[#7c6af7]/50 text-white text-[10px] px-3 py-1.5 rounded hover:bg-[#7c6af7]/40"
                      >
                        {min} Min
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={customTimerMin}
                      onChange={(e) => setCustomTimerMin(e.target.value)}
                      placeholder="Custom mins" 
                      className="bg-[#1e1e2e] border border-white/15 text-white/80 text-[10px] rounded px-2 py-1.5 outline-none w-24"
                    />
                    <button 
                      onClick={() => {
                        if (customTimerMin && !isNaN(parseFloat(customTimerMin))) {
                          const min = parseFloat(customTimerMin);
                          setTimerState({ ...timerState, totalDuration: min * 60000, endTime: Date.now() + min * 60000, isFinished: false });
                        }
                      }}
                      className="bg-white/10 text-white border border-white/20 text-[10px] px-3 py-1.5 rounded hover:bg-white/20"
                    >
                      Start
                    </button>
                    <button 
                      onClick={() => setTimerState({ ...timerState, endTime: null, isFinished: false })}
                      className="bg-red-500/20 text-red-400 border border-red-500/50 text-[10px] px-3 py-1.5 rounded hover:bg-red-500/30"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-l border-white/10 pl-4 ml-4">
                  <h3 className="text-sm text-white/80 font-medium">Appearance & Audio</h3>
                  <div className="flex flex-col gap-2 text-[10px]">
                    <div className="flex items-center gap-2">
                      <label className="text-white/50 w-16">Background</label>
                      <select 
                        value={timerState.background.startsWith("file") ? "image" : timerState.background}
                        onChange={(e) => {
                          if (e.target.value === "image" && savedImages.length > 0) {
                            setTimerState({ ...timerState, background: savedImages[0] });
                          } else {
                            setTimerState({ ...timerState, background: e.target.value });
                          }
                        }}
                        className="bg-[#1e1e2e] border border-white/15 rounded px-2 py-1 w-24 text-white"
                      >
                        <option value="black">Black</option>
                        {savedImages.length > 0 && <option value="image">Saved Image</option>}
                      </select>
                      {timerState.background.startsWith("file") && savedImages.length > 0 && (
                        <select
                          value={timerState.background}
                          onChange={e => setTimerState({ ...timerState, background: e.target.value })}
                          className="bg-[#1e1e2e] border border-white/15 rounded px-2 py-1 w-24 text-white"
                        >
                          {savedImages.map((img, idx) => (
                            <option key={idx} value={img}>Image {idx+1}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="text-white/50 w-16">Color</label>
                      <input 
                        type="color" 
                        value={timerState.circleColor}
                        onChange={e => setTimerState({ ...timerState, circleColor: e.target.value })}
                        className="bg-transparent border-0 w-6 h-6 p-0 cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-white/50 w-16">Alarm MP3</label>
                      <input 
                        type="file" 
                        accept="audio/mp3,audio/wav"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const filePath = window.electron ? window.electron.getPathForFile(file) : file.name;
                            setTimerState({ ...timerState, alarmSound: `file:///${filePath.replace(/\\/g, '/')}` });
                          }
                        }}
                        className="text-white/70 file:text-[10px] file:bg-white/10 file:border file:border-white/20 file:rounded file:px-2 file:py-1 w-40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="playAlarmOpt"
                        checked={timerState.playAlarm}
                        onChange={e => setTimerState({ ...timerState, playAlarm: e.target.checked })}
                      />
                      <label htmlFor="playAlarmOpt" className="text-white/70 select-none">Play alarm when finished</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stream status panel - Dynamic Output & Camera Selection */}
      <div className="flex border-l border-white/10" style={{ minWidth: 320 }}>
        {/* Output Routing */}
        <div className="flex flex-col p-3 gap-2 flex-1 border-r border-white/10">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wide">Output Routing</span>
          </div>
          
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {displays.length === 0 ? (
              <p className="text-[10px] text-white/30 italic text-center mt-2">No external displays connected.</p>
            ) : (
              <>
                {displays.map((display) => {
                  const isOn = selectedDisplays.includes(display.id);
                  return (
                    <button 
                      key={display.id}
                      onClick={() => toggleDisplay(display.id)}
                      className={`flex items-center justify-between p-1.5 rounded border text-left transition-all ${
                        isOn ? "bg-[#7c6af7]/20 border-[#7c6af7]/50 text-white" : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
                      }`}
                    >
                      <div>
                        <p className="text-[10px] truncate w-24">{display.label}</p>
                        <p className="text-[8px] opacity-60">{display.bounds.width}×{display.bounds.height}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${isOn ? "bg-green-400" : "bg-white/15"}`} />
                    </button>
                  )
                })}
                {displays.length > 1 && (
                  <button 
                    onClick={selectAllDisplays}
                    className="mt-1 w-full text-[10px] py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
                  >
                    Present on Both
                  </button>
                )}
              </>
            )}
            <button 
              onClick={() => updateSection('app', { enableNDI: !settings.app.enableNDI })}
              className={`flex items-center justify-between p-1.5 rounded border text-left transition-all ${
                settings.app.enableNDI
                  ? "bg-[#7c6af7]/25 border-[#7c6af7]/60 text-white"
                  : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
              }`}
              title={settings.app.enableNDI ? "NDI broadcasting — click to stop" : "Turn on NDI broadcast"}
            >
              <div>
                <p className="text-[10px] truncate w-24">NDI Broadcast</p>
                <p className="text-[8px] opacity-60">
                  {settings.app.enableNDI ? "On · Network" : "Off"}
                </p>
              </div>
              <div className={`w-2 h-2 rounded-full ${settings.app.enableNDI ? "bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]" : "bg-white/15"}`} />
            </button>
          </div>
        </div>

        {/* Video Input */}
        <div className="flex flex-col p-3 gap-2 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Camera size={11} className="text-blue-400" />
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Video Input</span>
          </div>
          
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {/* Phone Camera (WiFi) — only shown while a phone is connected */}
            {(phoneCamConnected || activeCameraId === PHONE_CAMERA_ID || previewCameraId === PHONE_CAMERA_ID) && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => toggleCamera(PHONE_CAMERA_ID)}
                  className={`flex items-center justify-between p-1.5 rounded border text-left transition-all ${
                    activeCameraId === PHONE_CAMERA_ID ? "bg-blue-500/20 border-blue-400/50 text-white" : previewCameraId === PHONE_CAMERA_ID ? "bg-white/10 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${phoneCamConnected ? "bg-green-400" : "bg-white/15"}`} />
                    <p className="text-[10px] truncate" style={{ width: 100 }}>Phone Camera (WiFi)</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${activeCameraId === PHONE_CAMERA_ID ? "bg-blue-400" : previewCameraId === PHONE_CAMERA_ID ? "bg-white/40" : phoneCamConnected ? "bg-green-400" : "bg-white/15"}`} />
                </button>
                {previewCameraId === PHONE_CAMERA_ID && activeCameraId !== PHONE_CAMERA_ID && (
                  <button
                    onClick={applyCamera}
                    className="w-full text-[9px] py-1 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 transition-colors border border-blue-500/30 font-medium"
                  >
                    Use this as background
                  </button>
                )}
                {activeCameraId === PHONE_CAMERA_ID && (
                  <button
                    onClick={clearCamera}
                    className="w-full text-[9px] py-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors border border-red-500/30 font-medium"
                  >
                    Clear Background
                  </button>
                )}
              </div>
            )}

            {cameras.length === 0 ? (
              <p className="text-[10px] text-white/30 italic text-center mt-2">No cameras found.</p>
            ) : (
              cameras.map((cam, i) => {
                const isSelected = previewCameraId === cam.deviceId;
                const isActive = activeCameraId === cam.deviceId;
                return (
                  <div key={cam.deviceId} className="flex flex-col gap-1">
                    <button 
                      onClick={() => toggleCamera(cam.deviceId)}
                      className={`flex items-center justify-between p-1.5 rounded border text-left transition-all ${
                        isActive ? "bg-blue-500/20 border-blue-400/50 text-white" : isSelected ? "bg-white/10 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
                      }`}
                    >
                      <div>
                        <p className="text-[10px] truncate" style={{ width: 100 }}>{cam.label || `Camera ${i + 1}`}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${isActive ? "bg-blue-400" : isSelected ? "bg-white/40" : "bg-white/15"}`} />
                    </button>
                    {isSelected && !isActive && (
                      <button 
                        onClick={applyCamera}
                        className="w-full text-[9px] py-1 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 transition-colors border border-blue-500/30 font-medium"
                      >
                        Use this as background
                      </button>
                    )}
                    {isSelected && isActive && (
                      <button 
                        onClick={clearCamera}
                        className="w-full text-[9px] py-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors border border-red-500/30 font-medium"
                      >
                        Clear Background
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
