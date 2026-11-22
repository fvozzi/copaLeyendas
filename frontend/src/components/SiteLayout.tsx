import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { publicSectionKeys, sectionMeta, tournamentStory } from '../lib/content';

export function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site-shell">
      <header className="site-header">
        <NavLink to="/" className="brandmark" onClick={() => setMenuOpen(false)}>
          <span className="brandmark-kicker">Copa</span>
          <span className="brandmark-title">Leyendas</span>
        </NavLink>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav id="site-navigation" className={`site-nav ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)}>
          {publicSectionKeys.map((key) => (
            <NavLink key={key} to={`/secciones/${key}`} className="site-nav-link">
              {sectionMeta[key].label}
            </NavLink>
          ))}
          <NavLink to="/museo-pelotari" className="site-nav-link">
            Museo Pelotari
          </NavLink>
          <NavLink to="/inscripcion" className="site-nav-link site-nav-link-accent">
            Inscripcion
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <p className="footer-title">{tournamentStory.title}</p>
          <p>{tournamentStory.place}</p>
        </div>
        <div>
          <a href={tournamentStory.instagramUrl} target="_blank" rel="noreferrer">
            Instagram oficial
          </a>
        </div>
      </footer>
    </div>
  );
}
