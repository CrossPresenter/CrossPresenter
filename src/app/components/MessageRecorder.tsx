import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Download } from 'lucide-react';

export const MessageRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRefs = useRef<any>(null);
  const stopRecordingRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopRecordingRef.current();
    };
  }, []);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const loadLameJS = async () => {
    if ((window as any).lamejs) return;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const startRecording = async () => {
    try {
      await loadLameJS();
      const lamejs = (window as any).lamejs;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      const encoder = new lamejs.Mp3Encoder(1, audioContext.sampleRate, 128);
      const mp3Data: Int8Array[] = [];

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const samples = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const mp3buf = encoder.encodeBuffer(samples);
        if (mp3buf.length > 0) {
          mp3Data.push(new Int8Array(mp3buf));
        }
      };

      source.connect(processor);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      processor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      recordingRefs.current = { stream, audioContext, processor, encoder, mp3Data, source, gainNode };

      setIsRecording(true);
      setAudioUrl(null);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (e) {
      console.error('Error starting MP3 recording:', e);
      alert('Could not start recording. Please check microphone permissions and internet connection.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!recordingRefs.current) return;

    const { stream, audioContext, processor, encoder, mp3Data, source, gainNode } = recordingRefs.current;

    const mp3buf = encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(new Int8Array(mp3buf));
    }

    source.disconnect();
    processor.disconnect();
    gainNode.disconnect();
    
    if (audioContext.state !== 'closed') {
      audioContext.close();
    }

    stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());

    const audioBlob = new Blob(mp3Data, { type: 'audio/mp3' });
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    setIsRecording(false);
    recordingRefs.current = null;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `CrossPresenter_Message_${new Date().toISOString().slice(0,10)}.mp3`;
    a.click();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-black/40 border border-white/10 px-3 py-2 min-h-[46px]">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 hover:border-red-500/60 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
        >
          <Mic size={14} /> Start
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="font-mono text-lg text-white/90 tabular-nums leading-none">{formatTime(recordingTime)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Square size={12} className="fill-current" /> Stop &amp; Save
          </button>
        </>
      )}

      {audioUrl && !isRecording && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Download size={14} className="text-green-400 shrink-0" />
          <audio src={audioUrl} controls className="w-full h-8" />
        </div>
      )}
    </div>
  );
};
