import { museoPelotari } from '../lib/museum-content';

export function MuseumPage() {
  return <section className="content-band museum-page">
    <header className="museum-heading">
      <div>
        <p className="eyebrow">Museo Pelotari</p>
        <h1>{museoPelotari.title}</h1>
      </div>
      <p>{museoPelotari.description}</p>
    </header>

    <section className="museum-about" aria-labelledby="museum-about-title">
      <div><p className="eyebrow">Acerca del proyecto</p><h2 id="museum-about-title">Un archivo para mantener viva nuestra historia</h2></div>
      <div>{museoPelotari.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
    </section>

    <section aria-labelledby="museum-links-title">
      <div className="section-subheading museum-links-heading"><p className="eyebrow">Explorar el museo</p><h2 id="museum-links-title">Todos sus canales oficiales</h2></div>
      <div className="museum-link-grid">
        {museoPelotari.links.map((link) => <a key={link.url} className="museum-link-card" href={link.url} target="_blank" rel="noreferrer">
          <span>Canal oficial</span>
          <strong>{link.label}</strong>
          <p>{link.description}</p>
          <small>Abrir en una nueva pestaña →</small>
        </a>)}
      </div>
    </section>
  </section>;
}
