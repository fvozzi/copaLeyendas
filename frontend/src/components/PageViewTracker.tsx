import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordPageView } from '../lib/api';

const VISITOR_KEY = 'copa_leyendas_analytics_visitor';
let fallbackVisitorId: string | null = null;

export function PageViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (navigator.doNotTrack === '1') return;
    void recordPageView({ path: pathname, visitorId: visitorId(), referrer: document.referrer || undefined }).catch(() => undefined);
  }, [pathname]);

  return null;
}

function visitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = newVisitorId();
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    fallbackVisitorId ??= newVisitorId();
    return fallbackVisitorId;
  }
}

function newVisitorId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
