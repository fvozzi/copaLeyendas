import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getPublicPosts } from '../lib/api';
import { sectionMeta } from '../lib/content';
import { pelotaPaletaHistory } from '../lib/history-content';
import { tournamentArchiveStory, tournamentEditions } from '../lib/tournament-editions';
import type { ContentPost, ContentSection } from '../types';

export function SectionPage() {
  const { section } = useParams<{ section: ContentSection }>();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const validSection = section && section in sectionMeta ? section : undefined;

  useEffect(() => {
    if (!validSection || validSection === 'leyendas' || validSection === 'canchas') return;
    setLoading(true);
    getPublicPosts({ section: validSection }).then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  }, [validSection]);

  if (!validSection) return <Navigate to="/" replace />;
  if (validSection === 'leyendas' || validSection === 'canchas') return <Navigate to="/secciones/torneos" replace />;

  return (
    <section className="content-band section-page">
      <div className="section-heading">
        <p className="eyebrow">{sectionMeta[validSection].label}</p>
        <h1>{sectionMeta[validSection].intro}</h1>
      </div>
      {validSection === 'torneos' && <TournamentArchive />}
      {validSection === 'historias' && <HistoryFeature />}
      {validSection === 'torneos' && posts.length > 0 && <div className="section-subheading"><p className="eyebrow">Actualidad</p><h2>Noticias y convocatorias</h2></div>}
      {validSection === 'historias' && posts.length > 0 && <div className="section-subheading"><p className="eyebrow">Archivo abierto</p><h2>Más historias</h2></div>}
      {loading ? <div className="inline-state">Cargando publicaciones...</div> : posts.length === 0 ? validSection === 'torneos' || validSection === 'historias' ? null : <div className="inline-state">No hay publicaciones publicadas en esta sección.</div> : <div className="post-grid">{posts.map((post) => <article key={post.id} className="post-card"><h2>{post.title}</h2><p>{post.excerpt}</p><Link to={`/post/${post.slug}`} className="inline-link">Leer nota</Link></article>)}</div>}
    </section>
  );
}

function HistoryFeature() {
  return <article className="history-feature">
    <header className="history-feature-heading">
      <p className="eyebrow">Archivo histórico</p>
      <h2>{pelotaPaletaHistory.title}</h2>
      <p>{pelotaPaletaHistory.introduction}</p>
    </header>
    {pelotaPaletaHistory.chapters.map((chapter, index) => <section key={chapter.period} className={`history-chapter${index % 2 === 1 ? ' is-reverse' : ''}`}>
      <div className="history-chapter-copy">
        <span>{chapter.period}</span>
        <h3>{chapter.title}</h3>
        {chapter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <div className={`history-media-grid${chapter.images.length > 1 ? ' is-mosaic' : ''}`}>
        {chapter.images.map((image) => <figure key={image.src} className={image.portrait ? 'is-portrait' : undefined}>
          <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
          <figcaption>{image.caption}</figcaption>
        </figure>)}
      </div>
    </section>)}
  </article>;
}

function TournamentArchive() {
  return <div className="tournament-archive">
    <section className="tournament-archive-story" aria-labelledby="historia-copa-title">
      <div><p className="eyebrow">Copa Leyendas</p><h2 id="historia-copa-title">{tournamentArchiveStory.title}</h2></div>
      <div className="tournament-archive-story-copy">{tournamentArchiveStory.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
    </section>
    <div className="tournament-archive-note"><p className="eyebrow">El camino continúa</p><p>La Copa Leyendas Femme 2026 es una edición especial y única. Desde 2027, mujeres y varones compartirán una sola edición.</p></div>
    <div className="edition-card-grid">{tournamentEditions.map((edition) => <article key={edition.slug} className={`edition-card ${edition.specialEdition ? 'is-femme' : ''}`}><div className="edition-card-top"><span className={`edition-status ${edition.status}`}>{edition.status === 'finished' ? 'Finalizada' : 'Próximamente'}</span><span>{edition.dateLabel}</span></div><div><p className="eyebrow">{edition.specialEdition ? 'Edición especial' : `Copa Leyendas ${edition.year}`}</p><h2>{edition.name}</h2><p>{edition.summary}</p></div><div className="edition-card-legend"><span>Leyenda</span><strong>{edition.legendName}</strong></div><Link to={`/torneos/${edition.slug}`} className="primary-button">Ver edición</Link></article>)}</div>
  </div>;
}
