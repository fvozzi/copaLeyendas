import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getPublicPosts } from '../lib/api';
import { sectionMeta } from '../lib/content';
import type { ContentPost, ContentSection } from '../types';

export function SectionPage() {
  const { section } = useParams<{ section: ContentSection }>();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  if (!section || !(section in sectionMeta)) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    getPublicPosts({ section })
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [section]);

  return (
    <section className="content-band section-page">
      <div className="section-heading">
        <p className="eyebrow">{sectionMeta[section].label}</p>
        <h1>{sectionMeta[section].intro}</h1>
      </div>
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
