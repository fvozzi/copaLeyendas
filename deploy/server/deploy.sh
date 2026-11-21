#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-copa-leyendas}"
APP_USER="${APP_USER:-copa-leyendas}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
APP_DIR="${APP_DIR:-/var/www/$APP_NAME}"
BRANCH="${BRANCH:-main}"
RELEASE_ARCHIVE="${RELEASE_ARCHIVE:-}"
FORCE_SERVER_BUILD="${FORCE_SERVER_BUILD:-false}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root."
  exit 1
fi

install_dependencies() {
  local target_dir="$1"

  if [[ -f "$target_dir/package-lock.json" ]]; then
    sudo -u "$APP_USER" npm --prefix "$target_dir" ci
  else
    sudo -u "$APP_USER" npm --prefix "$target_dir" install
  fi
}

cd "$APP_DIR/app"

install -m 0640 -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/shared/backend/.env" "$APP_DIR/app/backend/.env"
install -m 0640 -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/shared/frontend/.env" "$APP_DIR/app/frontend/.env"
install -d -m 0755 -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/shared/payment-proofs"
install -d -m 0700 -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/shared/backups"

if [[ -n "$RELEASE_ARCHIVE" ]]; then
  if [[ ! -f "$RELEASE_ARCHIVE" ]]; then
    echo "Release archive not found: $RELEASE_ARCHIVE"
    exit 1
  fi

  rm -rf "$APP_DIR/app/backend/dist" "$APP_DIR/app/backend/node_modules" "$APP_DIR/app/frontend/dist"
  tar -xzf "$RELEASE_ARCHIVE" -C "$APP_DIR/app"
  rm -f "$RELEASE_ARCHIVE"
elif [[ "$FORCE_SERVER_BUILD" == "true" ]]; then
  sudo -u "$APP_USER" git fetch origin "$BRANCH"
  sudo -u "$APP_USER" git checkout "$BRANCH"
  sudo -u "$APP_USER" git pull --ff-only origin "$BRANCH"

  install_dependencies "backend"
  install_dependencies "frontend"

  sudo -u "$APP_USER" npm --prefix backend run build
  sudo -u "$APP_USER" npm --prefix frontend run build
else
  echo "No release archive provided."
  echo "Recommended usage:"
  echo "  sudo RELEASE_ARCHIVE=/tmp/copa-leyendas-release.tgz bash $APP_DIR/app/deploy/server/deploy.sh"
  echo "Fallback server build:"
  echo "  sudo FORCE_SERVER_BUILD=true bash $APP_DIR/app/deploy/server/deploy.sh"
  exit 1
fi

chown -R "$APP_USER:$APP_GROUP" \
  "$APP_DIR/app/backend" \
  "$APP_DIR/app/frontend/dist" \
  "$APP_DIR/app/deploy" \
  "$APP_DIR/shared/payment-proofs"

sudo -u "$APP_USER" npm --prefix backend run migration:run:prod

systemctl restart "${APP_NAME}-backend"

# Older installations tried physical directories before the SPA fallback. A
# public asset directory can share a name with a React route (for example
# /torneos/femme-2026/) and Nginx then returns 403 because it has no index file.
# Apply this narrow migration to the active config without regenerating it, so
# any HTTPS directives previously added by Certbot remain untouched.
NGINX_PATH="/etc/nginx/sites-available/${APP_NAME}.conf"
if [[ -f "$NGINX_PATH" ]] && grep -Fq 'try_files $uri $uri/ /index.html;' "$NGINX_PATH"; then
  sed -i 's|try_files $uri $uri/ /index.html;|try_files $uri /index.html;|g' "$NGINX_PATH"
fi
if [[ -f "$NGINX_PATH" ]] && ! grep -Fq 'location ~ ^/torneos/[^/]+/?$' "$NGINX_PATH"; then
  sed -i '/^[[:space:]]*location \/ {/i\  location ~ ^/torneos/[^/]+/?$ {\n    try_files /index.html =404;\n  }\n' "$NGINX_PATH"
fi

nginx -t
systemctl reload nginx

echo "Deploy complete."
