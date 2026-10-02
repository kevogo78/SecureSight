import React, { useState, useEffect } from 'react';
import { X, Play, Pause, RotateCcw, Volume2, ShieldCheck, Film, Clock, Monitor } from 'lucide-react';

export default function SessionPlayerModal({ isOpen, onClose, endpointName = 'WORKSTATION-WIN11' }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(35);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
      }, 250 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Encrypted Session Screen Stream</h3>
              <p className="text-xs text-slate-400">Endpoint: {endpointName} • Stream Source: AWS S3 Encrypted Bucket</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Area */}
        <div className="flex-1 bg-black relative flex items-center justify-center min-h-[380px] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80"
            alt="Session Frame"
            className="w-full h-full object-cover opacity-90"
          />

          {/* Screen Privacy Redaction Simulation Overlay */}
          <div className="absolute top-1/3 left-1/4 w-72 h-14 bg-black/95 border border-emerald-500/50 rounded-lg flex items-center justify-center text-xs font-mono text-emerald-400 gap-2 shadow-2xl backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>[PRIVACY FILTER: REDACTED]</span>
          </div>

          <div className="absolute top-4 left-4 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>S3 Chunk Stream: #{Math.floor(progress / 5) + 101}.enc</span>
          </div>

          <div className="absolute top-4 right-4 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-mono">
            AES-256-GCM Hardware Decrypted
          </div>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {/* Scrubber */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">00:{String(Math.floor(progress / 2)).padStart(2, '0')}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="flex-1 accent-emerald-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-400">00:50</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-bold transition"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setProgress(0)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 text-xs text-slate-300">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-2 py-0.5 rounded font-bold ${speed === s ? 'bg-emerald-500 text-slate-950' : 'hover:text-white'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Full DLP compliance active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
