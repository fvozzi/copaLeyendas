import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PublicProgramMap } from '../components/PublicProgramMap';
import { getPublicCurrentTournament, getPublicPosts, resolveApiAssetUrl } from '../lib/api';
import { getTournamentEdition, normalizeSearchText, type TournamentEdition } from '../lib/tournament-editions';
import { pairPlayerNames, pairTeamName } from '../lib/pair-display';
import { venuesWithEnabledCourts } from '../lib/public-venues';
import type { ContentPost, PairRegistration, PublicCurrentTournament, PublicTournamentZone, TournamentMatch, TournamentScheduleSlot } from '../types';

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
    let active = true;
    const refresh = () => getPublicCurrentTournament()
      .then((result) => { if (active) { setCurrentTournament(result); setTournamentError(null); } })
      .catch(() => { if (active) setTournamentError('No se pudo cargar la información del torneo actual.'); });
    void refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => { active = false; window.clearInterval(interval); };
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
        {edition.specialEdition && <img src="/LogoFemme.webp" alt="Copa Leyendas Femme" width="180" height="180" decoding="async" />}
      </header>

      <nav className="edition-tabs" aria-label={`Contenido de ${edition.name}`}>
        <button type="button" className={tab === 'legend' ? 'is-selected' : ''} onClick={() => setTab('legend')}>Leyenda</button>
        <button type="button" className={tab === 'photos' ? 'is-selected' : ''} onClick={() => setTab('photos')}>Fotos</button>
        <button type="button" className={tab === 'results' ? 'is-selected' : ''} onClick={() => setTab('results')}>Resultados</button>
      </nav>

      <div className="edition-tab-panel">
        {tab === 'legend' && <LegendSection edition={edition} post={legendPost} loading={legendLoading} />}
        {tab === 'photos' && <PhotoSection name={edition.name} photos={edition.photos} current={edition.usesLiveTournament ? currentTournament : undefined} />}
        {tab === 'results' && (edition.usesLiveTournament
          ? <LiveResults current={currentTournament} error={tournamentError} />
          : <HistoricalResults editionName={edition.name} finals={edition.finals} />)}
      </div>

      {edition.specialEdition && <TournamentRegulations />}
    </section>
  );
}

function LegendSection({ edition, post, loading }: { edition: TournamentEdition; post?: ContentPost; loading: boolean }) {
  if (loading) return <div className="inline-state">Cargando la nota de la leyenda...</div>;
  const content = edition.legendContent;
  return <article className={`edition-legend-feature${content.image ? '' : ' without-image'}`}>
    {content.image && <img src={content.image.src} alt={content.image.alt} width="960" height="1358" loading="lazy" decoding="async" />}
    <div className="edition-legend-copy">
      <p className="eyebrow">Leyenda de la edición</p>
      <h2>{post?.title ?? content.title}</h2>
      {post ? <><p className="article-excerpt">{post.excerpt}</p><div className="article-body">{post.body}</div></> : content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {content.interview && <div className="edition-legend-video"><iframe src={content.interview.embedUrl} title={content.interview.label} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>}
      <div className="edition-legend-actions">
        {post && <Link to={`/post/${post.slug}`} className="inline-link">Abrir nota completa</Link>}
      </div>
    </div>
  </article>;
}

type MatchGalleryPhoto = {
  id: number;
  category: string;
  stage: string;
  sequence: number | null;
  match: TournamentMatch;
  venue: string;
};

function PhotoSection({ name, photos, current }: { name: string; photos: { src: string; alt: string }[]; current?: PublicCurrentTournament | null }) {
  if (current !== undefined) {
    if (!current) return <div className="inline-state">Cargando fotos del torneo...</div>;
    const gallery = tournamentMatchPhotos(current);
    if (!gallery.length) return <div className="edition-empty"><p className="eyebrow">Archivo fotográfico</p><h2>Fotos de {name}</h2><p>Las fotos de los partidos aparecerán aquí a medida que se carguen los resultados.</p></div>;
    const categories = [...new Set(gallery.map((photo) => photo.category))];
    return <section className="match-photo-gallery">
      <div className="edition-panel-heading"><p className="eyebrow">Archivo fotográfico</p><h2>Fotos de {name}</h2><p>{gallery.length} {gallery.length === 1 ? 'partido fotografiado' : 'partidos fotografiados'}, ordenados por categoría e instancia.</p></div>
      {categories.map((category) => {
        const categoryPhotos = gallery.filter((photo) => photo.category === category);
        const headingId = `fotos-${normalizeSearchText(category).replace(/\s+/g, '-')}`;
        return <section className="match-photo-category" aria-labelledby={headingId} key={category}>
          <header className="match-photo-category-heading"><div><p className="eyebrow">Categoría</p><h3 id={headingId}>{category}</h3></div><span>{categoryPhotos.length} {categoryPhotos.length === 1 ? 'foto' : 'fotos'}</span></header>
          <div className="edition-photo-grid match-photo-grid">
            {categoryPhotos.map((photo) => <MatchPhotoCard photo={photo} key={`${photo.stage}-${photo.id}`} />)}
          </div>
        </section>;
      })}
    </section>;
  }
  if (!photos.length) return <div className="edition-empty"><p className="eyebrow">Archivo fotográfico</p><h2>Fotos de {name}</h2><p>La galería está preparada y se completará cuando estén seleccionadas las fotos de esta edición.</p></div>;
  return <section><div className="edition-panel-heading"><p className="eyebrow">Archivo fotográfico</p><h2>Fotos de {name}</h2><p>{photos.length} fotos de esta edición. Abrí una foto para verla en tamaño completo.</p></div><div className="edition-photo-grid">{photos.map((photo) => <figure key={photo.src}><a href={photo.src} target="_blank" rel="noreferrer"><img src={photo.src} alt={photo.alt} loading="lazy" /></a><figcaption>{photo.alt}</figcaption></figure>)}</div></section>;
}

function MatchPhotoCard({ photo }: { photo: MatchGalleryPhoto }) {
  const { match } = photo;
  const imageUrl = resolveApiAssetUrl(match.cleanPhotoUrl) ?? undefined;
  const home = teamName(match.homeRegistration);
  const away = teamName(match.awayRegistration);
  const score = match.status === 'IN_PROGRESS'
    ? 'En juego'
    : match.homeScore === null || match.awayScore === null ? 'Resultado pendiente' : `${match.homeScore} - ${match.awayScore}`;
  return <figure className="match-photo-card">
    <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={`Abrir foto del partido ${photo.sequence ?? photo.id}: ${home} contra ${away}`}>
      <img src={imageUrl} alt={`${photo.category}, ${photo.stage}: ${home} contra ${away}`} loading="lazy" decoding="async" />
    </a>
    <figcaption>
      <div className="match-photo-labels"><strong>{photo.sequence ? `P${photo.sequence}` : 'Partido'}</strong><span>{photo.stage}</span></div>
      <p>{home} <span>vs.</span> {away}</p>
      <div className="match-photo-details"><strong>{score}</strong><span>{formatMatchDate(match.scheduledAt)}</span></div>
      {photo.venue && <small>{photo.venue}</small>}
    </figcaption>
  </figure>;
}

export function tournamentMatchPhotos(current: PublicCurrentTournament): MatchGalleryPhoto[] {
  const tournament = current.tournament;
  if (!tournament) return [];
  const zonePhotos = tournament.zones.flatMap((zone) => zone.matches
    .filter((match) => match.status === 'PLAYED' && Boolean(match.cleanPhotoUrl))
    .map((match) => ({ id: match.id, category: zone.category, stage: zone.name, sequence: match.sequence ?? null, match, venue: zone.venue.name })));
  const knockoutPhotos = (tournament.knockout ?? []).flatMap((slot) => slot.match?.status === 'PLAYED' && slot.match.cleanPhotoUrl ? [{
    id: slot.match.id,
    category: slot.tournamentCategory.category.name,
    stage: knockoutStageLabel(slot.stage),
    sequence: slot.sequence ?? slot.match.sequence ?? null,
    match: slot.match,
    venue: slot.court?.venue?.name ?? '',
  }] : []);
  return [...zonePhotos, ...knockoutPhotos].sort((left, right) => {
    const categoryOrder = left.category.localeCompare(right.category, 'es');
    if (categoryOrder) return categoryOrder;
    const leftTime = left.match.scheduledAt ? new Date(left.match.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.match.scheduledAt ? new Date(right.match.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime || (left.sequence ?? left.id) - (right.sequence ?? right.id);
  });
}

function knockoutStageLabel(stage: TournamentScheduleSlot['stage']) {
  if (stage === 'QUARTERFINAL') return 'Cuartos de final';
  if (stage === 'SEMIFINAL') return 'Semifinal';
  if (stage === 'FINAL') return 'Final';
  return 'Zona';
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

function TournamentRegulations() { return <section className="tournament-regulations" aria-labelledby="reglamento-title"><div className="tournament-regulations-heading"><div><p className="eyebrow">Copa Leyendas Femme</p><h2 id="reglamento-title">Reglamento</h2></div><img src="/LogoFemme.webp" alt="Copa Leyendas Femme" width="92" height="92" loading="lazy" decoding="async" /></div><ol>{regulations.map((rule) => <li key={rule}>{rule}</li>)}</ol></section>; }

function CurrentTournament({ tournament: current }: { tournament: PublicCurrentTournament }) {
  const [tab, setTab] = useState<'results' | 'venues' | 'map'>('results'); const tournament = current.tournament!; const categories = [...new Set(tournament.zones.map((zone) => zone.category))]; const [category, setCategory] = useState(categories[0] ?? ''); const state = getTournamentState(tournament.startsAt, tournament.endsAt); const zones = tournament.zones.filter((zone) => zone.category === category); const venues = venuesWithEnabledCourts(current.courts);
  return <section className="public-tournament public-tournament-femme"><div className="public-tournament-heading"><div><p className="eyebrow">{state.heading}</p><h2>{tournament.name}</h2><p className={state.live ? 'tournament-date is-live' : 'tournament-date'}>{state.live && <span className="live-dot" />}{formatDates(tournament.startsAt, tournament.endsAt)}{tournament.city ? ` · ${tournament.city}` : ''}</p></div><img className="public-tournament-logo" src="/LogoFemme.webp" alt="Copa Leyendas Femme" width="112" height="112" decoding="async" /><span className={`status-chip ${state.live ? 'status-live tournament-live-chip' : 'status-review'}`}>{state.label}</span></div><LiveMatches current={current} /><div className="public-tournament-tabs"><button type="button" className={tab === 'results' ? 'is-selected' : ''} onClick={() => setTab('results')}>Resultados y posiciones</button><button type="button" className={tab === 'venues' ? 'is-selected' : ''} onClick={() => setTab('venues')}>Sedes</button><button type="button" className={tab === 'map' ? 'is-selected' : ''} onClick={() => setTab('map')}>Mapa</button></div>{tab === 'results' ? <><div className="public-category-tabs">{categories.map((item) => <button key={item} type="button" className={category === item ? 'is-selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><p className="standings-rule">Orden: partidos ganados, diferencia de tantos y tantos a favor. Las dos primeras parejas de cada zona clasifican a los cruces.</p><div className="tournament-zone-grid">{zones.map((zone) => <ZoneResults key={zone.id} zone={zone} />)}</div><KnockoutBracket category={category} slots={tournament.knockout ?? []} zones={zones} /></> : tab === 'map' ? <PublicProgramMap /> : <div className="court-public-grid">{venues.length ? venues.map((venue) => <article key={venue.id} className="court-public-card"><p className="post-section">Sede habilitada</p><h3>{venue.name}</h3><p>{[venue.address, venue.city, venue.provinceName].filter(Boolean).join(', ') || 'Ubicación a confirmar'}</p><a className="inline-link" href={googleMapsLink(venue)} target="_blank" rel="noreferrer">Abrir en Google Maps</a></article>) : <p className="empty-copy">No hay sedes habilitadas todavía.</p>}</div>}</section>;
}

function LiveMatches({ current }: { current: PublicCurrentTournament }) {
  const tournament = current.tournament!;
  const live = [
    ...tournament.zones.flatMap((zone) => zone.matches.map((match) => ({ match, category: zone.category, stage: zone.name, venue: zone.venue.name }))),
    ...(tournament.knockout ?? []).flatMap((slot) => slot.match ? [{ match: slot.match, category: slot.tournamentCategory.category.name, stage: slot.zoneName, venue: slot.court?.venue?.name ?? '' }] : []),
  ].filter((item) => item.match.status === 'IN_PROGRESS');
  if (!live.length) return null;
  return <section className="live-matches" aria-label="Partidos en juego"><div className="live-matches-heading"><span className="live-dot" /><div><p className="eyebrow">Ahora</p><h3>Partidos en juego</h3></div></div><div className="live-match-grid">{live.map(({ match, category, stage, venue }) => <article key={match.id} className="live-match-card">{match.photoUrl && <img src={resolveApiAssetUrl(match.photoUrl) ?? undefined} alt={`Partido en juego: ${teamName(match.homeRegistration)} contra ${teamName(match.awayRegistration)}`} />}<div><p>{category} · {stage}{venue ? ` · ${venue}` : ''}</p><TeamDisclosure registration={match.homeRegistration} side="home" /><span className="live-match-versus">vs.</span><TeamDisclosure registration={match.awayRegistration} side="away" /><small>Iniciado {match.startedAt ? new Intl.DateTimeFormat('es-AR', { timeStyle: 'short' }).format(new Date(match.startedAt)) : 'ahora'}</small></div></article>)}</div></section>;
}

function ZoneResults({ zone }: { zone: PublicTournamentZone }) {
  const complete = zone.matches.length > 0 && zone.matches.every((match) => match.homeScore !== null && match.awayScore !== null);
  return <article className="tournament-public-card"><p className="post-section">{zone.category} · {zone.name}</p><h3>{zone.venue.name}</h3><div className="public-table-wrap"><table className="public-table" aria-label={`Posiciones ${zone.name}`}><thead><tr><th>Pos.</th><th>Equipo</th><th>PJ</th><th>PG</th><th>Dif.</th><th>TF</th></tr></thead><tbody>{zone.standings.map((row, index) => <tr key={row.registration.id} className={complete && index < 2 ? 'is-qualified' : ''}><td>{index + 1}{complete && index < 2 ? ' · C' : ''}</td><td><TeamDisclosure registration={row.registration} compact /></td><td>{row.played}</td><td>{row.wins}</td><td>{row.pointsFor - row.pointsAgainst}</td><td>{row.pointsFor}</td></tr>)}</tbody></table></div>{zone.matches.length ? <ul className="match-list">{zone.matches.map((match) => <li key={match.id}><div className="match-teams"><TeamDisclosure registration={match.homeRegistration} side="home" /><TeamDisclosure registration={match.awayRegistration} side="away" /><MatchPhotoLinks match={match} /></div><div className="match-score">{match.status === 'IN_PROGRESS' ? 'En juego' : match.homeScore === null || match.awayScore === null ? 'Pendiente' : `${match.homeScore} - ${match.awayScore}`}<small>{formatMatchDate(match.scheduledAt)}</small></div></li>)}</ul> : <p className="empty-copy">Fixture en preparación.</p>}</article>;
}
function KnockoutBracket({ category, slots, zones }: { category: string; slots: TournamentScheduleSlot[]; zones: PublicTournamentZone[] }) { const categorySlots = slots.filter((slot) => slot.tournamentCategory.category.name === category); const rounds = ([['QUARTERFINAL', 'Cuartos de final'], ['SEMIFINAL', 'Semifinales'], ['FINAL', 'Final']] as const).map(([stage, label]) => ({ stage, label, slots: categorySlots.filter((slot) => slot.stage === stage).sort((a, b) => a.matchOrder - b.matchOrder) })).filter((round) => round.slots.length); if (!rounds.length) return null; return <section className="knockout-section"><div><p className="eyebrow">{category}</p><h3>Clasificación y cruces finales</h3></div><div className="knockout-bracket">{rounds.map((round) => <div className={`bracket-round ${round.stage === 'FINAL' ? 'bracket-final' : ''}`} key={round.stage}><p>{round.label}</p>{round.slots.map((slot) => <BracketMatch key={slot.id} slot={slot} slots={categorySlots} zones={zones} />)}</div>)}</div></section>; }
function BracketMatch({ slot, slots, zones }: { slot: TournamentScheduleSlot; slots: TournamentScheduleSlot[]; zones: PublicTournamentZone[] }) {
  const match = slot.match;
  const participant = (side: 'home' | 'away') => {
    const registration = side === 'home' ? match?.homeRegistration : match?.awayRegistration;
    if (registration) return { registration, label: teamName(registration) };
    const zoneId = side === 'home' ? match?.homeQualifierZoneId : match?.awayQualifierZoneId;
    const rank = side === 'home' ? match?.homeQualifierRank : match?.awayQualifierRank;
    if (zoneId) return { registration: null, label: `${rank}.ª de ${zones.find((zone) => zone.id === zoneId)?.name ?? 'zona'}` };
    const sourceId = side === 'home' ? match?.homeSourceMatchId : match?.awaySourceMatchId;
    if (sourceId) return { registration: null, label: `Ganadora P${slots.find((candidate) => candidate.matchId === sourceId)?.sequence ?? '?'}` };
    return { registration: null, label: 'A definir' };
  };
  return <div className="bracket-match">{(['home', 'away'] as const).map((side) => {
    const entry = participant(side);
    const score = side === 'home' ? match?.homeScore : match?.awayScore;
    return <div className="bracket-participant" key={side}>{entry.registration ? <TeamDisclosure registration={entry.registration} side={side} compact /> : <span>{entry.label}</span>}{score != null ? <strong>{score}</strong> : null}</div>;
  })}{match && <MatchPhotoLinks match={match} />}</div>;
}

function MatchPhotoLinks({ match }: { match: TournamentMatch }) {
  if (match.status !== 'PLAYED') return null;
  const resultUrl = resolveApiAssetUrl(match.photoUrl);
  const cleanUrl = resolveApiAssetUrl(match.cleanPhotoUrl);
  if (!resultUrl && !cleanUrl) return null;
  return <div className="match-photo-actions">
    {resultUrl && <a className="inline-link" href={resultUrl} target="_blank" rel="noreferrer">Foto con resultado</a>}
    {cleanUrl && <a className="inline-link" href={cleanUrl} target="_blank" rel="noreferrer">Foto con logo</a>}
  </div>;
}
function TeamDisclosure({ registration, side, compact = false }: { registration: PairRegistration | null; side?: 'home' | 'away'; compact?: boolean }) {
  if (!registration) return <span className="public-team-empty">A definir</span>;
  return <details className={`public-team${side ? ` is-${side}` : ''}${compact ? ' is-compact' : ''}`}>
    <summary>{side && <span className="public-team-side">{side === 'home' ? 'Local' : 'Visitante'}</span>}<strong>{teamName(registration)}</strong></summary>
    <p>{pairPlayerNames(registration)}</p>
  </details>;
}
function teamName(registration: PairRegistration | null) { return registration ? pairTeamName(registration) : 'A definir'; }
function formatDates(startsAt: string | null, endsAt: string | null) { if (!startsAt) return 'Fechas a confirmar'; return endsAt && endsAt !== startsAt ? `${startsAt} al ${endsAt}` : startsAt; }
function formatMatchDate(value: string | null) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : ''; }
function googleMapsLink(court: { name: string; address: string | null; city: string | null; provinceName: string | null }) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([court.name, court.address, court.city, court.provinceName].filter(Boolean).join(', '))}`; }
function getTournamentState(startsAt: string | null, endsAt: string | null) { if (!startsAt) return { heading: 'Próximo torneo', label: 'Próximamente', live: false }; const today = new Date(); today.setHours(0, 0, 0, 0); const start = new Date(`${startsAt}T00:00:00`); const end = new Date(`${endsAt ?? startsAt}T23:59:59`); if (today < start) return { heading: 'Próximo torneo', label: 'Próximamente', live: false }; if (today <= end) return { heading: 'Torneo en curso', label: 'En juego', live: true }; return { heading: 'Torneo finalizado', label: 'Finalizado', live: false }; }
