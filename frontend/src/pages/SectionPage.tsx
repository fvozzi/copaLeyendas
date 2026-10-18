import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getPublicPosts } from '../lib/api';
import { sectionMeta } from '../lib/content';
import { tournamentEditions } from '../lib/tournament-editions';
import type { ContentPost, ContentSection } from '../types';

export function SectionPage() {
  const { section } = useParams<{ section: ContentSection }>();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const validSection = section && section in sectionMeta ? section : undefined;

  useEffect(() => {
    if (!validSection) return;
    setLoading(true);
    getPublicPosts({ section: validSection }).then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  }, [validSection]);

  if (!validSection) return <Navigate to="/" replace />;

  return (
    <section className="content-band section-page">
      <div className="section-heading">
        <p className="eyebrow">{sectionMeta[validSection].label}</p>
        <h1>{sectionMeta[validSection].intro}</h1>
      </div>
      {validSection === 'torneos' && <TournamentArchive />}
      {validSection === 'torneos' && posts.length > 0 && <div className="section-subheading"><p className="eyebrow">Actualidad</p><h2>Noticias y convocatorias</h2></div>}
      {loading ? <div className="inline-state">Cargando publicaciones...</div> : posts.length === 0 ? validSection === 'torneos' ? null : <div className="inline-state">No hay publicaciones publicadas en esta sección.</div> : <div className="post-grid">{posts.map((post) => <article key={post.id} className="post-card"><h2>{post.title}</h2><p>{post.excerpt}</p><Link to={`/post/${post.slug}`} className="inline-link">Leer nota</Link></article>)}</div>}
    </section>
  );
}

function TournamentArchive() {
  return <div className="tournament-archive"><div className="tournament-archive-note"><p className="eyebrow">El camino continúa</p><p>La Copa Leyendas Femme 2026 es una edición especial y única. Desde 2027, mujeres y varones compartirán una sola edición.</p></div><div className="edition-card-grid">{tournamentEditions.map((edition) => <article key={edition.slug} className={`edition-card ${edition.specialEdition ? 'is-femme' : ''}`}><div className="edition-card-top"><span className={`edition-status ${edition.status}`}>{edition.status === 'finished' ? 'Finalizada' : 'Próximamente'}</span><span>{edition.dateLabel}</span></div><div><p className="eyebrow">{edition.specialEdition ? 'Edición especial' : `Copa Leyendas ${edition.year}`}</p><h2>{edition.name}</h2><p>{edition.summary}</p></div><div className="edition-card-legend"><span>Leyenda</span><strong>{edition.legendName}</strong></div><Link to={`/torneos/${edition.slug}`} className="primary-button">Ver edición</Link></article>)}</div></div>;
}
