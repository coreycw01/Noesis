
'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../provider';

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { if (active) setUnavailable(true); }, 10_000);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      window.clearTimeout(timer);
      setUser(user);
      setUnavailable(false);
      setLoading(false);
    }, () => {
      if (!active) return;
      window.clearTimeout(timer);
      setUser(null);
      setUnavailable(true);
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [auth, attempt]);

  const retry = () => {
    setLoading(true);
    setUnavailable(false);
    setAttempt((value) => value + 1);
  };
  return { user, loading, unavailable, retry };
}
