import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CourtMap } from '../components/CourtMap';
import { getPublicCourts, resolveApiAssetUrl } from '../lib/api';
import { ageRangeLabel, communityCourtOrganizationLabels, communityCourtTypeLabels, communityGenderLabels, courtFeatureLabels, southAmericanCountries } from '../lib/court-directory';
import type { CommunityCourt, CommunityCourtType, CommunityPlayerGender } from '../types';

export function CourtsDirectoryPage() {
  const [courts, setCourts] = useState<CommunityCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [courtType, setCourtType] = useState<CommunityCourtType | ''>('');
  const [gender, setGender] = useState<CommunityPlayerGender | ''>('');
  const [age, setAge] = useState('');
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => !isMobileViewport());

  useEffect(() => {
    getPublicCourts().then(setCourts).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia('(max-width: 640px)');
    const updateForViewport = (event: MediaQueryListEvent) => setFiltersOpen(!event.matches);
    media.addEventListener('change', updateForViewport);
    return () => media.removeEventListener('change', updateForViewport);
  }, []);

  const visible = useMemo(() => filterCommunityCourts(courts, { search, country, courtType, gender, age: age === '' ? undefined : Number(age) }), [courts, search, country, courtType, gender, age]);
  const totalPlayers = visible.reduce((total, court) => total + court.totalPlayers, 0);
  const activeFilterCount = [search, country, courtType, gender, age].filter(Boolean).length;
  const selectCourt = (court: CommunityCourt) => { setSelectedCourtId(court.id); document.getElementById('court-directory-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  return <section className="content-band court-directory-page">
    <header className="court-directory-hero">
      <div><p className="eyebrow">Mapa comunitario</p><h1>Canchas de pelota paleta</h1><p>Encontrá dónde jugar, conocé su comunidad y ayudanos a construir el mapa más completo de canchas.</p></div>
      <Link to="/canchas/nueva" className="primary-button">Dar de alta una cancha</Link>
    </header>

    <div className={`court-directory-filter-panel${filtersOpen ? ' is-open' : ''}`}>
      <button type="button" className="court-directory-filter-toggle" aria-expanded={filtersOpen} aria-controls="court-directory-filters" onClick={() => setFiltersOpen((current) => !current)}>
        <span>Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span><span className="filter-toggle-icon" aria-hidden="true">⌄</span>
      </button>
      {filtersOpen && <section id="court-directory-filters" className="court-directory-filters" aria-label="Filtros de canchas">
        <label>Buscar<input type="search" placeholder="Cancha, localidad o provincia" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>País<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">Todos</option>{southAmericanCountries.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}</select></label>
        <label>Tipo<select value={courtType} onChange={(event) => setCourtType(event.target.value as CommunityCourtType | '')}><option value="">Todos</option>{Object.entries(communityCourtTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Jugadores<select value={gender} onChange={(event) => setGender(event.target.value as CommunityPlayerGender | '')}><option value="">Todos</option>{Object.entries(communityGenderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Edad<input type="number" min="0" max="120" placeholder="Ej. 45" value={age} onChange={(event) => setAge(event.target.value)} /></label>
      </section>}
    </div>

    <div className="court-directory-summary"><strong>{visible.length}</strong><span>{visible.length === 1 ? 'cancha encontrada' : 'canchas encontradas'}</span><strong>{totalPlayers}</strong><span>jugadores/as registrados</span></div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {loading ? <div className="inline-state">Cargando mapa de canchas...</div> : <div id="court-directory-map"><CourtMap courts={visible} selectedCourtId={selectedCourtId} onCourtSelect={(court) => setSelectedCourtId(court.id)} className="court-directory-map" /></div>}

    {!loading && !visible.length ? <div className="edition-empty"><p className="eyebrow">Sin coincidencias</p><h2>No encontramos canchas con esos filtros</h2><p>Probá otra búsqueda o sumá una cancha que todavía no figure.</p><Link to="/canchas/nueva" className="primary-button">Agregar cancha</Link></div> : <div className="community-court-grid">{visible.map((court) => <article className={`community-court-card${court.id === selectedCourtId ? ' is-selected' : ''}`} key={court.id}>
      {(court.photos ?? []).length > 0 && <div className={`community-court-gallery${court.photos.length === 1 ? ' is-single' : ''}`}>{court.photos.map((photo, index) => <a key={photo.id} href={resolveApiAssetUrl(photo.url) ?? undefined} target="_blank" rel="noreferrer"><img src={resolveApiAssetUrl(photo.url) ?? undefined} alt={`${court.name}, foto ${index + 1}`} loading="lazy" decoding="async" /></a>)}</div>}
      <div><p className="eyebrow">{court.organizationType ? `${communityCourtOrganizationLabels[court.organizationType]} · ` : ''}{court.courtType ? `${communityCourtTypeLabels[court.courtType]} · ` : ''}{court.country}</p><h2>{court.name}</h2><p>{court.locality}, {court.province}</p>{court.address && <small>{court.address}</small>}</div>
      <div className="community-court-measures"><span><strong>{court.totalPlayers}</strong> jugadores/as</span>{court.lengthMeters && <span><strong>{court.lengthMeters} m</strong> de largo</span>}{court.widthMeters && <span><strong>{court.widthMeters} m</strong> de ancho</span>}</div>
      <div className="community-court-features">{courtFeatureLabels(court).map((feature) => <span key={feature}>{feature}</span>)}</div>
      {court.history && <details className="community-court-history"><summary>Historia de la cancha</summary><p>{court.history}</p></details>}
      {(court.contactName || court.contactPhone || court.contactEmail || court.contactUrl || court.hasCourtKeeper) && <details className="community-court-contact"><summary>Datos de contacto</summary><div><span>{court.hasCourtKeeper ? 'Tiene canchero' : 'No tiene canchero'}</span>{court.contactName && <strong>{court.contactName}</strong>}{court.contactPhone && <a href={`tel:${court.contactPhone.replace(/[^+\d]/g, '')}`}>{court.contactPhone}</a>}{court.contactEmail && <a href={`mailto:${court.contactEmail}`}>{court.contactEmail}</a>}{court.contactUrl && <a href={court.contactUrl} target="_blank" rel="noreferrer">Web o red social ↗</a>}</div></details>}
      <ul>{court.playerGroups.map((group, index) => <li key={group.id ?? `${group.gender}-${index}`}><strong>{group.playerCount}</strong><span>{communityGenderLabels[group.gender]} · {ageRangeLabel(group)}</span></li>)}</ul>
      <button type="button" className="inline-link" onClick={() => selectCourt(court)}>Ver en el mapa</button>
    </article>)}</div>}
  </section>;
}

export function filterCommunityCourts(courts: CommunityCourt[], filters: { search: string; country: string; courtType?: CommunityCourtType | ''; gender: CommunityPlayerGender | ''; age?: number }) {
  const term = normalize(filters.search);
  return courts.filter((court) => {
    if (term && !normalize([court.name, court.organizationType, court.locality, court.province, court.country, court.address, court.history, court.inaugurationDate, court.contactName].filter(Boolean).join(' ')).includes(term)) return false;
    if (filters.country && court.country !== filters.country) return false;
    if (filters.courtType && court.courtType !== filters.courtType) return false;
    if ((filters.gender || filters.age !== undefined) && !court.playerGroups.some((group) => (
      (!filters.gender || group.gender === filters.gender)
      && (filters.age === undefined || ((group.minAge === null || group.minAge <= filters.age) && (group.maxAge === null || group.maxAge >= filters.age)))
    ))) return false;
    return true;
  });
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

function isMobileViewport() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 640px)').matches);
}
