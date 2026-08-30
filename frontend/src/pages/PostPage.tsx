import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicPostBySlug } from '../lib/api';
import { sectionMeta } from '../lib/content';
import type { ContentPost } from '../types';

export function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    getPublicPostBySlug(slug)
      .then(setPost)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <section className="content-band inline-state">Cargando nota...</section>;
  }

  if (error || !post) {
    return <section className="content-band inline-state">{error ?? 'No se encontro la nota.'}</section>;
  }

  return (
    <section className="article-band">
      <div className="article-shell">
        <Link to={`/secciones/${post.section}`} className="inline-link">
          {sectionMeta[post.section].label}
        </Link>
        <h1>{post.title}</h1>
        <p className="article-excerpt">{post.excerpt}</p>
        <div className="article-body">{post.body}</div>
      </div>
    </section>
  );
}
