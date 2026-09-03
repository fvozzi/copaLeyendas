# Deploy en DigitalOcean

Este setup replica el modelo de Propia:

- Ubuntu en un Droplet
- PostgreSQL local en el mismo servidor
- `nginx` sirviendo la SPA publica y el backoffice
- backend NestJS bajo `systemd`
- deploy continuo por `git push` usando GitHub Actions + SSH
- build de backend/frontend fuera del servidor

## 1. Preparar el Droplet

Entrar como `root` y ejecutar:

```bash
apt update && apt install -y git
git clone git@github.com:fvozzi/copaLeyendas.git /root/copa-leyendas-bootstrap
cd /root/copa-leyendas-bootstrap
chmod +x deploy/server/bootstrap.sh deploy/server/deploy.sh
APP_NAME=copa-leyendas \
APP_USER=copa-leyendas \
REPO_SSH=git@github.com:fvozzi/copaLeyendas.git \
APP_DOMAIN=copaleyendas.tu-dominio.com \
ROOT_DOMAIN=tu-dominio.com \
WWW_DOMAIN=www.tu-dominio.com \
DB_NAME=copa_leyendas \
DB_USER=copa_leyendas \
DB_PASSWORD=cambia-esto \
ENABLE_CERTBOT=false \
./deploy/server/bootstrap.sh
```

Si el repo es privado, el servidor necesita una clave SSH con acceso al repo:

```bash
ssh-keygen -t ed25519 -C "copa-leyendas-server" -f ~/.ssh/id_ed25519_copa_leyendas
cat ~/.ssh/id_ed25519_copa_leyendas.pub
```

Luego agrega esa publica como deploy key en GitHub y confirma que el `git clone` por SSH funciona desde el Droplet.

## 2. Variables de entorno

Editar en el servidor:

```bash
nano /var/www/copa-leyendas/shared/backend/.env
nano /var/www/copa-leyendas/shared/frontend/.env
```

Backend recomendado:

```env
PORT=3000
JWT_SECRET=cambia-esto
JWT_EXPIRES_IN=7d
DB_HOST=localhost
DB_PORT=5432
DB_NAME=copa_leyendas
DB_USER=copa_leyendas
DB_PASSWORD=cambia-esto
DB_SYNCHRONIZE=false
DB_LOGGING=false
SEED_ADMIN_EMAIL=admin@copaleyendas.local
SEED_ADMIN_PASSWORD=cambia-esto
SEED_ADMIN_NAME=Direccion Copa Leyendas
PAYMENT_PROOF_STORAGE_DIR=/var/www/copa-leyendas/shared/payment-proofs
# Carpeta raiz "Copa Leyendas" en Drive. La aplicacion crea carpetas por edicion.
GOOGLE_DRIVE_ROOT_FOLDER_ID=ID_DE_CARPETA
# JSON de cuenta de servicio en una linea, preferentemente codificado base64.
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON=JSON_O_BASE64
```

### Fotos de jugadoras en Google Drive

1. En Google Cloud, crear un proyecto y habilitar **Google Drive API**.
2. Crear una cuenta de servicio y generar una clave JSON.
3. En Drive, dentro de `copaleyendaspaleta@gmail.com`, crear o seleccionar la carpeta raiz `Copa Leyendas` y compartirla como **Editora** con el email de la cuenta de servicio.
4. Copiar el identificador de esa carpeta desde su URL a `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
5. Codificar el JSON en base64 y definirlo en `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`:

```bash
base64 -w 0 cuenta-servicio.json
```

Al recibir una inscripcion, el backend crea una carpeta para el torneo activo, guarda ese ID en la base de datos y crea dentro `Fotos Jugadores`. Luego podran agregarse otras subcarpetas, como `Comprobantes`, sin cambiar la carpeta raiz. Si las dos variables no estan definidas, mantiene el almacenamiento local actual.

Frontend recomendado:

```env
VITE_API_URL=/api
```

## 2.1 DNS recomendado

Si vas a servir todo desde el mismo frontend:

```text
A     @      TU_IP
A     app    TU_IP
CNAME www    @
```

Los nameservers de DigitalOcean son:

```text
ns1.digitalocean.com
ns2.digitalocean.com
ns3.digitalocean.com
```

## 3. Actualizar scripts en el servidor

Antes del primer deploy automatizado, asegura que el repo clonado en el Droplet tenga estos scripts:

```bash
cd /root/copa-leyendas-bootstrap
git pull origin main

cd /var/www/copa-leyendas/app
git pull origin main
chmod +x deploy/server/bootstrap.sh deploy/server/deploy.sh
```

## 4. Seed inicial

Despues del primer deploy de codigo, correr una sola vez:

```bash
cd /var/www/copa-leyendas/app
cp /var/www/copa-leyendas/shared/backend/.env backend/.env
sudo -u copa-leyendas npm --prefix backend run seed
```

Eso crea el usuario director inicial y el contenido semilla.

## 5. Deploy continuo

Hay un workflow en `.github/workflows/deploy.yml`.

Configurar estos secrets en GitHub:

- `DROPLET_HOST=147.182.166.174`
- `DROPLET_PORT=22`
- `DROPLET_USER=root`
- `DROPLET_SSH_KEY` con el contenido completo de `C:\Users\Facundo Vozzi\.ssh\id_ed25519_copa_actions_nopass`
  - puede pegarse como clave multilinea completa (`-----BEGIN ...`)
  - si GitHub te rompe el formato al pegarla, tambien funciona guardarla en base64

Opcionales como repo variables de GitHub Actions:

- `VITE_API_URL`

Valor recomendado hoy:

- `VITE_API_URL=/api`

El usuario del secret debe poder ejecutar:

```bash
sudo RELEASE_ARCHIVE=/tmp/copa-leyendas-release.tgz bash /var/www/copa-leyendas/app/deploy/server/deploy.sh
```

El workflow:

- admite `push` a `main` y disparo manual
- instala dependencias deterministicas con `npm ci`
- reutiliza cache de npm a partir de los `package-lock.json`
- corre lint, tests y build
- empaqueta artefactos Linux listos para deploy
- los sube por `scp`
- ejecuta migraciones productivas en el Droplet
- reinicia backend y recarga `nginx`

## 6. Fallback manual en el servidor

Si necesitas compilar directamente en el servidor:

```bash
sudo FORCE_SERVER_BUILD=true bash /var/www/copa-leyendas/app/deploy/server/deploy.sh
```

## 7. Recomendaciones operativas

- Abrir solo `22`, `80` y `443` en el firewall.
- Habilitar backups del Droplet y de la base PostgreSQL.
- Guardar comprobantes en `shared/payment-proofs`, no dentro del release.
- Mantener `DB_SYNCHRONIZE=false` en produccion.
