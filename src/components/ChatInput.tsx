import React, { useRef, useState, useEffect } from 'react';
import {
  Plus,
  Mic,
  MicOff,
  ArrowUp,
  Cloud,
  Wrench,
  Disc,
  Lightbulb,
  X,
  FileCode,
  Image as ImageIcon,
  FileText,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { ACTION_STARTERS, ActionStarter } from '../constants/models';
import { Attachment } from '../types/chat';
import {
  FileAttachmentBadge,
  ImageAttachmentThumbnail,
  ALLOWED_EXTENSIONS,
  ALLOWED_DOC_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
  getFileTypeDetails,
  isDocumentFile,
  isImageFile,
} from './FileAttachmentBadge';
import { ImageLightboxModal } from './ImageLightboxModal';
import { detectTextDirection } from '../utils/textDirection';
import { useAuth } from '../context/AuthContext';

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  isCenteringLayout?: boolean;
  theme?: 'dark' | 'light';
  quotedText?: { text: string; id: number } | null;
  isTyping?: boolean;
}

const DRAFT_STORAGE_KEY = 'chat_input_draft';

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask anything...',
  initialValue = '',
  isCenteringLayout = true,
  theme = 'dark',
  quotedText = null,
  isTyping = false,
}) => {
  const { user } = useAuth();
  const [text, setText] = useState<string>(() => {
    if (initialValue) return initialValue;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved || '';
    } catch {
      return '';
    }
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAttachMenuMounted, setIsAttachMenuMounted] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeStarter, setActiveStarter] = useState<ActionStarter | null>(null);
  const [lightboxAttachment, setLightboxAttachment] = useState<Attachment | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const textRef = useRef<string>(text);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const starterPopoverRef = useRef<HTMLDivElement>(null);

  const openAttachMenu = () => {
    setIsAttachMenuMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAttachMenuOpen(true);
      });
    });
  };

  const closeAttachMenu = () => {
    setIsAttachMenuOpen(false);
    setTimeout(() => {
      setIsAttachMenuMounted(false);
    }, 200);
  };

  const toggleAttachMenu = () => {
    if (isAttachMenuOpen) {
      closeAttachMenu();
    } else {
      openAttachMenu();
    }
  };

  // Keep textRef updated for interval and beforeunload callbacks
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Periodically save unfinished draft to localStorage (every 2 seconds)
  useEffect(() => {
    const saveCurrentDraft = () => {
      try {
        const val = textRef.current;
        if (val && val.trim().length > 0) {
          localStorage.setItem(DRAFT_STORAGE_KEY, val);
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
    };

    const interval = setInterval(saveCurrentDraft, 2000);

    const handleBeforeUnload = () => saveCurrentDraft();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentDraft();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      saveCurrentDraft();
    };
  }, []);

  // Also debounce-save draft after typing pauses (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (text && text.trim().length > 0) {
          localStorage.setItem(DRAFT_STORAGE_KEY, text);
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [text]);

  const isDark = theme === 'dark';

  // Dismiss attachment menu on click outside, window blur, or Escape key
  useEffect(() => {
    if (!isAttachMenuMounted) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        closeAttachMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAttachMenu();
        attachButtonRef.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!attachMenuRef.current) return;
        const items = Array.from(
          attachMenuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
        );
        if (items.length === 0) return;
        e.preventDefault();
        const activeIdx = items.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') {
          const nextIdx = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
          items[nextIdx]?.focus();
        } else {
          const prevIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
          items[prevIdx]?.focus();
        }
      }
    };

    const handleWindowBlur = () => {
      closeAttachMenu();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isAttachMenuMounted]);

  // Dismiss starter popover on click outside, window blur, or Escape key
  useEffect(() => {
    if (!activeStarter) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (starterPopoverRef.current && !starterPopoverRef.current.contains(e.target as Node)) {
        setActiveStarter(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveStarter(null);
      }
    };

    const handleWindowBlur = () => {
      setActiveStarter(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [activeStarter]);

  useEffect(() => {
    if (initialValue) {
      setText(initialValue);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialValue]);

  // Handle incoming quoted text to paste into the prompt edit box
  useEffect(() => {
    if (quotedText && quotedText.text) {
      const quoteString = quotedText.text;
      setText((prev) => {
        if (!prev || !prev.trim()) {
          return quoteString;
        }
        return `${prev.trim()}\n\n${quoteString}`;
      });

      // Auto-focus and place cursor right after the quote
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
          textareaRef.current.style.height = 'auto';
          const scrollHeight = textareaRef.current.scrollHeight;
          textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 40), 200)}px`;
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [quotedText]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 40), 200)}px`;
    }
  }, [text]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Web Speech API Voice-to-Text Input
  const toggleSpeechRecognition = () => {
    setSpeechError(null);

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
      );
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      // Keep track of text before starting dictation
      baseTextRef.current = text.trim();

      recognition.onstart = () => {
        setIsRecording(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        const base = baseTextRef.current;
        const newContent = base ? `${base} ${transcript.trim()}` : transcript.trim();
        setText(newContent);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied. Please allow microphone permissions.');
        } else if (event.error === 'no-speech') {
          // No speech detected, quietly finish
        } else if (event.error !== 'aborted') {
          setSpeechError(`Voice input error: ${event.error}`);
        }
        setIsRecording(false);
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsRecording(false);
      setSpeechError('Could not start microphone. Please check browser permissions.');
      setTimeout(() => setSpeechError(null), 4000);
    }
  };

  // Listen for external focus request (e.g. from hotkeys or reply action)
  useEffect(() => {
    const handleFocusInput = () => {
      textareaRef.current?.focus();
    };
    const handleClearComposer = () => {
      setText('');
      textRef.current = '';
      setAttachments([]);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    };

    window.addEventListener('focus-chat-input', handleFocusInput);
    window.addEventListener('chat-input-clear', handleClearComposer);
    return () => {
      window.removeEventListener('focus-chat-input', handleFocusInput);
      window.removeEventListener('chat-input-clear', handleClearComposer);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      // Blur input so user can move through messages with arrow keys
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' && text.length === 0) {
      // ArrowUp in empty input jumps keyboard focus to latest message
      e.preventDefault();
      e.currentTarget.blur();
      window.dispatchEvent(new CustomEvent('focus-last-message'));
    }
  };

  const handleSubmit = () => {
    // If currently dictating, stop recording on submit
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
    }

    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (disabled) return;

    onSendMessage(trimmed, attachments);

    // If user is authenticated, clear draft normally
    // If user is NOT authenticated, preserve draft and attachments in the input so nothing is lost!
    if (user) {
      setText('');
      textRef.current = '';
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
      setAttachments([]);
      closeAttachMenu();
      setActiveStarter(null);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  /**
   * Process and strictly validate document uploads (PDF, DOC, DOCX, TXT).
   * Rejects images and any unsupported formats.
   */
  const processDocumentFiles = (files: File[] | FileList) => {
    if (!files || files.length === 0) return;

    const invalidFiles: string[] = [];
    const validNewAttachments: Attachment[] = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (!isDocumentFile(file)) {
        invalidFiles.push(file.name);
        return;
      }

      const fileDetails = getFileTypeDetails(file.name);
      const newAttachment: Attachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: fileDetails.type,
        fileExtension: ext,
      };

      if (ext === 'txt') {
        const reader = new FileReader();
        reader.onload = () => {
          newAttachment.content = reader.result as string;
        };
        reader.readAsText(file);
      }

      validNewAttachments.push(newAttachment);
    });

    if (invalidFiles.length > 0) {
      setUploadError(
        `This file type is not supported. Please select a PDF, DOC, DOCX, or TXT file.`
      );
      setTimeout(() => setUploadError(null), 5000);
    }

    if (validNewAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...validNewAttachments]);
    }

    closeAttachMenu();
    if (docFileInputRef.current) {
      docFileInputRef.current.value = '';
    }
  };

  /**
   * Process and strictly validate image uploads (JPG, PNG, WEBP).
   * Rejects documents and any unsupported formats.
   */
  const processImageFiles = (files: File[] | FileList) => {
    if (!files || files.length === 0) return;

    const invalidFiles: string[] = [];
    const validNewAttachments: Attachment[] = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (!isImageFile(file)) {
        invalidFiles.push(file.name);
        return;
      }

      const fileDetails = getFileTypeDetails(file.name);
      const newAttachment: Attachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: 'image',
        fileExtension: ext,
        previewUrl: URL.createObjectURL(file),
      };

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === newAttachment.id
              ? { ...a, previewUrl: dataUrl, content: dataUrl }
              : a
          )
        );
      };
      reader.readAsDataURL(file);

      validNewAttachments.push(newAttachment);
    });

    if (invalidFiles.length > 0) {
      setUploadError(
        `This image format is not supported. Please select a JPG, PNG, or WEBP image.`
      );
      setTimeout(() => setUploadError(null), 5000);
    }

    if (validNewAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...validNewAttachments]);
    }

    closeAttachMenu();
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          filesToProcess.push(file);
        }
      }
    }

    if (filesToProcess.length > 0) {
      processImageFiles(filesToProcess);
    }
  };

  const insertCodeTemplate = () => {
    setText((prev) =>
      prev ? `${prev}\n\`\`\`typescript\n// Paste code here\n\`\`\`\n` : `\`\`\`typescript\n// Paste code here\n\`\`\`\n`
    );
    closeAttachMenu();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleStarterClick = (starter: ActionStarter) => {
    if (activeStarter?.id === starter.id) {
      setActiveStarter(null);
    } else {
      setActiveStarter(starter);
    }
  };

  const applyQuickPrompt = (promptText: string) => {
    setText(promptText);
    setActiveStarter(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const renderStarterIcon = (iconName: ActionStarter['iconName']) => {
    switch (iconName) {
      case 'cloud':
        return <Cloud className="w-3.5 h-3.5" />;
      case 'wrench':
        return <Wrench className="w-3.5 h-3.5" />;
      case 'target':
        return <Disc className="w-3.5 h-3.5" />;
      case 'lightbulb':
        return <Lightbulb className="w-3.5 h-3.5" />;
    }
  };

  const canSubmit = (text.trim().length > 0 || attachments.length > 0) && !disabled;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hidden file input restricted strictly to document types: pdf, docx, doc, txt */}
      <input
        ref={docFileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            processDocumentFiles(e.target.files);
          }
        }}
      />

      {/* Hidden file input restricted strictly to image types: jpg, jpeg, png, webp */}
      <input
        ref={imageFileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            processImageFiles(e.target.files);
          }
        }}
      />

      {/* Upload error banner if unsupported file type is selected */}
      {uploadError && (
        <div className="w-full max-w-2xl mb-2 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Speech error banner */}
      {speechError && (
        <div className="w-full max-w-2xl mb-2 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{speechError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSpeechError(null)}
            className="text-amber-400 hover:text-amber-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Real-time "AI is typing..." indicator */}
      {isTyping && (
        <div className="w-full max-w-2xl flex items-center justify-between mb-1.5 px-1.5 select-none animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 py-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full animate-typing-dot-1 ${
                  isDark ? 'bg-purple-400' : 'bg-purple-600'
                }`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full animate-typing-dot-2 ${
                  isDark ? 'bg-purple-400' : 'bg-purple-600'
                }`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full animate-typing-dot-3 ${
                  isDark ? 'bg-purple-400' : 'bg-purple-600'
                }`}
              />
            </div>
            <span
              className={`text-xs font-medium tracking-tight ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              AI is typing...
            </span>
          </div>
        </div>
      )}

      {/* Main input container */}
      <div
        className={`w-full max-w-2xl rounded-[14px] p-3 transition-all duration-150 relative border shadow-lg ${
          isDark
            ? 'bg-[#27272a] border-[#333338] hover:border-[#3f3f46] focus-within:border-[#52525b]'
            : 'bg-white border-[#e4e4e7] hover:border-neutral-300 focus-within:border-neutral-400 shadow-neutral-100'
        }`}
      >
        {/* Attachment preview area: small thumbnail cards for images, compact badges for files */}
        {attachments.length > 0 && (
          <div
            className={`flex flex-wrap items-center gap-2 mb-2.5 pb-2 border-b ${
              isDark ? 'border-[#323238]' : 'border-neutral-100'
            }`}
          >
            {attachments.map((att) => {
              if (att.type === 'image') {
                return (
                  <ImageAttachmentThumbnail
                    key={att.id}
                    attachment={att}
                    theme={theme}
                    variant="composer"
                    onClick={() => setLightboxAttachment(att)}
                    onRemove={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  />
                );
              }
              return (
                <FileAttachmentBadge
                  key={att.id}
                  attachment={att}
                  theme={theme}
                  onRemove={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                />
              );
            })}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          dir={detectTextDirection(text)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isRecording ? 'Listening to your voice...' : placeholder}
          rows={1}
          disabled={disabled}
          className={`w-full bg-transparent text-sm resize-none focus:outline-none leading-relaxed min-h-[38px] max-h-[220px] ${
            detectTextDirection(text) === 'rtl' ? 'text-right' : 'text-left'
          } ${
            isDark ? 'text-white placeholder-[#9ca3af]' : 'text-neutral-900 placeholder-neutral-400'
          }`}
        />

        {/* Controls row inside input */}
        <div className="flex items-center justify-between mt-2 pt-1">
          {/* Left tools: Plus and Microphone */}
          <div className="flex items-center gap-2">
            {/* Plus / Attachment button */}
            <div
              className="relative"
              ref={attachMenuRef}
              onBlur={(e) => {
                if (
                  attachMenuRef.current &&
                  e.relatedTarget &&
                  !attachMenuRef.current.contains(e.relatedTarget as Node)
                ) {
                  closeAttachMenu();
                }
              }}
            >
              <button
                ref={attachButtonRef}
                type="button"
                onClick={toggleAttachMenu}
                aria-haspopup="menu"
                aria-expanded={isAttachMenuOpen}
                aria-label="Add attachment"
                title="Add attachment (Document or Image)"
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-1 cursor-pointer ${
                  isAttachMenuOpen
                    ? isDark
                      ? 'bg-[#323238] border-purple-500/50 text-white ring-1 ring-purple-500/30'
                      : 'bg-neutral-200 border-purple-500/50 text-neutral-900 ring-1 ring-purple-500/30'
                    : isDark
                    ? 'bg-[#1e1e22] hover:bg-[#323238] border-[#38383e] text-neutral-400 hover:text-white focus-visible:ring-neutral-400'
                    : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-600 hover:text-neutral-900 focus-visible:ring-neutral-500'
                }`}
              >
                <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${isAttachMenuOpen ? 'rotate-45' : ''}`} />
              </button>

              {/* Attachment Popup with Smooth Fade & Scale Animation */}
              {isAttachMenuMounted && (
                <div
                  role="menu"
                  aria-label="Upload options"
                  className={`absolute bottom-10 left-0 z-40 w-max min-w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl p-1.5 space-y-1 border backdrop-blur-md transition-all duration-200 ease-out origin-bottom-left ${
                    isAttachMenuOpen
                      ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
                  } ${
                    isDark
                      ? 'bg-[#18181b]/95 border-[#333338] text-white shadow-black/60 ring-1 ring-white/5'
                      : 'bg-white/95 border-[#e4e4e7] text-neutral-900 shadow-neutral-300/60 ring-1 ring-black/5'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Option 1: Upload Document */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeAttachMenu();
                      docFileInputRef.current?.click();
                    }}
                    className={`w-full flex items-center justify-between gap-3.5 px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                      isDark
                        ? 'text-neutral-300 hover:text-white hover:bg-[#27272a] focus-visible:bg-[#27272a]'
                        : 'text-neutral-700 hover:text-black hover:bg-neutral-100 focus-visible:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium whitespace-nowrap">Upload document</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-500/10 px-1.5 py-0.5 rounded border border-neutral-500/20 shrink-0 whitespace-nowrap">
                      PDF, DOC, TXT
                    </span>
                  </button>

                  {/* Option 2: Upload Image */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeAttachMenu();
                      imageFileInputRef.current?.click();
                    }}
                    className={`w-full flex items-center justify-between gap-3.5 px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                      isDark
                        ? 'text-neutral-300 hover:text-white hover:bg-[#27272a] focus-visible:bg-[#27272a]'
                        : 'text-neutral-700 hover:text-black hover:bg-neutral-100 focus-visible:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium whitespace-nowrap">Upload image</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-500/10 px-1.5 py-0.5 rounded border border-neutral-500/20 shrink-0 whitespace-nowrap">
                      JPG, PNG, WEBP
                    </span>
                  </button>

                  {/* Option 3: Insert Code Block */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeAttachMenu();
                      insertCodeTemplate();
                    }}
                    className={`w-full flex items-center justify-between gap-3.5 px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                      isDark
                        ? 'text-neutral-300 hover:text-white hover:bg-[#27272a] focus-visible:bg-[#27272a]'
                        : 'text-neutral-700 hover:text-black hover:bg-neutral-100 focus-visible:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                        <FileCode className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium whitespace-nowrap">Insert code block</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-500/10 px-1.5 py-0.5 rounded border border-neutral-500/20 shrink-0 whitespace-nowrap">
                      TS/JS
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Microphone Button (Voice-to-Text via Web Speech API) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 cursor-pointer ${
                  isRecording
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse shadow-sm'
                    : isDark
                    ? 'bg-[#1e1e22] hover:bg-[#323238] border-[#38383e] text-neutral-400 hover:text-white focus-visible:ring-neutral-400'
                    : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-600 hover:text-neutral-900 focus-visible:ring-neutral-500'
                }`}
                title={
                  isRecording
                    ? 'Stop listening'
                    : 'Voice-to-text dictation (Web Speech API)'
                }
                aria-label={isRecording ? 'Stop voice recording' : 'Voice-to-text input'}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5" />}
              </button>

              {/* Active Voice Wave / Listening Feedback Indicator */}
              {isRecording && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-mono animate-in fade-in duration-150">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-medium">Listening...</span>
                </div>
              )}
            </div>
          </div>

          {/* Right tool: Up arrow send button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Send message"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 ${
              canSubmit
                ? isDark
                  ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-md transform hover:scale-105 active:scale-95 focus-visible:ring-neutral-400'
                  : 'bg-neutral-900 text-white hover:bg-black cursor-pointer shadow-md transform hover:scale-105 active:scale-95 focus-visible:ring-neutral-700'
                : isDark
                ? 'bg-[#38383e] text-neutral-500 cursor-not-allowed'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Quick Prompt Popover if starter is active */}
      {activeStarter && (
        <div
          ref={starterPopoverRef}
          tabIndex={-1}
          onBlur={(e) => {
            if (
              starterPopoverRef.current &&
              e.relatedTarget &&
              !starterPopoverRef.current.contains(e.relatedTarget as Node)
            ) {
              setActiveStarter(null);
            }
          }}
          className={`w-full max-w-2xl mt-3 p-3 rounded-xl shadow-xl animate-in fade-in duration-150 border outline-none ${
            isDark ? 'bg-[#18181b] border-[#2e2e34]' : 'bg-white border-[#e4e4e7] shadow-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-semibold flex items-center gap-1.5 ${
                isDark ? 'text-white' : 'text-neutral-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              {activeStarter.label} Prompts
            </span>
            <button
              onClick={() => setActiveStarter(null)}
              className="text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {activeStarter.quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyQuickPrompt(qp.prompt)}
                className={`p-2.5 rounded-lg border text-left transition-all group cursor-pointer ${
                  isDark
                    ? 'bg-[#202024] hover:bg-[#27272b] border-[#2b2b31] hover:border-neutral-500'
                    : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <div
                  className={`text-xs font-medium truncate ${
                    isDark ? 'text-neutral-200 group-hover:text-white' : 'text-neutral-800 group-hover:text-black'
                  }`}
                >
                  {qp.title}
                </div>
                <div
                  className={`text-[11px] line-clamp-2 mt-1 leading-normal ${
                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  {qp.prompt}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pill action buttons row directly below input in empty state */}
      {isCenteringLayout && (
        <div className="flex items-center justify-center flex-wrap gap-2 mt-4 select-none">
          {ACTION_STARTERS.map((starter) => {
            const isActive = activeStarter?.id === starter.id;
            return (
              <button
                key={starter.id}
                type="button"
                onClick={() => handleStarterClick(starter)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 ${
                  isDark
                    ? isActive
                      ? 'bg-[#27272a] text-white border-neutral-400 focus-visible:ring-neutral-400'
                      : 'bg-[#18181b] hover:bg-[#27272a] text-neutral-300 hover:text-white border-[#2e2e34] focus-visible:ring-neutral-400'
                    : isActive
                    ? 'bg-neutral-900 text-white border-neutral-900 focus-visible:ring-neutral-700'
                    : 'bg-white hover:bg-neutral-100 text-neutral-700 hover:text-black border-neutral-200 shadow-xs focus-visible:ring-neutral-500'
                }`}
              >
                <span className={isDark ? 'text-neutral-400' : 'text-neutral-500'}>
                  {renderStarterIcon(starter.iconName)}
                </span>
                <span>{starter.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {/* Image Lightbox Modal for enlarged preview in composer */}
      <ImageLightboxModal
        attachment={lightboxAttachment}
        isOpen={!!lightboxAttachment}
        onClose={() => setLightboxAttachment(null)}
        theme={theme}
      />
    </div>
  );
};
