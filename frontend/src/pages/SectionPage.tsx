import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getPublicPosts, getPublicCurrentTournament } from '../lib/api';
import { sectionMeta } from '../lib/content';
import type { ContentPost, ContentSection, PublicCurrentTournament } from '../types';

export function SectionPage() {
  const { section } = useParams<{ section: ContentSection }>();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTournament, setCurrentTournament] = useState<PublicCurrentTournament | null>(null);

  if (!section || !(section in sectionMeta)) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    getPublicPosts({ section })
      .then(setPosts)
      .finally(() => setLoading(false));
    if (section === 'torneos') getPublicCurrentTournament().then(setCurrentTournament);
  }, [section]);

  return (
    <section className="content-band section-page">
      <div className="section-heading">
        <p className="eyebrow">{sectionMeta[section].label}</p>
        <h1>{sectionMeta[section].intro}</h1>
      </div>
      {section === 'torneos' && currentTournament?.tournament ? <CurrentTournament tournament={currentTournament} /> : null}
      {loading ? (
        <div className="inline-state">Cargando publicaciones...</div>
      ) : posts.length === 0 ? (
        <div className="inline-state">No hay publicaciones publicadas en esta seccion.</div>
      ) : (
        <div className="post-grid">
          {posts.map((post) => (
            <article key={post.id} className="post-card">
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <Link to={`/post/${post.slug}`} className="inline-link">
                Leer nota
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CurrentTournament({ tournament: current }: { tournament: PublicCurrentTournament }) {
  const [tab, setTab] = useState<'results' | 'standings' | 'courts'>('results');
  const tournament = current.tournament;
  if (!tournament) return null;

  return <section className="public-tournament">
    <div className="public-tournament-heading">
      <div><p className="eyebrow">Torneo en curso</p><h2>{tournament.name}</h2><p>{formatDates(tournament.startsAt, tournament.endsAt)}{tournament.city ? ` · ${tournament.city}` : ''}</p></div>
      <span className="status-chip status-live">En juego</span>
    </div>
    <div className="public-tournament-tabs" role="tablist" aria-label="Informacion del torneo">
      <button type="button" className={tab === 'results' ? 'is-selected' : ''} onClick={() => setTab('results')}>Resultados</button>
      <button type="button" className={tab === 'standings' ? 'is-selected' : ''} onClick={() => setTab('standings')}>Tabla</button>
      <button type="button" className={tab === 'courts' ? 'is-selected' : ''} onClick={() => setTab('courts')}>Canchas</button>
    </div>
    {tab === 'results' ? <div className="tournament-zone-grid">{tournament.zones.map((zone) => <article key={zone.id} className="tournament-public-card"><p className="post-section">{zone.category} · {zone.name}</p><h3>{zone.court.name}</h3>{zone.matches.length ? <ul className="match-list">{zone.matches.map((match) => <li key={match.id}><div><strong>{teamName(match.homeRegistration)}</strong><span>{teamName(match.awayRegistration)}</span></div><div className="match-score">{match.homeScore === null || match.awayScore === null ? 'Pendiente' : `${match.homeScore} - ${match.awayScore}`}<small>{formatMatchDate(match.scheduledAt)}</small></div></li>)}</ul> : <p className="empty-copy">Fixture en preparacion.</p>}</article>)}</div> : null}
    {tab === 'standings' ? <div className="tournament-zone-grid">{tournament.zones.map((zone) => <article key={zone.id} className="tournament-public-card standings-card"><p className="post-section">{zone.category} · {zone.name}</p><h3>Tabla de posiciones</h3>{zone.standings.length ? <div className="public-table-wrap"><table className="public-table"><thead><tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>Dif.</th><th>Pts.</th></tr></thead><tbody>{zone.standings.map((row) => <tr key={row.registration.id}><td>{teamName(row.registration)}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.pointsFor - row.pointsAgainst}</td><td><strong>{row.tablePoints}</strong></td></tr>)}</tbody></table></div> : <p className="empty-copy">Todavia no hay equipos asignados.</p>}</article>)}</div> : null}
    {tab === 'courts' ? <div className="court-public-grid">{current.courts.length ? current.courts.map((court) => <article key={court.id} className="court-public-card"><p className="post-section">Cancha habilitada</p><h3>{court.name}</h3><p>{[court.address, court.city, court.provinceName].filter(Boolean).join(', ') || 'Ubicacion a confirmar'}</p><a className="inline-link" href={googleMapsLink(court)} target="_blank" rel="noreferrer">Abrir en Google Maps</a></article>) : <p className="empty-copy">No hay canchas asignadas todavia.</p>}</div> : null}
  </section>;
}

function teamName(registration: { playerOneName: string; playerTwoName: string; localityName: string } | null) { return registration ? `${registration.playerOneName} / ${registration.playerTwoName} · ${registration.localityName}` : 'A definir'; }
function formatDates(startsAt: string | null, endsAt: string | null) { if (!startsAt) return 'Fechas a confirmar'; return endsAt && endsAt !== startsAt ? `${startsAt} al ${endsAt}` : startsAt; }
function formatMatchDate(value: string | null) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : ''; }
function googleMapsLink(court: { name: string; address: string | null; city: string | null; provinceName: string | null }) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([court.name, court.address, court.city, court.provinceName].filter(Boolean).join(', '))}`; }
