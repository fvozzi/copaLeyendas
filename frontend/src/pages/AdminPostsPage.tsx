import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deletePost, getAdminPosts } from '../lib/api';
import { sectionMeta } from '../lib/content';
import type { ContentPost, ContentSection } from '../types';

export function AdminPostsPage() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [section, setSection] = useState<string>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPosts = () => {
    getAdminPosts({
      section: section || undefined,
      search: search || undefined,
    })
      .then(setPosts)
      .catch((reason: Error) => setError(reason.message));
  };

  useEffect(() => {
    loadPosts();
  }, [section]);

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm('Se va a eliminar esta publicacion.');
    if (!confirmed) {
      return;
    }

    await deletePost(id);
    loadPosts();
  };

  return (
    <div className="admin-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">CMS</p>
          <h1>Publicaciones por seccion</h1>
        </div>
        <Link to="/app/contenidos/nuevo" className="primary-button">
          Nueva publicacion
        </Link>
      </div>

      <div className="toolbar">
        <select value={section} onChange={(event) => setSection(event.target.value)}>
          <option value="">Todas las secciones</option>
          {Object.entries(sectionMeta).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Buscar por titulo o copete"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className="secondary-button" onClick={loadPosts}>
          Buscar
        </button>
      </div>

      {error ? <div className="inline-state">{error}</div> : null}

      <div className="list-grid">
        {posts.map((post) => (
          <article key={post.id} className="list-card">
            <div className="list-card-header">
              <div>
                <p className="post-section">{sectionMeta[post.section as ContentSection].label}</p>
                <h2>{post.title}</h2>
              </div>
              <span className={`status-chip ${post.published ? 'status-live' : 'status-draft'}`}>
                {post.published ? 'Publicado' : 'Borrador'}
              </span>
            </div>
            <p>{post.excerpt}</p>
            <div className="list-actions">
              <Link to={`/app/contenidos/${post.id}`} className="inline-link">
                Editar
              </Link>
              <button type="button" className="danger-link" onClick={() => handleDelete(post.id)}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
