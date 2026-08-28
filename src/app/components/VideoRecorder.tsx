import React, { useEffect, useRef, useState } from "react";
import { Mic, Radio, Square, FileVideo } from "lucide-react";

interface AudioDevice {
  deviceId: string;
  label: string;
}

export const VideoRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [quality, setQuality] = useState<"720p" | "1080p">("720p");
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [audioSource, setAudioSource] = useState<string>("none");
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const frameChainRef = useRef<Promise<void>>(Promise.resolve());
  const abortedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === "audioinput");
        if (!cancelled) {
          setAudioDevices(audioInputs.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` })));
        }
      } catch {
        // ignore enumeration errors
      }
    };
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", load);
    };
  }, []);

  // Cleanup on unmount (e.g. closing the app) — discard the recording, no dialog.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        abortedRef.current = true;
        try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      }
      try { window.electron?.stopRecorder(); } catch { /* ignore */ }
    };
  }, []);

  const pickMimeType = () => {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp8",
      "video/webm"
    ];
    if (typeof MediaRecorder !== "undefined") {
      for (const c of candidates) {
        try { if (MediaRecorder.isTypeSupported(c)) return c; } catch { /* ignore */ }
      }
    }
    return "";
  };

  const setupMeter = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, Math.round((avg / 255) * 200)));
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch { /* ignore */ }
  };

  const stopMeter = () => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
    setMicLevel(0);
  };

  const start = async () => {
    if (isRecording || isStarting) return;
    setError(null);
    setIsStarting(true);
    abortedRef.current = false;

    const W = quality === "1080p" ? 1920 : 1280;
    const H = Math.round((W * 9) / 16);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported.");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      canvasRef.current = canvas;
      ctxRef.current = ctx;

      window.electron?.startRecorder(quality);

      const audioTracks: MediaStreamTrack[] = [];
      if (audioSource !== "none") {
        try {
          if (audioSource === "system") {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const audioTrack = displayStream.getAudioTracks()[0];
            if (audioTrack) {
              audioStreamRef.current = displayStream;
              audioTracks.push(audioTrack);
            } else {
              displayStream.getTracks().forEach(t => t.stop());
              throw new Error("No audio available from that source.");
            }
          } else {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: audioSource } } });
            audioStreamRef.current = micStream;
            const track = micStream.getAudioTracks()[0];
            if (track) audioTracks.push(track);
            setupMeter(micStream);
          }
        } catch (e: any) {
          setError(e?.message || "Could not start the selected audio input.");
          setIsStarting(false);
          window.electron?.stopRecorder();
          return;
        }
      }

      const videoStream = canvas.captureStream(30);
      const videoTrack = videoStream.getVideoTracks()[0];
      const finalStream = new MediaStream([videoTrack, ...audioTracks]);
      streamRef.current = finalStream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: quality === "1080p" ? 8_000_000 : 5_000_000,
        audioBitsPerSecond: 128_000
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          e.data.arrayBuffer().then(buf => window.electron?.recorderChunk(buf)).catch(() => {});
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsStarting(false);
        stopMeter();
        window.electron?.stopRecorder();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
        streamRef.current = null;
        mediaRecorderRef.current = null;
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        canvasRef.current = null;
        ctxRef.current = null;

        if (abortedRef.current) {
          window.electron?.cancelRecording();
          return;
        }

        const name = `CrossPresenter_${quality}_${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}.webm`;
        try {
          const res = await window.electron?.saveRecording(name);
          if (res && res.path) {
            setLastFile(res.path);
            setShowPreview(true);
            setError(null);
          } else {
            setError(res?.canceled ? "Recording discarded." : "Could not save the recording.");
          }
        } catch {
          setError("Could not save the recording.");
        }
      };

      window.electron?.onRecorderFrame((frame) => {
        const u8 = frame.data instanceof Uint8Array ? frame.data : new Uint8Array(frame.data);
        const blob = new Blob([u8 as BlobPart], { type: "image/jpeg" });
        frameChainRef.current = frameChainRef.current
          .then(() => createImageBitmap(blob))
          .then((bmp) => {
            const c = ctxRef.current;
            if (c) c.drawImage(bmp, 0, 0, W, H);
            bmp.close();
          })
          .catch(() => {});
      });

      recorder.start(1000);
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (e: any) {
      setError(e?.message || "Failed to start recording.");
      setIsStarting(false);
      try { window.electron?.stopRecorder(); } catch { /* ignore */ }
    }
  };

  const stop = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Source controls */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Audio Input</label>
          <select
            value={audioSource}
            onChange={(e) => setAudioSource(e.target.value)}
            disabled={isRecording}
            className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-[10px] text-white/80 outline-none focus:border-[#7c6af7]/60 disabled:opacity-50"
          >
            <option value="none">No audio</option>
            {audioDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
            <option value="system">System audio (PC sound)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Quality</label>
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-md p-0.5">
            {(["720p", "1080p"] as const).map(q => (
              <button
                key={q}
                disabled={isRecording}
                onClick={() => setQuality(q)}
                className={`flex-1 py-1 rounded text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                  quality === q ? "bg-[#7c6af7]/30 text-[#a89cf7]" : "text-white/40 hover:text-white/80"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mic level meter */}
      {audioSource !== "none" && audioSource !== "system" && (
        <div className="flex items-center gap-2">
          <Mic size={10} className="text-white/40 shrink-0" />
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-150"
              style={{ width: `${micLevel}%` }}
            />
          </div>
          <span className="text-[9px] text-white/40 tabular-nums w-8 text-right">{micLevel}%</span>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1">{error}</p>
      )}

      {/* Record controls */}
      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg px-3 py-2.5">
        {!isRecording ? (
          <button
            onClick={start}
            disabled={isStarting}
            className="flex items-center gap-2 bg-red-500/90 hover:bg-red-500 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-colors disabled:opacity-60"
          >
            <Radio size={14} className={isStarting ? "animate-pulse" : ""} />
            {isStarting ? "Starting…" : "Record Live Video"}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
              <span className="font-mono text-lg text-white/90 tabular-nums leading-none">{formatTime(elapsed)}</span>
              <span className="text-[9px] text-white/40 uppercase tracking-wider">REC · {quality}</span>
            </div>
            <button
              onClick={stop}
              className="flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Square size={12} className="fill-current" /> Stop &amp; Save
            </button>
          </>
        )}
      </div>

      {/* Recent recording */}
      {lastFile && (
        <div className="flex flex-col gap-1.5 bg-green-500/10 border border-green-500/30 rounded-lg p-2">
          <div className="flex items-center gap-1.5 text-green-400">
            <FileVideo size={12} className="shrink-0" />
            <span className="text-[10px] font-semibold truncate">{lastFile.split(/[\\/]/).pop()}</span>
          </div>
          <p className="text-[9px] text-white/40 break-all">{lastFile}</p>
          {showPreview && (
            <video
              src={`file:///${lastFile.replace(/\\/g, "/")}`}
              controls
              className="w-full rounded-md bg-black max-h-32"
            />
          )}
        </div>
      )}
    </div>
  );
};
