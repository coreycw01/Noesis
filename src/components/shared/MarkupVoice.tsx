'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function MarkupVoice({ text, onTranscript }: { text: string; onTranscript: (words: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'reading' | 'listening'>('idle');
  const [notice, setNotice] = useState('');
  const [support, setSupport] = useState({ read: false, dictate: false });
  const listener = useRef<Recognition | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const append = useRef(onTranscript);
  useEffect(() => { append.current = onTranscript; }, [onTranscript]);
  useEffect(() => {
    const w = window as VoiceWindow;
    setSupport({ read: Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance), dictate: Boolean(w.SpeechRecognition || w.webkitSpeechRecognition) });
    return () => {
      if (listener.current) {
        const r = listener.current; listener.current = null;
        r.onresult = r.onerror = r.onend = null; r.abort();
      }
      if (utterance.current) {
        utterance.current = null; window.speechSynthesis.cancel();
      }
    };
  }, []);
  const language = () => document.documentElement.lang || navigator.language;
  function read() {
    if (mode === 'reading') { utterance.current = null; window.speechSynthesis.cancel(); setMode('idle'); return; }
    const u = new SpeechSynthesisUtterance(text.trim()); u.lang = language(); utterance.current = u;
    const finish = () => { if (utterance.current === u) { utterance.current = null; setMode('idle'); } };
    u.onend = finish;
    u.onerror = () => { if (utterance.current === u) { finish(); setNotice('Playback stopped. Try reading aloud again.'); } };
    setNotice(''); setMode('reading'); window.speechSynthesis.speak(u);
  }
  function dictate() {
    if (listener.current) { listener.current.stop(); return; }
    const w = window as VoiceWindow; const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor(); listener.current = r; r.lang = language(); r.continuous = true; r.interimResults = false;
    r.onresult = e => {
      if (listener.current !== r) return;
      const words: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) words.push(e.results[i][0].transcript.trim());
      if (words.join(' ').trim()) append.current(words.join(' ').trim());
    };
    r.onend = () => { if (listener.current === r) { listener.current = null; setMode('idle'); } };
    r.onerror = e => { if (listener.current === r) setNotice(e.error === 'not-allowed' ? 'Microphone access was denied. You can still type your note.' : 'Dictation stopped. You can retry or type your note.'); };
    setNotice('');
    try { r.start(); setMode('listening'); } catch { listener.current = null; setNotice('Could not start the microphone.'); }
  }
  return <div className="space-y-1">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Markup voice tools">
      <Button type="button" variant="ghost" size="sm" onClick={read} disabled={!support.read || mode === 'listening' || (!text.trim() && mode !== 'reading')} title={support.read ? 'Read the passage aloud' : 'Playback unavailable in this browser'}>
        {mode === 'reading' ? <Square /> : <Volume2 />}{mode === 'reading' ? 'Stop reading' : 'Read aloud'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={dictate} disabled={!support.dictate || mode === 'reading'} title={support.dictate ? 'Dictate into your note' : 'Dictation unavailable in this browser'}>
        {mode === 'listening' ? <Square /> : <Mic />}{mode === 'listening' ? 'Stop dictation' : 'Dictate note'}
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">{support.dictate ? 'Dictation uses your browser’s speech service.' : 'Browser dictation unavailable. You can type or use keyboard dictation.'}</p>
    <span role="status" className="text-xs">{notice || (mode === 'listening' ? 'Listening…' : '')}</span>
  </div>;
}
