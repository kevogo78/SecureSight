import React, { useEffect } from 'react';
import { X, ExternalLink, ShieldCheck, Calendar, HardDrive, Hash } from 'lucide-react';

export default function ScreenshotModal({ capture, onClose }) {
  // Close modal when pressing the Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!capture) return null;

  const formattedDate = capture.timestamp
    ? new Date(capture.timestamp).toLocaleString()
    : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      {/* Background click overlay */}
      <div className="fixed inset-0" onClick={onClose}></div>

      {/* Modal Content Window */}
      <div className="relative z-10 w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <HardDrive className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">Media Evidence Viewer</h3>
              <p className="text-xs text-slate-400">
                Log ID: #{capture.log_id} &bull; Endpoint: Node-{capture.endpoint_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Image Viewport */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center bg-slate-950/50">
          {capture.media_url ? (
            <div className="relative group rounded-lg overflow-hidden border border-slate-800 max-h-[55vh]">
              <img
                src={capture.media_url}
                alt={`Capture for Log ${capture.log_id}`}
                className="w-full h-auto object-contain max-h-[55vh] rounded"
              />
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 border border-slate-700 rounded px-2.5 py-1 text-[11px] text-slate-300">
                Encrypted at Source (AES-256-GCM)
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm font-medium">No decrypted media buffer available.</p>
              <p className="text-xs mt-1">Capture may have been redacted or expired by lifecycle policy.</p>
            </div>
          )}
        </div>

        {/* Modal Metadata Footer */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Status: <strong className="text-slate-200">{capture.filter_status || 'Clean'}</strong></span>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <Hash className="w-4 h-4 text-slate-500" />
              <span className="font-mono truncate max-w-[180px]">App: {capture.active_app}</span>
            </div>
          </div>

          {capture.media_url && (
            <a
              href={capture.media_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
            >
              <span>Open Raw Presigned Asset</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}