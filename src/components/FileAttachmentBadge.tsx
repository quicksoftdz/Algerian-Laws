import React from 'react';
import { Image as ImageIcon, FileText, FileCode, File, X, ZoomIn } from 'lucide-react';
import { Attachment } from '../types/chat';

export const ALLOWED_DOC_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt'];
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
export const ALLOWED_EXTENSIONS = [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_DOC_EXTENSIONS];

export function isDocumentFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) return false;
  if (file.type && !file.type.startsWith('text/') && !file.type.startsWith('application/')) {
    return false;
  }
  return true;
}

export function isImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return false;
  if (file.type && !file.type.startsWith('image/')) {
    return false;
  }
  return true;
}

export function getFileTypeDetails(fileName: string): {
  type: 'image' | 'pdf' | 'doc' | 'txt' | 'file';
  extension: string;
  badgeLabel: string;
  badgeColorDark: string;
  badgeColorLight: string;
  iconColor: string;
} {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return {
      type: 'image',
      extension,
      badgeLabel: extension.toUpperCase(),
      badgeColorDark: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      badgeColorLight: 'bg-amber-50 text-amber-700 border-amber-200',
      iconColor: 'text-amber-400',
    };
  }

  if (extension === 'pdf') {
    return {
      type: 'pdf',
      extension,
      badgeLabel: 'PDF',
      badgeColorDark: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      badgeColorLight: 'bg-rose-50 text-rose-700 border-rose-200',
      iconColor: 'text-rose-400',
    };
  }

  if (['docx', 'doc'].includes(extension)) {
    return {
      type: 'doc',
      extension,
      badgeLabel: extension.toUpperCase(),
      badgeColorDark: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      badgeColorLight: 'bg-sky-50 text-sky-700 border-sky-200',
      iconColor: 'text-sky-400',
    };
  }

  if (extension === 'txt') {
    return {
      type: 'txt',
      extension,
      badgeLabel: 'TXT',
      badgeColorDark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      badgeColorLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconColor: 'text-emerald-400',
    };
  }

  return {
    type: 'file',
    extension,
    badgeLabel: extension ? extension.toUpperCase() : 'FILE',
    badgeColorDark: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
    badgeColorLight: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    iconColor: 'text-neutral-400',
  };
}

interface FileAttachmentBadgeProps {
  attachment: Attachment;
  onRemove?: () => void;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md';
}

export const FileAttachmentBadge: React.FC<FileAttachmentBadgeProps> = ({
  attachment,
  onRemove,
  theme = 'dark',
  size = 'md',
}) => {
  const isDark = theme === 'dark';
  const details = getFileTypeDetails(attachment.name);

  const renderIcon = () => {
    switch (details.type) {
      case 'image':
        if (attachment.previewUrl || attachment.content) {
          return (
            <img
              src={attachment.previewUrl || attachment.content}
              alt={attachment.name}
              className="w-4 h-4 rounded object-cover"
            />
          );
        }
        return <ImageIcon className={`w-3.5 h-3.5 ${details.iconColor}`} />;

      case 'pdf':
      case 'doc':
        return <FileText className={`w-3.5 h-3.5 ${details.iconColor}`} />;

      case 'txt':
        return <FileCode className={`w-3.5 h-3.5 ${details.iconColor}`} />;

      default:
        return <File className={`w-3.5 h-3.5 ${details.iconColor}`} />;
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border font-mono transition-all ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${
        isDark
          ? 'bg-[#1e1e22] border-[#2e2e34] text-neutral-200 shadow-xs'
          : 'bg-white border-neutral-200 text-neutral-800 shadow-xs'
      }`}
    >
      <div className="shrink-0 flex items-center">{renderIcon()}</div>

      {/* Extension Tag */}
      <span
        className={`px-1 py-0.2 rounded text-[9px] font-bold tracking-wider border uppercase ${
          isDark ? details.badgeColorDark : details.badgeColorLight
        }`}
      >
        {details.badgeLabel}
      </span>

      {/* File Name */}
      <span className="truncate max-w-[120px] font-sans text-[11px]" title={attachment.name}>
        {attachment.name}
      </span>

      {/* Optional File Size */}
      {attachment.size && (
        <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">
          {attachment.size}
        </span>
      )}

      {/* Remove Button if provided */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${attachment.name}`}
          className="text-neutral-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer ml-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

interface ImageAttachmentThumbnailProps {
  attachment: Attachment;
  onRemove?: () => void;
  onClick?: () => void;
  theme?: 'dark' | 'light';
  variant?: 'composer' | 'message';
}

export const ImageAttachmentThumbnail: React.FC<ImageAttachmentThumbnailProps> = ({
  attachment,
  onRemove,
  onClick,
  theme = 'dark',
  variant = 'composer',
}) => {
  const isDark = theme === 'dark';
  const imgUrl = attachment.previewUrl || attachment.content || '';

  if (variant === 'composer') {
    return (
      <div
        className={`group relative flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border transition-all ${
          isDark
            ? 'bg-[#1e1e22] hover:bg-[#24242a] border-[#38383e] hover:border-neutral-500 text-neutral-200'
            : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-800'
        }`}
      >
        {/* Clickable area for full-size expanded view */}
        <div
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          onKeyDown={
            onClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                  }
                }
              : undefined
          }
          className={`flex items-center gap-2.5 min-w-0 ${onClick ? 'cursor-pointer' : ''}`}
          title={onClick ? `Click to view full size (${attachment.name})` : undefined}
        >
          {/* Compact Thumbnail 48-52px */}
          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-neutral-700/30 bg-black/20 shrink-0 flex items-center justify-center group/thumb">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={attachment.name || 'Attachment thumbnail'}
                className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-neutral-400" />
            )}
            {onClick && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                <ZoomIn className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Info Column */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span
                className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold tracking-wider border uppercase ${
                  isDark
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                {attachment.fileExtension?.toUpperCase() || 'IMAGE'}
              </span>
              {attachment.size && (
                <span className="text-[10px] text-neutral-400 font-mono">
                  {attachment.size}
                </span>
              )}
            </div>
            <span
              className="text-xs font-medium truncate max-w-[130px] sm:max-w-[180px] mt-0.5 group-hover:text-amber-400 transition-colors"
              title={attachment.name}
            >
              {attachment.name}
            </span>
          </div>
        </div>

        {/* Remove Button */}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remove image attachment ${attachment.name}`}
            title="Remove image attachment"
            className={`ml-1 p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
              isDark
                ? 'text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10'
                : 'text-neutral-500 hover:text-rose-600 hover:bg-rose-50'
            }`}
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        )}
      </div>
    );
  }

  // Variant: 'message' (in sent chat bubble)
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer select-none max-w-xs ${
        isDark
          ? 'bg-[#18181b] border-[#38383e] hover:border-neutral-400 shadow-md'
          : 'bg-white border-neutral-200 hover:border-neutral-400 shadow-xs'
      }`}
      title={`Click to view ${attachment.name}`}
    >
      <div className="relative max-h-48 min-w-[140px] flex items-center justify-center bg-black/10 overflow-hidden">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={attachment.name || 'Attached image'}
            className="w-full max-h-48 object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="p-4 flex items-center gap-2 text-neutral-400">
            <ImageIcon className="w-5 h-5" />
            <span className="text-xs">{attachment.name}</span>
          </div>
        )}

        {/* Zoom overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[2px]">
          <ZoomIn className="w-4 h-4" />
          <span>View Image</span>
        </div>
      </div>

      {/* Bottom compact label */}
      <div
        className={`px-2.5 py-1 flex items-center justify-between text-[11px] border-t ${
          isDark ? 'bg-[#1c1c20] border-[#2b2b31] text-neutral-300' : 'bg-neutral-50 border-neutral-100 text-neutral-700'
        }`}
      >
        <span className="truncate max-w-[150px] font-medium" title={attachment.name}>
          {attachment.name}
        </span>
        {attachment.size && (
          <span className="text-[10px] text-neutral-400 font-mono ml-2 shrink-0">
            {attachment.size}
          </span>
        )}
      </div>
    </div>
  );
};
