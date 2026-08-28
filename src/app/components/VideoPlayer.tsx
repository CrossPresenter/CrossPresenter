import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { VideoState } from "../App";

interface VideoPlayerProps extends VideoState {
  forceMute?: boolean;
  onReady?: () => void;
  onEnd?: () => void;
  onStateChange?: (state: number) => void;
  onTogglePlay?: () => void;
}

export function VideoPlayer({
  url,
  playing,
  volume,
  playbackRate,
  seekToTimestamp,
  isBackground,
  audioOutput,
  forceMute,
  onReady,
  onEnd,
  onStateChange,
  onTogglePlay,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const isMasterRef = useRef(isMaster);
  const lastTimeSent = useRef<number>(0);
  const callbacksRef = useRef({ onReady, onEnd, onStateChange });

  useEffect(() => {
    callbacksRef.current = { onReady, onEnd, onStateChange };
  });

  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  // ── Sync Master Role Management ──
  useEffect(() => {
    if (window.electron && window.electron.getSyncRole) {
      window.electron.getSyncRole().then((master: boolean) => {
        setIsMaster(master);
      });
      window.electron.onSyncRoleChanged((master: boolean) => {
        setIsMaster(master);
      });
    }
  }, []);

  // ============================================
  // AUDIO OUTPUT DEVICE (setSinkId)
  // ============================================
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !audioOutput) return;
    const fn = el as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof fn.setSinkId !== "function") return;
    fn.setSinkId(audioOutput).catch((err: any) => console.warn("setSinkId error:", err));
  }, [audioOutput, isReady]);

  const handleLocalTimeUpdate = () => {
    if (!videoRef.current || !isMaster) return;
    const now = Date.now();
    if (now - lastTimeSent.current > 1000) {
      lastTimeSent.current = now;
      if (window.electron && window.electron.sendSyncTime) window.electron.sendSyncTime(videoRef.current.currentTime);
    }
  };

  const handleLocalSeeked = () => {
    if (!videoRef.current || !isMaster) return;
    if (window.electron && window.electron.sendSyncTime) window.electron.sendSyncTime(videoRef.current.currentTime);
  };

  const handleLocalLoadedMetadata = () => {
    if (!videoRef.current || !isMaster) return;
    if (window.electron && window.electron.sendSyncDuration) window.electron.sendSyncDuration(videoRef.current.duration);
  };

  const handleLocalEnded = () => {
    if (onStateChange) onStateChange(0);
    if (onEnd) onEnd();
  };

  // ============================================
  // SYNC SLAVE LISTENER
  // ============================================
  useEffect(() => {
    if (isMaster || !isReady) return;
    if (window.electron && window.electron.onSyncTimeUpdated) {
      window.electron.onSyncTimeUpdated((syncTime: number) => {
        if (videoRef.current && Math.abs(videoRef.current.currentTime - syncTime) > 0.8) {
          videoRef.current.currentTime = syncTime;
        }
      });
    }
  }, [isMaster, isReady]);

  // ============================================
  // PLAY / PAUSE
  // ============================================
  useEffect(() => {
    if (!isReady || !videoRef.current) return;
    if (playing) videoRef.current.play().catch(e => console.warn(e));
    else videoRef.current.pause();
  }, [playing, isReady]);

  // ============================================
  // VOLUME & MUTE
  // ============================================
  useEffect(() => {
    if (!isReady || !videoRef.current) return;
    const shouldMute = volume === 0 || forceMute || isBackground;
    videoRef.current.volume = shouldMute ? 0 : volume / 100;
    videoRef.current.muted = shouldMute;
  }, [volume, forceMute, isBackground, isReady]);

  // ============================================
  // PLAYBACK RATE
  // ============================================
  useEffect(() => {
    if (!isReady || !playbackRate || !videoRef.current) return;
    videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, isReady]);

  // ============================================
  // SEEK
  // ============================================
  useEffect(() => {
    if (!isReady || seekToTimestamp === undefined || !videoRef.current) return;
    videoRef.current.currentTime = seekToTimestamp;
  }, [seekToTimestamp, isReady]);

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: isBackground ? "none" : "auto",
    zIndex: isBackground ? 0 : 40,
    opacity: isBackground ? 0.6 : 1,
    transition: "opacity 0.3s ease, z-index 0.3s ease",
  };

  return (
    <div style={containerStyle}>
      <video
        ref={videoRef}
        src={url}
        autoPlay={playing}
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "black", pointerEvents: "none" }}
        onTimeUpdate={handleLocalTimeUpdate}
        onSeeked={handleLocalSeeked}
        onLoadedMetadata={handleLocalLoadedMetadata}
        onEnded={handleLocalEnded}
        onCanPlay={() => {
          if (!isReady) {
            setIsReady(true);
            if (onReady) onReady();
          }
        }}
        onPlay={() => { if (onStateChange) onStateChange(1); }}
        onPause={() => { if (onStateChange) onStateChange(2); }}
      />
      
      {!isBackground && onTogglePlay && (
        <div 
          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/40 z-50 cursor-pointer"
          onClick={onTogglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-[#7c6af7] flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 pointer-events-none">
            {playing ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </div>
        </div>
      )}
    </div>
  );
}