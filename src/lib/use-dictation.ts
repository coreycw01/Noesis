"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The browser's own speech recognition, wrapped so a surface can dictate.
 * It is the one place the Web Speech API is touched; both the voice tools on
 * a passage and the dictation control beside a writing surface use it.
 */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function useDictation(onWords: (words: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [notice, setNotice] = useState('');
  const listener = useRef<Recognition | null>(null);
  const append = useRef(onWords);
  useEffect(() => { append.current = onWords; }, [onWords]);

  useEffect(() => {
    const view = window as VoiceWindow;
    setSupported(Boolean(view.SpeechRecognition || view.webkitSpeechRecognition));
    return () => {
      const current = listener.current;
      if (!current) return;
      listener.current = null;
      current.onresult = current.onerror = current.onend = null;
      current.abort();
    };
  }, []);

  const toggle = useCallback(() => {
    if (listener.current) { listener.current.stop(); return; }
    const view = window as VoiceWindow;
    const Recogniser = view.SpeechRecognition || view.webkitSpeechRecognition;
    if (!Recogniser) return;
    const recogniser = new Recogniser();
    listener.current = recogniser;
    recogniser.lang = document.documentElement.lang || navigator.language;
    recogniser.continuous = true;
    recogniser.interimResults = false;
    recogniser.onresult = (event) => {
      if (listener.current !== recogniser) return;
      const words: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        if (event.results[index].isFinal) words.push(event.results[index][0].transcript.trim());
      }
      const said = words.join(' ').trim();
      if (said) append.current(said);
    };
    recogniser.onend = () => { if (listener.current === recogniser) { listener.current = null; setListening(false); } };
    recogniser.onerror = (event) => {
      if (listener.current !== recogniser) return;
      setNotice(event.error === 'not-allowed' ? 'Microphone access was denied. You can still type.' : 'Dictation stopped. You can retry or type instead.');
    };
    setNotice('');
    try { recogniser.start(); setListening(true); }
    catch { listener.current = null; setNotice('Could not start the microphone.'); }
  }, []);

  return { listening, supported, notice, toggle };
}

/**
 * Append dictated words to a controlled field without losing React's state:
 * write through the native value setter, then fire the input event React
 * listens for.
 */
export function appendToField(field: HTMLInputElement | HTMLTextAreaElement, words: string) {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  const next = [field.value.trimEnd(), words].filter(Boolean).join(' ');
  if (setter) setter.call(field, next); else field.value = next;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
