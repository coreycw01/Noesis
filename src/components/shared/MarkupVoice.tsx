'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDictation } from '@/lib/use-dictation';

export function MarkupVoice({ text, onTranscript }: { text: string; onTranscript: (words: string) => void }) {
  const [reading, setReading] = useState(false);
  const [canRead, setCanRead] = useState(false);
  const [readNotice, setReadNotice] = useState('');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const { listening, supported: canDictate, notice: dictationNotice, toggle: dictate } = useDictation(onTranscript);

  useEffect(() => {
    setCanRead(Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance));
    return () => { if (utterance.current) { utterance.current = null; window.speechSynthesis.cancel(); } };
  }, []);

  function read() {
    if (reading) { utterance.current = null; window.speechSynthesis.cancel(); setReading(false); return; }
    const spoken = new SpeechSynthesisUtterance(text.trim());
    spoken.lang = document.documentElement.lang || navigator.language;
    utterance.current = spoken;
    const finish = () => { if (utterance.current === spoken) { utterance.current = null; setReading(false); } };
    spoken.onend = finish;
    spoken.onerror = () => { if (utterance.current === spoken) { finish(); setReadNotice('Playback stopped. Try reading aloud again.'); } };
    setReadNotice(''); setReading(true); window.speechSynthesis.speak(spoken);
  }

  return <div className="space-y-1">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Markup voice tools">
      <Button type="button" variant="ghost" size="sm" onClick={read} disabled={!canRead || listening || (!text.trim() && !reading)} title={canRead ? 'Read the passage aloud' : 'Playback unavailable in this browser'}>
        {reading ? <Square /> : <Volume2 />}{reading ? 'Stop reading' : 'Read aloud'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={dictate} disabled={!canDictate || reading} title={canDictate ? 'Dictate into your note' : 'Dictation unavailable in this browser'}>
        {listening ? <Square /> : <Mic />}{listening ? 'Stop dictation' : 'Dictate note'}
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">{canDictate ? 'Dictation uses your browser\u2019s speech service.' : 'Browser dictation unavailable. You can type or use keyboard dictation.'}</p>
    <span role="status" className="text-xs">{dictationNotice || readNotice || (listening ? 'Listening\u2026' : '')}</span>
  </div>;
}
