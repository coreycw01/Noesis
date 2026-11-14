'use client';

import { useEffect, useState } from 'react';
import { localDateKey, millisecondsUntilLocalMidnight } from '@/lib/calendar';

export function useLocalDay() {
  const [day, setDay] = useState(() => localDateKey());

  useEffect(() => {
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setDay(localDateKey(now));
      timer = window.setTimeout(update, millisecondsUntilLocalMidnight(now));
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return day;
}
