import React, { useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Layers, Film, Image as ImageIcon, SkipBack, SkipForward, BookOpen, Camera, Clock, Plus, Youtube, Link as LinkIcon, Mic, ArrowLeft } from "lucide-react";
import { BIBLE_BOOKS, CHAPTERS, BOOK_ABBREV, getVerses, getVerseText, setActiveTranslation, loadBuiltinBibles, TAMIL_BIBLE_BOOKS_MAP } from "./BibleData";
import type { LiveContent, DisplayInfo, ClockSettings, VideoState } from "../App";
import { useSettings } from "../contexts/SettingsContext";
import { VideoPlayer } from "./VideoPlayer";
import { MessageRecorder } from "./MessageRecorder";

const OVERLAYS = [
  { id: 1, label: "Lower Third — Speaker", color: "bg-[#7c6af7]/20 border-[#7c6af7]/40 text-[#a89cf7]" },
  { id: 2, label: "Scripture Reference Bar", color: "bg-blue-500/15 border-blue-400/30 text-blue-300" },
  { id: 3, label: "Offering Alert", color: "bg-yellow-500/15 border-yellow-400/30 text-yellow-300" },
];

interface MediaPanelProps {
  onBibleVerse: (v: LiveContent) => void;
  onImageOverride: (url: string) => void;
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
  backgroundImage,
  setBackgroundImage,
  videoState,
  setVideoState,
  timerState,
  setTimerState
}: MediaPanelProps) {
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("https://www.youtube.com/watch?v=mqhYYB6ChHQ");
  const [activeOverlays, setActiveOverlays] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<"videos" | "overlays" | "images" | "bible" | "record" | "timer">("videos");
  const [customTimerMin, setCustomTimerMin] = useState<string>("");

  
  const { settings } = useSettings();
  
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

  const toggleOverlay = (id: number) =>
    setActiveOverlays(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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
    const { text, refLabel } = buildLiveVerse(v, selectedTranslations);
    onBibleVerse({
      type: "bible",
      text,
      reference: refLabel,
    });
  }

  const toggleTranslation = (t: string) => {
    if (selectedTranslations.includes(t)) {
      if (selectedTranslations.length > 1) {
        const next = selectedTranslations.filter(x => x !== t);
        setSelectedTranslations(next);
        if (bibleVerse !== null) {
          const { text, refLabel } = buildLiveVerse(bibleVerse, next);
          onBibleVerse({ type: "bible", text, reference: refLabel });
        }
      }
      return;
    }
    if (selectedTranslations.length >= 2) {
      setVersionMsg("Not more than two versions");
      window.setTimeout(() => setVersionMsg(null), 2500);
      return;
    }
    const next = [...selectedTranslations, t];
    setSelectedTranslations(next);
    if (bibleVerse !== null) {
      const { text, refLabel } = buildLiveVerse(bibleVerse, next);
      onBibleVerse({ type: "bible", text, reference: refLabel });
    }
  };

  const handleReferenceOnly = () => {
    if (bibleVerse === null) return;
    const { refLabel } = buildLiveVerse(bibleVerse, selectedTranslations);
    onBibleVerse({
      type: "bible",
      text: "",
      reference: refLabel,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // In Electron, File objects have a .path property.
      // Instead of reading the entire image into memory as Base64 (which is very slow),
      // we instantly grab the absolute file path and use it directly.
      const newUrls = Array.from(files).map(file => `file:///${file.path.replace(/\\/g, '/')}`);
      setSavedImages(prev => [...newUrls, ...prev]);
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

  const parseYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleLoadYoutube = () => {
    const id = parseYoutubeId(youtubeUrlInput);
    if (id && setVideoState) {
      setVideoState({
        type: "youtube",
        url: id,
        playing: true,
        volume: 80,
        playbackRate: 1,
        isBackground: false,
        audioDestination: "tv"
      });
      setYoutubeUrlInput("");
      onImageOverride(""); // Clear full screen image if any
    }
  };

  const handleLocalVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && setVideoState) {
      const filePath = file.path.replace(/\\/g, '/');
      setVideoState({
        type: "local",
        url: `file:///${filePath}`,
        playing: true,
        volume: 80,
        playbackRate: 1,
        isBackground: false,
        audioDestination: "tv"
      });
      onImageOverride("");
      onImageOverride("");
    }
    // reset input
    e.target.value = '';
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
            <div className="flex flex-col h-full gap-3 p-4">
              <div className="flex flex-col gap-2 max-w-lg">
                <h3 className="text-sm text-white/80 font-medium">Add YouTube Video</h3>
                <p className="text-[10px] text-white/40">Paste any YouTube URL. The video will be routed directly to the live display, and you will control playback from this panel to save laptop resources.</p>
                
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 relative">
                    <LinkIcon size={12} className="absolute left-2.5 top-[8px] text-white/30" />
                    <input 
                      type="text" 
                      value={youtubeUrlInput}
                      onChange={(e) => setYoutubeUrlInput(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-black/40 border border-white/10 rounded px-8 py-1.5 text-xs text-white outline-none focus:border-[#7c6af7]/50"
                      onKeyDown={(e) => { if (e.key === "Enter") handleLoadYoutube(); }}
                    />
                  </div>
                  <button 
                    onClick={handleLoadYoutube}
                    disabled={!youtubeUrlInput.trim()}
                    className="bg-[#7c6af7] hover:bg-[#6a58e0] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded text-xs font-medium transition-colors"
                  >
                    Load
                  </button>
                  <label className="bg-[#7c6af7]/20 hover:bg-[#7c6af7]/40 text-[#a89cf7] px-3 py-1.5 rounded cursor-pointer transition-colors flex items-center justify-center" title="Add Local MP4 Video">
                    <Plus size={14} />
                    <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleLocalVideoUpload} />
                  </label>
                </div>
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
            <div className="flex flex-col gap-2 h-full">
              {!biblesLoaded && (
                <div className="flex items-center justify-center h-full text-white/50 text-xs">
                  Loading Bibles...
                </div>
              )}
              {biblesLoaded && (
                <>
              <div className="flex flex-col gap-1.5 pb-1.5 border-b border-white/10 shrink-0">
                {/* Row: Translation toggles + Reference Only */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] uppercase tracking-widest text-white/30 shrink-0">Translation</span>
                  {translations.map(t => {
                    const active = selectedTranslations.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTranslation(t)}
                        className={`px-2 py-1 rounded border text-[10px] transition-colors ${
                          active
                            ? "bg-[#7c6af7]/25 border-[#7c6af7]/60 text-white"
                            : "bg-white/3 border-white/10 text-white/45 hover:text-white/80 hover:border-white/20"
                        }`}
                      >
                        {t === 'nasb2020' ? 'NASB 2020' : t === 'tamil_bible' ? 'Tamil (O.V.)' : 'NASB 1995'}
                      </button>
                    );
                  })}
                  <div className="flex-1" />
                  <button
                    onClick={handleReferenceOnly}
                    disabled={bibleVerse === null}
                    className="px-2.5 py-1 rounded border text-[10px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white/5 border-white/15 text-white/70 hover:text-white hover:border-white/30"
                    title="Present only the reference on the live screen"
                  >
                    Reference Only
                  </button>
                </div>
                {versionMsg && (
                  <div className="text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                    {versionMsg}
                  </div>
                )}
              </div>

              {/* Progress bar: Back button + current reference (top-left) */}
              <div className="flex items-center gap-2 shrink-0">
                {bibleStep !== "book" && (
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium text-white/70 bg-white/5 border-white/15 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <ArrowLeft size={10} /> Back
                  </button>
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  {bibleStep === "book" && (
                    <span className="text-xs font-bold text-white/90 tracking-wide">Select Book</span>
                  )}
                  {bibleStep === "chapter" && bibleBook && (
                    <span className="text-xs font-bold text-white/90 tracking-wide">{bibleBook}</span>
                  )}
                  {bibleStep === "verse" && bibleBook && bibleChapter !== null && (
                    <span className="text-xs font-bold text-white/90 tracking-wide">
                      {bibleBook} {bibleChapter}
                    </span>
                  )}
                  {bibleStep === "verse" && bibleVerse !== null && (
                    <span className="text-[9px] bg-[#7c6af7]/20 border border-[#7c6af7]/30 text-[#9d8ff8] px-1.5 py-0.5 rounded font-mono shadow-inner uppercase tracking-wider">
                      Verse {bibleVerse} Live
                    </span>
                  )}
                </div>
              </div>

              {/* Step content */}
              <div className="flex-1 overflow-hidden min-h-0">
                {bibleStep === "book" && (
                  <div className="flex flex-col h-full gap-1.5">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-4 gap-[3px] content-start">
                        {BIBLE_BOOKS.map(b => (
                          <button
                            key={b}
                            onClick={() => selectBook(b)}
                            title={b}
                            className={`px-1 py-1 rounded text-[10px] leading-none truncate text-center transition-colors ${
                              bibleBook === b
                                ? "bg-[#7c6af7]/30 text-white border border-[#7c6af7]/60"
                                : "bg-white/3 text-white/45 border border-transparent hover:text-white/85 hover:bg-white/8"
                            }`}
                          >
                            {BOOK_ABBREV[b] ?? b}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {bibleStep === "chapter" && bibleBook && (
                  <div className="flex flex-col h-full gap-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-white/30 shrink-0">
                      Select Chapter — {bibleBook}
                    </span>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-6 gap-[3px] content-start">
                        {Array.from({ length: CHAPTERS[bibleBook] ?? 10 }, (_, i) => i + 1).map(c => (
                          <button
                            key={c}
                            onClick={() => selectChapter(c)}
                            className={`px-1 py-1 rounded text-[10px] leading-none text-center transition-colors ${
                              bibleChapter === c
                                ? "bg-[#7c6af7]/30 text-white border border-[#7c6af7]/60"
                                : "bg-white/3 text-white/50 border border-transparent hover:bg-white/8"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {bibleStep === "verse" && bibleBook && bibleChapter !== null && (
                  <div className="flex flex-col h-full gap-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-white/30 shrink-0">
                      Select Verse — {bibleBook} {bibleChapter}
                    </span>
                    <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 custom-scrollbar pr-1">
                      {getVerses(bibleBook, bibleChapter).map(v => {
                        setActiveTranslation(selectedTranslations[0]);
                        let text = getVerseText(bibleBook, bibleChapter, v);
                        for (let i = 1; i < selectedTranslations.length; i++) {
                          setActiveTranslation(selectedTranslations[i]);
                          text += `\n${getVerseText(bibleBook, bibleChapter, v)}`;
                        }
                        setActiveTranslation(selectedTranslations[0]);
                        const isActive = bibleVerse === v;
                        return (
                          <button
                            key={v}
                            onClick={() => handleBibleSelection(v)}
                            className={`flex gap-2 text-left px-2.5 py-1.5 rounded border transition-all ${
                              isActive
                                ? "bg-[#7c6af7]/20 border-[#7c6af7]/50 text-white shadow-[0_0_10px_rgba(124,106,247,0.15)]"
                                : "bg-white/3 border-white/8 text-white/55 hover:text-white/85 hover:border-white/18"
                            }`}
                          >
                            <span className={`text-[10px] font-mono flex-shrink-0 mt-0.5 ${isActive ? "text-[#9d8ff8]" : "text-white/25"}`}>{v}</span>
                            <span className="text-[10px] leading-relaxed whitespace-pre-line">{text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          )}

          {activeTab === "record" && (
            <div className="flex flex-col h-full gap-2 p-3">
              <h3 className="text-xs text-white/70 font-medium">Record Message (MP3)</h3>
              <MessageRecorder />
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
                        <option value="image">Saved Image</option>
                      </select>
                      {timerState.background.startsWith("file") && (
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
                            const url = `file:///${file.path.replace(/\\/g, '/')}`;
                            setTimerState({ ...timerState, alarmSound: url });
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
          </div>
        </div>

        {/* Video Input */}
        <div className="flex flex-col p-3 gap-2 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Camera size={11} className="text-blue-400" />
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Video Input</span>
          </div>
          
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
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
