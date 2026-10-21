import React, { useState, useEffect } from 'react';
import { X, Film, RefreshCw } from 'lucide-react';

export default function SessionPlayerModal({ isOpen, onClose, endpointId, endpointName }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState('');
  const [videoError, setVideoError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setItems([]); setSelectedId(''); }, [endpointId, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const escape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [isOpen, onClose]);
  useEffect(() => {
    if (!isOpen || !endpointId) return;
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/v1/recordings?endpoint_id=${encodeURIComponent(endpointId)}`, { credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details.detail || `Recordings unavailable (HTTP ${response.status}). Check backend deployment.`);
        }
        const records = await response.json();
        if (!Array.isArray(records)) throw new Error('The recording API did not return a list.');
        if (controller.signal.aborted) return;
        setItems(records); setError('');
        setSelectedId((previous) => records.some((item) => item.recording_id === previous) ? previous : records[0]?.recording_id || '');
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
      finally { pending = false; }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [isOpen, endpointId, refresh]);
  useEffect(() => {
    setVideoUrl(null); setVideoError(''); setLoading(false);
    if (!isOpen || !selectedId) return;
    const controller = new AbortController();
    let objectUrl;
    setLoading(true);
    fetch(`/api/v1/recordings/${selectedId}/video`, { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details.detail || `Playback failed (HTTP ${response.status})`);
        }
        if (!response.headers.get('content-type')?.startsWith('video/mp4')) throw new Error('The server did not return an MP4.');
        return response.blob();
      }).then((blob) => {
        if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setVideoUrl(objectUrl); }
      }).catch((failure) => { if (!controller.signal.aborted) setVideoError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [isOpen, selectedId]);
  if (!isOpen) return null;
  const selected = items.find((item) => item.recording_id === selectedId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label="Video recordings" className="relative w-full max-w-4xl bg-slate-900 text-white border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex gap-3 items-center"><Film className="w-6 h-6 text-emerald-400" /><div><h2 className="font-bold">Video Recordings</h2><p className="text-xs text-slate-400">{endpointName || 'Select an endpoint'} · Default screen · No audio</p></div></div>
          <button onClick={onClose} aria-label="Close recordings"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-5 space-y-4">
          <div className="flex gap-3 items-center">
            <select aria-label="Choose a recording" className="flex-1 min-w-0 bg-slate-800 rounded-lg p-2 text-sm" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!items.length}>
              {!items.length && <option value="">No uploaded recordings</option>}
              {items.map((item) => <option key={item.recording_id} value={item.recording_id}>{new Date(item.started_at).toLocaleString()} — {item.duration_seconds}s</option>)}
            </select>
            <button onClick={() => setRefresh((value) => value + 1)} aria-label="Refresh recordings" className="p-2 bg-slate-800 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
          <div className="min-h-72 bg-black rounded-lg flex items-center justify-center">
            {videoUrl && !videoError ? <video key={videoUrl} src={videoUrl} controls playsInline preload="metadata" className="w-full max-h-[55vh]" onError={() => setVideoError('This browser could not decode the recording.')} />
              : <p role="status" className="p-8 text-sm text-slate-400 text-center">{loading ? 'Loading and decrypting recording…' : videoError || (error ? 'Recording list unavailable.' : 'No video yet. The agent records a 15-second clip after consent, then every 5 minutes.')}</p>}
          </div>
          {selected && <p className="text-xs text-slate-400">{selected.width} × {selected.height} · {selected.fps} FPS · {selected.duration_seconds} seconds · Encrypted in S3</p>}
          <p className="text-xs text-slate-500">Recorded clips, not a live stream. List refreshes every 10 seconds. Capture stops on pause, revoke, or detected sensitive activity.</p>
        </div>
      </section>
    </div>
  );
}
