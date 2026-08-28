import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import type { ClockSettings, VideoState, TimerState } from "../App";
import type { AppSettings } from "../contexts/SettingsContext";
import { VideoPlayer } from "./VideoPlayer";
import { motion, AnimatePresence } from "motion/react";

export interface PresenterState {
  text: string;
  reference?: string;
  liveImage?: string | null;
  imageZoom?: number;
  imagePan?: { x: number; y: number };
  isBlank: boolean;
  isTheme: boolean;
  isLive: boolean;
  scriptureBadge?: boolean;
  activeCameraId?: string | null;
  backgroundImage?: string | null;
  appSettings?: AppSettings;
  clockSettings?: ClockSettings;
  videoState?: VideoState | null;
  timerState?: TimerState;
  textScale?: number;
}

interface PresenterViewProps {
  state: PresenterState;
  isPreview?: boolean;
  onTogglePlay?: () => void;
  onVideoEnd?: () => void;
  canvasSize?: { w: number; h: number } | null;
  onImageZoomChange?: (zoom: number) => void;
  onImagePanChange?: (pan: { x: number; y: number }) => void;
}

const TAMIL_RE = /[\u0B80-\u0BFF]/;

function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^data:video\//i.test(url) || /\.(mp4|webm|mov|ogg|m4v)(\?|#|$)/i.test(url);
}

// Renders the reference with any Tamil portion in a smaller font size.
function ReferenceText({ reference }: { reference: string }) {
  const parts = reference.split(/([\u0B80-\u0BFF]+)/g);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} style={TAMIL_RE.test(part) ? { fontSize: '0.62em' } : undefined}>{part}</span>
      ))}
    </>
  );
}

// Auto-scaling text component that fills available space
function AutoScaledText({ state, isPreview, presenterRootRef, canvasSize }: { state: any, isPreview: boolean, presenterRootRef: React.RefObject<HTMLDivElement>, canvasSize?: { w: number; h: number } | null }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(32);
  useLayoutEffect(() => {
    const root = presenterRootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;

    const fit = () => {
      // Use the fixed-size root presenter div for available height
      const availableHeight = root.clientHeight * 0.82;

      // Binary search for the largest font size (in px) that fits vertically and horizontally
      let lo = 8;
      let hi = Math.floor(availableHeight * 0.6); // Scale with display size
      let best = lo;

      for (let i = 0; i < 20; i++) {
        const mid = Math.floor((lo + hi) / 2);
        if (lo > hi) break;

        content.style.fontSize = `${mid}px`;

        if (content.scrollHeight <= availableHeight && content.scrollWidth <= content.clientWidth) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      // Final safety check
      content.style.fontSize = `${best}px`;
      if (content.scrollHeight > availableHeight || content.scrollWidth > content.clientWidth) {
        best = Math.max(8, best - 1);
      }

      const scale = state.textScale && state.textScale > 0 ? state.textScale : 1;
      const effective = Math.max(8, Math.round(best * scale));
      setFontSize(effective);
      // Apply directly too, so the DOM always matches even if React bails out
      // of a re-render because effective equals the current state.
      content.style.fontSize = `${effective}px`;
    };

    let measuring = false;
    const safeFit = () => {
      if (measuring) return;
      measuring = true;
      try {
        fit();
      } finally {
        measuring = false;
      }
    };

    // Measure immediately.
    safeFit();

    // Re-measure whenever the available space changes (window resize, panel toggles, etc.).
    // Only the root is observed; observing the content would cause a resize loop
    // because changing the font size changes the content's own size.
    const ro = new ResizeObserver(safeFit);
    ro.observe(root);

    // Fallback: also re-measure on window resizes.
    window.addEventListener('resize', safeFit);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', safeFit);
    };
  }, [state.text, state.reference, state.appSettings?.typography, state.backgroundImage, state.liveImage, state.timerState, state.isBlank, state.textScale, isPreview, presenterRootRef, canvasSize]);

  const splitText = state.text.split('\n\n');

  return (
    <div ref={contentRef} className="w-full" style={{ fontSize: `${fontSize}px` }}>
    {state.reference && !state.scriptureBadge && (
      <div className={`mb-[0.5em] flex w-full ${state.appSettings?.typography.textAlign === 'center' ? 'justify-center' : state.appSettings?.typography.textAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
        <p className="text-white font-extrabold tracking-wide whitespace-nowrap drop-shadow-2xl" 
           style={{ 
             fontSize: 'inherit',
             textShadow: state.appSettings?.typography.dropShadow ? '0 0.05em 0.2em rgba(0,0,0,0.8), 0 0.1em 0.4em rgba(0,0,0,0.5)' : 'none',
             WebkitTextStroke: state.appSettings?.typography.textStroke ? '0.04em rgba(0,0,0,0.8)' : 'none'
           }}>
          <ReferenceText reference={state.reference} />
        </p>
      </div>
    )}
    {splitText.map((paragraph: string, pIdx: number) => {
      const isTamil = /[\u0B80-\u0BFF]/.test(paragraph);
      
      return (
        <div key={pIdx} className={`mb-[0.3em] w-full flex flex-col ${state.appSettings?.typography.textAlign === 'center' ? 'items-center' : state.appSettings?.typography.textAlign === 'right' ? 'items-end' : 'items-start'}`}>
          <p 
            className="whitespace-pre-wrap leading-snug drop-shadow-2xl break-words"
            style={{ 
              fontSize: isTamil ? '0.85em' : 'inherit',
              lineHeight: state.appSettings?.typography.lineHeight || 1.5 
            }}
          >
            {paragraph.split('\n').map((line, lIdx) => (
              <span key={lIdx} className="block text-white" 
                style={{ 
                  textShadow: state.appSettings?.typography.dropShadow ? '0 0.05em 0.2em rgba(0,0,0,0.8), 0 0.1em 0.4em rgba(0,0,0,0.5)' : 'none',
                  WebkitTextStroke: state.appSettings?.typography.textStroke ? '0.04em rgba(0,0,0,0.8)' : 'none'
                }}>
                {line}
              </span>
            ))}
          </p>
        </div>
      );
    })}
    </div>
  );
}

export function PresenterView({ state, isPreview = false, onTogglePlay, onVideoEnd, canvasSize, onImageZoomChange, onImagePanChange }: PresenterViewProps) {
  const [time, setTime] = useState(new Date());
  const [appPath, setAppPath] = useState<string | null>(null);
  const [phoneCamUrl, setPhoneCamUrl] = useState<string | null>(null);
  const [phoneCamConnected, setPhoneCamConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Root presenter div ref (fixed size, used for auto-scaling measurements)
  const presenterRootRef = useRef<HTMLDivElement>(null);
  // Lyrics container ref
  const containerRef = useRef<HTMLDivElement>(null);
  // Image drag state
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({ dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  const handleImageWheel = useCallback((e: React.WheelEvent) => {
    if (!state.liveImage || !onImageZoomChange) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const newZoom = Math.max(0.5, Math.min(3, (state.imageZoom ?? 1) + delta));
    onImageZoomChange(Math.round(newZoom * 100) / 100);
  }, [state.liveImage, state.imageZoom, onImageZoomChange]);

  const handleImageMouseDown = useCallback((e: React.MouseEvent) => {
    if (!state.liveImage) return;
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startPanX: state.imagePan?.x ?? 0, startPanY: state.imagePan?.y ?? 0 };
  }, [state.liveImage, state.imagePan]);

  const handleImageMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging || !onImagePanChange) return;
    const root = presenterRootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const dx = (e.clientX - dragRef.current.startX) / (rect.width / 2);
    const dy = (e.clientY - dragRef.current.startY) / (rect.height / 2);
    onImagePanChange({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy });
  }, [onImagePanChange]);

  const handleImageMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  useEffect(() => {
    if (window.electron && window.electron.getAppPath) {
      window.electron.getAppPath().then((p: string) => {
        // Format path for file:// URI properly
        setAppPath(`file:///${p.replace(/\\/g, '/')}`);
      });
    }
    if (window.electron && window.electron.getRemoteInfo) {
      window.electron.getRemoteInfo().then((info: any) => {
        if (info && info.phoneCamUrl) setPhoneCamUrl(info.phoneCamUrl);
      });
    }
  }, []);

  // Poll phone camera status while it's the active camera
  useEffect(() => {
    if (state.activeCameraId !== "phone-camera") return;
    let cancelled = false;
    const check = () => {
      if (window.electron && window.electron.getPhoneCamStatus) {
        window.electron.getPhoneCamStatus().then((s: any) => {
          if (!cancelled) setPhoneCamConnected(!!s?.connected);
        });
      }
    };
    check();
    const id = setInterval(check, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [state.activeCameraId]);

  // Handle camera stream
  useEffect(() => {
    const videoEl = videoRef.current;
    let stream: MediaStream | null = null;
    let isActive = true;

    // Small delay for actual presenter to prevent race condition.
    // In preview mode, we can acquire immediately.
    const delay = isPreview ? 0 : 500;
    const timeout = setTimeout(() => {
      if (state.activeCameraId && state.activeCameraId !== "phone-camera" && videoEl) {
        navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: state.activeCameraId } },
          audio: false
        })
        .then(s => {
          if (!isActive) {
            s.getTracks().forEach(t => t.stop());
            return;
          }
          stream = s;
          if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play().catch(e => console.error("PresenterView video play failed", e));
          }
        })
        .catch(err => {
          console.error("PresenterView failed to acquire camera:", err);
        });
      }
    }, delay);

    return () => {
      isActive = false;
      clearTimeout(timeout);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [state.activeCameraId, isPreview]);

  // Clock Update
  useEffect(() => {
    if (state.clockSettings?.show) {
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
    }
  }, [state.clockSettings?.show]);

  // Timer Update & Alarm
  useEffect(() => {
    if (state.timerState && state.timerState.endTime !== null) {
      const checkTime = () => {
        const remaining = Math.max(0, state.timerState!.endTime! - Date.now());
        setTimeLeft(remaining);
        
        if (remaining === 0 && state.timerState?.playAlarm && audioRef.current && audioRef.current.paused) {
           audioRef.current.loop = true;
           audioRef.current.play().catch(e => console.error("Alarm play failed", e));
        }
      };
      checkTime();
      const interval = setInterval(checkTime, 100);
      return () => clearInterval(interval);
    } else {
      if (audioRef.current) {
         audioRef.current.pause();
         audioRef.current.currentTime = 0;
      }
    }
  }, [state.timerState]);

  const clockString = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: state.clockSettings?.format === "12h"
  });

  // Background video loop control. Forward mode uses the native `loop`;
  // ping-pong mode plays forward then reverses back to the start repeatedly.
  useEffect(() => {
    const el = bgVideoRef.current;
    if (!el || !isVideoUrl(state.backgroundImage)) return;
    if (state.appSettings?.background?.loopMode === 'pingpong') {
      let forward = true;
      const setForward = (f: boolean) => {
        forward = f;
        el.playbackRate = f ? 1 : -1;
      };
      const onEnded = () => {
        if (forward) {
          setForward(false);
        } else {
          setForward(true);
          el.currentTime = 0;
        }
        el.play().catch(() => {});
      };
      const onLoaded = () => {
        el.loop = false;
        setForward(true);
        el.currentTime = 0;
        el.play().catch(() => {});
      };
      el.addEventListener('ended', onEnded);
      el.addEventListener('loadedmetadata', onLoaded);
      el.loop = false;
      setForward(true);
      return () => {
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('loadedmetadata', onLoaded);
      };
    } else {
      el.loop = true;
      el.playbackRate = 1;
    }
  }, [state.backgroundImage, state.appSettings?.background?.loopMode]);

  // Visually hide if not live or blank.
  const isHidden = state.isBlank || (!state.isLive && !isPreview);
  // Phone camera is "connected" only while it's the active camera.
  const phoneCamOn = state.activeCameraId === "phone-camera" && phoneCamConnected;

  return (
    <div 
      ref={presenterRootRef}
      className={`absolute inset-0 bg-black flex flex-col items-center justify-center overflow-hidden ${!isPreview ? 'cursor-none z-50' : 'z-0'}`}
      style={{ containerType: 'size' }} // Enable cqw queries
    >
      
      {/* Blank screen overlay (Blackout) */}
      {state.isBlank && (
        <div className="absolute inset-0 bg-black z-[100]" />
      )}

      {/* Timer Overlay */}
      {state.timerState && state.timerState.endTime !== null && !state.isBlank && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black">
          {state.timerState.background !== 'black' && (
             <img src={state.timerState.background} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Timer Background" />
          )}
          <div className="relative flex items-center justify-center" style={{ width: '45cqw', height: '45cqw' }}>
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 drop-shadow-2xl">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke={state.timerState.circleColor} 
                strokeWidth="3" 
                strokeLinecap="round"
                strokeDasharray="282.743"
                strokeDashoffset={282.743 * (1 - (timeLeft / Math.max(1, state.timerState.totalDuration)))}
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              {timeLeft === 0 ? (
                <span className="text-red-500 font-black tracking-widest drop-shadow-lg animate-pulse text-center leading-tight" style={{ fontSize: '5cqw' }}>
                  TIMER<br/>FINISHED
                </span>
              ) : (
                <span className="text-white font-black tracking-widest drop-shadow-lg" style={{ fontSize: '10cqw', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.floor(timeLeft / 60000).toString().padStart(2, '0')}:
                  {Math.floor((timeLeft % 60000) / 1000).toString().padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
          {state.timerState.playAlarm && state.timerState.alarmSound && (
            <audio ref={audioRef} src={state.timerState.alarmSound} />
          )}
        </div>
      )}

      {/* Full-Screen Video Override (Foreground Mode) */}
      {state.videoState && !state.videoState.isBackground && !state.isBlank && (
        <VideoPlayer 
          {...state.videoState}
          forceMute={!isPreview}
          onTogglePlay={onTogglePlay}
          onEnd={onVideoEnd}
        />
      )}

      {/* Full-Screen Image Override */}
      {state.liveImage && !state.videoState && !state.isBlank && (
        <img 
          src={state.liveImage} 
          className="absolute inset-0 w-full h-full object-contain bg-black z-40 transition-opacity duration-300" 
          alt="Full Screen Media"
          style={{ 
            transform: `translate(${(state.imagePan?.x ?? 0) * 50}%, ${(state.imagePan?.y ?? 0) * 50}%) scale(${state.imageZoom ?? 1})`, 
            transformOrigin: 'center center',
            cursor: (state.imageZoom ?? 1) > 1 ? 'grab' : 'default'
          }}
          onWheel={handleImageWheel}
          onMouseDown={handleImageMouseDown}
          onMouseMove={handleImageMouseMove}
          onMouseUp={handleImageMouseUp}
          onMouseLeave={handleImageMouseUp}
          draggable={false}
        />
      )}

      {/* Default Lyrics Interface (only visible if no liveImage override) */}
      {!state.liveImage && (
        <>
          {/* Background Layer */}
          {state.videoState && state.videoState.isBackground ? (
            <VideoPlayer 
              {...state.videoState}
              forceMute={!isPreview}
              onTogglePlay={onTogglePlay}
              onEnd={onVideoEnd}
            />
          ) : state.activeCameraId === "phone-camera" ? (
            <div className="absolute inset-0 overflow-hidden">
              {phoneCamUrl && (
                <img 
                  src={phoneCamUrl}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`} 
                  alt="Phone Camera" 
                />
              )}
              {!phoneCamOn && (
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
                  <div className="bg-black/50 backdrop-blur-sm rounded-xl px-[3cqw] py-[2cqh] text-center">
                    <p className="text-white/80 font-semibold drop-shadow-lg" style={{ fontSize: '3cqw' }}>
                      Waiting for phone camera…
                    </p>
                    <p className="text-white/45 mt-[1cqh]" style={{ fontSize: '1.8cqw' }}>
                      Open the "Connect your phone" link (Camera tab) on your phone.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : state.activeCameraId ? (
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`} 
            />
          ) : state.backgroundImage ? (
            isVideoUrl(state.backgroundImage) ? (
              <video
                ref={bgVideoRef}
                src={state.backgroundImage}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}
              />
            ) : (
              <img 
                src={state.backgroundImage} 
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`} 
                alt="background" 
              />
            )
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #7c6af7 0%, transparent 70%)' }} />
            </div>
          )}

          {/* Lyrics Layer (hidden when theme mode is active) */}
          <div 
            ref={containerRef}
            className={`relative z-10 px-[10cqw] w-full max-h-[85%] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-300 ${isHidden || state.isTheme ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <div
              className="w-full transform-gpu flex-shrink-0"
              style={{
                textAlign: state.appSettings?.typography.textAlign || "center",
                fontFamily: state.appSettings?.typography.fontFamily || "Inter, system-ui, sans-serif",
                fontWeight: state.appSettings?.typography.fontWeight || "700",
                fontStyle: state.appSettings?.typography.italic ? "italic" : "normal"
              }}
            >
              <AutoScaledText state={state} isPreview={isPreview} presenterRootRef={presenterRootRef} canvasSize={canvasSize} />
            </div>
          </div>
        </>
      )}

      {/* Clock Overlay (highest priority except blackout) */}
      {state.clockSettings?.show && (
        <div className={`absolute bottom-[6cqh] right-[6cqw] z-20 transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
          <p className="text-white drop-shadow-lg font-bold" style={{ fontSize: '3cqw', textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
            {clockString}
          </p>
        </div>
      )}

      {/* Scripture Lower Third Overlay Badge */}
      <AnimatePresence>
        {state.scriptureBadge && state.reference && !state.isBlank && (
          <motion.div
            key="scripture-badge"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute bottom-[14cqh] left-[6cqw] z-30"
          >
            <div className={`flex items-center gap-[1cqw] ${isHidden ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
              <p
                className="text-white font-extrabold tracking-wide whitespace-nowrap"
                style={{
                  fontSize: '2.4cqw',
                  textShadow: state.appSettings?.typography.dropShadow ? '0 0.05em 0.2em rgba(0,0,0,0.8)' : 'none',
                  WebkitTextStroke: state.appSettings?.typography.textStroke ? '0.04em rgba(0,0,0,0.8)' : 'none'
                }}
              >
                <ReferenceText reference={state.reference} />
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standby / Offline Screen (Shown when not live, but not blanked) */}
      {!state.isLive && !isPreview && !state.isBlank && (
        <div className="absolute inset-0 z-40 bg-black pointer-events-none transition-opacity duration-300" />
      )}
    </div>
  );
}
