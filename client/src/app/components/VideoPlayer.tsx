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

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function VideoPlayer({
  type,
  url,
  playing,
  volume,
  playbackRate,
  seekToTimestamp,
  isBackground,
  forceMute,
  onReady,
  onEnd,
  onStateChange,
  onTogglePlay,
}: VideoPlayerProps) {
  const webviewRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const isMasterRef = useRef(isMaster);
  const lastTimeSent = useRef<number>(0);

  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  // ── Sync Master Role Management ──
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.getSyncRole) {
      // @ts-ignore
      window.electron.getSyncRole().then((master: boolean) => {
        setIsMaster(master);
      });
      // @ts-ignore
      window.electron.onSyncRoleChanged((master: boolean) => {
        setIsMaster(master);
      });
    }
  }, []);

  // ============================================
  // YOUTUBE <webview> LOGIC
  // ============================================
  useEffect(() => {
    if (type !== "youtube") return;
    const wv = webviewRef.current;
    if (!wv) return;

    const handleDomReady = () => {
      wv.executeJavaScript(`
        (function() {
          /* ── Inject CSS ── */
          if (!document.getElementById('__yt_hide_css')) {
            var s = document.createElement('style');
            s.id = '__yt_hide_css';
            s.textContent = \`
              #masthead, #masthead-container, ytd-masthead, tp-yt-app-header,
              #guide, #guide-wrapper, tp-yt-app-drawer,
              #header, header { display: none !important; }
              #below, #secondary, #related, #comments, #info, #meta,
              ytd-watch-metadata, #description, #above-the-fold, #panels,
              ytd-merch-shelf-renderer, #ticket-shelf, #chat, #chat-container,
              ytd-watch-next-secondary-results-renderer, #dismissible,
              #clarify-box, #actions, #owner, #upload-info,
              ytd-video-primary-info-renderer, ytd-video-secondary-info-renderer,
              #teaser, .ytd-watch-flexy[flexy] #columns #secondary { display: none !important; }
              .ytp-chrome-top, .ytp-chrome-bottom,
              .ytp-gradient-top, .ytp-gradient-bottom,
              .ytp-watermark, .ytp-show-cards-title,
              .ytp-ce-element, .ytp-endscreen-content,
              .ytp-pause-overlay, .ytp-paid-content-overlay,
              .iv-branding, .annotation, .ytp-cards-teaser,
              .ytp-ce-covering-overlay, .ytp-ce-element-shadow,
              .ytp-ce-covering-image, .ytp-ce-expanding-image,
              .ytp-endscreen-previous, .ytp-endscreen-next,
              .ytp-impression-link, .ytp-suggested-action,
              .ytp-doubletap-ui-legacy { display: none !important; }
              tp-yt-paper-dialog, ytd-popup-container,
              ytd-consent-bump-v2-lightbox, #consent-bump,
              .consent-bump-v2-lightbox, ytd-enforcement-message-view-model,
              ytd-mealbar-promo-renderer, iron-overlay-backdrop { display: none !important; }
              ytd-miniplayer, .ytd-miniplayer,
              ytd-reel-shelf-renderer { display: none !important; }
              html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #000 !important; }
              ytd-app, #content, #page-manager, ytd-watch-flexy,
              ytd-watch-flexy[theater], ytd-watch-flexy[fullscreen] { margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
              #player, #player-container, #player-container-inner,
              #player-container-outer, ytd-player, #ytd-player,
              #player-theater-container, #full-bleed-container,
              #player-wide-container, #movie_player, .html5-video-player {
                position: fixed !important; top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 100vh !important;
                max-width: none !important; max-height: none !important;
                min-height: 0 !important; margin: 0 !important; padding: 0 !important; z-index: 9999 !important;
              }
              .html5-video-container, video { width: 100% !important; height: 100% !important; }
              video { object-fit: contain !important; }
              ytd-watch-flexy[theater] #player-theater-container,
              ytd-watch-flexy[fullscreen] #player-theater-container { max-height: 100vh !important; }
            \`;
            document.head.appendChild(s);
          }

          /* ── Wait for <video> element & attach listeners ── */
          function setup(video) {
            if (video.__yt_flow_ready) return;
            video.__yt_flow_ready = true;
            video.addEventListener('ended',  function() { console.log('__YOUTUBE_ENDED__'); });
            video.addEventListener('play',   function() { console.log('__YOUTUBE_PLAYING__'); });
            video.addEventListener('pause',  function() { console.log('__YOUTUBE_PAUSED__'); });
            
            video.addEventListener('timeupdate', function() {
              var now = Date.now();
              if (!video.__last_time_sent || (now - video.__last_time_sent > 1000)) {
                video.__last_time_sent = now;
                console.log('__YOUTUBE_TIME__' + video.currentTime);
              }
            });
            
            video.addEventListener('seeked', function() {
              console.log('__YOUTUBE_TIME__' + video.currentTime);
            });

            video.addEventListener('durationchange', function() {
              console.log('__YOUTUBE_DURATION__' + video.duration);
            });

            // Also broadcast duration immediately on setup in case it's already known
            if (video.duration) {
              console.log('__YOUTUBE_DURATION__' + video.duration);
            }

            console.log('__YOUTUBE_READY__');
          }

          var existing = document.querySelector('video');
          if (existing) { setup(existing); }

          var obs = new MutationObserver(function() {
            var v = document.querySelector('video');
            if (v) { obs.disconnect(); setup(v); }
          });
          obs.observe(document.documentElement, { childList: true, subtree: true });
          setTimeout(function() { obs.disconnect(); }, 30000);

          /* ── Force Theater Mode ── */
          var theaterInterval = setInterval(function() {
            var watchFlexy = document.querySelector('ytd-watch-flexy');
            if (watchFlexy) {
              if (watchFlexy.hasAttribute('theater') || watchFlexy.hasAttribute('fullscreen')) {
                clearInterval(theaterInterval);
              } else {
                var sizeBtn = document.querySelector('.ytp-size-button');
                if (sizeBtn) { sizeBtn.click(); clearInterval(theaterInterval); }
              }
            }
          }, 500);
          setTimeout(function() { clearInterval(theaterInterval); }, 15000);

          return null;
        })();
      `).catch((e: any) => console.warn("YT init inject error:", e));
    };

    const handleConsoleMessage = (e: any) => {
      if (e.message === "__YOUTUBE_READY__") {
        setIsReady(true);
        if (onReady) onReady();
      } else if (e.message === "__YOUTUBE_ENDED__") {
        if (onStateChange) onStateChange(0);
        if (onEnd) onEnd();
      } else if (e.message === "__YOUTUBE_PLAYING__") {
        if (onStateChange) onStateChange(1);
      } else if (e.message === "__YOUTUBE_PAUSED__") {
        if (onStateChange) onStateChange(2);
      } else if (e.message.startsWith("__YOUTUBE_TIME__")) {
        const time = parseFloat(e.message.substring(16));
        if (!isNaN(time) && isMasterRef.current) {
          // @ts-ignore
          if (window.electron && window.electron.sendSyncTime) window.electron.sendSyncTime(time);
        }
      } else if (e.message.startsWith("__YOUTUBE_DURATION__")) {
        const duration = parseFloat(e.message.substring(20));
        if (!isNaN(duration) && isMasterRef.current) {
          // @ts-ignore
          if (window.electron && window.electron.sendSyncDuration) window.electron.sendSyncDuration(duration);
        }
      }
    };

    wv.addEventListener("dom-ready", handleDomReady);
    wv.addEventListener("console-message", handleConsoleMessage);

    return () => {
      wv.removeEventListener("dom-ready", handleDomReady);
      wv.removeEventListener("console-message", handleConsoleMessage);
      setIsReady(false);
    };
  }, [type, url]);

  // ============================================
  // LOCAL <video> LOGIC
  // ============================================
  // We set isReady=true in onCanPlay now to ensure it's fully loaded

  const handleLocalTimeUpdate = () => {
    if (!videoRef.current || !isMaster) return;
    const now = Date.now();
    if (now - lastTimeSent.current > 1000) {
      lastTimeSent.current = now;
      // @ts-ignore
      if (window.electron && window.electron.sendSyncTime) window.electron.sendSyncTime(videoRef.current.currentTime);
    }
  };

  const handleLocalSeeked = () => {
    if (!videoRef.current || !isMaster) return;
    // @ts-ignore
    if (window.electron && window.electron.sendSyncTime) window.electron.sendSyncTime(videoRef.current.currentTime);
  };

  const handleLocalLoadedMetadata = () => {
    if (!videoRef.current || !isMaster) return;
    // @ts-ignore
    if (window.electron && window.electron.sendSyncDuration) window.electron.sendSyncDuration(videoRef.current.duration);
  };

  const handleLocalEnded = () => {
    if (onStateChange) onStateChange(0);
    if (onEnd) onEnd();
  };

  // ============================================
  // SYNC SLAVE LISTENER (Both YT & Local)
  // ============================================
  useEffect(() => {
    if (isMaster || !isReady) return;
    // @ts-ignore
    if (window.electron && window.electron.onSyncTimeUpdated) {
      // @ts-ignore
      window.electron.onSyncTimeUpdated((syncTime: number) => {
        if (type === "youtube" && webviewRef.current) {
          webviewRef.current.executeJavaScript(`
            (function() {
              var v = document.querySelector('video');
              if (v && Math.abs(v.currentTime - ${syncTime}) > 0.8) {
                v.currentTime = ${syncTime}; return true;
              }
              return false;
            })();
          `).catch((err: any) => console.warn("YT Sync error:", err));
        } else if (type === "local" && videoRef.current) {
          if (Math.abs(videoRef.current.currentTime - syncTime) > 0.8) {
            videoRef.current.currentTime = syncTime;
          }
        }
      });
    }
  }, [isMaster, isReady, type]);

  // ============================================
  // PLAY / PAUSE
  // ============================================
  useEffect(() => {
    if (!isReady) return;
    if (type === "youtube" && webviewRef.current) {
      webviewRef.current.executeJavaScript(`(function(){ var v = document.querySelector('video'); if(v) v.${playing ? 'play()' : 'pause()' }; return null; })()`).catch(e => console.warn(e));
    } else if (type === "local" && videoRef.current) {
      if (playing) videoRef.current.play().catch(e => console.warn(e));
      else videoRef.current.pause();
    }
  }, [playing, isReady, type]);

  // ============================================
  // VOLUME & MUTE
  // ============================================
  useEffect(() => {
    if (!isReady) return;
    const shouldMute = volume === 0 || forceMute || isBackground;
    const actualVolume = shouldMute ? 0 : volume / 100;
    
    if (type === "youtube" && webviewRef.current) {
      webviewRef.current.executeJavaScript(`(function(){ var v = document.querySelector('video'); if(v){ v.volume=${actualVolume}; v.muted=${shouldMute}; } return null; })()`).catch(e => console.warn(e));
    } else if (type === "local" && videoRef.current) {
      videoRef.current.volume = actualVolume;
      videoRef.current.muted = shouldMute;
    }
  }, [volume, forceMute, isBackground, isReady, type]);

  // ============================================
  // PLAYBACK RATE
  // ============================================
  useEffect(() => {
    if (!isReady || !playbackRate) return;
    if (type === "youtube" && webviewRef.current) {
      webviewRef.current.executeJavaScript(`(function(){ var v = document.querySelector('video'); if(v) v.playbackRate=${playbackRate}; return null; })()`).catch(e => console.warn(e));
    } else if (type === "local" && videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isReady, type]);

  // ============================================
  // SEEK
  // ============================================
  useEffect(() => {
    if (!isReady || seekToTimestamp === undefined) return;
    if (type === "youtube" && webviewRef.current) {
      webviewRef.current.executeJavaScript(`(function(){ var v = document.querySelector('video'); if(v) v.currentTime=${seekToTimestamp}; return null; })()`).catch(e => console.warn(e));
    } else if (type === "local" && videoRef.current) {
      videoRef.current.currentTime = seekToTimestamp;
    }
  }, [seekToTimestamp, isReady, type]);

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
      {type === "youtube" && (
        /* @ts-ignore */
        <webview
          ref={webviewRef}
          src={`https://www.youtube.com/watch?v=${url}`}
          useragent={CHROME_USER_AGENT}
          httpreferrer="https://www.youtube.com"
          style={{ width: "100%", height: "100%", border: "none", pointerEvents: "none" }}
          allowpopups="false"
          // @ts-ignore
          webpreferences="autoplayPolicy=no-user-gesture-required,contextIsolation=false"
        />
      )}
      {type === "local" && (
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
      )}
      
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
