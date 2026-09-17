import { useEffect, useState } from 'react';
import { getPublicProgramMap } from '../lib/api';
import type { PublicProgramMapData, Venue } from '../types';
import { ProgramMap } from './ProgramMap';

export function PublicProgramMap() {
  const [data, setData] = useState<PublicProgramMapData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const value = await getPublicProgramMap();
        if (current) { setData(value); setError(false); }
      } catch { if (current) setError(true); }
      finally { pending = false; }
    };
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { current = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [retry]);
  const venues = data?.slots.map(slot => slot.court?.venue).filter((venue): venue is Venue => Boolean(venue)) ?? [];
  return <>
    {error && <div className="inline-state" role="alert">No se pudo actualizar el mapa.<button className="inline-link" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    {!data && !error && <div className="inline-state">Cargando mapa del torneo…</div>}
    {data && !data.detail && <div className="inline-state">No hay un torneo activo para mostrar.</div>}
    {data?.detail && <ProgramMap key={data.detail.id} readOnly detail={data.detail} slots={data.slots} venues={venues} />}
  </>;
}
