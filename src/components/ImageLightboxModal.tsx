import React, { useEffect, useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Attachment } from '../types/chat';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface ImageLightboxModalProps {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  attachment,
  isOpen,
  onClose,
  theme = 'dark',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const { isMounted, isVisible, backdropClasses, cardClasses } = useModalAnimation({
    isOpen: Boolean(isOpen && attachment),
  });

  // Reset zoom whenever a new image opens
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
    }
  }, [isOpen, attachment?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((prev) => Math.min(prev + 0.25, 3));
      } else if (e.key === '-') {
        setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        setZoomLevel(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isMounted || !attachment) return null;

  const isDark = theme === 'dark';
  const imageUrl = attachment.previewUrl || attachment.content || '';

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = attachment.name || 'image-attachment';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview: ${attachment.name}`}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`relative max-w-5xl w-full max-h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border ${
          isDark
            ? 'bg-[#18181b] border-[#2e2e34] text-white'
            : 'bg-white border-neutral-200 text-neutral-900'
        } ${cardClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
            isDark ? 'border-[#27272a] bg-[#1c1c20]' : 'border-neutral-100 bg-neutral-50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-4">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
                isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {attachment.fileExtension?.toUpperCase() || 'IMAGE'}
            </span>
            <span className="text-xs sm:text-sm font-medium truncate" title={attachment.name}>
              {attachment.name}
            </span>
            {attachment.size && (
              <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                ({attachment.size})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zoom Controls */}
            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border mr-1 ${isDark ? 'border-[#2e2e34] bg-[#222226]' : 'border-neutral-200 bg-neutral-100'}`}>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  zoomLevel <= 0.5 ? 'opacity-40 cursor-not-allowed' : isDark ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-neutral-200 text-neutral-700'
                }`}
                title="Zoom Out (-)"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1.5 text-neutral-400 select-none">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  zoomLevel >= 3 ? 'opacity-40 cursor-not-allowed' : isDark ? 'hover:bg-neutral-700 text-neutral-300' : 'hover:bg-neutral-200 text-neutral-700'
                }`}
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className={`p-1 rounded cursor-pointer transition-colors ${isDark ? 'hover:bg-neutral-700 text-amber-400' : 'hover:bg-neutral-200 text-amber-600'}`}
                  title="Reset Zoom (0)"
                  aria-label="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {imageUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'border-[#2e2e34] hover:bg-[#27272a] text-neutral-300 hover:text-white'
                    : 'border-neutral-200 hover:bg-neutral-100 text-neutral-600 hover:text-black'
                }`}
                title="Download image"
                aria-label="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#2e2e34] hover:bg-[#27272a] text-neutral-400 hover:text-white'
                  : 'border-neutral-200 hover:bg-neutral-100 text-neutral-500 hover:text-black'
              }`}
              title="Close preview (Esc)"
              aria-label="Close image preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image viewport */}
        <div className="flex-1 min-h-[300px] max-h-[78vh] flex items-center justify-center p-4 overflow-auto bg-black/30 select-none">
          {imageUrl ? (
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center max-w-full max-h-full"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={imageUrl}
                alt={attachment.name || 'Attached preview'}
                className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-2xl"
                draggable={false}
              />
            </div>
          ) : (
            <div className="text-xs text-neutral-400 py-12">Image preview unavailable</div>
          )}
        </div>
      </div>
    </div>
  );
};
