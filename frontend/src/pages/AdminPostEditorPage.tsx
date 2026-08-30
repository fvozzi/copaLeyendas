import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPost, getAdminPost, updatePost } from '../lib/api';
import { sectionMeta } from '../lib/content';
import type { ContentSection, PostPayload } from '../types';

const initialForm: PostPayload = {
  section: 'leyendas',
  title: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  published: false,
  featured: false,
  sortOrder: 0,
};

export function AdminPostEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<PostPayload>(initialForm);
  const [loading, setLoading] = useState(id !== 'nuevo' && id !== undefined);
  const [error, setError] = useState<string | null>(null);
  const editingId = id && id !== 'nuevo' ? Number(id) : null;

  useEffect(() => {
    if (!editingId) {
      return;
    }

    getAdminPost(editingId)
      .then((post) =>
        setForm({
          section: post.section,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body,
          coverImageUrl: post.coverImageUrl ?? '',
          published: post.published,
          featured: post.featured,
          sortOrder: post.sortOrder,
        }),
      )
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [editingId]);

  const setField = <K extends keyof PostPayload>(field: K, value: PostPayload[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      if (editingId) {
        await updatePost(editingId, form);
      } else {
        await createPost(form);
      }

      navigate('/app/contenidos');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la publicacion.');
    }
  };

  if (loading) {
    return <div className="admin-panel inline-state">Cargando publicacion...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h1>{editingId ? 'Editar publicacion' : 'Nueva publicacion'}</h1>
        </div>
      </div>

      <form className="editor-form" onSubmit={handleSubmit}>
        <label>
          Seccion
          <select
            value={form.section}
            onChange={(event) => setField('section', event.target.value as ContentSection)}
          >
            {Object.entries(sectionMeta).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titulo
          <input value={form.title} onChange={(event) => setField('title', event.target.value)} required />
        </label>
        <label>
          Slug
          <input value={form.slug ?? ''} onChange={(event) => setField('slug', event.target.value)} />
        </label>
        <label className="span-2">
          Copete
          <textarea value={form.excerpt} onChange={(event) => setField('excerpt', event.target.value)} rows={3} required />
        </label>
        <label className="span-2">
          Cuerpo
          <textarea value={form.body} onChange={(event) => setField('body', event.target.value)} rows={12} required />
        </label>
        <label className="span-2">
          URL de imagen de portada
          <input value={form.coverImageUrl ?? ''} onChange={(event) => setField('coverImageUrl', event.target.value)} />
        </label>
        <label>
          Orden
          <input
            type="number"
            value={form.sortOrder ?? 0}
            onChange={(event) => setField('sortOrder', Number(event.target.value))}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.published ?? false}
            onChange={(event) => setField('published', event.target.checked)}
          />
          Publicada
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.featured ?? false}
            onChange={(event) => setField('featured', event.target.checked)}
          />
          Destacar en home
        </label>
        {error ? <p className="form-error span-2">{error}</p> : null}
        <div className="span-2 form-actions">
          <button type="submit" className="primary-button">
            Guardar publicacion
          </button>
        </div>
      </form>
    </div>
  );
}
