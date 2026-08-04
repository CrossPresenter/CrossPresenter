import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ClockSettings, VideoState, TimerState } from "../App";
import type { AppSettings } from "../contexts/SettingsContext";
import { VideoPlayer } from "./VideoPlayer";
import { motion, AnimatePresence } from "motion/react";

export interface PresenterState {
  text: string;
  reference?: string;
  liveImage?: string | null;
  isBlank: boolean;
  isTheme: boolean;
  isLive: boolean;
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
  // If true, the camera stream shouldn't delay acquisition since it's the laptop preview
  // Also, we can optionally mute it again just to be safe
  isPreview?: boolean;
  onTogglePlay?: () => void;
}

const TAMIL_RE = /[\u0B80-\u0BFF]/;

// Renders the reference with any Tamil portion in a smaller font size.
function ReferenceText({ reference, style }: { reference: string; style: React.CSSProperties }) {
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
function AutoScaledText({ state, isPreview, presenterRootRef }: { state: any, isPreview: boolean, presenterRootRef: React.RefObject<HTMLDivElement> }) {
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
      let hi = 130; // Capped to 130px so short text doesn't get comically huge
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
      const effective = Math.max(8, Math.min(200, Math.round(best * scale)));
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

    // Measure immediately, then again once the first layout has settled.
    safeFit();
    const raf = requestAnimationFrame(safeFit);

    // Re-measure whenever the available space changes (window resize, panel toggles, etc.).
    // Only the root is observed; observing the content would cause a resize loop
    // because changing the font size changes the content's own size.
    const ro = new ResizeObserver(safeFit);
    ro.observe(root);

    // Fallback: also re-measure on window resizes.
    window.addEventListener('resize', safeFit);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', safeFit);
    };
  }, [state.text, state.reference, state.appSettings?.typography, state.backgroundImage, state.liveImage, state.timerState, state.isBlank, state.isLive, state.textScale, isPreview, presenterRootRef]);

  const splitText = state.text.split('\n\n');

  return (
    <div ref={contentRef} className="w-full" style={{ fontSize: `${fontSize}px` }}>
    {state.reference && (
      <div className={`mb-[0.5em] flex w-full ${state.appSettings?.typography.textAlign === 'center' ? 'justify-center' : state.appSettings?.typography.textAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
        <p className="text-white font-extrabold tracking-wide drop-shadow-2xl" 
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

export function PresenterView({ state, isPreview = false, onTogglePlay }: PresenterViewProps) {
  const [time, setTime] = useState(new Date());
  const [appPath, setAppPath] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Root presenter div ref (fixed size, used for auto-scaling measurements)
  const presenterRootRef = useRef<HTMLDivElement>(null);
  // Lyrics container ref
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.electron && window.electron.getAppPath) {
      window.electron.getAppPath().then((p: string) => {
        // Format path for file:// URI properly
        setAppPath(`file:///${p.replace(/\\/g, '/')}`);
      });
    }
  }, []);

  // Handle camera stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isActive = true;

    // Small delay for actual presenter to prevent race condition.
    // In preview mode, we can acquire immediately.
    const delay = isPreview ? 0 : 500;
    const timeout = setTimeout(() => {
      if (state.activeCameraId && videoRef.current) {
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
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error("PresenterView video play failed", e));
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
      if (videoRef.current) {
        videoRef.current.srcObject = null;
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

  // Visually hide if not live or blank.
  const isHidden = state.isBlank || (!state.isLive && !isPreview);

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

      {/* Full-Screen YouTube Video Override (Foreground Mode) */}
      {state.videoState && !state.videoState.isBackground && !state.isBlank && (
        <VideoPlayer 
          {...state.videoState}
          forceMute={(state.videoState.audioDestination === "tv" && isPreview) || (state.videoState.audioDestination === "laptop" && !isPreview)}
          onTogglePlay={onTogglePlay}
        />
      )}

      {/* Full-Screen Image Override */}
      {state.liveImage && !state.videoState && !state.isBlank && (
        <img 
          src={state.liveImage} 
          className="absolute inset-0 w-full h-full object-contain bg-black z-40 transition-opacity duration-300" 
          alt="Full Screen Media" 
        />
      )}

      {/* Default Lyrics Interface (only visible if no liveImage override) */}
      {!state.liveImage && (
        <>
          {/* Background Layer */}
          {state.videoState && state.videoState.isBackground ? (
            <VideoPlayer 
              {...state.videoState}
              forceMute={(state.videoState.audioDestination === "tv" && isPreview) || (state.videoState.audioDestination === "laptop" && !isPreview)}
              onTogglePlay={onTogglePlay}
            />
          ) : state.activeCameraId ? (
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`} 
            />
          ) : state.backgroundImage ? (
            <img 
              src={state.backgroundImage} 
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`} 
              alt="background" 
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #7c6af7 0%, transparent 70%)' }} />
            </div>
          )}

          {/* Lyrics Layer */}
          <div 
            ref={containerRef}
            className={`relative z-10 px-[10cqw] w-full max-h-[85%] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-300 ${isHidden ? 'opacity-0' : 'opacity-100'}`}
          >
            <AnimatePresence mode="wait">
              {state.appSettings?.typography.transition === 'none' ? (
                <div
                  key={state.text}
                  className="w-full transform-gpu flex-shrink-0"
                  style={{
                    textAlign: state.appSettings?.typography.textAlign || "center",
                    fontFamily: state.appSettings?.typography.fontFamily || "Inter, system-ui, sans-serif",
                    fontWeight: state.appSettings?.typography.fontWeight || "700",
                    fontStyle: state.appSettings?.typography.italic ? "italic" : "normal"
                  }}
                >
                  <AutoScaledText state={state} isPreview={isPreview} presenterRootRef={presenterRootRef} />
                </div>
              ) : (
                <motion.div 
                  key={state.text}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="w-full transform-gpu flex-shrink-0" 
                  style={{ 
                    textAlign: state.appSettings?.typography.textAlign || "center",
                    fontFamily: state.appSettings?.typography.fontFamily || "Inter, system-ui, sans-serif",
                    fontWeight: state.appSettings?.typography.fontWeight || "700",
                    fontStyle: state.appSettings?.typography.italic ? "italic" : "normal",
                    willChange: "transform, opacity"
                  }}
                >
                  <AutoScaledText state={state} isPreview={isPreview} presenterRootRef={presenterRootRef} />
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* Standby / Offline Screen (Shown when not live, but not blanked) */}
      {!state.isLive && !isPreview && !state.isBlank && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br from-[#121220] to-[#0a0a12] pointer-events-none transition-opacity duration-300">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at center, #7c6af7 0%, transparent 60%)' }} />
          
          <div className="relative flex items-center gap-[4cqw] opacity-90 drop-shadow-2xl">
            {/* CrossPresenter User Custom Logo */}
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-[12cqw] h-[12cqw] rounded-3xl bg-transparent flex items-center justify-center"
            >
              {appPath ? (
                <img 
                  src={`${appPath}/build/icon.ico`} 
                  alt="CrossPresenter Logo" 
                  className="w-[12cqw] h-[12cqw] object-contain drop-shadow-[0_0_50px_rgba(124,106,247,0.4)]"
                  onError={(e) => {
                    // Fallback to SVG if icon.ico is not found
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              {/* Fallback SVG */}
              <div className="w-full h-full rounded-3xl bg-gradient-to-br from-[#7c6af7] to-[#4b3bb5] shadow-[0_0_50px_rgba(124,106,247,0.4)] flex items-center justify-center" style={{ display: appPath ? 'none' : 'flex' }}>
                <svg viewBox="0 0 100 100" className="w-[6cqw] h-[6cqw] text-white">
                  <path fill="currentColor" d="M20,50 Q40,10 60,50 T100,50 L100,100 L0,100 Z" opacity="0.3"/>
                  <path fill="currentColor" d="M0,60 Q30,30 50,60 T100,60 L100,100 L0,100 Z" opacity="0.6"/>
                  <path fill="currentColor" d="M0,70 Q20,50 40,70 T100,70 L100,100 L0,100 Z" opacity="0.9"/>
                </svg>
              </div>
            </motion.div>
            
            {/* CrossPresenter Typography */}
            <div className="flex flex-col">
              <span className="text-white font-bold tracking-tight" style={{ fontSize: '7cqw', lineHeight: 1 }}>CrossPresenter</span>
              <span className="text-[#a89cf7] font-medium tracking-[0.3em] uppercase opacity-80" style={{ fontSize: '1.5cqw', marginTop: '0.8cqw' }}>Presentation System</span>
            </div>
          </div>
        </div>
      )}

      {/* Absolute Black overlay (only for Blank) */}
      {state.isBlank && (
        <div className="absolute inset-0 bg-black z-50 pointer-events-none transition-opacity duration-300" />
      )}
    </div>
  );
}
