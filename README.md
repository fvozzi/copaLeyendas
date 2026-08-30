# Copa Leyendas

Web publica y app de gestion para la Copa Leyendas de Pelota Paleta, usando el mismo stack tecnico de Propia:

- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL
- ORM: TypeORM
- Frontend: React + Vite + TypeScript
- Auth: JWT propio

## Alcance inicial

- Sitio publico con home, secciones editoriales y detalle de notas
- Secciones: `Leyendas`, `Canchas`, `Torneos`, `Historias`
- Flujo de inscripcion con token emitido por Direccion del Torneo
- Panel para iniciar sesion, publicar contenidos, emitir habilitaciones y gestionar inscripciones
- Dashboard operativo con volumen de publicaciones e inscriptas

## Estructura

```text
/backend
/frontend
/docs
```

## Variables de entorno

### Backend

Copiar `backend/.env.example` a `backend/.env`.

```env
PORT=3000
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
DB_HOST=localhost
DB_PORT=5432
DB_NAME=copa_leyendas
DB_USER=postgres
DB_PASSWORD=postgres
DB_SYNCHRONIZE=false
DB_LOGGING=false
SEED_ADMIN_EMAIL=admin@copaleyendas.local
SEED_ADMIN_PASSWORD=copa123
SEED_ADMIN_NAME=Administracion Copa Leyendas
```

### Frontend

Copiar `frontend/.env.example` a `frontend/.env`.

```env
VITE_API_URL=http://localhost:3000/api
```

## Levantar en local

1. Instalar dependencias desde la raiz:

```bash
npm run setup
```

2. Crear la base de datos:

```bash
cd backend
npm run db:create
```

3. Ejecutar migraciones:

```bash
cd backend
npm run migration:run
```

4. Ejecutar el seed del admin:

```bash
cd backend
npm run seed
```

Eso crea tambien un token demo para pruebas locales:

- `COPA-BA-001`

5. Levantar backend y frontend:

```bash
npm run dev
```

## Credenciales iniciales

- Email: `admin@copaleyendas.local`
- Password: `copa123`

## Notas

- El caso de uso de inscripcion quedo documentado en [docs/use-cases.md](/F:/FV/dev/copaLeyendas/docs/use-cases.md).
- La ruta publica de inscripcion es `http://localhost:5174/inscripcion` y primero pide token.
- Direccion del Torneo puede marcar tokens con inscripcion bonificada; en ese caso no se pide comprobante.
- El backend guarda comprobantes en `storage/payment-proofs` relativo al directorio de ejecucion del backend solo cuando corresponde.
- El frontend corre en `http://localhost:5174`.
- El setup de producción para DigitalOcean quedó documentado en [deploy/README.md](/F:/FV/dev/copaLeyendas/deploy/README.md).
