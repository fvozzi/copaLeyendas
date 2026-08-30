import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import heroImage from '../assets/hero-copa-leyendas.png';
import { getPublicPosts } from '../lib/api';
import { sectionMeta, tournamentHighlights, tournamentStory } from '../lib/content';
import type { ContentPost } from '../types';

export function HomePage() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicPosts()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  const featuredPosts = posts.filter((post) => post.featured).slice(0, 3);

  return (
    <>
      <section
        className="hero-band"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10, 20, 22, 0.35), rgba(10, 20, 22, 0.88)), url(${heroImage})`,
        }}
      >
        <div className="hero-content">
          <p className="eyebrow">Pelota paleta federal</p>
          <h1>{tournamentStory.title}</h1>
          <p className="hero-copy">{tournamentStory.description}</p>
          <div className="hero-meta">
            <span>{tournamentStory.schedule}</span>
            <span>{tournamentStory.place}</span>
          </div>
          <div className="hero-actions">
            <Link to="/inscripcion" className="primary-button">
              Registrar pareja
            </Link>
            <a href={tournamentStory.instagramUrl} target="_blank" rel="noreferrer" className="secondary-button">
              Ver Instagram
            </a>
          </div>
        </div>
      </section>

      <section className="info-band">
        <div className="info-grid">
          {tournamentHighlights.map((item) => (
            <article key={item} className="metric-card">
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <p className="eyebrow">Secciones editoriales</p>
          <h2>Una base digital para todo el ano</h2>
        </div>
        <div className="section-grid">
          {Object.entries(sectionMeta).map(([key, value]) => (
            <article key={key} className="section-card">
              <p className="section-card-kicker">{value.label}</p>
              <p>{value.intro}</p>
              <Link to={`/secciones/${key}`} className="inline-link">
                Abrir seccion
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="content-band content-band-accent">
        <div className="section-heading">
          <p className="eyebrow">Lecturas destacadas</p>
          <h2>Contenido listo para crecer desde el backoffice</h2>
        </div>
        {loading ? (
          <div className="inline-state">Cargando publicaciones...</div>
        ) : (
          <div className="post-grid">
            {featuredPosts.length > 0 ? (
              featuredPosts.map((post) => (
                <article key={post.id} className="post-card">
                  <p className="post-section">{sectionMeta[post.section].label}</p>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <Link to={`/post/${post.slug}`} className="inline-link">
                    Leer nota
                  </Link>
                </article>
              ))
            ) : (
              <div className="inline-state">Todavia no hay destacados publicados.</div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
