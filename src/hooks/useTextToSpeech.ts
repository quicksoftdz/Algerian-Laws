import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Strips markdown symbols, code blocks, raw URLs, and formatting
 * so the Web Speech API reads natural, clean language aloud.
 */
export function cleanMarkdownForSpeech(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Replace code blocks with a brief spoken descriptor
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' [code snippet omitted] ');

  // Replace inline code `varName` with varName
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Replace markdown links [anchor](url) with just anchor
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Replace markdown images ![alt](url) with nothing
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Remove markdown headers #, ##, ###
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // Remove bold / italic markers (*, **, _, __)
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove blockquote > symbols
  cleaned = cleaned.replace(/^>\s+/gm, '');

  // Remove bullet points / dashes
  cleaned = cleaned.replace(/^[-*+]\s+/gm, '');

  // Remove horizontal rules
  cleaned = cleaned.replace(/^([-*_]){3,}\s*$/gm, '');

  // Collapse multiple whitespaces and line breaks
  cleaned = cleaned.replace(/\n{2,}/g, '. ').replace(/\n/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

export function useTextToSpeech() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      setIsSupported(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.debug('Speech synthesis cancel error', e);
      }
    }
    utteranceRef.current = null;
    setSpeakingId(null);
    setIsPaused(false);
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }

      // If currently speaking this message, toggle stop
      if (speakingId === id) {
        stop();
        return;
      }

      // Stop any existing speech
      stop();

      const cleanedText = cleanMarkdownForSpeech(text);
      if (!cleanedText) return;

      try {
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to pick a natural English voice if available
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const naturalEn = voices.find(
            (v) => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural')) && v.lang.startsWith('en')
          );
          const defaultEn = voices.find((v) => v.lang.startsWith('en'));
          if (naturalEn) {
            utterance.voice = naturalEn;
          } else if (defaultEn) {
            utterance.voice = defaultEn;
          }
        }

        utterance.onstart = () => {
          setSpeakingId(id);
          setIsPaused(false);
        };

        utterance.onend = () => {
          setSpeakingId(null);
          setIsPaused(false);
          utteranceRef.current = null;
        };

        utterance.onerror = (e) => {
          // If cancelled intentionally, ignore
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.debug('Speech synthesis error:', e);
          }
          setSpeakingId(null);
          setIsPaused(false);
          utteranceRef.current = null;
        };

        utterance.onpause = () => {
          setIsPaused(true);
        };

        utterance.onresume = () => {
          setIsPaused(false);
        };

        utteranceRef.current = utterance;
        setSpeakingId(id);

        // Resume if suspended before speaking
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Failed to trigger speech synthesis:', err);
        setSpeakingId(null);
        setIsPaused(false);
      }
    },
    [speakingId, stop]
  );

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    speak,
    stop,
    speakingId,
    isPaused,
    isSupported,
  };
}
