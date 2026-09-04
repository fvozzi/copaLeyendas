import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const isDirector = user?.role === 'DIRECTOR';
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-sidebar-header">
          <div>
          <p className="sidebar-kicker">Direccion del Torneo</p>
          <h1>Copa Leyendas</h1>
          <p className="sidebar-user">{user?.name}</p>
          </div>
          <button type="button" className="admin-menu-toggle" aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen((open) => !open)}>
            <span />
            <span />
            <span />
          </button>
        </div>
        <nav id="admin-navigation" className="admin-nav" onClick={() => setMenuOpen(false)}>
          <NavLink to="/app" end className="admin-nav-link">
            Resumen
          </NavLink>
          {isDirector && <NavLink to="/app/contenidos" className="admin-nav-link">
            Contenidos
          </NavLink>}
          {isDirector && <NavLink to="/app/inscripciones" className="admin-nav-link">
            Inscripciones
          </NavLink>}
          {isDirector && <NavLink to="/app/caja" className="admin-nav-link">
            Caja
          </NavLink>}
          {isDirector && <NavLink to="/app/jugadoras" className="admin-nav-link">
            Jugadores/as
          </NavLink>}
          {isDirector && <NavLink to="/app/localidades" className="admin-nav-link">
            Localidades
          </NavLink>}
          {isDirector && <NavLink to="/app/categorias" className="admin-nav-link">Categorias</NavLink>}
          {isDirector && <NavLink to="/app/canchas" className="admin-nav-link">Sedes</NavLink>}
          {isDirector && <NavLink to="/app/canchas/internas" className="admin-nav-link">Canchas</NavLink>}
          <NavLink to="/app/torneos" className="admin-nav-link">Torneos</NavLink>
          {isDirector && <NavLink to="/app/programa" className="admin-nav-link">Programa</NavLink>}
          {isDirector && <NavLink to="/app/usuarios" className="admin-nav-link">Usuarios</NavLink>}
          <NavLink to="/" className="admin-nav-link">
            Ver sitio
          </NavLink>
        </nav>
        <button type="button" className="ghost-button admin-logout" onClick={logout}>
          Cerrar sesion
        </button>
      </aside>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
