import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <p className="sidebar-kicker">Direccion del Torneo</p>
          <h1>Copa Leyendas</h1>
          <p className="sidebar-user">{user?.name}</p>
        </div>
        <nav className="admin-nav">
          <NavLink to="/app" end className="admin-nav-link">
            Resumen
          </NavLink>
          <NavLink to="/app/contenidos" className="admin-nav-link">
            Contenidos
          </NavLink>
          <NavLink to="/app/inscripciones" className="admin-nav-link">
            Inscripciones
          </NavLink>
          <NavLink to="/app/jugadoras" className="admin-nav-link">
            Jugadores/as
          </NavLink>
          <NavLink to="/app/localidades" className="admin-nav-link">
            Localidades
          </NavLink>
          <NavLink to="/app/categorias" className="admin-nav-link">Categorias</NavLink>
          <NavLink to="/app/canchas" className="admin-nav-link">Canchas</NavLink>
          <NavLink to="/app/torneos" className="admin-nav-link">Torneos</NavLink>
          <NavLink to="/" className="admin-nav-link">
            Ver sitio
          </NavLink>
        </nav>
        <button type="button" className="ghost-button" onClick={logout}>
          Cerrar sesion
        </button>
      </aside>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
