import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PublicProgramMap } from '../components/PublicProgramMap';
import { getPublicCurrentTournament, getPublicPosts } from '../lib/api';
import { getTournamentEdition, normalizeSearchText } from '../lib/tournament-editions';
import type { ContentPost, PublicCurrentTournament, PublicTournamentZone } from '../types';

type EditionTab = 'legend' | 'photos' | 'results';

const regulations = ['Partidos en zona de grupos y finales a 25. Cuartos y semifinales a 21.', 'Cada pareja dispone de 2 minutos por partido, con flexibilidad ante la necesidad.', 'En caso de lesión se podrá realizar un cambio por un jugador del mismo club o ciudad que esté jugando el torneo en una categoría igual o inferior.', 'Es obligatorio el uso de protectores oculares.', 'Se informará el horario de inicio de cada partido. Los equipos tendrán 15 minutos de tolerancia antes de darles el encuentro por perdido.', 'Sistema de desempate por diferencia de puntos, seguido por el encuentro disputado entre sí. De persistir la igualdad, se define por moneda.', 'El saque se jugará con media.', 'El saque en Núcleo se hará del 2 a pasar el 2. En Goma del 3 a pasar el 3.'];

export function TournamentEditionPage() {
  const { edition: editionSlug } = useParams<{ edition: string }>();
  const edition = getTournamentEdition(editionSlug);
  const [tab, setTab] = useState<EditionTab>('results');
  const [legendPosts, setLegendPosts] = useState<ContentPost[]>([]);
  const [legendLoading, setLegendLoading] = useState(true);
  const [currentTournament, setCurrentTournament] = useState<PublicCurrentTournament | null>(null);
  const [tournamentError, setTournamentError] = useState<string | null>(null);

  useEffect(() => {
    getPublicPosts({ section: 'leyendas' })
      .then(setLegendPosts)
      .catch(() => setLegendPosts([]))
      .finally(() => setLegendLoading(false));
  }, []);

  useEffect(() => {
    if (!edition?.usesLiveTournament) return;
    getPublicCurrentTournament()
      .then(setCurrentTournament)
      .catch(() => setTournamentError('No se pudo cargar la información del torneo actual.'));
  }, [edition?.usesLiveTournament]);

  const legendPost = useMemo(() => {
    if (!edition) return undefined;
    return legendPosts.find((post) => {
      const searchable = normalizeSearchText(`${post.title} ${post.excerpt} ${post.body}`);
      return edition.legendSearchTerms.some((term) => searchable.includes(term));
    });
  }, [edition, legendPosts]);

  if (!edition) return <Navigate to="/secciones/torneos" replace />;

  return (
    <section className={`content-band tournament-edition-page ${edition.specialEdition ? 'is-femme' : ''}`}>
      <Link to="/secciones/torneos" className="inline-link tournament-back-link">← Todas las ediciones</Link>
      <header className="edition-hero">
        <div>
          <p className="eyebrow">{edition.status === 'finished' ? 'Edición finalizada' : 'Próxima edición'}</p>
          <h1>{edition.name}</h1>
          <p>{edition.summary}</p>
          <div className="edition-meta">
            <span>{edition.dateLabel}</span>
            <span>Leyenda: {edition.legendName}</span>
          </div>
        </div>
        {edition.specialEdition && <img src="/LogoFemme.png" alt="Copa Leyendas Femme" />}
      </header>

      <nav className="edition-tabs" aria-label={`Contenido de ${edition.name}`}>
        <button type="button" className={tab === 'legend' ? 'is-selected' : ''} onClick={() => setTab('legend')}>Leyenda</button>
        <button type="button" className={tab === 'photos' ? 'is-selected' : ''} onClick={() => setTab('photos')}>Fotos</button>
        <button type="button" className={tab === 'results' ? 'is-selected' : ''} onClick={() => setTab('results')}>Resultados</button>
      </nav>

      <div className="edition-tab-panel">
        {tab === 'legend' && <LegendSection name={edition.legendName} post={legendPost} loading={legendLoading} />}
        {tab === 'photos' && <PhotoSection name={edition.name} photos={edition.photos} />}
        {tab === 'results' && (edition.usesLiveTournament
          ? <LiveResults current={currentTournament} error={tournamentError} />
          : <HistoricalResults editionName={edition.name} finals={edition.finals} />)}
      </div>

      {edition.specialEdition && <TournamentRegulations />}
    </section>
  );
}

function LegendSection({ name, post, loading }: { name: string; post?: ContentPost; loading: boolean }) {
  if (loading) return <div className="inline-state">Cargando la nota de la leyenda...</div>;
  if (!post) return <div className="edition-empty"><p className="eyebrow">Leyenda de la edición</p><h2>{name}</h2><p>La nota todavía no está publicada. Cuando se publique en Leyendas aparecerá también acá automáticamente.</p><Link to="/secciones/leyendas" className="inline-link">Ir a Leyendas</Link></div>;
  return <article className="edition-legend-article"><p className="eyebrow">Leyenda de la edición</p><h2>{post.title}</h2><p className="article-excerpt">{post.excerpt}</p><div className="article-body">{post.body}</div><Link to={`/post/${post.slug}`} className="inline-link">Abrir nota completa</Link></article>;
}

function PhotoSection({ name, photos }: { name: string; photos: { src: string; alt: string }[] }) {
  if (!photos.length) return <div className="edition-empty"><p className="eyebrow">Archivo fotográfico</p><h2>Fotos de {name}</h2><p>La galería está preparada y se completará cuando estén seleccionadas las fotos de esta edición.</p></div>;
  return <section><div className="edition-panel-heading"><p className="eyebrow">Archivo fotográfico</p><h2>Fotos de {name}</h2><p>{photos.length} fotos de esta edición. Abrí una foto para verla en tamaño completo.</p></div><div className="edition-photo-grid">{photos.map((photo) => <figure key={photo.src}><a href={photo.src} target="_blank" rel="noreferrer"><img src={photo.src} alt={photo.alt} loading="lazy" /></a><figcaption>{photo.alt}</figcaption></figure>)}</div></section>;
}

function HistoricalResults({ editionName, finals }: { editionName: string; finals: { category: string; champion: { locality: string; players: string }; finalist: { locality: string; players: string } }[] }) {
  return <section className="historical-results"><div className="edition-panel-heading"><p className="eyebrow">Finales</p><h2>Resultados de {editionName}</h2><p>Campeones y finalistas de cada categoría.</p></div><div className="historical-results-grid">{finals.map((final) => <article key={final.category} className="historical-final-card"><p className="historical-category">{final.category} final</p><div className="historical-team is-champion"><span>Campeones</span><strong>{final.champion.locality}</strong><p>{final.champion.players}</p></div><div className="historical-versus">vs.</div><div className="historical-team"><span>Finalistas</span><strong>{final.finalist.locality}</strong><p>{final.finalist.players}</p></div></article>)}</div></section>;
}

function LiveResults({ current, error }: { current: PublicCurrentTournament | null; error: string | null }) {
  if (error) return <div className="inline-state">{error}</div>;
  if (!current) return <div className="inline-state">Cargando torneo...</div>;
  if (!current.tournament) return <div className="edition-empty"><p className="eyebrow">Noviembre 2026</p><h2>Resultados próximamente</h2><p>El fixture y los resultados se publicarán desde la organización del torneo.</p></div>;
  return <CurrentTournament tournament={current} />;
}

function TournamentRegulations() { return <section className="tournament-regulations" aria-labelledby="reglamento-title"><div className="tournament-regulations-heading"><div><p className="eyebrow">Copa Leyendas Femme</p><h2 id="reglamento-title">Reglamento</h2></div><img src="/LogoFemme.png" alt="Copa Leyendas Femme" /></div><ol>{regulations.map((rule) => <li key={rule}>{rule}</li>)}</ol></section>; }

function CurrentTournament({ tournament: current }: { tournament: PublicCurrentTournament }) {
  const [tab, setTab] = useState<'results' | 'courts' | 'map'>('results'); const tournament = current.tournament!; const categories = [...new Set(tournament.zones.map((zone) => zone.category))]; const [category, setCategory] = useState(categories[0] ?? ''); const state = getTournamentState(tournament.startsAt, tournament.endsAt); const zones = tournament.zones.filter((zone) => zone.category === category);
  return <section className="public-tournament public-tournament-femme"><div className="public-tournament-heading"><div><p className="eyebrow">{state.heading}</p><h2>{tournament.name}</h2><p className={state.live ? 'tournament-date is-live' : 'tournament-date'}>{state.live && <span className="live-dot" />}{formatDates(tournament.startsAt, tournament.endsAt)}{tournament.city ? ` · ${tournament.city}` : ''}</p></div><img className="public-tournament-logo" src="/LogoFemme.png" alt="Copa Leyendas Femme" /><span className={`status-chip ${state.live ? 'status-live tournament-live-chip' : 'status-review'}`}>{state.label}</span></div><div className="public-tournament-tabs"><button type="button" className={tab === 'results' ? 'is-selected' : ''} onClick={() => setTab('results')}>Resultados</button><button type="button" className={tab === 'courts' ? 'is-selected' : ''} onClick={() => setTab('courts')}>Canchas</button><button type="button" className={tab === 'map' ? 'is-selected' : ''} onClick={() => setTab('map')}>Mapa</button></div>{tab === 'results' ? <><div className="public-category-tabs">{categories.map((item) => <button key={item} type="button" className={category === item ? 'is-selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="tournament-zone-grid">{zones.map((zone) => <ZoneResults key={zone.id} zone={zone} />)}</div><KnockoutBracket category={category} /></> : tab === 'map' ? <PublicProgramMap /> : <div className="court-public-grid">{current.courts.length ? current.courts.map((court) => <article key={court.id} className="court-public-card"><p className="post-section">Cancha habilitada</p><h3>{court.name}</h3><p>{[court.address, court.city, court.provinceName].filter(Boolean).join(', ') || 'Ubicación a confirmar'}</p><a className="inline-link" href={googleMapsLink(court)} target="_blank" rel="noreferrer">Abrir en Google Maps</a></article>) : <p className="empty-copy">No hay canchas asignadas todavía.</p>}</div>}</section>;
}

function ZoneResults({ zone }: { zone: PublicTournamentZone }) { return <article className="tournament-public-card"><p className="post-section">{zone.category} · {zone.name}</p><h3>{zone.venue.name}</h3>{zone.matches.length ? <ul className="match-list">{zone.matches.map((match) => <li key={match.id}><div><strong>{teamName(match.homeRegistration)}</strong><span>{teamName(match.awayRegistration)}</span></div><div className="match-score">{match.homeScore === null || match.awayScore === null ? 'Pendiente' : `${match.homeScore} - ${match.awayScore}`}<small>{formatMatchDate(match.scheduledAt)}</small></div></li>)}</ul> : <p className="empty-copy">Fixture en preparación.</p>}</article>; }
function KnockoutBracket({ category }: { category: string }) { return <section className="knockout-section"><div><p className="eyebrow">{category}</p><h3>Cruces finales</h3></div><div className="knockout-bracket"><div className="bracket-round"><p>Semifinales</p><BracketMatch home="Ganador de cuarto 1" away="Ganador de cuarto 2" /><BracketMatch home="Ganador de cuarto 3" away="Ganador de cuarto 4" /></div><div className="bracket-round bracket-final"><p>Final</p><BracketMatch home="Ganador semifinal 1" away="Ganador semifinal 2" /></div></div></section>; }
function BracketMatch({ home, away }: { home: string; away: string }) { return <div className="bracket-match"><span>{home}</span><span>{away}</span></div>; }
function teamName(registration: { playerOneName: string; playerTwoName: string; locality: { name: string } } | null) { return registration ? `${registration.playerOneName} / ${registration.playerTwoName} · ${registration.locality.name}` : 'A definir'; }
function formatDates(startsAt: string | null, endsAt: string | null) { if (!startsAt) return 'Fechas a confirmar'; return endsAt && endsAt !== startsAt ? `${startsAt} al ${endsAt}` : startsAt; }
function formatMatchDate(value: string | null) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : ''; }
function googleMapsLink(court: { name: string; address: string | null; city: string | null; provinceName: string | null }) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([court.name, court.address, court.city, court.provinceName].filter(Boolean).join(', '))}`; }
function getTournamentState(startsAt: string | null, endsAt: string | null) { if (!startsAt) return { heading: 'Próximo torneo', label: 'Próximamente', live: false }; const today = new Date(); today.setHours(0, 0, 0, 0); const start = new Date(`${startsAt}T00:00:00`); const end = new Date(`${endsAt ?? startsAt}T23:59:59`); if (today < start) return { heading: 'Próximo torneo', label: 'Próximamente', live: false }; if (today <= end) return { heading: 'Torneo en curso', label: 'En juego', live: true }; return { heading: 'Torneo finalizado', label: 'Finalizado', live: false }; }
